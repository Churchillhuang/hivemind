/**
 * Agent 技能配置文件
 * 记录每个 agent 的技能历史和熟练度
 *
 * 核心思想：不是预设角色，而是根据任务完成历史自然形成"专长"
 */

/**
 * SkillRecord - 单个技能记录
 */
export interface SkillRecord {
  /**
   * 技能评分（0-1）
   * = successCount / count
   */
  score: number;

  /**
   * 总尝试次数
   */
  count: number;

  /**
   * 成功次数
   */
  successCount: number;

  /**
   * 平均耗时（秒）
   */
  avgTime: number;

  /**
   * 最后使用时间（Unix timestamp）
   */
  lastUsed: number;

  /**
   * 技能类型（用于分类）
   * - 'domain': 领域技能（哲学、编程、写作...）
   * - 'tool': 工具技能（python、wget、curl...）
   * - 'method': 方法技能（分析、综合、翻译...）
   */
  type: "domain" | "tool" | "method";

  /**
   * 技能标签（用于灵活匹配）
   */
  tags: string;

  /**
   * 最小成功次数（才能被认为"熟练"）
   * 例如：至少做 3 次以上才算真正掌握
   */
  minSuccesses: number;
}

/**
 * SkillProfile - Agent 技能配置文件
 */
export interface SkillProfile {
  /**
   * 动态技能库
   * Key: 技能名称（如 'philosophy_discussion', 'python_data'）
   * Value: 技能记录
   */
  dynamicSkills: Map<string, SkillRecord>;

  /**
   * 主动加载的技能库（来自 SkillLearning 提炼）
   * 这里存储的是"预学习"的技能，但没有实际做过
   * Agent 可以通过这些技能快速适应新任务
   */
  activeSkills: Map<
    string,
    {
      skillName: string;
      confidence: number; // 0-1，提炼时的信心度
      extractedAt: number; // 提取时间
    }
  >;

  /**
   * 探索设置
   */
  exploration: {
    /**
     * 探索概率（0-1）
     * 无论技能评分如何，都有这个概率强制探索新任务
     */
    probability: number;

    /**
     * 探索持续时间限制（秒）
     * 对于完全没有经验的任务，最多尝试多长时间
     */
    maxTryTime: number;

    /**
     * 探索最大重试次数
     * 某个任务如果一直失败，最多尝试几次
     */
    maxRetries: number;
  };

  /**
   * 技能衰减设置
   */
  decay: {
    /**
     * 衰减周期（秒）
     * 每隔多少秒衰减一次评分
     */
    interval: number;

    /**
     * 衰减比例（0-1）
     * 每次衰减当前评分的多少
     */
    rate: number;

    /**
     * 最小评分
     * 技能评分不会低于这个值
     */
    minScore: number;

    /**
     * 保护期（秒）
     * 最近使用过的技能不衰减
     */
    protectionPeriod: number;
  };
}

/**
 * TaskSkillRequirement - 任务技能需求
 */
export interface TaskSkillRequirement {
  /**
   * 需要的技能列表
   * Key: 技能名称
   * Value: 最小评分（例如 {'python': 0.8} 表示需要 0.8 以上的 python 技能）
   */
  requiredSkills: Map<string, number>;

  /**
   * 可选技能（加分项）
   */
  optionalSkills?: Map<string, number>;

  /**
   * 技能匹配模式
   * - 'all': 必须满足所有 requiredSkills
   * - 'any': 只需满足任意一个 requiredSkills
   * - 'majority': 至少满足 50% 以上
   */
  matchMode: "all" | "any" | "majority";
}

/**
 * BidWithSkills - 带技能评分的报价
 */
export interface BidWithSkills {
  agentId: string;
  capabilities: string[];

  /**
   * 技能匹配评分（0-1）
   * 越高表示技能越匹配
   */
  skillMatchScore: number;

  /**
   * 各个技能的实际评分
   */
  skillScores: Map<string, number>;

