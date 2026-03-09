/**
 * IncentiveSystem - 内部激励机制
 *
 * 不是硬编码规则，而是让Agent基于激励机制自主决策：
 * - 成功 → 奖励 → 强化行为
 * - 失败 → 惩罚 → 调整行为
 * - 协作成功 → 共享奖励
 *
 * Agent会学习：
 * - 什么情况下应该独自执行
 * - 什么情况下应该寻求协作
 * - 什么情况下应该拒绝任务
 */

export interface IncentiveConfig {
  // 成功奖励
  successReward: number; // 独自完成任务的奖励
  collaborationBonus: number; // 协作成功的额外奖励
  skillImprovement: number; // 技能提升幅度

  // 失败惩罚
  failurePenalty: number; // 任务失败的惩罚
  overconfidencePenalty: number; // 过度自信的额外惩罚
  reputationLoss: number; // 声誉损失

  // 协作激励
  collaborationReward: number; // 参与协作的奖励
  leadershipBonus: number; // 领导协作的额外奖励

  // 学习参数
  learningRate: number; // 学习率
  confidenceAdjustment: number; // 置信度调整幅度
}

export const DEFAULT_INCENTIVE_CONFIG: IncentiveConfig = {
  successReward: 1.0,
  collaborationBonus: 0.5,
  skillImprovement: 0.1,

  failurePenalty: -0.5,
  overconfidencePenalty: -0.3,
  reputationLoss: -0.2,

  collaborationReward: 0.3,
  leadershipBonus: 0.2,

  learningRate: 0.1,
  confidenceAdjustment: 0.05,
};

/**
 * Agent的内部状态（用于决策）
 */
export interface AgentInternalState {
  // 技能自信度（动态调整）
  skillConfidence: Map<string, number>; // skill -> confidence

  // 历史统计
  stats: {
    tasksAttempted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    collaborationsJoined: number;
    collaborationsLed: number;
    collaborationsSucceeded: number;
  };

  // 内部奖励积分
  rewardPoints: number;

  // 声誉分数
  reputation: number;

  // 决策阈值（学习得来）
  confidenceThreshold: number; // 高于此阈值才独自执行
  collaborationThreshold: number; // 低于此阈值才寻求协作
}

/**
 * 激励系统
 */
export class IncentiveSystem {
  private config: IncentiveConfig;
  private agentStates: Map<string, AgentInternalState> = new Map();

  constructor(config?: Partial<IncentiveConfig>) {
    this.config = { ...DEFAULT_INCENTIVE_CONFIG, ...config };
  }

  /**
   * 初始化Agent状态
   */
  initializeAgent(agentId: string, skills: string[]): void {
    const state: AgentInternalState = {
      skillConfidence: new Map(),
      stats: {
        tasksAttempted: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        collaborationsJoined: 0,
        collaborationsLed: 0,
        collaborationsSucceeded: 0,
      },
      rewardPoints: 0,
      reputation: 1.0,
      confidenceThreshold: 0.7, // 初始阈值
      collaborationThreshold: 0.5, // 初始阈值
    };

    // 初始化技能自信度
    for (const skill of skills) {
      state.skillConfidence.set(skill, 0.7); // 初始自信度
    }

    this.agentStates.set(agentId, state);
  }

