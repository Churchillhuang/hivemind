/**
 * HiveManager - HiveMind System Agent Manager
 *
 * Central management for all system agents:
 * - Orchestrator (routing)
 * - InterfaceAgent (user dialogue)
 * - MemoryAgent (memory retrieval)
 * - MemoryGateway (file I/O coordination)
 * - ReflectionAgent (self-evaluation)
 *
 * This is the main entry point for HiveMind.
 */

import { EventBus, getGlobalEventBus } from './EventBus.js';
import { EventType } from './Event.js';
import type { HiveConfig } from '../hive/HiveConfig.js';
import { Orchestrator } from '../hive/Orchestrator.js';
import { InterfaceAgent } from '../hive/InterfaceAgent.js';
import { MemoryAgent } from '../hive/MemoryAgent.js';
import { ReflectionAgent } from '../hive/ReflectionAgent.js';
import { MemoryGateway } from '../hive/MemoryGateway.js';

export interface HiveManagerOptions {
  hiveConfig: HiveConfig;
  eventBus?: EventBus;
}

export class HiveManager {
  private eventBus: EventBus;
  private hiveConfig: HiveConfig;
  private initialized = false;

  // System Agents
  private orchestrator?: Orchestrator;
  private interfaceAgent?: InterfaceAgent;
  private memoryAgent?: MemoryAgent;
  private memoryGateway?: MemoryGateway;
  private reflectionAgent?: ReflectionAgent;

  constructor(options: HiveManagerOptions) {
    this.hiveConfig = options.hiveConfig;
    this.eventBus = options.eventBus || getGlobalEventBus();
  }

  /**
   * Initialize HiveMind - start all system agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[HiveManager] Already initialized');
      return;
    }

    if (!this.hiveConfig.enabled || this.hiveConfig.mode !== 'multi') {
      console.log('[HiveManager] HiveMind is not enabled or not in multi mode');
      return;
    }

    console.log('[HiveManager] Initializing HiveMind system agents...');

    // Start agents in dependency order:
    // MemoryGateway first (others depend on it)
    // Orchestrator (manages other agents)
    // MemoryAgent
    // InterfaceAgent
    // ReflectionAgent

    try {
      // 1. MemoryGateway - central file I/O
      if (this.hiveConfig.agents.system.memoryGateway.enabled) {
        this.memoryGateway = new MemoryGateway(
          {
            id: 'memory_gateway_001',
            role: 'Memory Gateway',
            description: 'Centralizes all memory file I/O operations to prevent concurrent write conflicts',
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.memoryGateway.start();
        console.log('[HiveManager] MemoryGateway started');
      }

      // 2. Orchestrator - task routing
      if (this.hiveConfig.agents.system.orchestrator.enabled) {
        this.orchestrator = new Orchestrator(
          {
            id: 'orchestrator_001',
            role: 'Orchestrator',
            description: 'Manages task routing and agent lifecycle',
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.orchestrator.start();
        console.log('[HiveManager] Orchestrator started');
      }

      // 3. MemoryAgent - memory retrieval
      if (this.hiveConfig.agents.system.memory.enabled) {
        this.memoryAgent = new MemoryAgent(
          {
            id: 'memory_agent_001',
            role: 'Memory Agent',
            description: 'Retrieves and distributes memory based on tiering system',
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.memoryAgent.start();
        console.log('[HiveManager] MemoryAgent started');
      }

      // 4. InterfaceAgent - user dialogue
      if (this.hiveConfig.agents.system.interface.enabled) {
        this.interfaceAgent = new InterfaceAgent(
          {
            id: 'interface_agent_001',
            role: 'Interface Agent',
            description: 'Primary interface for user dialogue',
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.interfaceAgent.start();
        console.log('[HiveManager] InterfaceAgent started');
      }

      // 5. ReflectionAgent - self-evaluation
      if (this.hiveConfig.agents.system.reflection.enabled) {
        this.reflectionAgent = new ReflectionAgent(
          {
            id: 'reflection_agent_001',
            role: 'Reflection Agent',
            description: 'Self-evaluation and skill learning',
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.reflectionAgent.start();
        console.log('[HiveManager] ReflectionAgent started');
      }

      this.initialized = true;

      // Publish initialization event
      await this.eventBus.publish({
        type: EventType.SYSTEM_START,
        sourceAgent: 'HiveManager',
        payload: {
          agents: {
            orchestrator: this.orchestrator?.isRunning(),
            interface: this.interfaceAgent?.isRunning(),
            memory: this.memoryAgent?.isRunning(),
            memoryGateway: this.memoryGateway?.isRunning(),
            reflection: this.reflectionAgent?.isRunning(),
          },
        },
      });

      console.log('[HiveManager] Initialization complete');

    } catch (error) {
      console.error('[HiveManager] Initialization failed:', error);

      // Cleanup on failure
      await this.shutdown();

      throw error;
    }
  }

  /**
   * Shutdown HiveMind - stop all system agents gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('[HiveManager] Shutting down HiveMind...');

    // Stop in reverse order, using destroy() to ensure proper cleanup
    const stopPromises: Promise<void>[] = [];

    if (this.reflectionAgent) {
      stopPromises.push(this.reflectionAgent.destroy());
    }

    if (this.interfaceAgent) {
      stopPromises.push(this.interfaceAgent.destroy());
    }

    if (this.memoryAgent) {
      stopPromises.push(this.memoryAgent.destroy());
    }

    if (this.orchestrator) {
      stopPromises.push(this.orchestrator.destroy());
    }

    if (this.memoryGateway) {
      stopPromises.push(this.memoryGateway.destroy());
    }

    await Promise.all(stopPromises);

    // Clear agent references
    this.reflectionAgent = undefined;
    this.interfaceAgent = undefined;
    this.memoryAgent = undefined;
    this.orchestrator = undefined;
    this.memoryGateway = undefined;

    this.initialized = false;

    await this.eventBus.publish({
      type: EventType.SYSTEM_STOP,
      sourceAgent: 'HiveManager',
      payload: {},
    });

    console.log('[HiveManager] Shutdown complete');
  }

  /**
   * Get agent instances (for advanced usage)
   */
  getAgents() {
    return {
      orchestrator: this.orchestrator,
      interface: this.interfaceAgent,
      memory: this.memoryAgent,
      memoryGateway: this.memoryGateway,
      reflection: this.reflectionAgent,
    };
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      agents: {
        orchestrator: this.orchestrator?.isRunning() ?? false,
        interface: this.interfaceAgent?.isRunning() ?? false,
        memory: this.memoryAgent?.isRunning() ?? false,
        memoryGateway: this.memoryGateway?.isRunning() ?? false,
        reflection: this.reflectionAgent?.isRunning() ?? false,
      },
      config: this.hiveConfig,
    };
  }

  /**
   * Update configuration (runtime)
   */
  updateConfig(updates: Partial<HiveConfig>): void {
    this.hiveConfig = {
      ...this.hiveConfig,
      ...updates,
    };
    console.log('[HiveManager] Configuration updated:', updates);
  }

  /**
   * Get Hive configuration
   */
  getConfig(): HiveConfig {
    return { ...this.hiveConfig };
  }
}

/**
 * Global instance (for simple usage)
 */
let globalHiveManager: HiveManager | null = null;

export function getGlobalHiveManager(config: HiveConfig): HiveManager {
  if (!globalHiveManager) {
    globalHiveManager = new HiveManager({ hiveConfig: config });
  }
  return globalHiveManager;
}

export function resetGlobalHiveManager(): void {
  if (globalHiveManager) {
    globalHiveManager = null;
  }
}
