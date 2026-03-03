/**
 * SimpleAgent - 极简 Agent
 *
 * 核心简化：
 * 1. 技能只有 3 个参数：successCount, failCount, count
 * 2. 愿意程度的公式极其简单
 * 3. 探索基于"动机"，而不是固定概率
 *
 * 愿意程度（willing）计算公式：
 *   willing = (success / count) × (1 + motivation bonus)
 *
 * 其中动机 bonus：
 *   - 成功率高（> 0.8）→ +0.2（"我想尝试更难的任务"）
 *   - 连续失败（> 3 次）→ +0.5（"我想换种方式"）
 *   - 默认 → 0
 */

import { CoordinationAgent, type AgentCapabilities } from './CoordinationAgent.js';
import type { Event } from '../events/Event.js';
import type { SimpleTaskAnnouncement, SimpleBid } from './SimpleNegotiationRouter.js';

export interface SimpleSkillRecord {
  successCount: number;
  failCount: number;
  count: number;
}

export class SimpleAgent extends CoordinationAgent {
  /**
   * 技能库（极简版）
   * Key: 技能名称
   * Value: 成功/失败次数
   */
  skills: Map<string, SimpleSkill>;

  /**
   * 连续失败记录
   * Key: 技能名称
   * Value: 连续失败次数
   */
  consecutiveFailures: Map<string, number>;

  /**
   * 连续成功记录
   * Key: 技能名称
   * Value: 连续成功次数
   */
  consecutiveSuccesses: Map<string, number>;

  /**
   * 动机参数
   */
  motivation: {
    /**
     * 成功率高时的探索奖励
     * 如果某个技能的成功率 > highSuccessThreshold，愿意程度增加
     */
    highSuccessThreshold: number;  // 默认 0.8
    highSuccessBonus: number;      // 默认 0.2

    /**
     * 连续失败时的探索奖励
     * 如果某个技能连续失败 > maxConsecutiveFailures，愿意程度大幅增加
     * （意味着："我想换种方式"）
     */
    maxConsecutiveFailures: number;  // 默认 3
    consecutiveFailureBonus: number; // 默认 0.5

    /**
     * 基础随机性
     * 允许一些"随机冲动"
     */
    randomness: number;  // 默认 0.1 (10%)
  };

  constructor(
    config: {
      id: string;
      role: string;
      type: 'system' | 'functional';
      description?: string;
    },
    capabilities: AgentCapabilities,
    eventBus?: any,
    customMotivation?: Partial<typeof SimpleAgent.prototype['motivation']>,
  ) {
    super(config, capabilities, eventBus);

    this.skills = new Map();
    this.consecutiveFailures = new Map();
    this.consecutiveSuccesses = new Map();

    this.motivation = {
      highSuccessThreshold: 0.8,
      highSuccessBonus: 0.2,
      maxConsecutiveFailures: 3,
      consecutiveFailureBonus: 0.5,
      randomness: 0.1,
      ...customMotivation,
    };

    // 订阅任务公告
    this.subscribeTo('SIMPLE_TASK_ANNOUNCEMENT');
  }

  /**
   * 获取技能成功率
   * @param skillName - 技能名称
   * @returns 成功率 (0-1)，如果没有经验返回 0.5（不确定）
   */
  getSkillSuccessRate(skillName: string): number {
    const skill = this.skills.get(skillName);

    if (!skill || skill.count === 0) {
      return 0.5;  // 没有经验，不确定
    }

    return skill.successCount / skill.count;
  }

