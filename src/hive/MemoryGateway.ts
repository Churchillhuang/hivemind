/**
 * MemoryGateway - Memory File I/O Coordinator
 *
 * Centralizes all memory file write operations through the EventBus.
 * Prevents concurrent write conflicts by serializing requests.
 *
 * Key features:
 * - Write queue: Serializes all write operations
 * - Read cache: Guarantees consistent reads (includes pending writes)
 * - Atomic writes: Writes to temp file + atomic rename
 * - Error handling: Retries failed writes with exponential backoff
 */

import { promises as fs } from "fs";
import { randomUUID } from "node:crypto";
import path from "path";
import { BaseAgent } from "../core/Agent.js";
import { Event, EventType } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "../hive/HiveConfig.js";

/**
 * MemoryWriteRequest - Write request payload
 */
export interface MemoryWriteRequest {
  file: string; // Relative path from workspace root (e.g. "MEMORY.md", "IDENTITY.md")
  content: string;
  requestId: string;
  operation: "write" | "append";
  options?: {
    atomic?: boolean; // Use atomic write (default: true)
    retry?: number; // Retry count (default: 3)
  };
}

/**
 * MemoryWriteResponse - Write response
 */
export interface MemoryWriteResponse {
  requestId: string;
  file: string;
  success: boolean;
  error?: string;
  bytesWritten: number;
  writeTimeMs: number;
}

/**
 * MemoryReadRequest - Read request payload
 */
export interface MemoryReadRequest {
  file: string;
  requestId: string;
  options?: {
    fromLine?: number;
    toLine?: number;
  };
}

/**
 * MemoryReadResponse - Read response
 */
export interface MemoryReadResponse {
  requestId: string;
  file: string;
  content: string | null;
  error?: string;
  source: "cache" | "file" | "error";
}

/**
 * Pending write in queue
 */
interface QueuedWrite {
  request: MemoryWriteRequest;
  timestamp: number;
  reject: (reason: unknown) => void;
  resolve: (value: MemoryWriteResponse) => void;
}

export class MemoryGateway extends BaseAgent {
  private hiveConfig: HiveConfig;
  private writeQueue: Map<string, QueuedWrite> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private readCache: Map<string, { content: string; timestamp: number }> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  // Cache expiration (5 seconds)
  private readonly CACHE_TTL = 5000;
  // Cleanup interval (60 seconds)
  private readonly CLEANUP_INTERVAL = 60000;
  // Max retries for failed writes
  private readonly MAX_RETRIES = 3;
  // Retry delay (exponential backoff base)
  private readonly RETRY_DELAY_BASE = 100;

  private resolveWorkspacePath(file: string): string {
    const workspacePath = this.hiveConfig.memory?.indexing.workspacePath || "";
    if (!workspacePath) {
      throw new Error("Memory workspace path is not configured");
    }

    const workspaceRoot = path.resolve(workspacePath);
    const fullPath = path.resolve(workspaceRoot, file);
    const relative = path.relative(workspaceRoot, fullPath);
    const escapesWorkspace =
      relative.startsWith("..") || path.isAbsolute(relative) || relative.includes("\0");

    if (escapesWorkspace) {
      throw new Error(`Path escapes workspace: ${file}`);
    }

    return fullPath;
  }

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super(
      {
        id: config.id,
        role: config.role,
        type: "system",
        description: config.description,
      },
      eventBus,
    );

    this.hiveConfig = hiveConfig;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Subscribe to memory events
    this.subscribeTo("MEMORY_WRITE_REQUEST");
    this.subscribeTo("MEMORY_READ_REQUEST");

