import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../events/EventBus.js';
import { DEFAULT_HIVE_CONFIG } from '../hive/HiveConfig.js';
import { HiveManager } from '../hive/HiveManager.js';

const orchestratorStart = vi.fn(async () => {});
const orchestratorDestroy = vi.fn(async () => {});
const interfaceStart = vi.fn(async () => {});
const interfaceDestroy = vi.fn(async () => {});
const memoryStart = vi.fn(async () => {});
const memoryDestroy = vi.fn(async () => {});
const memoryGatewayStart = vi.fn(async () => {});
const memoryGatewayDestroy = vi.fn(async () => {});
const reflectionStart = vi.fn(async () => {});
const reflectionDestroy = vi.fn(async () => {});
const bridgeInitialize = vi.fn(async () => {});
const bridgeShutdown = vi.fn(async () => {});
const bridgeConstructArgs: unknown[] = [];

vi.mock('../hive/Orchestrator.js', () => ({
  Orchestrator: class {
    private running = false;

    async start(): Promise<void> {
      this.running = true;
      await orchestratorStart();
    }

    async destroy(): Promise<void> {
      this.running = false;
      await orchestratorDestroy();
    }

    isRunning(): boolean {
      return this.running;
    }
  },
}));

vi.mock('../hive/InterfaceAgent.js', () => ({
  InterfaceAgent: class {
    public id = 'interface_agent_001';
    private running = false;

    async start(): Promise<void> {
      this.running = true;
      await interfaceStart();
    }

    async destroy(): Promise<void> {
      this.running = false;
      await interfaceDestroy();
    }

    isRunning(): boolean {
      return this.running;
    }
  },
}));

vi.mock('../hive/MemoryAgent.js', () => ({
  MemoryAgent: class {
    private running = false;

    async start(): Promise<void> {
      this.running = true;
      await memoryStart();
    }

    async destroy(): Promise<void> {
      this.running = false;
      await memoryDestroy();
    }

    isRunning(): boolean {
      return this.running;
    }
  },
}));

vi.mock('../hive/MemoryGateway.js', () => ({
  MemoryGateway: class {
    private running = false;

    async start(): Promise<void> {
      this.running = true;
      await memoryGatewayStart();
    }

    async destroy(): Promise<void> {
      this.running = false;
      await memoryGatewayDestroy();
    }

    isRunning(): boolean {
      return this.running;
    }
  },
}));

vi.mock('../hive/ReflectionAgent.js', () => ({
  ReflectionAgent: class {
    private running = false;

    async start(): Promise<void> {
      this.running = true;
      await reflectionStart();
    }

    async destroy(): Promise<void> {
      this.running = false;
      await reflectionDestroy();
    }

    isRunning(): boolean {
      return this.running;
    }
  },
}));

vi.mock('../hive/HiveGatewayBridge.js', () => ({
  HiveGatewayBridge: class {
    private initialized = false;

    constructor(options: unknown) {
      bridgeConstructArgs.push(options);
    }

    async initialize(): Promise<void> {
      this.initialized = true;
      await bridgeInitialize();
    }

    async shutdown(): Promise<void> {
      this.initialized = false;
      await bridgeShutdown();
    }

    getStatus(): { initialized: boolean } {
      return {
        initialized: this.initialized,
      };
    }
  },
}));

function createHiveConfig() {
  const config = structuredClone(DEFAULT_HIVE_CONFIG);
  config.enabled = true;
  config.mode = 'multi';
  return config;
}

describe('HiveManager GatewayBridge lifecycle', () => {
  beforeEach(() => {
    orchestratorStart.mockClear();
    orchestratorDestroy.mockClear();
    interfaceStart.mockClear();
    interfaceDestroy.mockClear();
    memoryStart.mockClear();
    memoryDestroy.mockClear();
    memoryGatewayStart.mockClear();
    memoryGatewayDestroy.mockClear();
    reflectionStart.mockClear();
    reflectionDestroy.mockClear();
    bridgeInitialize.mockClear();
    bridgeShutdown.mockClear();
    bridgeConstructArgs.length = 0;
  });

  it('creates and initializes bridge once, reusing manager-owned interface agent', async () => {
    const manager = new HiveManager({
      hiveConfig: createHiveConfig(),
      eventBus: new EventBus({ maxHistorySize: 100 }),
    });

    await manager.initialize();
    const first = await manager.ensureGatewayBridge();
    const second = await manager.ensureGatewayBridge();

    expect(first).toBe(second);
    expect(bridgeConstructArgs).toHaveLength(1);
    expect(bridgeInitialize).toHaveBeenCalledTimes(1);

    const bridgeOptions = bridgeConstructArgs[0] as {
      interfaceAgent?: unknown;
      eventBus?: unknown;
      hiveConfig?: unknown;
    };
    expect(bridgeOptions.interfaceAgent).toBeDefined();
    expect(bridgeOptions.eventBus).toBeDefined();
    expect(bridgeOptions.hiveConfig).toBeDefined();
  });

  it('shuts down bridge during manager shutdown when bridge was initialized', async () => {
    const manager = new HiveManager({
      hiveConfig: createHiveConfig(),
      eventBus: new EventBus({ maxHistorySize: 100 }),
    });

    await manager.initialize();
    await manager.ensureGatewayBridge();
    await manager.shutdown();

    expect(bridgeShutdown).toHaveBeenCalledTimes(1);
    expect(interfaceDestroy).toHaveBeenCalledTimes(1);
  });
});
