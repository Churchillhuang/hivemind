/**
 * ConsensusParticipant - 让现有Agent能够参与共识决策的辅助类
 *
 * 不需要修改Agent的继承关系，只需要创建一个ConsensusParticipant实例
 * 并在收到任务时调用evaluate方法即可。
 */

import { EventBus } from "../events/EventBus.js";
import {
  type Dance,
  type Support,
  type TaskAnnouncement,
  type SkillMatch,
  type ConsensusConfig,
  DEFAULT_CONSENSUS_CONFIG,
} from "./consensus-types.js";
import type { HiveConfig } from "./HiveConfig.js";

/**
 * 共识参与者的技能评估器
 */
export type SkillEvaluatorFn = (task: TaskAnnouncement) => SkillMatch;

/**
 * 共识参与者配置
 */
export interface ParticipantConfig {
  agentId: string;
  agentRole: string;
  skills: string[];
  eventBus: EventBus;
  hiveConfig: HiveConfig;
  consensusConfig?: Partial<ConsensusConfig>;
}

/**
 * 共识参与者
 *
 * 使用方式：
 * ```typescript
 * class MyAgent extends BaseAgent {
 *   private consensusParticipant: ConsensusParticipant;
 *
 *   constructor(...) {
 *     this.consensusParticipant = new ConsensusParticipant({
 *       agentId: this.id,
 *       agentRole: this.role,
 *       skills: ["analysis", "coding"],
 *       eventBus: this.eventBus,
 *       hiveConfig: config,
 *     });
 *   }
 *
 *   async start() {
 *     this.consensusParticipant.start();
 *   }
 * }
 * ```
 */
export class ConsensusParticipant {
  private config: ParticipantConfig;
  private consensusConfig: ConsensusConfig;
  private eventBus: EventBus;
  private running: boolean = false;

  // 技能评分（用于任务匹配）
  private skillScores: Map<string, number> = new Map();

  // 自定义评估器
  private customEvaluator?: SkillEvaluatorFn;

  constructor(config: ParticipantConfig) {
    this.config = config;
    this.eventBus = config.eventBus;
    this.consensusConfig = {
      ...DEFAULT_CONSENSUS_CONFIG,
      ...config.consensusConfig,
    };

    // 初始化技能评分
    for (const skill of config.skills) {
      this.skillScores.set(skill, 0.5); // 默认0.5分
    }
  }

  /**
   * 启动共识参与
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;

    // 订阅共识相关事件
    this.eventBus.subscribe("TASK_ANNOUNCEMENT", this.handleTaskAnnouncement.bind(this));
    this.eventBus.subscribe("DANCE", this.handleDance.bind(this));
    this.eventBus.subscribe("SUPPORT", this.handleSupport.bind(this));

    console.log(
      `[ConsensusParticipant ${this.config.agentId}] Started with skills: ${this.config.skills.join(", ")}`,
    );
  }

  /**
   * 停止共识参与
   */
  stop(): void {
    this.running = false;
  }

  /**
   * 设置自定义技能评估器
   */
  setCustomEvaluator(evaluator: SkillEvaluatorFn): void {
    this.customEvaluator = evaluator;
  }

  /**
   * 更新技能评分
   */
  updateSkillScore(skill: string, score: number): void {
    this.skillScores.set(skill, score);
  }

  /**
   * 处理任务公告
   */
  private async handleTaskAnnouncement(event: { type: string; payload: unknown }): Promise<void> {
    if (!this.running) {
      return;
    }

    const task = event.payload as TaskAnnouncement;

    // 评估任务
    const match = this.evaluateTask(task);

    // 如果匹配度太低，不参与
    if (match.score < 0.3) {
      console.log(
        `[ConsensusParticipant ${this.config.agentId}] Not participating in task ${task.taskId} - low match: ${match.score.toFixed(2)}`,
      );
      return;
    }

    // 发布舞蹈
    await this.publishDance(task, match);
  }

  /**
   * 评估任务
   */
  evaluateTask(task: TaskAnnouncement): SkillMatch {
    // 如果有自定义评估器，使用它
    if (this.customEvaluator) {
      return this.customEvaluator(task);
    }

    // 默认：基于技能匹配
    const matchedSkills: string[] = [];
    let totalScore = 0;

    // 检查任务需要的能力
    for (const cap of task.requiredCapabilities) {
      const score = this.skillScores.get(cap);
      if (score !== undefined) {
        matchedSkills.push(cap);
        totalScore += score;
      }
    }

    // 也检查描述中的关键词
    const desc = task.description.toLowerCase();
    for (const skill of this.config.skills) {
      if (desc.includes(skill.toLowerCase())) {
        const score = this.skillScores.get(skill) || 0.5;
        if (!matchedSkills.includes(skill)) {
          matchedSkills.push(skill);
          totalScore += score;
        }
      }
    }

    // 计算匹配度
    const avgScore = matchedSkills.length > 0 ? totalScore / matchedSkills.length : 0;

    return {
      score: Math.min(1, avgScore),
      matchedSkills,
      reasoning:
        matchedSkills.length > 0
          ? `Matched ${matchedSkills.length} skills: ${matchedSkills.join(", ")}`
          : "No matching skills",
    };
  }

  /**
   * 发布舞蹈
   */
  private async publishDance(task: TaskAnnouncement, match: SkillMatch): Promise<void> {
    const dance: Dance = {
      type: "DANCE",
      taskId: task.taskId,
      agentId: this.config.agentId,
      confidence: match.score,
      matchedSkills: match.matchedSkills,
      reasoning: match.reasoning,
      proposal: "direct",
      timestamp: Date.now(),
    };

    console.log(
      `[ConsensusParticipant ${this.config.agentId}] Publishing dance for task ${task.taskId}:`,
    );
    console.log(`  Confidence: ${dance.confidence.toFixed(2)}`);
    console.log(`  Skills: ${dance.matchedSkills.join(", ")}`);

    await this.eventBus.publish({
      type: "DANCE",
      sourceAgent: this.config.agentId,
      payload: dance,
    });
  }

  /**
   * 处理其他Agent的舞蹈
   */
  private async handleDance(event: { type: string; payload: unknown }): Promise<void> {
    const dance = event.payload as Dance;

    // 忽略自己的舞蹈
    if (dance.agentId === this.config.agentId) {
      return;
    }

    console.log(
      `[ConsensusParticipant ${this.config.agentId}] Received dance from ${dance.agentId}`,
    );
    // 可以在这里实现支持逻辑
  }

  /**
   * 处理支持消息
   */
  private handleSupport(event: { type: string; payload: unknown }): void {
    const support = event.payload as Support;

    if (support.targetAgentId === this.config.agentId) {
      console.log(
        `[ConsensusParticipant ${this.config.agentId}] Received support from ${support.agentId}`,
      );
    }
  }

  /**
   * 主动支持另一个Agent
   */
  async supportAgent(taskId: string, targetAgentId: string, reason: string): Promise<void> {
    const support: Support = {
      type: "SUPPORT",
      taskId,
      agentId: this.config.agentId,
      targetAgentId,
      reason,
      confidence: 0.8,
      timestamp: Date.now(),
    };

    await this.eventBus.publish({
      type: "SUPPORT",
      sourceAgent: this.config.agentId,
      payload: support,
    });
  }
}