  estimatedTimeMs: number;
  currentLoad: number;
  bidScore: number;
  timestamp: number;

  /**
   * 是否是探索性投标
   * 如果是，说明这个 agent 没有相关经验，但想尝试
   */
  isExploration: boolean;
}

/**
 * Agent 扩展 - 添加技能管理能力
 */
export class SkillfulAgent {
  /**
   * 技能配置文件
   */
  public skillProfile: SkillProfile;

  constructor() {
    this.skillProfile = {
      dynamicSkills: new Map(),
      activeSkills: new Map(),
      exploration: {
        probability: 0.1, // 默认 10% 探索概率
        maxTryTime: 300, // 最多尝试 5 分钟
        maxRetries: 3, // 最多重试 3 次
      },
      decay: {
        interval: 86400, // 24 小时衰减一次
        rate: 0.1, // 每次衰减 10%
        minScore: 0.3, // 最低保留 0.3
        protectionPeriod: 2592000, // 30 天内的技能不衰减
      },
    };
  }

  /**
   * 更新技能评分
   * @param skillName - 技能名称
   * @param success - 是否成功
   * @param duration - 耗时（秒）
   * @param type - 技能类型
   * @param tags - 技能标签
   */
  updateSkill(
    skillName: string,
    success: boolean,
    duration: number,
    type: "domain" | "tool" | "method" = "domain",
    tags: string = "",
  ): void {
    const existing = this.skillProfile.dynamicSkills.get(skillName);

    const record: SkillRecord = existing || {
      score: 0,
      count: 0,
      successCount: 0,
      avgTime: 0,
      lastUsed: 0,
      type,
      tags,
      minSuccesses: 3, // 默认需要至少 3 次成功才算"熟练"
    };

    // 更新计数
    record.count += 1;
    if (success) {
      record.successCount += 1;
    }

    // 计算新的评分
    const newScore = record.successCount / record.count;

    // 如果已经有了经验，平均耗时才有效；否则用当前耗时
    if (existing) {
      record.avgTime = (record.avgTime * (record.count - 1) + duration) / record.count;
    } else {
      record.avgTime = duration;
    }

    record.lastUsed = Date.now();
    record.score = newScore;

    this.skillProfile.dynamicSkills.set(skillName, record);

    console.log(`[${this.getId()}] Skill updated: ${skillName}`);
    console.log(`  Score: ${record.score.toFixed(3)} (${record.successCount}/${record.count})`);
    console.log(`  Avg Time: ${record.avgTime.toFixed(1)}s`);
  }

  /**
   * 获取技能评分
   * @param skillName - 技能名称
   * @returns 技能评分（如果没有记录，返回 0）
   */
  getSkillScore(skillName: string): number {
    const record = this.skillProfile.dynamicSkills.get(skillName);
    return record?.score || 0;
  }

