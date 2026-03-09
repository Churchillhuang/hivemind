/**
 * consensus-types.ts - 分布式共识决策通信协议
 *
 * Agent之间通过这些消息类型进行自主决策，不需要中央决策者。
 *
 * 流程：
 * 1. TASK_ANNOUNCEMENT: 任务广播
 * 2. DANCE: Agent声明自己可以处理
 * 3. SUPPORT: Agent支持另一个Agent
 * 4. WITHDRAW: Agent撤回自己的提案
 * 5. DISCUSSION: Agent间讨论
 * 6. CONSENSUS_REACHED: 共识达成
 */

/**
 * 子任务提案
 */
export interface SubtaskProposal {
  id: string;
  description: string;
  requiredSkills: string[];
  estimatedComplexity: "low" | "medium" | "high";
  dependencies?: string[]; // 依赖的其他子任务ID
}

/**
 * 舞蹈 - Agent声明自己可以处理任务
 *
 * 类似蜜蜂的"摇摆舞"，Agent通过舞蹈表达：
 * - 自己能处理这个任务
 * - 自己的置信度
 * - 匹配的技能
 * - 建议的方案（直接执行或分解）
 */
export interface Dance {
  type: "DANCE";
  taskId: string;
  agentId: string;
  confidence: number; // 0-1
  matchedSkills: string[];
  reasoning: string;
  proposal: "direct" | "decompose";
  subtasks?: SubtaskProposal[]; // 如果建议分解
  timestamp: number;
}

/**
 * 支持 - Agent支持另一个Agent的提案
 *
 * Agent可以支持别人的舞蹈，增加该提案的权重。
 * 支持者自己的置信度会影响支持力度。
 */
export interface Support {
  type: "SUPPORT";
  taskId: string;
  agentId: string; // 支持者
  targetAgentId: string; // 被支持者
  reason: string;
  confidence: number; // 支持者对被支持者的信心
  timestamp: number;
}

/**
 * 撤回 - Agent撤回自己的舞蹈
 *
 * 当Agent发现自己不适合处理任务时（如看到更合适的Agent），
 * 可以撤回自己的舞蹈。
 */
export interface Withdraw {
  type: "WITHDRAW";
  taskId: string;
  agentId: string;
  reason: string;
  timestamp: number;
}

/**
 * 讨论 - Agent之间的讨论消息
 *
 * Agent可以通过讨论来：
 * - 协商谁更适合处理
 * - 讨论如何分解任务
 * - 解决分歧
 */
export interface Discussion {
  type: "DISCUSSION";
  taskId: string;
  fromAgentId: string;
  toAgentId?: string; // null = 广播给所有参与者
  message: string;
  timestamp: number;
}

/**
 * 共识达成 - 任务决策最终结果
 *
 * 当满足以下条件之一时触发：
 * 1. 某个提案获得足够多的支持
 * 2. 只剩下一个提案
 * 3. 超时后选择支持最多的提案
 */
export interface ConsensusReached {
  type: "CONSENSUS_REACHED";
  taskId: string;
  result: {
    action: "direct" | "decompose";
    assignedAgent?: string; // 直接执行时的Agent
    subtasks?: SubtaskProposal[]; // 分解时的子任务
    supporters: string[]; // 支持者列表
  };
  timestamp: number;
}

/**
 * 共识状态 - 追踪某个任务的共识形成过程
 */
export interface ConsensusState {
  taskId: string;
  announcement: TaskAnnouncement;
  dances: Map<string, Dance>;
  supports: Map<string, Support[]>; // agentId -> 支持列表
  withdraws: string[]; // 已撤回的Agent ID列表
  discussions: Discussion[];
  startTime: number;
  deadline: number;
  consensusReached: boolean;
  finalResult?: ConsensusReached["result"];
}

/**
 * 任务公告 - 和现有NegotiationRouter兼容
 */
export interface TaskAnnouncement {
  taskId: string;
  taskType: string;
  requiredCapabilities: string[];
  priority: "urgent" | "normal" | "low";
  description: string;
  timestamp: number;
  deadline?: number;
  payload?: unknown; // 原始任务数据
}

/**
 * Agent技能匹配结果
 */
export interface SkillMatch {
  score: number; // 0-1
  matchedSkills: string[];
  reasoning: string;
}

/**
 * 共识配置
 */
export interface ConsensusConfig {
  // 舞蹈收集时间（毫秒）
  danceCollectionTime: number;

  // 支持收集时间（毫秒）
  supportCollectionTime: number;

  // 达成共识所需的支持比例（0-1）
  consensusThreshold: number;

  // 最少参与Agent数
  minParticipants: number;

  // 最大等待时间（毫秒）
  maxWaitTime: number;
}

/**
 * 默认共识配置
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  danceCollectionTime: 3000, // 3秒
  supportCollectionTime: 2000, // 2秒
  consensusThreshold: 0.6, // 60%支持率
  minParticipants: 1,
  maxWaitTime: 10000, // 10秒
};
