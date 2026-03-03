/**
 * Hive Modes - 支持传统单 Agent 模式和 HiveMind 多 Agent 模式
 */

export type HiveMode = 'single' | 'multi';

export interface HiveConfig {
  enabled: boolean;
  mode: HiveMode;

  // EventBus 配置
  eventBus: {
    maxHistorySize: number;
  };

  // Orchestrator 配置
  orchestrator: {
    maxAgents: number;
    idleTimeout: number;
    model?: string;
  };

  // StateMachine 配置
  stateMachine: {
    persist: boolean;
    checkpointInterval: number;
    checkpointPath: string;
  };

  // Agents 配置
  agents: {
    system: {
      interface: { enabled: boolean };
      memory: { enabled: boolean };
      orchestrator: { enabled: boolean };
      reflection: { enabled: boolean };
    };
    functional: {
      enabled: boolean;
      maxConcurrent: number;
      lifespan: 'task' | 'session' | 'persistent';
    };
  };

  // Skill Learning 配置
  skillLearning: {
    enabled: boolean;
    sharedSkillsPath: string;
    agentSkillsPath: string;
    minSuccessThreshold: number;
  };
}

export const DEFAULT_HIVE_CONFIG: HiveConfig = {
  enabled: false,
  mode: 'single',
  eventBus: {
    maxHistorySize: 1000,
  },
  orchestrator: {
    maxAgents: 10,
    idleTimeout: 30000,
  },
  stateMachine: {
    persist: true,
    checkpointInterval: 10000,
    checkpointPath: '/var/lib/hivemind/state.json',
  },
  agents: {
    system: {
      interface: { enabled: true },
      memory: { enabled: true },
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
};