  /**
   * 计算对任务的"愿意程度"（0-1）
   * 这是极简路由的核心
   */
  calculateWillingness(task: SimpleTaskAnnouncement): number {
    // 1. 如果这个任务类型，我有经验的
    const taskSkill = `task_${task.taskType}`;
    const successRate = this.getSkillSuccessRate(taskSkill);
    const experienceCount = this.skills.get(taskSkill)?.count || 0;

    // 2. 基础成功/失败评分
    let willingness = successRate;

    // 3. 经验越多，越有信心
    // 经验少于 3 次，降低信心
    if (experienceCount < 3) {
      willingness *= 0.8;
    }

    // 4. 连续失败的情况
    // 如果连续失败 > 3 次，大幅增加探索意愿
    const consecutiveFails = this.consecutiveFailures.get(taskSkill) || 0;
    if (consecutiveFails >= this.motivation.maxConsecutiveFailures) {
      willingness += this.motivation.consecutiveFailureBonus;
      console.log(`[${this.id}] High consecutive failures (${consecutiveFails}), exploring`);
    }

    // 5. 连续成功的情况
    // 如果连续成功很多，增加"挑战困难任务"的意愿
    const consecutiveSuccesses = this.consecutiveSuccesses.get(taskSkill) || 0;
    if (successRate > this.motivation.highSuccessThreshold && consecutiveSuccesses > 3) {
      willingness += this.motivation.highSuccessBonus;
      console.log(`[${this.id}] High success rate (${successRate.toFixed(2)}), seeking new challenges`);
    }

    // 6. 完全没有经验的任务
    // 给一个不确定值，介于探索和保守之间
    if (experienceCount === 0) {
      // 随机在 0.3-0.7 之间
      willingness = 0.3 + Math.random() * 0.4;
      console.log(`[${this.id}] No experience, random willingness: ${willingness.toFixed(3)}`);
    }

    // 7. 添加随机性（"随机冲动"）
    if (Math.random() < this.motivation.randomness) {
      willingness += 0.2;  // 随机增加意愿
      console.log(`[${this.id}] Random impulse +0.2`);
    }

    // 8. 确保在 0-1 之间
    willingness = Math.max(0, Math.min(1, willingness));

    return willingness;
  }

  /**
   * 处理任务公告
   * 决定是否投标
   */
  protected async handleSimpleTaskAnnouncement(event: Event): Promise<void> {
    const task = event.payload as SimpleTaskAnnouncement;

    // 计算愿意程度
    const willingness = this.calculateWillingness(task);

    // 提交报价
    if (willingness > 0) {
      this.publishBid(task.taskId, willingness);
    } else {
      console.log(`[${this.id}] Not willing to bid for ${task.taskId} (willingness: ${willingness.toFixed(3)})`);
    }
  }

  /**
   * 发布报价
   */
  private publishBid(taskId: string, willingness: number): void {
    const bid: SimpleBid = {
      agentId: this.id,
      willing: willingness,
      timestamp: Date.now(),
    };

    this.eventBus?.publish({
      type: 'SIMPLE_BID',
      sourceAgent: this.id,
      payload: {
        taskId,
        agentId: this.id,
        willing: willingness,
        timestamp: Date.now(),
      },
    });

    console.log(`[${this.id}] Bid for ${taskId}: willing = ${willingness.toFixed(3)}`);
  }

  /**
   * 更新技能记录
   * @param taskType - 任务类型
   * @param success - 是否成功
   */
  updateSkill(taskType: string, success: boolean): void {
    const skillName = `task_${taskType}`;

    const skill = this.skills.get(skillName) || {
      successCount: 0,
      failCount: 0,
      count: 0,
    };

    skill.count += 1;

    if (success) {
      skill.successCount += 1;

      // 更新连续成功
      this.consecutiveSuccesses.set(skillName, (this.consecutiveSuccesses.get(skillName) || 0) + 1);
      this.consecutiveFailures.set(skillName, 0);  // 重置连续失败

    } else {
      skill.failCount += 1;

      // 更新连续失败
      this.consecutiveFailures.set(skillName, (this.consecutiveFailures.get(skillName) || 0) + 1);
      this.consecutiveSuccesses.set(skillName, 0);  // 重置连续成功
    }

    this.skills.set(skillName, skill);

    console.log(`[${this.id}] Skill updated for ${taskType}:`)
    console.log(`  Success: ${skill.successCount}, Fail: ${skill.failCount}, Total: ${skill.count}`)
    console.log(`  Success Rate: ${(skill.successCount / skill.count).toFixed(3)}`)
    console.log(`  Consecutive Successes: ${this.consecutiveSuccesses.get(skillName) || 0}`)
    console.log(`  Consecutive Failures: ${this.consecutiveFailures.get(skillName) || 0}`)
  }

  /**
   * 处理事件
   */
  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case 'SIMPLE_TASK_ANNOUNCEMENT':
        await this.handleSimpleTaskAnnouncement(event);
        break;

      case 'TASK_ASSIGNED':
        await this.handleTaskAssignment(event);
        break;

      default:
        await super.handle(event);
    }
  }
}

// 辅助类型定义
type SimpleSkill = SimpleSkillRecord;