    // Start periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.CLEANUP_INTERVAL);

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        cacheSize: this.readCache.size,
        queueSize: 0,
      },
    });

    console.log(`[MemoryGateway ${this.id}] Started`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop periodic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Process remaining writes before stopping
    await this.flushQueue();

    await this.eventBus?.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });

    console.log(`[MemoryGateway ${this.id}] Stopped`);
  }

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case "MEMORY_WRITE_REQUEST":
        await this.handleWriteRequest(event);
        break;

      case "MEMORY_READ_REQUEST":
        await this.handleReadRequest(event);
        break;

      default:
        console.warn(`[MemoryGateway ${this.id}] Unknown event type: ${event.type}`);
    }
  }

  /**
   * Handle write request
   */
  private async handleWriteRequest(event: Event): Promise<void> {
    const request = event.payload as MemoryWriteRequest;

    console.log(
      `[MemoryGateway ${this.id}] Write request: ${request.file} (${request.content.length} bytes)`,
    );

    try {
      // Queue the write
      const promise = this.queueWrite(request);

      // Wait for it to complete
      const response = await promise;

      // Publish result
      await this.eventBus?.publish({
        type: "MEMORY_WRITE_RESPONSE",
        sourceAgent: this.id,
        payload: response,
      });

      // Notify about memory update
      await this.eventBus?.publish({
        type: EventType.MEMORY_UPDATE,
        sourceAgent: this.id,
        payload: {
          file: request.file,
          operation: request.operation,
          bytesWritten: response.bytesWritten,
        },
      });

      console.log(
        `[MemoryGateway ${this.id}] Write completed: ${request.file} (${response.bytesWritten} bytes)`,
      );
    } catch (error) {
      console.error(`[MemoryGateway ${this.id}] Write failed: ${request.file}`, error);

      await this.eventBus?.publish({
        type: "MEMORY_WRITE_RESPONSE",
        sourceAgent: this.id,
        payload: {
          requestId: request.requestId,
          file: request.file,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          bytesWritten: 0,
          writeTimeMs: 0,
        },
      });
    }
  }

  /**
   * Queue a write operation and return a promise
   */
  private queueWrite(request: MemoryWriteRequest): Promise<MemoryWriteResponse> {
    // Check if file is already being processed
    if (this.isProcessing.get(request.file)) {
      // Wait for current write to complete, then re-queue
      return new Promise((resolve, reject) => {
        this.writeQueue.set(request.requestId, {
          request,
          timestamp: Date.now(),
          resolve,
          reject,
        });
      });
    }

    // Process immediately
    return this.processWrite(request);
  }

  /**
   * Process a write operation with retry logic
   */
  private async processWrite(request: MemoryWriteRequest): Promise<MemoryWriteResponse> {
    const startTime = Date.now();

    // Mark file as processing
    this.isProcessing.set(request.file, true);

    try {
      const retryCount = request.options?.retry ?? this.MAX_RETRIES;
      const atomic = request.options?.atomic ?? true;

      // Try write with retries
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          if (atomic) {
            await this.atomicWrite(request.file, request.content, request.operation);
          } else {
            await this.directWrite(request.file, request.content, request.operation);
          }

          // Update cache
          this.readCache.set(request.file, {
            content: await this.readFileDirect(request.file),
            timestamp: Date.now(),
          });

          const writeTimeMs = Date.now() - startTime;

          return {
            requestId: request.requestId,
            file: request.file,
            success: true,
            bytesWritten: request.content.length,
            writeTimeMs,
          };
        } catch (error) {
          if (attempt === retryCount) {
            throw error;
          }

          // Exponential backoff
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.warn(
            `[MemoryGateway ${this.id}] Write attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Should not reach here
      throw new Error("Write failed after retries");
    } finally {
      // Mark file as not processing
      this.isProcessing.set(request.file, false);

      // Process next write for this file
      this.processNextWrite(request.file);
    }
  }

  /**
   * Process next write in queue for a file
   */
  private processNextWrite(file: string): void {
    // Find the next write for this file
    for (const [requestId, queued] of this.writeQueue.entries()) {
      if (queued.request.file === file) {
        this.writeQueue.delete(requestId);

        // Process it
        this.processWrite(queued.request).then(queued.resolve).catch(queued.reject);

        return;
      }
    }
  }

  /**
   * Atomic write: write to temp file + rename
   */
  private async atomicWrite(
    file: string,
    content: string,
    operation: "write" | "append",
  ): Promise<void> {
    const fullPath = this.resolveWorkspacePath(file);

    if (operation === "append") {
      // For append, read existing, append, then atomic write
      const existing = await this.readFileDirect(file);
      content = existing + content;
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write to temp file
    const tmpFile = `${fullPath}.tmp.${Date.now()}.${randomUUID()}`;
    await fs.writeFile(tmpFile, content, "utf-8");

    // Atomic rename
    await fs.rename(tmpFile, fullPath);

    console.log(`[MemoryGateway ${this.id}] Atomic write: ${file}`);
  }

  /**
   * Direct write (without atomic rename)
   */
  private async directWrite(
    file: string,
    content: string,
    operation: "write" | "append",
  ): Promise<void> {
    const fullPath = this.resolveWorkspacePath(file);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    if (operation === "append") {
      await fs.appendFile(fullPath, content, "utf-8");
    } else {
      await fs.writeFile(fullPath, content, "utf-8");
    }

    console.log(`[MemoryGateway ${this.id}] Direct write: ${file}`);
  }

  /**
   * Read file directly (no cache)
   */
  private async readFileDirect(file: string): Promise<string> {
    const fullPath = this.resolveWorkspacePath(file);

    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return ""; // File doesn't exist, return empty string
      }
      throw error;
    }
  }

  /**
   * Handle read request
   */
  private async handleReadRequest(event: Event): Promise<void> {
    const request = event.payload as MemoryReadRequest;

    console.log(`[MemoryGateway ${this.id}] Read request: ${request.file}`);

    try {
      let content: string | null = null;
      let source: "cache" | "file" | "error" = "error";

      // Check cache first
      try {
        const cached = this.readCache.get(request.file);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          content = cached.content;
          source = "cache";
          console.log(`[MemoryGateway ${this.id}] Cache hit: ${request.file}`);
        }
      } catch {}

      // Cache miss, read from file
      if (content === null) {
        content = await this.readFileDirect(request.file);
        source = "file";

        // Update cache
        this.readCache.set(request.file, {
          content: content,
          timestamp: Date.now(),
        });
      }

      // Extract lines if requested
      if (request.options?.fromLine !== undefined) {
        const lines = content.split("\n");
        const from = request.options.fromLine;
        const to = request.options.toLine ?? lines.length;
        content = lines.slice(from, to).join("\n");
      }

      const response: MemoryReadResponse = {
        requestId: request.requestId,
        file: request.file,
        content,
        source,
      };

      await this.eventBus?.publish({
        type: "MEMORY_READ_RESPONSE",
        sourceAgent: this.id,
        payload: response,
      });
    } catch (error) {
      console.error(`[MemoryGateway ${this.id}] Read failed: ${request.file}`, error);

      await this.eventBus?.publish({
        type: "MEMORY_READ_RESPONSE",
        sourceAgent: this.id,
        payload: {
          requestId: request.requestId,
          file: request.file,
          content: null,
          error: error instanceof Error ? error.message : String(error),
          source: "error",
        },
      });
    }
  }

  /**
   * Flush all pending writes
   */
  private async flushQueue(): Promise<void> {
    const isAnyWriteInFlight = () => Array.from(this.isProcessing.values()).some(Boolean);

    while (this.writeQueue.size > 0 || isAnyWriteInFlight()) {
      if (this.writeQueue.size === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }

      const next = this.writeQueue.entries().next().value;
      if (!next) {
        continue;
      }

      const [requestId, queued] = next;
      this.writeQueue.delete(requestId);

      try {
        const response = await this.queueWrite(queued.request);
        queued.resolve(response);
      } catch (error) {
        queued.reject(error);
      }
    }
  }

  /**
   * Clear read cache
   */
  clearCache(file?: string): void {
    if (file) {
      this.readCache.delete(file);
    } else {
      this.readCache.clear();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.readCache.entries()) {
      // Remove entries older than 2x TTL (stale cache)
      if (now - value.timestamp > this.CACHE_TTL * 2) {
        this.readCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[MemoryGateway ${this.id}] Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { queueSize: number; processing: Set<string> } {
    return {
      queueSize: this.writeQueue.size,
      processing: new Set(
        this.isProcessing
          .entries()
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    };
  }
}