  /**
   * 检查是否满足技能需求
   * @param requirements - 技能需求
   * @returns 是否满足
   */
  meetsSkillRequirements(requirements: TaskSkillRequirement): boolean {
    const { requiredSkills, matchMode } = requirements;

    // 特殊情况：如果没有明确技能需求，则默认可以处理
    if (requiredSkills.size === 0) {
      return true;
    }

    switch (matchMode) {
      case "all":
        // 必须满足所有技能
        for (const [skill, minScore] of requiredSkills.entries()) {
          const myScore = this.getSkillScore(skill);
          if (myScore < minScore) {
            return false;
          }
        }
        return true;

      case "any":
        // 只需满足任意一个
        for (const [skill, minScore] of requiredSkills.entries()) {
          const myScore = this.getSkillScore(skill);
          if (myScore >= minScore) {
            return true;
          }
        }
        return false;

      case "majority":
        // 至少满足 50%
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

  /**
   * 计算技能匹配评分（0-1）
   * 用于报价时的技能权重
   * @param requirements - 技能需求
   * @returns 技能匹配评分
   */
  calculateSkillMatchScore(requirements: TaskSkillRequirement): number {
    const { requiredSkills, optionalSkills } = requirements;

    if (requiredSkills.size === 0) {
      return 1.0; // 没有需求，完全匹配
    }

    // 计算需要技能的匹配度
    let requiredScore = 0;
    for (const [skill, minScore] of requiredSkills.entries()) {
      const myScore = this.getSkillScore(skill);
      // 超出需求的部分也加分，但不超过 1
      requiredScore += Math.min(1, myScore / minScore);
    }
    requiredScore /= requiredSkills.size;

    // 计算可选技能的匹配度（作为额外加分）
    let optionalScore = 0;
    if (optionalSkills && optionalSkills.size > 0) {
      for (const [skill, minScore] of optionalSkills.entries()) {
        const myScore = this.getSkillScore(skill);
        optionalScore += Math.min(1, myScore / minScore);
      }
      optionalScore /= optionalSkills.size;
    }

    // 综合评分（0-1）
    return requiredScore * 0.8 + optionalScore * 0.2;
  }

  /**
   * 加载 Active Skill（来自 SkillLearning）
   * 这些是"预学习"的技能，但还没有实际执行过
   * Agent 可以通过这些技能快速适应新任务
   * @param skillName - 技能名称
   * @param confidence - 信心度（从 SkillLearning 提炼时的评分）
   */
  loadActiveSkill(skillName: string, confidence: number): void {
    this.skillProfile.activeSkills.set(skillName, {
      skillName,
      confidence,
      extractedAt: Date.now(),
    });

    console.log(
      `[${this.getId()}] Active skill loaded: ${skillName} (confidence: ${(confidence * 100).toFixed(0)}%)`,
    );
  }

  /**
   * 技能衰减（定期清理）
   * 长期不使用的技能，评分逐渐下降
   */
  applySkillDecay(): void {
    const now = Date.now();
    const decayConfig = this.skillProfile.decay;

    for (const [skillName, record] of this.skillProfile.dynamicSkills.entries()) {
      // 保护期内的技能不衰减
      const age = now - record.lastUsed;
      if (age < decayConfig.protectionPeriod) {
        continue;
      }

      // 检查是否到达衰减周期
      const periodsSinceLastUse = Math.floor(age / decayConfig.interval);

      if (periodsSinceLastUse > 0) {
        // 衰减计算
        let newScore = record.score;
        for (let i = 0; i < periodsSinceLastUse; i++) {
          newScore = newScore * (1 - decayConfig.rate);
        }

        // 不低于最小值
        newScore = Math.max(newScore, decayConfig.minScore);
        newScore = Math.min(newScore, 1.0);

        record.score = newScore;

        console.log(`[${this.getId()}] Skill decayed: ${skillName}`);
        console.log(`  ${record.score.toFixed(3)} → ${newScore.toFixed(3)}`);
      }
    }
  }

  /**
   * 判断是否应该探索（而非利用）
   * @param taskSkillRequirements - 任务技能需求
   * @param currentSkillMatchScore - 当前技能匹配评分
   * @returns 是否探索
   */
  shouldExplore(
    taskSkillRequirements: TaskSkillRequirement,
    currentSkillMatchScore: number,
  ): boolean {
    // 探索概率
    if (Math.random() < this.skillProfile.exploration.probability) {
      return true;
    }

    // 当前技能完全不匹配，且有主动加载的相关技能
    if (currentSkillMatchScore === 0) {
      for (const skillName of taskSkillRequirements.requiredSkills.keys()) {
        if (this.skillProfile.activeSkills.has(skillName)) {
          return true; // 有预学习的技能，值得尝试
        }
      }
    }

    // 否则，不探索
    return false;
  }

  /**
   * 获取技能统计信息（调试用）
   */
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

  /**
   * 抽象方法，需要子类实现
   */
  protected getId(): string {
    throw new Error("getId() must be implemented by subclass");
  }
}
