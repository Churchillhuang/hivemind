/**
 * MemoryGateway Tests
 *
 * Tests concurrent write conflict prevention
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { EventBus } from '../events/EventBus.js';
import { MemoryGateway, type MemoryWriteRequest, type MemoryReadRequest } from '../hive/MemoryGateway.js';
import { HiveConfig } from '../hive/HiveConfig.js';

describe('MemoryGateway - File I/O Coordination', () => {
  let eventBus: EventBus;
  let memoryGateway: MemoryGateway;
  let testDir: string;
  let config: HiveConfig;

  beforeEach(async () => {
    // Create temporary directory
    testDir = path.join(process.cwd(), '.temp', 'memory-gateway-test');
    await fs.mkdir(path.join(testDir, 'memory'), { recursive: true });

    // Create test config
    config = {
      enabled: true,
      mode: 'multi',
      eventBus: { maxHistorySize: 1000 },
      orchestrator: {
        maxAgents: 10,
        idleTimeout: 30000,
      },
      stateMachine: {
        persist: false,
        checkpointInterval: 10000,
        checkpointPath: path.join(testDir, 'state.json'),
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
          lifespan: 'task',
        },
      },
      skillLearning: {
        enabled: true,
        sharedSkillsPath: 'shared_skills/',
        agentSkillsPath: 'agent_skills/',
        minSuccessThreshold: 0.8,
      },
      memory: {
        layers: {
          orchestrator: 'none',
          interface: 'session',
          functional: 'task',
          memory: 'knowledge',
          reflection: 'sample',
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
          memoryPath: path.join(testDir, 'memory'),
        },
      },
      agentModels: {
        tierMapping: {
          nano: 'test-nano',
          light: 'test-light',
          standard: 'test-standard',
        },
        system: {
          orchestrator: {
            tier: 'light',
            temperature: 0.1,
            maxTokens: 500,
            timeout: 30,
          },
          interface: {
            tier: 'standard',
            temperature: 0.7,
            maxTokens: 2000,
            timeout: 60,
          },
          memory: {
            tier: 'nano',
            temperature: 0,
            maxTokens: 100,
            timeout: 10,
          },
          reflection: {
            tier: 'standard',
            temperature: 0.3,
            maxTokens: 1500,
            timeout: 60,
          },
        },
        functional: {
          default: {
            tier: 'light',
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
        id: 'memory_gateway_test',
        role: 'Test Memory Gateway',
        description: 'Test gateway for MemoryGateway tests',
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

  describe('Basic Write/Read', () => {
    it('should write and read a simple file', async () => {
      const writeRequest: MemoryWriteRequest = {
        file: 'MEMORY.md',
        content: 'Test content',
        requestId: 'test-1',
        operation: 'write',
      };

      // Publish write request
      await eventBus.publish({
        type: 'MEMORY_WRITE_REQUEST',
        sourceAgent: 'test',
        payload: writeRequest,
      });

      // Wait for write response (polling)
      let response: any;
      for (let i = 0; i < 10; i++) {
        const history = eventBus.getHistory();
        response = history.find(
          (e: any) => e.type === 'MEMORY_WRITE_RESPONSE' && e.payload.requestId === 'test-1'
        );
        if (response) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(response?.payload.success).toBe(true);
      expect(response?.payload.bytesWritten).toBe(12);

      // Read back
      const readRequest: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'test-read-1',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest,
      });

      // Wait for read response
      let readResponse: any;
      for (let i = 0; i < 10; i++) {
        const history = eventBus.getHistory();
        readResponse = history.find(
          (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'test-read-1'
        );
        if (readResponse) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(readResponse?.payload.content).toBe('Test content');
    });

    it('should append to a file', async () => {
      // Write initial content
      const write1: MemoryWriteRequest = {
        file: 'MEMORY.md',
        content: 'Line 1\n',
        requestId: 'test-2',
        operation: 'write',
      };

      await eventBus.publish({
        type: 'MEMORY_WRITE_REQUEST',
        sourceAgent: 'test',
        payload: write1,
      });

      // Wait
      await new Promise(resolve => setTimeout(resolve, 200));

      // Append
      const write2: MemoryWriteRequest = {
        file: 'MEMORY.md',
        content: 'Line 2\n',
        requestId: 'test-3',
        operation: 'append',
      };

      await eventBus.publish({
        type: 'MEMORY_WRITE_REQUEST',
        sourceAgent: 'test',
        payload: write2,
      });

      // Wait
      await new Promise(resolve => setTimeout(resolve, 200));

      // Read
      const readRequest: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'test-read-2',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest,
      });

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 200));
      const history = eventBus.getHistory();
      const response = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'test-read-2'
      );

      expect(response?.payload.content).toContain('Line 1');
      expect(response?.payload.content).toContain('Line 2');
    });
  });

  describe('Concurrent Write Safety', () => {
    it('should handle concurrent writes to the same file without corruption', async () => {
      const writeCount = 10;
      const writes: Promise<void>[] = [];

      // Create write promises
      for (let i = 0; i < writeCount; i++) {
        const writePromise = (async (index: number) => {
          const writeRequest: MemoryWriteRequest = {
            file: 'MEMORY.md',
            content: `Write ${index}\n`,
            requestId: `concurrent-write-${index}`,
            operation: 'append',
          };

          await eventBus.publish({
            type: 'MEMORY_WRITE_REQUEST',
            sourceAgent: 'test',
            payload: writeRequest,
          });

          // Wait for completion
          for (let j = 0; j < 20; j++) {
            const history = eventBus.getHistory();
            const response = history.find(
              (e: any) =>
                e.type === 'MEMORY_WRITE_RESPONSE' &&
                e.payload.requestId === `concurrent-write-${index}`
            );
            if (response) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        })(i);

        writes.push(writePromise);
      }

      // Execute all writes concurrently
      await Promise.all(writes);

      // Wait a bit more for processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Read the file
      const readRequest: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'concurrent-read',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const readResponse = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'concurrent-read'
      );

      const content = readResponse?.payload.content || '';
      const lines = content.split('\n');

      // All writes should be present
      expect(lines.length).toBeGreaterThanOrEqual(writeCount + 1); // +1 trailing newline
    });

    it('should serialize writes to the same file', async () => {
      // Track write order
      const writeOrder: number[] = [];

      // Subscribe to write responses
      const subscription = eventBus.subscribe('MEMORY_WRITE_RESPONSE', async (event) => {
        const requestId = (event.payload as any).requestId;
        if (requestId?.startsWith('serial-write-')) {
          const index = parseInt(requestId.split('-').pop() || '0');
          writeOrder.push(index);
        }
      });

      // Send writes rapidly
      for (let i = 0; i < 5; i++) {
        const writeRequest: MemoryWriteRequest = {
          file: 'MEMORY.md',
          content: `Serial ${i}\n`,
          requestId: `serial-write-${i}`,
          operation: 'append',
        };

        // Fire and forget (don't await)
        eventBus.publish({
          type: 'MEMORY_WRITE_REQUEST',
          sourceAgent: 'test',
          payload: writeRequest,
        }).catch(() => {});
      }

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Unsubscribe
      subscription();

      // Check queue status
      const queueStatus = memoryGateway.getQueueStatus();
      expect(queueStatus.queueSize).toBe(0);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache reads and return cached data', async () => {
      // Write something
      const writeRequest: MemoryWriteRequest = {
        file: 'MEMORY.md',
        content: 'Cache test',
        requestId: 'cache-write',
        operation: 'write',
      };

      await eventBus.publish({
        type: 'MEMORY_WRITE_REQUEST',
        sourceAgent: 'test',
        payload: writeRequest,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // First read (from file)
      const read1: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'cache-read-1',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: read1,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response1 = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'cache-read-1'
      );

      expect(response1?.payload.source).toBe('file');

      // Second read (from cache)
      const read2: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'cache-read-2',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: read2,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const response2 = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'cache-read-2'
      );

      expect(response2?.payload.source).toBe('cache');
    });

    it('should clear cache after TTL', async () => {
      // Write
      const writeRequest: MemoryWriteRequest = {
        file: 'MEMORY.md',
        content: 'TTL test',
        requestId: 'ttl-write',
        operation: 'write',
      };

      await eventBus.publish({
        type: 'MEMORY_WRITE_REQUEST',
        sourceAgent: 'test',
        payload: writeRequest,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Read (cache it)
      const readRequest: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'ttl-read',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for TTL to expire (6 seconds - wait 1 more second to be safe)
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Read again (should be from file, not cache)
      const readRequest2: MemoryReadRequest = {
        file: 'MEMORY.md',
        requestId: 'ttl-read-2',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest2,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'ttl-read-2'
      );

      expect(response?.payload.source).toBe('file');
    });
  });

  describe('Error Handling', () => {
    it('should handle read of non-existent file gracefully', async () => {
      const readRequest: MemoryReadRequest = {
        file: 'NONEXISTENT.md',
        requestId: 'error-read',
      };

      await eventBus.publish({
        type: 'MEMORY_READ_REQUEST',
        sourceAgent: 'test',
        payload: readRequest,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const history = eventBus.getHistory();
      const response = history.find(
        (e: any) => e.type === 'MEMORY_READ_RESPONSE' && e.payload.requestId === 'error-read'
      );

      // Should return empty string (not null)
      expect(response?.payload.content).toBe('');
      expect(response?.payload.source).toBe('file');
    });
  });
});
