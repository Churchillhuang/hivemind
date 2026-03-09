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

import path from "node:path";
import { EventType } from "../events/Event.js";
import { EventBus, getGlobalEventBus } from "../events/EventBus.js";
import { AgentFactory } from "../hive/AgentFactory.js";
import { AnalysisEngine } from "../hive/AnalysisEngine.js";
import { AutonomousTuner } from "../hive/AutonomousTuner.js";
import { CollaborationAnalyzer } from "../hive/CollaborationAnalyzer.js";
import { ContinuityAnalyzer } from "../hive/ContinuityAnalyzer.js";
import { EmergenceMonitor } from "../hive/EmergenceMonitor.js";
import { GatewayIntegrator } from "../hive/GatewayIntegrator.js";
import { GlobalStateMachine } from "../hive/GlobalStateMachine.js";
import type { HiveConfig } from "../hive/HiveConfig.js";
import { HiveGatewayBridge } from "../hive/HiveGatewayBridge.js";
import { InterfaceAgent } from "../hive/InterfaceAgent.js";
import { MemoryAgent } from "../hive/MemoryAgent.js";
import { MemoryEnhancement } from "../hive/MemoryEnhancement.js";
import { MemoryGateway } from "../hive/MemoryGateway.js";
import { MetricsTracker } from "../hive/MetricsTracker.js";
import { Orchestrator } from "../hive/Orchestrator.js";
import { ReflectionAgent } from "../hive/ReflectionAgent.js";
import { SimpleOrchestrator } from "../hive/SimpleOrchestrator.js";

export interface HiveManagerOptions {
  hiveConfig: HiveConfig;
  eventBus?: EventBus;
}

export class HiveManager {
  private eventBus: EventBus;
  private hiveConfig: HiveConfig;
  private initialized = false;

  // System Agents
  private orchestrator?: Orchestrator | SimpleOrchestrator;
  private interfaceAgent?: InterfaceAgent;
  private memoryAgent?: MemoryAgent;
  private memoryGateway?: MemoryGateway;
  private reflectionAgent?: ReflectionAgent;
  private agentFactory?: AgentFactory;
  private gatewayBridge?: HiveGatewayBridge;
  private stateMachine?: GlobalStateMachine;

  // Gateway Integration
  private gatewayIntegrator?: GatewayIntegrator;

  // Observation Components
  private emergenceMonitor?: EmergenceMonitor;
  private collaborationAnalyzer?: CollaborationAnalyzer;
  private continuityAnalyzer?: ContinuityAnalyzer;
  private analysisEngine?: AnalysisEngine;
  private autonomousTuner?: AutonomousTuner;
  private metricsTracker?: MetricsTracker;
  private memoryEnhancement?: MemoryEnhancement;

  constructor(options: HiveManagerOptions) {
    this.hiveConfig = options.hiveConfig;
    this.eventBus = options.eventBus || getGlobalEventBus();
  }

