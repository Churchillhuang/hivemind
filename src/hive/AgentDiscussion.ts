/**
 * AgentDiscussion - Agent讨论机制
 *
 * 任务发布后，不是由算法决定是否分解，
 * 而是让所有Agent参与讨论，自主决定：
 * 1. 是否需要分解
 * 2. 如何分解
 * 3. 谁来执行
 *
 * 这才是真正的分布式决策！
 */

import { randomUUID } from "node:crypto";
import { EventBus } from "../events/EventBus.js";
import type { TaskAnnouncement } from "./consensus-types.js";

export interface DiscussionTopic {
  id: string;
  taskId: string;
  topic: "should_decompose" | "how_to_decompose" | "who_executes";
  proposals: AgentProposal[];
  votes: Map<string, string>; // agentId -> proposalId
  status: "open" | "voting" | "resolved";
  result?: unknown;
  deadline: number;
}

export interface AgentProposal {
  id: string;
  agentId: string;
  taskId: string;
  type: "execute_directly" | "decompose" | "reject";
  reasoning: string;
  confidence: number;
  subtasks?: SubtaskProposal[];
  timestamp: number;
}

export interface SubtaskProposal {
  id: string;
  description: string;
  requiredSkills: string[];
  suggestedAgent?: string;
  estimatedComplexity: "low" | "medium" | "high";
}

export interface DiscussionConfig {
  // 讨论持续时间（毫秒）
  discussionTime: number;

  // 最少参与的Agent数
  minParticipants: number;

  // 投票通过阈值
  voteThreshold: number; // 0.6 = 60%

  // 是否强制讨论（即使只有一个Agent也要讨论）
  forceDiscussion: boolean;
}

export const DEFAULT_DISCUSSION_CONFIG: DiscussionConfig = {
  discussionTime: 3000, // 3秒讨论时间
  minParticipants: 1,
  voteThreshold: 0.6,
  forceDiscussion: true, // 强制讨论！
};

export class AgentDiscussion {
  private eventBus: EventBus;
  private config: DiscussionConfig;
  private topics: Map<string, DiscussionTopic> = new Map();

