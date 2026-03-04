/**
 * SkillDrivenAgent - 基于技能评分的 Agent
 *
 * 扩展 CoordinationAgent，添加：
 * - 动态技能管理
 * - 基于技能评分的报价
 * - 探索 vs 利用机制
 */

import type { Event } from "../events/Event.js";
import type { EventBus } from "../events/EventBus.js";
import { CoordinationAgent, type AgentCapabilities } from "./CoordinationAgent.js";
import {
  SkillProfile,
  TaskSkillRequirement,
  BidWithSkills,
  SkillfulAgent,
} from "./SkillProfile.js";

export class SkillDrivenAgent extends CoordinationAgent implements SkillfulAgent {
  /**
   * 技能配置文件
   */
  public skillProfile: SkillProfile;

  /**
   * 当前正在处理的任务
   * 用于记录任务开始时间，计算耗时
   */
  private currentTask: {
    taskId: string;
    startTime: number;
    skillNames: string[];
  } | null = null;

  constructor(
    config: {
      id: string;
      role: string;
      type: "system" | "functional";
      description?: string;
    },
    capabilities: AgentCapabilities,
    eventBus?: EventBus,
    explorationProbability?: number,
  ) {
    super(config, capabilities, eventBus);

    // 初始化技能配置文件
    this.skillProfile = {
      dynamicSkills: new Map(),
      activeSkills: new Map(),
      exploration: {
        probability: explorationProbability ?? 0.1,
        maxTryTime: 300,
        maxRetries: 3,
      },
      decay: {
        interval: 86400, // 24 小时
        rate: 0.1, // 每次衰减 10%
        minScore: 0.3, // 最低保留 0.3
        protectionPeriod: 2592000, // 30 天
      },
    };
  }

  /**
   * 实现 SkillfulAgent 接口
   */
  protected getId(): string {
    return this.id;
  }

  /**
   * 基于技能评分的报价
   * 重写父类的 placeBid 方法
   */
  protected placeBid(task: unknown): BidWithSkills | null {
    // 1. 解析任务技能需求
    const requirements: TaskSkillRequirement = this.parseTaskRequirements(task);

    // 2. 检查是否满足技能需求
    if (!this.meetsSkillRequirements(requirements)) {
      return null;
    }

    // 3. 计算技能匹配评分
    const skillMatchScore = this.calculateSkillMatchScore(requirements);

    // 4. 判断是否探索
    const isExploration = this.shouldExplore(requirements, skillMatchScore);

    // 5. 如果探索，则不拒绝（即使技能完全不匹配）
    // 但需要检查是否有主动加载的技能
    if (!isExploration && skillMatchScore === 0) {
      return null; // 既不探索，又不匹配 → 不投标
    }

    // 6. 估算耗时
    let estimatedTime = this.estimateTaskTime(task.taskType, task);

    // 如果是探索，增加耗时（假设不熟练）
    if (isExploration) {
      estimatedTime *= 1.5;
    }

    // 7. 计算基础评分（负载 + 耗时 + 随机性）
    const load = this.getCurrentLoad();
    const timeFactor = estimatedTime / 10000; // 归一化
    const randomFactor = Math.random() * 0.2;

    let baseScore = load * 0.5 + timeFactor * 0.3 + randomFactor;

    // 8. 技能匹配度加权
    // skillMatchScore 越高 → score 越低（更愿意接）
    const skillBonus = (1 - skillMatchScore) * 0.4;
    if (!isExploration) {
      baseScore -= skillBonus;
    } else {
      // 探索阶段：添加探索成本
      baseScore += 0.3;
    }

    return {
      agentId: this.id,
      capabilities: Array.from(this.skillProfile.dynamicSkills.keys()),
      skillMatchScore,
      skillScores: this.getSkillScores(requirements),
      estimatedTimeMs: estimatedTime,
      currentLoad: load,
      bidScore: baseScore,
      isExploration,
      timestamp: Date.now(),
    } as BidWithSkills;
  }