  /**
   * Agent基于激励机制做决策
   *
   * 不是硬编码规则，而是Agent权衡：
   * "如果独自执行成功，我能获得X奖励"
   * "如果失败，我会失去Y"
   * "如果协作，大家能获得Z"
   */
  decide(
    agentId: string,
    taskMatch: {
      matchedSkills: string[];
      missingSkills: string[];
      confidence: number;
    },
  ): {
    action: "execute_alone" | "seek_collaboration" | "reject";
    reasoning: string;
    expectedReward: number;
  } {
    const state = this.agentStates.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not initialized`);
    }

    // 计算预期收益
    const expectedSuccessReward = this.calculateExpectedReward(
      state,
      taskMatch.confidence,
      taskMatch.matchedSkills.length,
      taskMatch.missingSkills.length,
    );

    // 决策逻辑（基于激励机制，不是硬编码）

    // 1. 如果有缺失技能，考虑协作
    if (taskMatch.missingSkills.length > 0) {
      const collaborationBenefit = this.calculateCollaborationBenefit(
        state,
        taskMatch.matchedSkills.length,
        taskMatch.missingSkills.length,
      );

      if (collaborationBenefit > expectedSuccessReward) {
        return {
          action: "seek_collaboration",
          reasoning: `Missing skills: ${taskMatch.missingSkills.join(", ")}. Collaboration expected reward: ${collaborationBenefit.toFixed(2)} > solo: ${expectedSuccessReward.toFixed(2)}`,
          expectedReward: collaborationBenefit,
        };
      }
    }

    // 2. 如果自信度足够高，独自执行
    if (taskMatch.confidence >= state.confidenceThreshold) {
      // 考虑失败的代价
      const failureCost = this.calculateFailureCost(state, taskMatch.confidence);

      // 期望收益 = 成功奖励 * 成功概率 - 失败惩罚 * 失败概率
      const expectedValue =
        expectedSuccessReward * taskMatch.confidence - failureCost * (1 - taskMatch.confidence);

      if (expectedValue > 0) {
        return {
          action: "execute_alone",
          reasoning: `High confidence (${(taskMatch.confidence * 100).toFixed(0)}%) >= threshold (${(state.confidenceThreshold * 100).toFixed(0)}%). Expected value: ${expectedValue.toFixed(2)}`,
          expectedReward: expectedValue,
        };
      }
    }

    // 3. 自信度不够，拒绝或协作
    if (taskMatch.confidence < state.collaborationThreshold) {
      return {
        action: "reject",
        reasoning: `Low confidence (${(taskMatch.confidence * 100).toFixed(0)}%) < threshold (${(state.collaborationThreshold * 100).toFixed(0)}%). High risk of failure.`,
        expectedReward: 0,
      };
    }

    // 4. 边缘情况，寻求协作
    return {
      action: "seek_collaboration",
      reasoning: `Medium confidence (${(taskMatch.confidence * 100).toFixed(0)}%). Better to collaborate for safety.`,
      expectedReward: this.calculateCollaborationBenefit(
        state,
        taskMatch.matchedSkills.length,
        taskMatch.missingSkills.length,
      ),
    };
  }

  /**
   * 记录执行结果，更新激励
   */
  recordOutcome(
    agentId: string,
    outcome: {
      success: boolean;
      wasCollaboration: boolean;
      participants?: string[];
      confidence: number;
    },
  ): void {
    const state = this.agentStates.get(agentId);
    if (!state) {
      return;
    }

    state.stats.tasksAttempted++;

    if (outcome.success) {
      state.stats.tasksSucceeded++;

      if (outcome.wasCollaboration && outcome.participants) {
        // 协作成功
        state.stats.collaborationsSucceeded++;
        state.rewardPoints += this.config.collaborationReward;

        // 如果是领导者（发起协作），获得额外奖励
        if (outcome.participants[0] === agentId) {
          state.rewardPoints += this.config.leadershipBonus;
        }
      } else {
        // 独自完成
        state.rewardPoints += this.config.successReward;
      }

      // 成功后提升自信度
      this.adjustConfidence(state, outcome.confidence, true);
    } else {
      state.stats.tasksFailed++;
      state.rewardPoints += this.config.failurePenalty;
      state.reputation += this.config.reputationLoss;

      // 检查是否过度自信
      if (outcome.confidence > state.confidenceThreshold) {
        state.rewardPoints += this.config.overconfidencePenalty;
        console.log(
          `[IncentiveSystem] Agent ${agentId} was overconfident (${(outcome.confidence * 100).toFixed(0)}% confidence but failed)`,
        );
      }

      // 失败后降低自信度
      this.adjustConfidence(state, outcome.confidence, false);
    }

    // 更新阈值（学习）
    this.updateThresholds(state);

    console.log(
      `[IncentiveSystem] Agent ${agentId} outcome: ${outcome.success ? "SUCCESS" : "FAILED"}`,
    );
    console.log(
      `[IncentiveSystem] Reward points: ${state.rewardPoints.toFixed(2)}, Reputation: ${state.reputation.toFixed(2)}`,
    );
  }

  /**
   * 计算预期奖励
   */
  private calculateExpectedReward(
    state: AgentInternalState,
    confidence: number,
    matchedSkills: number,
    missingSkills: number,
  ): number {
    // 基础奖励 * 成功概率 * 技能匹配度
    const baseReward = this.config.successReward;
    const successProbability = confidence;
    const skillFactor = matchedSkills / Math.max(1, matchedSkills + missingSkills);

    return baseReward * successProbability * skillFactor * state.reputation;
  }

  /**
   * 计算协作收益
   */
  private calculateCollaborationBenefit(
    state: AgentInternalState,
    matchedSkills: number,
    missingSkills: number,
  ): number {
    // 协作奖励 + 额外奖励 + 技能互补收益
    const collaborationReward = this.config.collaborationReward;
    const bonus = this.config.collaborationBonus;

    // 缺失技能越多，协作收益越高
    const complementarityFactor = missingSkills / Math.max(1, matchedSkills + missingSkills);

    return (collaborationReward + bonus) * (1 + complementarityFactor) * state.reputation;
  }

  /**
   * 计算失败代价
   */
  private calculateFailureCost(state: AgentInternalState, confidence: number): number {
    const basePenalty = Math.abs(this.config.failurePenalty);

    // 自信度越高，失败代价越大（防止过度自信）
    const confidenceFactor = confidence;

    return basePenalty * (1 + confidenceFactor);
  }

  /**
   * 调整技能自信度（学习）
   */
  private adjustConfidence(state: AgentInternalState, confidence: number, success: boolean): void {
    const adjustment = success
      ? this.config.confidenceAdjustment
      : -this.config.confidenceAdjustment;

    // 根据结果调整阈值
    if (success) {
      // 成功了，可以稍微降低阈值（更愿意接受挑战）
      state.confidenceThreshold = Math.max(
        0.5,
        state.confidenceThreshold - adjustment * this.config.learningRate,
      );
    } else {
      // 失败了，提高阈值（更谨慎）
      state.confidenceThreshold = Math.min(
        0.9,
        state.confidenceThreshold + adjustment * this.config.learningRate,
      );
    }
  }

  /**
   * 更新决策阈值（学习）
   */
  private updateThresholds(state: AgentInternalState): void {
    // 根据历史成功率调整阈值
    const successRate = state.stats.tasksSucceeded / Math.max(1, state.stats.tasksAttempted);

    if (successRate > 0.8) {
      // 成功率很高，可以更激进
      state.confidenceThreshold *= 0.95;
      state.collaborationThreshold *= 0.95;
    } else if (successRate < 0.5) {
      // 成功率很低，需要更谨慎
      state.confidenceThreshold *= 1.05;
      state.collaborationThreshold *= 1.05;
    }

    // 保持在合理范围
    state.confidenceThreshold = Math.max(0.5, Math.min(0.9, state.confidenceThreshold));
    state.collaborationThreshold = Math.max(0.3, Math.min(0.7, state.collaborationThreshold));
  }

  /**
   * 获取Agent状态（用于决策）
   */
  getAgentState(agentId: string): AgentInternalState | undefined {
    return this.agentStates.get(agentId);
  }

  /**
   * 获取统计信息
   */
  getStats(agentId: string): string {
    const state = this.agentStates.get(agentId);
    if (!state) {
      return "Agent not found";
    }

    return `
Agent ${agentId} Statistics:
- Tasks: ${state.stats.tasksAttempted} attempted, ${state.stats.tasksSucceeded} succeeded, ${state.stats.tasksFailed} failed
- Success rate: ${((state.stats.tasksSucceeded / Math.max(1, state.stats.tasksAttempted)) * 100).toFixed(0)}%
- Collaborations: ${state.stats.collaborationsJoined} joined, ${state.stats.collaborationsLed} led, ${state.stats.collaborationsSucceeded} succeeded
- Reward points: ${state.rewardPoints.toFixed(2)}
- Reputation: ${state.reputation.toFixed(2)}
- Confidence threshold: ${(state.confidenceThreshold * 100).toFixed(0)}%
- Collaboration threshold: ${(state.collaborationThreshold * 100).toFixed(0)}%
		`.trim();
  }
}
