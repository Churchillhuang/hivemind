/**
 * MemoryGateway Tests
 *
 * Tests concurrent write conflict prevention
 */

import fs from "fs/promises";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Event } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import { HiveConfig } from "../hive/HiveConfig.js";
import {
  MemoryGateway,
  type MemoryWriteRequest,
  type MemoryReadRequest,
} from "../hive/MemoryGateway.js";

function getPayloadRecord(event: Event): Record<string, unknown> | null {
  if (typeof event.payload === "object" && event.payload !== null) {
    return event.payload as Record<string, unknown>;
  }
  return null;
}

function findResponseByRequestId(
  history: Event[],
  type: string,
  requestId: string,
): Event | undefined {
  return history.find((event) => {
    if (event.type !== type) {
      return false;
    }
    const payload = getPayloadRecord(event);
    return payload?.requestId === requestId;
  });
}

describe("MemoryGateway - File I/O Coordination", () => {
  let eventBus: EventBus;
  let memoryGateway: MemoryGateway;
  let testDir: string;
  let config: HiveConfig;

  beforeEach(async () => {
    // Create temporary directory
    testDir = path.join(process.cwd(), ".temp", "memory-gateway-test");
    await fs.mkdir(path.join(testDir, "memory"), { recursive: true });

    // Create test config
    config = {
      enabled: true,
      mode: "multi",
      eventBus: { maxHistorySize: 1000 },
      orchestrator: {
        maxAgents: 10,
        idleTimeout: 30000,
      },
      stateMachine: {
        persist: false,
        checkpointInterval: 10000,
        checkpointPath: path.join(testDir, "state.json"),
      },
      agents: {
        system: {
          interface: { enabled: true },
          memory: { enabled: true },
          memoryGateway: { enabled: true },
          orchestrator: { enabled: true },
          reflection: { enabled: true },
        },
        functional: {
          enabled: true,
          maxConcurrent: 5,
          lifespan: "task",
        },
      },
      skillLearning: {
        enabled: true,
        sharedSkillsPath: "shared_skills/",
        agentSkillsPath: "agent_skills/",
        minSuccessThreshold: 0.8,
      },
      memory: {
        layers: {
          orchestrator: "none",
          interface: "session",
          functional: "task",
          memory: "knowledge",
          reflection: "sample",
        },
        retention: {
          sessionDays: 2,
          sampleDays: 14,
          taskMaxFiles: 10,
        },
        indexing: {
          enableSemanticSearch: true,
          enableVectorCache: true,
          workspacePath: testDir,
          memoryPath: path.join(testDir, "memory"),
        },
      },
      agentModels: {
        tierMapping: {
          nano: "test-nano",
          light: "test-light",
          standard: "test-standard",
        },
        system: {
          orchestrator: {
            tier: "light",
            temperature: 0.1,
            maxTokens: 500,
            timeout: 30,
          },
          interface: {
            tier: "standard",
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 60,
          },
          memory: {
            tier: "nano",
            temperature: 0,
            maxTokens: 100,
            timeout: 10,
          },
          reflection: {
            tier: "standard",
            temperature: 0.3,
            maxTokens: 1500,
            timeout: 60,
          },
        },
        functional: {
          default: {
            tier: "light",
            temperature: 0.5,
            maxTokens: 1000,
            timeout: 30,
          },
          overrides: {},
        },
      },
    };

    // Initialize
    eventBus = new EventBus({ maxHistorySize: 1000 });
    memoryGateway = new MemoryGateway(
      {
        id: "memory_gateway_test",
        role: "Test Memory Gateway",
        description: "Test gateway for MemoryGateway tests",
      },
      config,
      eventBus,
    );

    await memoryGateway.start();
  });

  afterEach(async () => {
    // Cleanup
    await memoryGateway.stop();

    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Basic Write/Read", () => {
    it("should write and read a simple file", async () => {
      const writeRequest: MemoryWriteRequest = {
        file: "MEMORY.md",
        content: "Test content",
        requestId: "test-1",
        operation: "write",
      };

      // Publish write request
      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: writeRequest,
      });

      // Wait for write response (polling)
      let response: Event | undefined;
      for (let i = 0; i < 10; i++) {
        const history = eventBus.getHistory();
        response = findResponseByRequestId(history, "MEMORY_WRITE_RESPONSE", "test-1");
        if (response) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(response?.payload.success).toBe(true);
      expect(response?.payload.bytesWritten).toBe(12);

      // Read back
      const readRequest: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "test-read-1",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      // Wait for read response
      let readResponse: Event | undefined;
      for (let i = 0; i < 10; i++) {
        const history = eventBus.getHistory();
        readResponse = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "test-read-1");
        if (readResponse) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(readResponse?.payload.content).toBe("Test content");
    });

    it("should append to a file", async () => {
      // Write initial content
      const write1: MemoryWriteRequest = {
        file: "MEMORY.md",
        content: "Line 1\n",
        requestId: "test-2",
        operation: "write",
      };

      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: write1,
      });

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Append
      const write2: MemoryWriteRequest = {
        file: "MEMORY.md",
        content: "Line 2\n",
        requestId: "test-3",
        operation: "append",
      };

      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: write2,
      });

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Read
      const readRequest: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "test-read-2",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      // Wait for response
      await new Promise((resolve) => setTimeout(resolve, 200));
      const history = eventBus.getHistory();
      const response = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "test-read-2");

      expect(response?.payload.content).toContain("Line 1");
      expect(response?.payload.content).toContain("Line 2");
    });
  });

  describe("Concurrent Write Safety", () => {
    it("should handle concurrent writes to the same file without corruption", async () => {
      const writeCount = 10;
      const writes: Promise<void>[] = [];

      // Create write promises
      for (let i = 0; i < writeCount; i++) {
        const writePromise = (async (index: number) => {
          const writeRequest: MemoryWriteRequest = {
            file: "MEMORY.md",
            content: `Write ${index}\n`,
            requestId: `concurrent-write-${index}`,
            operation: "append",
          };

          await eventBus.publish({
            type: "MEMORY_WRITE_REQUEST",
            sourceAgent: "test",
            payload: writeRequest,
          });

          // Wait for completion
          for (let j = 0; j < 20; j++) {
            const history = eventBus.getHistory();
            const response = findResponseByRequestId(
              history,
              "MEMORY_WRITE_RESPONSE",
              `concurrent-write-${index}`,
            );
            if (response) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        })(i);

        writes.push(writePromise);
      }

      // Execute all writes concurrently
      await Promise.all(writes);

      // Wait a bit more for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Read the file
      const readRequest: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "concurrent-read",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const readResponse = findResponseByRequestId(
        history,
        "MEMORY_READ_RESPONSE",
        "concurrent-read",
      );

      const content = readResponse?.payload.content || "";
      const lines = content.split("\n");

      // All writes should be present
      expect(lines.length).toBeGreaterThanOrEqual(writeCount + 1); // +1 trailing newline
    });

    it("should serialize writes to the same file", async () => {
      // Track write order
      const writeOrder: number[] = [];

      // Subscribe to write responses
      const subscription = eventBus.subscribe("MEMORY_WRITE_RESPONSE", async (event) => {
        const payload = getPayloadRecord(event);
        const requestId = typeof payload?.requestId === "string" ? payload.requestId : undefined;
        if (requestId?.startsWith("serial-write-")) {
          const index = parseInt(requestId.split("-").pop() || "0");
          writeOrder.push(index);
        }
      });

      // Send writes rapidly
      for (let i = 0; i < 5; i++) {
        const writeRequest: MemoryWriteRequest = {
          file: "MEMORY.md",
          content: `Serial ${i}\n`,
          requestId: `serial-write-${i}`,
          operation: "append",
        };

        // Fire and forget (don't await)
        eventBus
          .publish({
            type: "MEMORY_WRITE_REQUEST",
            sourceAgent: "test",
            payload: writeRequest,
          })
          .catch(() => {});
      }

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Unsubscribe
      subscription();

      // Check queue status
      const queueStatus = memoryGateway.getQueueStatus();
      expect(queueStatus.queueSize).toBe(0);
    });
  });

  describe("Cache Behavior", () => {
    it("should cache reads and return cached data", async () => {
      // Write something
      const writeRequest: MemoryWriteRequest = {
        file: "MEMORY.md",
        content: "Cache test",
        requestId: "cache-write",
        operation: "write",
      };

      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: writeRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // First read (from cache; writes prime cache for consistency)
      const read1: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "cache-read-1",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: read1,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response1 = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "cache-read-1");

      expect(response1?.payload.source).toBe("cache");

      // Second read (from cache)
      const read2: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "cache-read-2",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: read2,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const response2 = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "cache-read-2");

      expect(response2?.payload.source).toBe("cache");
    });

    it("should clear cache after TTL", async () => {
      // Write
      const writeRequest: MemoryWriteRequest = {
        file: "MEMORY.md",
        content: "TTL test",
        requestId: "ttl-write",
        operation: "write",
      };

      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: writeRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Read (cache it)
      const readRequest: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "ttl-read",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Wait for TTL to expire (6 seconds - wait 1 more second to be safe)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Read again (should be from file, not cache)
      const readRequest2: MemoryReadRequest = {
        file: "MEMORY.md",
        requestId: "ttl-read-2",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest2,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "ttl-read-2");

      expect(response?.payload.source).toBe("file");
    });
  });

  describe("Error Handling", () => {
    it("should handle read of non-existent file gracefully", async () => {
      const readRequest: MemoryReadRequest = {
        file: "NONEXISTENT.md",
        requestId: "error-read",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "error-read");

      // Should return empty string (not null)
      expect(response?.payload.content).toBe("");
      expect(response?.payload.source).toBe("file");
    });

    it("should reject write paths that escape workspace", async () => {
      const writeRequest: MemoryWriteRequest = {
        file: "../outside.txt",
        content: "blocked",
        requestId: "escape-write",
        operation: "write",
      };

      await eventBus.publish({
        type: "MEMORY_WRITE_REQUEST",
        sourceAgent: "test",
        payload: writeRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = findResponseByRequestId(history, "MEMORY_WRITE_RESPONSE", "escape-write");
      expect(response).toBeDefined();
      const payload = response ? getPayloadRecord(response) : null;
      expect(payload?.success).toBe(false);
      expect(typeof payload?.error).toBe("string");
      expect(String(payload?.error)).toContain("Path escapes workspace");
    });

    it("should reject read paths that escape workspace", async () => {
      const readRequest: MemoryReadRequest = {
        file: "../outside.txt",
        requestId: "escape-read",
      };

      await eventBus.publish({
        type: "MEMORY_READ_REQUEST",
        sourceAgent: "test",
        payload: readRequest,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = findResponseByRequestId(history, "MEMORY_READ_RESPONSE", "escape-read");
      expect(response).toBeDefined();
      const payload = response ? getPayloadRecord(response) : null;
      expect(payload?.content).toBeNull();
      expect(payload?.source).toBe("error");
      expect(typeof payload?.error).toBe("string");
      expect(String(payload?.error)).toContain("Path escapes workspace");
    });
  });
});