  /**
   * 解析任务技能需求
   * 从任务描述中推断需要的技能
   */
  private parseTaskRequirements(task: unknown): TaskSkillRequirement {
    const taskData = (task ?? {}) as {
      taskType?: string;
      requiredSkills?: Record<string, number>;
    };
    const requiredSkills = new Map<string, number>();

    // 方式 1: 任务明确指定技能需求
    if (taskData.requiredSkills) {
      for (const [skill, minScore] of Object.entries(taskData.requiredSkills)) {
        requiredSkills.set(skill, minScore);
      }
    }

    // 方式 2: 根据任务类型推断（简单的启发式规则）
    else {
      const taskType = taskData.taskType;

      if (taskType === "philosophy_discussion") {
        requiredSkills.set("philosophy_analysis", 0.6);
        requiredSkills.set("chinese_writing", 0.8);
      } else if (taskType === "file_analysis") {
        requiredSkills.set("code_analysis", 0.7);
        requiredSkills.set("language_detection", 0.6);
      } else if (taskType === "data_processing") {
        requiredSkills.set("python", 0.7);
        requiredSkills.set("data_analysis", 0.7);
      } else if (taskType === "writing") {
        requiredSkills.set("chinese_writing", 0.7);
        requiredSkills.set("writing_structure", 0.6);
      } else if (taskType === "translation") {
        requiredSkills.set("translation", 0.7);
        requiredSkills.set("bilingual", 0.6);
      }
    }

    return {
      requiredSkills,
      optionalSkills: new Map(),
      matchMode: "all",
    };
  }

  /**
   * 获取当前任务相关的技能评分
   */
  private getSkillScores(requirements: TaskSkillRequirement): Map<string, number> {
    const scores = new Map<string, number>();

    for (const skillName of requirements.requiredSkills.keys()) {
      scores.set(skillName, this.getSkillScore(skillName));
    }

    return scores;
  }

  /**
   * 处理任务分配
   * 重写父类方法，记录任务开始时间
   */
  protected async handleTaskAssignment(event: Event): Promise<void> {
    const assignment = event.payload as { taskId: string; assignedTo: string };

    if (assignment.assignedTo === this.id) {
      const taskId = assignment.taskId;

      // 查找任务详情（需要从 taskQueue 获取，这里简化）
      // 假设我们从事件中也能获取到任务信息
      const taskPayload = event.payload as { task?: unknown };
      const task = taskPayload.task ?? {};
      const requirements = this.parseTaskRequirements(task);

      // 记录任务开始
      this.currentTask = {
        taskId,
        startTime: Date.now(),
        skillNames: Array.from(requirements.requiredSkills.keys()),
      };

      console.log(`[${this.id}] Task assigned: ${taskId}`);
      console.log(`  Required skills: ${this.currentTask.skillNames.join(", ")}`);

      // 调用父类方法处理
      await super.handleTaskAssignment(event);
    }
  }

  /**
   * 处理任务（重写，添加技能更新）
   */
  protected async processTask(taskId: string): Promise<void> {
    // 调用父类方法（实际执行任务）
    await super.processTask(taskId);

    // 记录任务完成
    const task = this.currentTask;
    if (task) {
      const duration = (Date.now() - task.startTime) / 1000; // 秒

      // 更新技能评分
      task.skillNames.forEach((skillName) => {
        // 简化：假设所有任务都成功
        // 实际应用中应该从任务结果判断
        const success = true;

        this.updateSkill(skillName, success, duration, "domain", skillName);
      });

      // 清除当前任务
      this.currentTask = null;
    }
  }

  /**
   * 从 SkillLearning 加载技能
   * 这个方法可以在 Agent 创建时调用，加载预学习的技能
   */
  loadSkillFromSkillLearning(skillName: string, confidence: number): void {
    this.loadActiveSkill(skillName, confidence);
  }

  /**
   * 定期执行技能衰减
   * 可以通过定时任务定期调用
   */
  performSkillDecay(): void {
    this.applySkillDecay();

    // 调试输出
    const stats = this.getSkillStats();
    console.log(`[${this.id}] Skill stats after decay:`);
    console.log(`  Total: ${stats.totalSkills}`);
    console.log(`  Average: ${stats.averageScore.toFixed(3)}`);
    if (stats.topSkills.length > 0) {
      console.log(
        `  Top: ${stats.topSkills.map((s) => `${s.name} (${s.score.toFixed(3)})`).join(", ")}`,
      );
    }
  }

  /**
   * 实现 SkillfulAgent 接口的方法
   */
  updateSkill(
    skillName: string,
    success: boolean,
    duration: number,
    type: "domain" | "tool" | "method",
    tags: string,
  ): void {
    const record = this.skillProfile.dynamicSkills.get(skillName);

    const newRecord = record || {
      score: 0,
      count: 0,
      successCount: 0,
      avgTime: 0,
      lastUsed: 0,
      type,
      tags,
      minSuccesses: 3,
    };

    newRecord.count += 1;
    if (success) {
      newRecord.successCount += 1;
    }

    const newScore = newRecord.successCount / newRecord.count;

    if (record) {
      newRecord.avgTime = (newRecord.avgTime * (newRecord.count - 1) + duration) / newRecord.count;
    } else {
      newRecord.avgTime = duration;
    }

    newRecord.lastUsed = Date.now();
    newRecord.score = newScore;

    this.skillProfile.dynamicSkills.set(skillName, newRecord);
  }

