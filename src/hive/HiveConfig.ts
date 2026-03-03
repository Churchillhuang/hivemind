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

/**
 * 模型大小分类
 * - nano: ≤1B（超小，如 DistilBERT）
 * - light: 3-7B（轻量，如 Llama-7B, Qwen-7B）
 * - standard: 8-30B（标准，如 Llama-13B/30B, Qwen-14B）
 * - heavy: ≥70B（重，如 Llama-70B, Qwen-72B）
 */
export type ModelTier = 'nano' | 'light' | 'standard' | 'heavy';

/**
 * Agent 模型配置
 */
export interface AgentModelConfig {
  tier: ModelTier;           // 模型分层
  model?: string;            // 具体模型名称（可选，覆盖默认）
  temperature?: number;      // 温度参数
  maxTokens?: number;        // 最大输出 tokens
  timeout?: number;          // 超时时间（秒）
}

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

  /**
   * Agent 模型配置
   * 不同类型的 Agent 使用不同的模型以优化成本和性能
   */
  agentModels: {
    /**
     * 模型分层到实际模型的映射
     */
    tierMapping: {
      nano?: string;       // 如: "distilbert-base"
      light?: string;      // 如: "llama-7b", "qwen-7b"
      standard?: string;   // 如: "llama-13b", "qwen-14b"
      heavy?: string;      // 如: "llama-70b", "qwen-72b"
    };

    /**
     * System Agents 模型配置
     */
    system: {
      orchestrator: AgentModelConfig;      // L0 - 路由决策（nano/light）
      interface: AgentModelConfig;         // L1 - 对话交互（standard）
      memory: AgentModelConfig;            // L3 - 记忆检索（light，主要是关键词匹配）
      reflection: AgentModelConfig;        // L4 - 自我反思（standard）
    };

    /**
     * Functional Agents 默认模型配置
     */
    functional: {
      default: AgentModelConfig;           // 默认配置（light/standard）
      overrides: {
        [key: string]: AgentModelConfig;   // 特定 task 的覆盖配置
      };
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
      workspacePath: '/path/to/openclaw/workspace',
      memoryPath: '/path/to/openclaw/workspace/memory',
    },
  },

  /**
   * Default model configuration
   * 优化不同 Agent 的成本和性能
   */
  agentModels: {
    // 模型映射（实际使用的模型名称）
    tierMapping: {
      nano: 'distilbert-base',
      light: 'llama-7b',
      standard: 'llama-13b',
      heavy: 'llama-70b',
    },

    // System Agents 配置
    system: {
      orchestrator: {
        tier: 'light',           // ≤7B - 路由决策，不需要理解复杂语义
        model: undefined,         // 使用 tierMapping.light
        temperature: 0.1,         // 低温度，路由决策应该确定性高
        maxTokens: 500,           // 少输出，只返回决策
        timeout: 30,
      },
      interface: {
        tier: 'standard',         // 8-30B - 对话交互需要理解复杂语义
        model: undefined,         // 使用 tierMapping.standard
        temperature: 0.7,         // 中等温度，有创造力但不太随机
        maxTokens: 2000,          // 需要生成完整回复
        timeout: 60,
      },
      memory: {
        tier: 'nano',             // ≤1B - 关键词匹配，几乎不需要 LLM
        model: undefined,         // 使用 tierMapping.nano
        temperature: 0.0,         // 零温度，精确匹配
        maxTokens: 100,
        timeout: 10,
      },
      reflection: {
        tier: 'standard',         // 8-30B - 模式分析需要理解
        model: undefined,         // 使用 tierMapping.standard
        temperature: 0.3,         // 低温度，分析需要确定性
        maxTokens: 1500,          // 分析报告
        timeout: 60,
      },
    },

    // Functional Agents 配置
    functional: {
      default: {
        tier: 'light',            // 3-7B - 功能任务大多数简单
        model: undefined,         // 使用 tierMapping.light
        temperature: 0.5,         // 中低温度
        maxTokens: 1000,
        timeout: 30,
      },
      overrides: {
        // 特别任务使用更大模型
        'philosophy_generation': {
          tier: 'standard',       // 哲学文本生成需要理解
          model: undefined,
          temperature: 0.8,
          maxTokens: 2000,
          timeout: 60,
        },
        'complex_analysis': {
          tier: 'standard',
          model: undefined,
          temperature: 0.4,
          maxTokens: 1500,
          timeout: 60,
        },
      },
    },
  },
};
