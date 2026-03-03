/**
 * Hive Modes - 支持传统单 Agent 模式和 HiveMind 多 Agent 模式
 */

export type HiveMode = 'single' | 'multi';

/**
 * 记忆层级
 * - none: 无记忆（Orchestrator）
 * - session: 最近对話 1-2 天（InterfaceAgent）
 * - task: 当前任务文件（Functional Agents）
 * - knowledge: MEMORY.md + 全量记忆检索（MemoryAgent）
 * - sample: 抽样记忆 1-2 周（ReflectionAgent）
 */
export type MemoryLevel = 'none' | 'session' | 'task' | 'knowledge' | 'sample';

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

  // 记忆分层配置
  memory: {
    /**
     * 不同 Agent 使用的记忆层级
     */
    layers: {
      orchestrator: MemoryLevel;   // L0: 零记忆
      interface: MemoryLevel;      // L1: 会话记忆
      functional: MemoryLevel;     // L2: 任务记忆
      memory: MemoryLevel;         // L3: 知识记忆
      reflection: MemoryLevel;     // L4: 样本记忆
    };

    /**
     * 记忆保留策略
     */
    retention: {
      sessionDays: number;         // InterfaceAgent 保留天数
      sampleDays: number;          // ReflectionAgent 抽样天数
      taskMaxFiles: number;        // Functional Agents 任务最大文件数
    };

    /**
     * 记忆索引配置
     */
    indexing: {
      enableSemanticSearch: boolean;   // 启用语义搜索
      enableVectorCache: boolean;      // 启用向量缓存
      workspacePath: string;           // OpenClaw workspace 路径
      memoryPath: string;              // 记忆文件路径
    };
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
  memory: {
    layers: {
      orchestrator: 'none',       // L0
      interface: 'session',       // L1
      functional: 'task',         // L2
      memory: 'knowledge',        // L3
      reflection: 'sample',       // L4
    },
    retention: {
      sessionDays: 2,
      sampleDays: 14,
      taskMaxFiles: 10,
    },
    indexing: {
      enableSemanticSearch: true,
      enableVectorCache: true,
      workspacePath: '/root/.openclaw/workspace',
      memoryPath: '/root/.openclaw/workspace/memory',
    },
  },
};