  getSkillScore(skillName: string): number {
    const record = this.skillProfile.dynamicSkills.get(skillName);
    return record?.score || 0;
  }

  meetsSkillRequirements(requirements: TaskSkillRequirement): boolean {
    const { requiredSkills, matchMode } = requirements;

    if (requiredSkills.size === 0) {
      return true;
    }

    switch (matchMode) {
      case "all":
        for (const [skill, minScore] of requiredSkills.entries()) {
          const myScore = this.getSkillScore(skill);
          if (myScore < minScore) {
            return false;
          }
        }
        return true;

      case "any":
        for (const [skill, minScore] of requiredSkills.entries()) {
          const myScore = this.getSkillScore(skill);
          if (myScore >= minScore) {
            return true;
          }
        }
        return false;

      case "majority":
        let metCount = 0;
        for (const [skill, minScore] of requiredSkills.entries()) {
          const myScore = this.getSkillScore(skill);
          if (myScore >= minScore) {
            metCount += 1;
          }
        }
        return metCount / requiredSkills.size >= 0.5;

      default:
        return false;
    }
  }

  calculateSkillMatchScore(requirements: TaskSkillRequirement): number {
    const { requiredSkills, optionalSkills } = requirements;

    if (requiredSkills.size === 0) {
      return 1.0;
    }

    let requiredScore = 0;
    for (const [skill, minScore] of requiredSkills.entries()) {
      const myScore = this.getSkillScore(skill);
      requiredScore += Math.min(1, myScore / minScore);
    }
    requiredScore /= requiredSkills.size;

    let optionalScore = 0;
    if (optionalSkills && optionalSkills.size > 0) {
      for (const [skill, minScore] of optionalSkills.entries()) {
        const myScore = this.getSkillScore(skill);
        optionalScore += Math.min(1, myScore / minScore);
      }
      optionalScore /= optionalSkills.size;
    }

    return requiredScore * 0.8 + optionalScore * 0.2;
  }

  applySkillDecay(): void {
    const now = Date.now();
    const decayConfig = this.skillProfile.decay;

    for (const [_skillName, record] of this.skillProfile.dynamicSkills.entries()) {
      const age = now - record.lastUsed;
      if (age < decayConfig.protectionPeriod) {
        continue;
      }

      const periodsSinceLastUse = Math.floor(age / decayConfig.interval);

      if (periodsSinceLastUse > 0) {
        let newScore = record.score;
        for (let i = 0; i < periodsSinceLastUse; i++) {
          newScore = newScore * (1 - decayConfig.rate);
        }
        newScore = Math.max(newScore, decayConfig.minScore);
        newScore = Math.min(newScore, 1.0);

        record.score = newScore;
      }
    }
  }

  loadActiveSkill(skillName: string, confidence: number): void {
    this.skillProfile.activeSkills.set(skillName, {
      skillName,
      confidence,
      extractedAt: Date.now(),
    });

    console.log(
      `[${this.id}] Active skill loaded: ${skillName} (confidence: ${(confidence * 100).toFixed(0)}%)`,
    );
  }

  shouldExplore(
    taskSkillRequirements: TaskSkillRequirement,
    currentSkillMatchScore: number,
  ): boolean {
    if (Math.random() < this.skillProfile.exploration.probability) {
      return true;
    }

    if (currentSkillMatchScore === 0) {
      for (const skillName of taskSkillRequirements.requiredSkills.keys()) {
        if (this.skillProfile.activeSkills.has(skillName)) {
          return true;
        }
      }
    }

    return false;
  }

  getSkillStats(): {
    totalSkills: number;
    averageScore: number;
    topSkills: Array<{ name: string; score: number; count: number }>;
  } {
    const skills = Array.from(this.skillProfile.dynamicSkills.values());

    if (skills.length === 0) {
      return {
        totalSkills: 0,
        averageScore: 0,
        topSkills: [],
      };
    }

    const totalScore = skills.reduce((sum, skill) => sum + skill.score, 0);
    const avgScore = totalScore / skills.length;

    const topSkills = skills
      .map((skill) => ({
        name: skill.type,
        score: skill.score,
        count: skill.count,
      }))
      .toSorted((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      totalSkills: skills.length,
      averageScore: avgScore,
      topSkills,
    };
  }
}