  /**
   * Initialize HiveMind - start all system agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[HiveManager] Already initialized");
      return;
    }

    if (!this.hiveConfig.enabled || this.hiveConfig.mode !== "multi") {
      console.log("[HiveManager] HiveMind is not enabled or not in multi mode");
      return;
    }

    console.log("[HiveManager] Initializing HiveMind system agents...");

    // Start agents in dependency order:
    // MemoryGateway first (others depend on it)
    // Orchestrator (manages other agents)
    // MemoryAgent
    // InterfaceAgent
    // ReflectionAgent

    try {
      const checkpointPath = this.resolveStateMachineCheckpointDir();
      this.stateMachine = new GlobalStateMachine(
        {
          enablePersistence: this.hiveConfig.stateMachine.persist,
          checkpointPath,
          checkpointInterval: this.hiveConfig.stateMachine.checkpointInterval,
        },
        this.hiveConfig,
        this.eventBus,
      );
      await this.stateMachine.start();
      await this.stateMachine.transition("processing", "hive_manager_initialize", "HiveManager");

      // 1. MemoryGateway - central file I/O
      if (this.hiveConfig.agents.system.memoryGateway.enabled) {
        this.memoryGateway = new MemoryGateway(
          {
            id: "memory_gateway_001",
            role: "Memory Gateway",
            description:
              "Centralizes all memory file I/O operations to prevent concurrent write conflicts",
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.memoryGateway.start();
        console.log("[HiveManager] MemoryGateway started");
      }

      // 2. Orchestrator - task routing
      if (this.hiveConfig.agents.system.orchestrator.enabled) {
        // 根据配置选择 Orchestrator 模式
        const orchestratorMode = this.hiveConfig.orchestrator.mode || "full";

        if (orchestratorMode === "simple") {
          this.orchestrator = new SimpleOrchestrator(
            {
              id: "orchestrator_001",
              role: "Simple Orchestrator",
              description: "Simplified task routing (direct + negotiation)",
            },
            this.hiveConfig,
            this.eventBus,
          );
          console.log("[HiveManager] Using SimpleOrchestrator");
        } else {
          this.orchestrator = new Orchestrator(
            {
              id: "orchestrator_001",
              role: "Orchestrator",
              description: "Manages task routing and agent lifecycle",
            },
            this.hiveConfig,
            this.eventBus,
          );
          console.log("[HiveManager] Using full Orchestrator");
        }
        await this.orchestrator.start();
        console.log("[HiveManager] Orchestrator started");
      }

      // 3. MemoryAgent - memory retrieval
      if (this.hiveConfig.agents.system.memory.enabled) {
        this.memoryAgent = new MemoryAgent(
          {
            id: "memory_agent_001",
            role: "Memory Agent",
            description: "Retrieves and distributes memory based on tiering system",
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.memoryAgent.start();
        console.log("[HiveManager] MemoryAgent started");
      }

      // 4. InterfaceAgent - user dialogue
      if (this.hiveConfig.agents.system.interface.enabled) {
        this.interfaceAgent = new InterfaceAgent(
          {
            id: "interface_agent_001",
            role: "Interface Agent",
            description: "Primary interface for user dialogue",
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.interfaceAgent.start();
        console.log("[HiveManager] InterfaceAgent started");
      }

      // 5. ReflectionAgent - self-evaluation
      if (this.hiveConfig.agents.system.reflection.enabled) {
        this.reflectionAgent = new ReflectionAgent(
          {
            id: "reflection_agent_001",
            role: "Reflection Agent",
            description: "Self-evaluation and skill learning",
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.reflectionAgent.start();
        console.log("[HiveManager] ReflectionAgent started");
      }

      // 6. AgentFactory - dynamic functional agent lifecycle
      if (this.hiveConfig.agents.functional.enabled) {
        this.agentFactory = new AgentFactory(
          {
            id: "agent_factory_001",
            role: "Agent Factory",
            description: "Dynamically creates and manages functional agents",
          },
          this.hiveConfig,
          this.eventBus,
        );
        await this.agentFactory.start();
        console.log("[HiveManager] AgentFactory started");
      }

      // 7. Gateway Integration - connect to OpenClaw Gateway
      if (this.hiveConfig.gateway.enabled && this.hiveConfig.gateway.autoConnect) {
        await this.initializeGateway();
      }

      // 8. Observation Components - start monitoring and analysis
      if (this.hiveConfig.observation.enabled) {
        await this.initializeObservation();
      }

      this.initialized = true;
      this.updateStateMachineMetadata();
      await this.stateMachine.transition("idle", "hive_manager_initialized", "HiveManager");

      // Publish initialization event
      await this.eventBus.publish({
        type: EventType.SYSTEM_START,
        sourceAgent: "HiveManager",
        payload: {
          agents: {
            orchestrator: this.orchestrator?.isRunning(),
            interface: this.interfaceAgent?.isRunning(),
            memory: this.memoryAgent?.isRunning(),
            memoryGateway: this.memoryGateway?.isRunning(),
            reflection: this.reflectionAgent?.isRunning(),
            agentFactory: this.agentFactory?.isRunning(),
          },
        },
      });

      console.log("[HiveManager] Initialization complete");
    } catch (error) {
      console.error("[HiveManager] Initialization failed:", error);
      if (this.stateMachine) {
        await this.stateMachine
          .transition("error", "hive_manager_init_failed", "HiveManager")
          .catch(() => {});
      }

      // Cleanup on failure
      await this.shutdown();

      throw error;
    }
  }

  /**
   * Shutdown HiveMind - stop all system agents gracefully
   */
  async shutdown(): Promise<void> {
    const hasManagedResources =
      this.initialized ||
      Boolean(
        this.stateMachine ||
        this.gatewayIntegrator ||
        this.gatewayBridge ||
        this.reflectionAgent ||
        this.interfaceAgent ||
        this.memoryAgent ||
        this.orchestrator ||
        this.memoryGateway ||
        this.agentFactory ||
        this.metricsTracker ||
        this.emergenceMonitor ||
        this.collaborationAnalyzer ||
        this.continuityAnalyzer ||
        this.analysisEngine ||
        this.autonomousTuner ||
        this.memoryEnhancement,
      );
    if (!hasManagedResources) {
      return;
    }

    console.log("[HiveManager] Shutting down HiveMind...");
    if (this.stateMachine) {
      await this.stateMachine
        .transition("shutdown", "hive_manager_shutdown", "HiveManager")
        .catch(() => {});
    }

    // Stop in reverse order, using destroy() to ensure proper cleanup
    const stopPromises: Promise<void>[] = [];

    // GatewayIntegrator
    if (this.gatewayIntegrator) {
      stopPromises.push(this.gatewayIntegrator.disconnect());
    }

    // GatewayBridge
    if (this.gatewayBridge) {
      stopPromises.push(this.gatewayBridge.shutdown());
    }

    // Observation components (no explicit shutdown needed, just clear references)
    this.metricsTracker = undefined;
    this.emergenceMonitor = undefined;
    this.collaborationAnalyzer = undefined;
    this.continuityAnalyzer = undefined;
    this.analysisEngine = undefined;
    this.autonomousTuner = undefined;
    this.memoryEnhancement = undefined;

    if (this.reflectionAgent) {
      stopPromises.push(this.reflectionAgent.destroy());
    }

    if (this.agentFactory) {
      stopPromises.push(this.agentFactory.destroy());
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
    if (this.stateMachine) {
      this.stateMachine.updateMetadata({ activeAgents: [] });
      await this.stateMachine.stop();
    }

    // Clear agent references
    this.reflectionAgent = undefined;
    this.interfaceAgent = undefined;
    this.memoryAgent = undefined;
    this.orchestrator = undefined;
    this.memoryGateway = undefined;
    this.agentFactory = undefined;
    this.gatewayBridge = undefined;
    this.gatewayIntegrator = undefined;
    this.stateMachine = undefined;

    const wasInitialized = this.initialized;
    this.initialized = false;

    if (wasInitialized) {
      await this.eventBus.publish({
        type: EventType.SYSTEM_STOP,
        sourceAgent: "HiveManager",
        payload: {},
      });
    }

    console.log("[HiveManager] Shutdown complete");
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
      agentFactory: this.agentFactory,
      gatewayBridge: this.gatewayBridge,
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
        agentFactory: this.agentFactory?.isRunning() ?? false,
        gatewayBridge: this.gatewayBridge?.getStatus().initialized ?? false,
      },
      gateway: {
        connected: this.gatewayIntegrator?.isConnected() ?? false,
        url: this.hiveConfig.gateway.url,
      },
      observation: {
        enabled: this.hiveConfig.observation.enabled,
        components: {
          metricsTracker: this.metricsTracker !== undefined,
          emergenceMonitor: this.emergenceMonitor !== undefined,
          collaborationAnalyzer: this.collaborationAnalyzer !== undefined,
          continuityAnalyzer: this.continuityAnalyzer !== undefined,
          analysisEngine: this.analysisEngine !== undefined,
          autonomousTuner: this.autonomousTuner !== undefined,
          memoryEnhancement: this.memoryEnhancement !== undefined,
        },
      },
      stateMachine: this.stateMachine?.getStatus() ?? null,
      config: this.hiveConfig,
    };
  }

  /**
   * Ensure GatewayBridge exists and is initialized.
   * Bridge reuses the manager-owned InterfaceAgent to avoid duplicate listeners.
   */
  async ensureGatewayBridge(): Promise<HiveGatewayBridge> {
    // Note: We don't check this.initialized here because this method may be called
    // during the initialization phase (via initializeGateway). What matters is that
    // the InterfaceAgent is ready.

    if (!this.interfaceAgent) {
      throw new Error("InterfaceAgent is not available; cannot create GatewayBridge");
    }

    if (!this.gatewayBridge) {
      this.gatewayBridge = new HiveGatewayBridge({
        hiveConfig: this.hiveConfig,
        eventBus: this.eventBus,
        interfaceAgent: this.interfaceAgent,
      });
    }

    const bridgeStatus = this.gatewayBridge.getStatus();
    if (!bridgeStatus.initialized) {
      await this.gatewayBridge.initialize();
    }

    return this.gatewayBridge;
  }

  /**
   * Initialize Gateway connection
   */
  private async initializeGateway(): Promise<void> {
    if (!this.hiveConfig.gateway.enabled) {
      return;
    }

    console.log("[HiveManager] Initializing Gateway integration...");

    try {
      // Ensure GatewayBridge is ready
      const bridge = await this.ensureGatewayBridge();

      // Create GatewayIntegrator
      this.gatewayIntegrator = new GatewayIntegrator({
        gatewayUrl: this.hiveConfig.gateway.url,
        token: this.hiveConfig.gateway.token,
        hiveConfig: this.hiveConfig,
        eventBus: this.eventBus,
        bridge,
      });

      // Connect to Gateway with timeout
      const timeout = this.hiveConfig.gateway.connectionTimeout || 10000;
      const connectPromise = this.gatewayIntegrator.connect();

      await Promise.race([
        connectPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gateway connection timeout")), timeout),
        ),
      ]);

      console.log("[HiveManager] Gateway connected successfully");
    } catch (error) {
      console.error("[HiveManager] Gateway connection failed:", error);
      // Gateway failure is not fatal - system can still operate in local mode
      this.gatewayIntegrator = undefined;
    }
  }

  /**
   * Initialize Observation Components
   */
  private async initializeObservation(): Promise<void> {
    if (!this.hiveConfig.observation.enabled) {
      return;
    }

    console.log("[HiveManager] Initializing observation components...");
    const components = this.hiveConfig.observation.components;

    // MetricsTracker - foundation for other components
    if (components.metricsTracker.enabled) {
      this.metricsTracker = new MetricsTracker();
      console.log("[HiveManager] MetricsTracker initialized");
    }

    // EmergenceMonitor - event tracing and visualization
    if (components.emergenceMonitor.enabled) {
      this.emergenceMonitor = new EmergenceMonitor();
      console.log("[HiveManager] EmergenceMonitor initialized");
    }

    // CollaborationAnalyzer - agent collaboration patterns
    if (components.collaborationAnalyzer.enabled && this.emergenceMonitor) {
      this.collaborationAnalyzer = new CollaborationAnalyzer(this.emergenceMonitor);
      console.log("[HiveManager] CollaborationAnalyzer initialized");
    }

    // ContinuityAnalyzer - self-awareness tracking
    if (components.continuityAnalyzer.enabled && this.emergenceMonitor) {
      this.continuityAnalyzer = new ContinuityAnalyzer(this.emergenceMonitor);
      console.log("[HiveManager] ContinuityAnalyzer initialized");
    }

    // AnalysisEngine - pattern analysis
    if (components.analysisEngine.enabled && this.metricsTracker) {
      this.analysisEngine = new AnalysisEngine(this.metricsTracker);
      console.log("[HiveManager] AnalysisEngine initialized");
    }

    // AutonomousTuner - self-optimization
    if (components.autonomousTuner.enabled && this.metricsTracker && this.analysisEngine) {
      this.autonomousTuner = new AutonomousTuner(this.metricsTracker, this.analysisEngine);
      console.log("[HiveManager] AutonomousTuner initialized");
    }

    // MemoryEnhancement - memory optimization
    if (components.memoryEnhancement.enabled) {
      this.memoryEnhancement = new MemoryEnhancement({
        hiveConfig: this.hiveConfig,
      });
      console.log("[HiveManager] MemoryEnhancement initialized");
    }

    console.log("[HiveManager] Observation components initialized");
  }

  /**
   * Update configuration (runtime)
   */
  updateConfig(updates: Partial<HiveConfig>): void {
    this.hiveConfig = {
      ...this.hiveConfig,
      ...updates,
    };
    console.log("[HiveManager] Configuration updated:", updates);
  }

  /**
   * Get Hive configuration
   */
  getConfig(): HiveConfig {
    return { ...this.hiveConfig };
  }

  private resolveStateMachineCheckpointDir(): string {
    const configured = this.hiveConfig.stateMachine.checkpointPath;
    if (configured.endsWith(".json")) {
      return path.dirname(configured);
    }
    return configured;
  }

  private updateStateMachineMetadata(): void {
    if (!this.stateMachine) {
      return;
    }

    const activeAgents: string[] = [];
    if (this.orchestrator?.isRunning()) {
      activeAgents.push("orchestrator_001");
    }
    if (this.interfaceAgent?.isRunning()) {
      activeAgents.push("interface_agent_001");
    }
    if (this.memoryAgent?.isRunning()) {
      activeAgents.push("memory_agent_001");
    }
    if (this.memoryGateway?.isRunning()) {
      activeAgents.push("memory_gateway_001");
    }
    if (this.reflectionAgent?.isRunning()) {
      activeAgents.push("reflection_agent_001");
    }
    if (this.agentFactory?.isRunning()) {
      activeAgents.push("agent_factory_001");
    }

    this.stateMachine.updateMetadata({ activeAgents });
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