  constructor(eventBus: EventBus, config?: Partial<DiscussionConfig>) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_DISCUSSION_CONFIG, ...config };
  }

  /**
   * 启动任务讨论
   *
   * 任务发布后，不是立即执行，而是：
   * 1. 开启讨论话题
   * 2. 等待所有Agent发表意见
   * 3. 投票决定
   */
  startTaskDiscussion(task: TaskAnnouncement): DiscussionTopic {
    const topic: DiscussionTopic = {
      id: `discussion_${task.taskId}_${Date.now()}`,
      taskId: task.taskId,
      topic: "should_decompose",
      proposals: [],
      votes: new Map(),
      status: "open",
      deadline: Date.now() + this.config.discussionTime,
    };

    this.topics.set(topic.id, topic);

    // 发布讨论邀请
    void this.eventBus.publish({
      type: "DISCUSSION_START",
      sourceAgent: "discussion_coordinator",
      payload: {
        topicId: topic.id,
        taskId: task.taskId,
        question: "这个任务应该如何处理？直接执行还是分解？",
        topic: "should_decompose",
        deadline: topic.deadline,
      },
    });

    console.log(`[AgentDiscussion] Started discussion for task ${task.taskId}`);
    console.log(`[AgentDiscussion] Waiting for agents to propose...`);

    return topic;
  }

  /**
   * Agent提交提案
   *
   * Agent可以提议：
   * - execute_directly: 我认为应该直接执行
   * - decompose: 我认为应该分解（并提供分解方案）
   * - reject: 我认为不应该执行
   */
  submitProposal(
    agentId: string,
    taskId: string,
    proposal: Omit<AgentProposal, "id" | "agentId" | "taskId" | "timestamp">,
  ): void {
    // 找到对应的讨论话题
    const topic = Array.from(this.topics.values()).find(
      (t) => t.taskId === taskId && t.status === "open",
    );

    if (!topic) {
      console.warn(`[AgentDiscussion] No open discussion for task ${taskId}`);
      return;
    }

    const fullProposal: AgentProposal = {
      ...proposal,
      id: `proposal_${randomUUID().substring(0, 8)}`,
      agentId,
      taskId,
      timestamp: Date.now(),
    };

    topic.proposals.push(fullProposal);

    console.log(`[AgentDiscussion] Agent ${agentId} submitted proposal:`);
    console.log(`  Type: ${proposal.type}`);
    console.log(`  Reasoning: ${proposal.reasoning}`);
    console.log(`  Confidence: ${(proposal.confidence * 100).toFixed(0)}%`);

    // 广播提案
    void this.eventBus.publish({
      type: "DISCUSSION",
      sourceAgent: agentId,
      payload: {
        topicId: topic.id,
        proposal: fullProposal,
      },
    });
  }

  /**
   * Agent投票
   *
   * Agent可以支持某个提案
   */
  vote(agentId: string, proposalId: string): void {
    // 找到包含该提案的话题
    const topic = Array.from(this.topics.values()).find((t) =>
      t.proposals.some((p) => p.id === proposalId),
    );

    if (!topic) {
      console.warn(`[AgentDiscussion] Proposal ${proposalId} not found`);
      return;
    }

    topic.votes.set(agentId, proposalId);

    console.log(`[AgentDiscussion] Agent ${agentId} voted for proposal ${proposalId}`);

    // 检查是否达到投票阈值
    this.checkConsensus(topic);
  }

  /**
   * 结束讨论并统计结果
   */
  resolveDiscussion(topicId: string): {
    decision: "execute_directly" | "decompose" | "reject";
    proposal?: AgentProposal;
    supporters: string[];
  } | null {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return null;
    }

    topic.status = "resolved";

    // 统计每个提案的票数
    const proposalVotes = new Map<string, number>();
    for (const [, proposalId] of topic.votes) {
      const count = proposalVotes.get(proposalId) || 0;
      proposalVotes.set(proposalId, count + 1);
    }

    // 找出获胜的提案
    let winningProposal: AgentProposal | null = null;
    let maxVotes = 0;

    for (const proposal of topic.proposals) {
      const votes = proposalVotes.get(proposal.id) || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        winningProposal = proposal;
      }
    }

    if (!winningProposal) {
      // 如果没有提案，默认直接执行
      console.log(`[AgentDiscussion] No proposals, defaulting to execute_directly`);
      return {
        decision: "execute_directly",
        supporters: [],
      };
    }

    // 收集支持者
    const supporters = Array.from(topic.votes.entries())
      .filter(([_, pid]) => pid === winningProposal.id)
      .map(([aid, _]) => aid);

    console.log(`[AgentDiscussion] Discussion resolved:`);
    console.log(`  Decision: ${winningProposal.type}`);
    console.log(`  Reasoning: ${winningProposal.reasoning}`);
    console.log(`  Votes: ${maxVotes}`);
    console.log(`  Supporters: ${supporters.join(", ")}`);

    // 发布决议
    void this.eventBus.publish({
      type: "DISCUSSION_RESOLVED",
      sourceAgent: "discussion_coordinator",
      payload: {
        topicId: topic.id,
        taskId: topic.taskId,
        decision: winningProposal.type,
        proposal: winningProposal,
        supporters,
      },
    });

    return {
      decision: winningProposal.type,
      proposal: winningProposal,
      supporters,
    };
  }

  /**
   * 检查是否达成共识
   */
  private checkConsensus(topic: DiscussionTopic): void {
    const totalVotes = topic.votes.size;
    const proposalVotes = new Map<string, number>();

    for (const [_, proposalId] of topic.votes) {
      const count = proposalVotes.get(proposalId) || 0;
      proposalVotes.set(proposalId, count + 1);
    }

    // 检查是否有提案达到阈值
    for (const [proposalId, votes] of proposalVotes) {
      const ratio = votes / totalVotes;
      if (ratio >= this.config.voteThreshold) {
        console.log(
          `[AgentDiscussion] Consensus reached: ${(ratio * 100).toFixed(0)}% voted for ${proposalId}`,
        );
        this.resolveDiscussion(topic.id);
        return;
      }
    }
  }

  /**
   * 获取讨论状态
   */
  getDiscussionStatus(topicId: string): DiscussionTopic | undefined {
    return this.topics.get(topicId);
  }

  /**
   * 列出所有活跃的讨论
   */
  getActiveDiscussions(): DiscussionTopic[] {
    return Array.from(this.topics.values()).filter((t) => t.status === "open");
  }
}
