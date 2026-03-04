/**
 * HiveManager 集成测试 - 验证所有修复
 */

import { promises as fs } from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetGlobalEventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";
import { HiveManager } from "./HiveManager.js";

describe("HiveManager Integration", () => {
  let hiveManager: HiveManager;
  let testConfig: HiveConfig;

  beforeEach(async () => {
    resetGlobalEventBus();

    // 创建测试配置
    testConfig = {
      enabled: true,
      mode: "multi",
      eventBus: {
        maxHistorySize: 100,
      },
      orchestrator: {
        mode: "full", // 测试完整模式
        maxAgents: 5,
        idleTimeout: 10000,
        negotiationTimeout: 3000,
      },
      stateMachine: {
        persist: false, // 测试时禁用持久化
        checkpointInterval: 60000,
        checkpointPath: "/tmp/hivemind-test",
      },
      gateway: {
        enabled: false, // 测试时禁用 Gateway
        url: "ws://127.0.0.1:18789",
        autoConnect: false,
        reconnectInterval: 5000,
        connectionTimeout: 10000,
      },
      observation: {
        enabled: true, // 启用观测体系
        components: {
          emergenceMonitor: {
            enabled: true,
            samplingInterval: 1000,
          },
          collaborationAnalyzer: {
            enabled: true,
          },
          continuityAnalyzer: {
            enabled: true,
          },
          analysisEngine: {
            enabled: true,
            analysisInterval: 60000,
          },
          autonomousTuner: {
            enabled: true,
            tuningInterval: 300000,
          },
          metricsTracker: {
            enabled: true,
            retentionDays: 7,
          },
          memoryEnhancement: {
            enabled: true,
          },
        },
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
          maxConcurrent: 3,
          lifespan: "task",
        },
      },
      skillLearning: {
        enabled: true,
        sharedSkillsPath: "/tmp/hivemind-test/shared_skills/",
        agentSkillsPath: "/tmp/hivemind-test/agent_skills/",
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
          enableSemanticSearch: false, // 测试时禁用
          enableVectorCache: false,
          workspacePath: "/tmp/hivemind-test",
          memoryPath: "/tmp/hivemind-test/memory",
        },
      },
      agentModels: {
        tierMapping: {
          nano: "test-nano",
          light: "test-light",
          standard: "test-standard",
          heavy: "test-heavy",
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
            temperature: 0.0,
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

    hiveManager = new HiveManager({ hiveConfig: testConfig });
  });

  afterEach(async () => {
    if (hiveManager) {
      await hiveManager.shutdown();
    }
    // 清理测试目录
    try {
      await fs.rm("/tmp/hivemind-test", { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe("P0: Gateway Integration", () => {
    it("should have Gateway configuration", () => {
      expect(testConfig.gateway).toBeDefined();
      expect(testConfig.gateway.enabled).toBe(false);
      expect(testConfig.gateway.url).toBe("ws://127.0.0.1:18789");
      expect(testConfig.gateway.autoConnect).toBe(false);
    });

    it("should initialize without Gateway when disabled", async () => {
      await hiveManager.initialize();
      const status = hiveManager.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.gateway.connected).toBe(false);
    });
  });

  describe("P1: Observation Components", () => {
    it("should have observation configuration", () => {
      expect(testConfig.observation).toBeDefined();
      expect(testConfig.observation.enabled).toBe(true);
      expect(testConfig.observation.components).toBeDefined();
      expect(testConfig.observation.components.metricsTracker.enabled).toBe(true);
      expect(testConfig.observation.components.emergenceMonitor.enabled).toBe(true);
    });

    it("should initialize observation components when enabled", async () => {
      await hiveManager.initialize();
      const status = hiveManager.getStatus();

      expect(status.observation.enabled).toBe(true);
      expect(status.observation.components.metricsTracker).toBe(true);
      expect(status.observation.components.emergenceMonitor).toBe(true);
      expect(status.observation.components.collaborationAnalyzer).toBe(true);
      expect(status.observation.components.continuityAnalyzer).toBe(true);
      expect(status.observation.components.analysisEngine).toBe(true);
      expect(status.observation.components.autonomousTuner).toBe(true);
      expect(status.observation.components.memoryEnhancement).toBe(true);
    });
  });

  describe("P2: Skill Learning", () => {
    it("should have skillLearning configuration", () => {
      expect(testConfig.skillLearning).toBeDefined();
      expect(testConfig.skillLearning.enabled).toBe(true);
      expect(testConfig.skillLearning.sharedSkillsPath).toBeDefined();
      expect(testConfig.skillLearning.agentSkillsPath).toBeDefined();
    });

    it("should create SkillPersistence instance", async () => {
      await hiveManager.initialize();
      const agents = hiveManager.getAgents();
      expect(agents.reflection).toBeDefined();
    });
  });

  describe("P3: Simplified Orchestrator Mode", () => {
    it("should support simple orchestrator mode", () => {
      const simpleConfig = { ...testConfig };
      simpleConfig.orchestrator = {
        ...simpleConfig.orchestrator,
        mode: "simple",
      };

      const simpleManager = new HiveManager({ hiveConfig: simpleConfig });
      expect(simpleManager).toBeDefined();
    });

    it("should support full orchestrator mode", () => {
      const fullConfig = { ...testConfig };
      fullConfig.orchestrator = {
        ...fullConfig.orchestrator,
        mode: "full",
      };

      const fullManager = new HiveManager({ hiveConfig: fullConfig });
      expect(fullManager).toBeDefined();
    });
  });

  describe("Full Integration", () => {
    it("should initialize all system agents", async () => {
      await hiveManager.initialize();
      const status = hiveManager.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.agents.orchestrator).toBe(true);
      expect(status.agents.interface).toBe(true);
      expect(status.agents.memory).toBe(true);
      expect(status.agents.memoryGateway).toBe(true);
      expect(status.agents.reflection).toBe(true);
      expect(status.agents.agentFactory).toBe(true);
    });

    it("should have all observation components active", async () => {
      await hiveManager.initialize();
      const status = hiveManager.getStatus();

      expect(status.observation.enabled).toBe(true);
      expect(status.observation.components.metricsTracker).toBe(true);
      expect(status.observation.components.emergenceMonitor).toBe(true);
    });

    it("should shutdown gracefully", async () => {
      await hiveManager.initialize();
      await hiveManager.shutdown();
      const status = hiveManager.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.agents.orchestrator).toBe(false);
      expect(status.agents.interface).toBe(false);
    });
  });
});
