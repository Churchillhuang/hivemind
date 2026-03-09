/**
 * ConsensusAgent - 具有共识决策能力的Agent基类
 *
 * 所有Agent都可以：
 * 1. 收到任务公告后自主评估是否参与
 * 2. 发布"舞蹈"声明自己的能力
 * 3. 支持其他Agent
 * 4. 撤回自己的提案
 * 5. 参与讨论
 * 6. 等待共识达成
 *
 * 没有中央决策者，Agent之间自主形成共识。
 */

import { BaseAgent } from "../core/Agent.js";
import type { Event } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import {
  type Dance,
  type Support,
  type Withdraw,
  type Discussion,
  type ConsensusReached,
  type TaskAnnouncement,
  type SkillMatch,
  type ConsensusState,
  type ConsensusConfig,
  DEFAULT_CONSENSUS_CONFIG,
} from "./consensus-types.js";
import type { HiveConfig } from "./HiveConfig.js";

/**
 * Agent技能评估函数类型
 */
export type SkillEvaluator = (task: TaskAnnouncement) => SkillMatch;

/**
 * 共识决策Agent基类
 */
export abstract class ConsensusAgent extends BaseAgent {
  protected hiveConfig: HiveConfig;
  protected consensusConfig: ConsensusConfig;
  protected skillEvaluator?: SkillEvaluator;

  // 当前参与的共识状态
  protected activeConsensuses: Map<string, ConsensusState> = new Map();

  // 技能记录（用于评估任务匹配度）
  protected skills: Map<string, { score: number; lastUsed: number }> = new Map();

  constructor(
    config: { id: string; role: string; type: "system" | "functional"; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super(config, eventBus);
    this.hiveConfig = hiveConfig;
    this.consensusConfig = DEFAULT_CONSENSUS_CONFIG;
  }

  /**
   * 设置技能评估器
   */
  setSkillEvaluator(evaluator: SkillEvaluator): void {
    this.skillEvaluator = evaluator;
  }

  /**
   * 启动共识Agent
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    // 订阅共识相关事件
    this.subscribeTo("TASK_ANNOUNCEMENT");
    this.subscribeTo("DANCE");
    this.subscribeTo("SUPPORT");
    this.subscribeTo("WITHDRAW");
    this.subscribeTo("DISCUSSION");
    this.subscribeTo("CONSENSUS_REACHED");
  }

  /**
   * 停止共识Agent
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;

    // 清理活跃的共识状态
    this.activeConsensuses.clear();
  }

  /**
   * 处理事件
   */
  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case "TASK_ANNOUNCEMENT":
        await this.onTaskAnnounced(event.payload as TaskAnnouncement);
        break;
      case "DANCE":
        await this.onDanceReceived(event.payload as Dance);
        break;
      case "SUPPORT":
        await this.onSupportReceived(event.payload as Support);
        break;
      case "WITHDRAW":
        await this.onWithdrawReceived(event.payload as Withdraw);
        break;
      case "DISCUSSION":
        await this.onDiscussionReceived(event.payload as Discussion);
        break;
      case "CONSENSUS_REACHED":
        await this.onConsensusReached(event.payload as ConsensusReached);
        break;
    }
  }

  /**
   * 收到任务公告 - Agent自主决定是否参与
   */
  protected async onTaskAnnounced(task: TaskAnnouncement): Promise<void> {
    console.log(`[${this.id}] Received task announcement: ${task.taskId}`);

    // 1. 评估任务
    const match = this.evaluateTask(task);

    // 2. 如果匹配度太低，不参与
    if (match.score < 0.3) {
      console.log(`[${this.id}] Not participating - low match score: ${match.score.toFixed(2)}`);
      return;
    }

    // 3. 初始化共识状态
    const state: ConsensusState = {
      taskId: task.taskId,
      announcement: task,
      dances: new Map(),
      supports: new Map(),
      withdraws: [],
      discussions: [],
      startTime: Date.now(),
      deadline: Date.now() + this.consensusConfig.maxWaitTime,
      consensusReached: false,
    };
    this.activeConsensuses.set(task.taskId, state);

    // 4. 发布自己的舞蹈
    await this.publishDance(task, match);

    // 5. 启动共识监控
    this.startConsensusMonitor(task.taskId);
  }

  /**
   * 评估任务匹配度
   *
   * 子类可以重写此方法来实现特定的评估逻辑。
   * 默认实现基于技能匹配。
   */
  protected evaluateTask(task: TaskAnnouncement): SkillMatch {
    // 如果有自定义评估器，使用它
    if (this.skillEvaluator) {
      return this.skillEvaluator(task);
    }

    // 默认：基于技能匹配
    const matchedSkills: string[] = [];
    let totalScore = 0;

    // 检查任务需要的能力
    for (const cap of task.requiredCapabilities) {
      const skill = this.skills.get(cap);
      if (skill) {
        matchedSkills.push(cap);
        totalScore += skill.score;
      }
    }

    // 计算匹配度
    const score = matchedSkills.length > 0 ? totalScore / matchedSkills.length : 0;

    return {
      score,
      matchedSkills,
      reasoning:
        score > 0
          ? `Matched ${matchedSkills.length} skills: ${matchedSkills.join(", ")}`
          : "No matching skills",
    };
  }

  /**
   * 发布舞蹈
   */
  protected async publishDance(task: TaskAnnouncement, match: SkillMatch): Promise<void> {
    const dance: Dance = {
      type: "DANCE",
      taskId: task.taskId,
      agentId: this.id,
      confidence: match.score,
      matchedSkills: match.matchedSkills,
      reasoning: match.reasoning,
      proposal: "direct", // 默认直接执行，子类可以覆盖
      timestamp: Date.now(),
    };

    console.log(`[${this.id}] Publishing dance for task ${task.taskId}:`);
    console.log(`  Confidence: ${dance.confidence.toFixed(2)}`);
    console.log(`  Skills: ${dance.matchedSkills.join(", ")}`);

    await this.eventBus.publish({
      type: "DANCE",
      sourceAgent: this.id,
      payload: dance,
    });

    // 记录自己的舞蹈
    const state = this.activeConsensuses.get(task.taskId);
    if (state) {
      state.dances.set(this.id, dance);
    }
  }

  /**
   * 收到其他Agent的舞蹈
   */
  protected async onDanceReceived(dance: Dance): Promise<void> {
    // 忽略自己的舞蹈
    if (dance.agentId === this.id) {
      return;
    }

    const state = this.activeConsensuses.get(dance.taskId);
    if (!state) {
      return; // 没有参与这个任务的共识
    }

    console.log(
      `[${this.id}] Received dance from ${dance.agentId} (confidence: ${dance.confidence.toFixed(2)})`,
    );

    // 记录舞蹈
    state.dances.set(dance.agentId, dance);

    // 评估是否应该支持这个Agent
    await this.considerSupport(state, dance);
  }

  /**
   * 考虑是否支持其他Agent
   */
  protected async considerSupport(state: ConsensusState, otherDance: Dance): Promise<void> {
    const myDance = state.dances.get(this.id);

    if (!myDance) {
      return; // 我没有参与
    }

    // 如果对方置信度明显高于我，考虑支持对方
    const threshold = 0.2; // 对方比我高20%以上才支持
    if (otherDance.confidence > myDance.confidence + threshold) {
      console.log(`[${this.id}] Supporting ${otherDance.agentId} (higher confidence)`);

      await this.publishSupport(
        state.taskId,
        otherDance.agentId,
        `Better confidence: ${otherDance.confidence.toFixed(2)} > ${myDance.confidence.toFixed(2)}`,
        myDance.confidence,
      );

      // 撤回自己的舞蹈
      await this.publishWithdraw(state.taskId, `Supporting ${otherDance.agentId} instead`);
    }
  }

  /**
   * 发布支持
   */
  protected async publishSupport(
    taskId: string,
    targetAgentId: string,
    reason: string,
    confidence: number,
  ): Promise<void> {
    const support: Support = {
      type: "SUPPORT",
      taskId,
      agentId: this.id,
      targetAgentId,
      reason,
      confidence,
      timestamp: Date.now(),
    };

    await this.eventBus.publish({
      type: "SUPPORT",
      sourceAgent: this.id,
      payload: support,
    });

    // 记录支持
    const state = this.activeConsensuses.get(taskId);
    if (state) {
      const supports = state.supports.get(targetAgentId) || [];
      supports.push(support);
      state.supports.set(targetAgentId, supports);
    }
  }

  /**
   * 发布撤回
   */
  protected async publishWithdraw(taskId: string, reason: string): Promise<void> {
    const withdraw: Withdraw = {
      type: "WITHDRAW",
      taskId,
      agentId: this.id,
      reason,
      timestamp: Date.now(),
    };

    await this.eventBus.publish({
      type: "WITHDRAW",
      sourceAgent: this.id,
      payload: withdraw,
    });

    // 记录撤回
    const state = this.activeConsensuses.get(taskId);
    if (state) {
      state.withdraws.push(this.id);
      state.dances.delete(this.id);
    }
  }

  /**
   * 收到支持消息
   */
  protected async onSupportReceived(support: Support): Promise<void> {
    const state = this.activeConsensuses.get(support.taskId);
    if (!state) {
      return;
    }

    // 记录支持
    const supports = state.supports.get(support.targetAgentId) || [];
    supports.push(support);
    state.supports.set(support.targetAgentId, supports);

    // 如果是支持我的，检查是否达成共识
    if (support.targetAgentId === this.id) {
      console.log(`[${this.id}] Received support from ${support.agentId}`);
      this.checkConsensus(support.taskId);
    }
  }

  /**
   * 收到撤回消息
   */
  protected async onWithdrawReceived(withdraw: Withdraw): Promise<void> {
    const state = this.activeConsensuses.get(withdraw.taskId);
    if (!state) {
      return;
    }

    console.log(`[${this.id}] Agent ${withdraw.agentId} withdrew: ${withdraw.reason}`);

    state.withdraws.push(withdraw.agentId);
    state.dances.delete(withdraw.agentId);

    // 检查是否只剩一个Agent
    this.checkConsensus(withdraw.taskId);
  }

  /**
   * 收到讨论消息
   */
  protected async onDiscussionReceived(discussion: Discussion): Promise<void> {
    // 子类可以重写此方法来参与讨论
    console.log(`[${this.id}] Discussion from ${discussion.fromAgentId}: ${discussion.message}`);
  }

  /**
   * 收到共识达成消息
   */
  protected async onConsensusReached(consensus: ConsensusReached): Promise<void> {
    const state = this.activeConsensuses.get(consensus.taskId);
    if (!state) {
      return;
    }

    console.log(`[${this.id}] Consensus reached for task ${consensus.taskId}:`);
    console.log(`  Action: ${consensus.result.action}`);
    if (consensus.result.assignedAgent) {
      console.log(`  Agent: ${consensus.result.assignedAgent}`);
    }

    state.consensusReached = true;
    state.finalResult = consensus.result;

    // 如果是我被分配任务，开始执行
    if (consensus.result.assignedAgent === this.id) {
      await this.executeAssignedTask(state);
    }
  }

  /**
   * 执行被分配的任务
   *
   * 子类需要重写此方法来实现具体执行逻辑
   */
  protected async executeAssignedTask(state: ConsensusState): Promise<void> {
    // 子类实现
    console.log(`[${this.id}] Executing assigned task: ${state.taskId}`);
  }

  /**
   * 启动共识监控
   *
   * 定期检查是否达成共识，或超时
   */
  protected startConsensusMonitor(taskId: string): void {
    const checkInterval = setInterval(() => {
      const state = this.activeConsensuses.get(taskId);
      if (!state || state.consensusReached) {
        clearInterval(checkInterval);
        return;
      }

      // 检查超时
      if (Date.now() > state.deadline) {
        console.log(`[${this.id}] Consensus timeout for task ${taskId}`);
        this.finalizeConsensus(taskId);
        clearInterval(checkInterval);
        return;
      }

      // 检查是否达成共识
      this.checkConsensus(taskId);
    }, 500); // 每500ms检查一次
  }

  /**
   * 检查是否达成共识
   */
  protected checkConsensus(taskId: string): void {
    const state = this.activeConsensuses.get(taskId);
    if (!state || state.consensusReached) {
      return;
    }

    // 获取所有活跃的舞蹈（排除已撤回的）
    const activeDances = Array.from(state.dances.entries()).filter(
      ([agentId]) => !state.withdraws.includes(agentId),
    );

    if (activeDances.length === 0) {
      return; // 没有参与者
    }

    // 如果只有一个参与者，直接达成共识
    if (activeDances.length === 1) {
      const [agentId, dance] = activeDances[0];
      this.finalizeConsensus(taskId, agentId, dance);
      return;
    }

    // 检查是否有Agent获得足够支持
    for (const [agentId, dance] of activeDances) {
      const supports = state.supports.get(agentId) || [];
      const totalSupporters = supports.length + (agentId === this.id ? 0 : 1); // 自己也算一票
      const supportRatio = totalSupporters / activeDances.length;

      if (supportRatio >= this.consensusConfig.consensusThreshold) {
        console.log(
          `[${this.id}] Consensus threshold reached for ${agentId}: ${supportRatio.toFixed(2)}`,
        );
        this.finalizeConsensus(taskId, agentId, dance);
        return;
      }
    }
  }

  /**
   * 最终确定共识
   */
  protected finalizeConsensus(taskId: string, agentId?: string, dance?: Dance): void {
    const state = this.activeConsensuses.get(taskId);
    if (!state || state.consensusReached) {
      return;
    }

    // 如果没有指定Agent，选择支持最多的
    if (!agentId) {
      const activeDances = Array.from(state.dances.entries()).filter(
        ([id]) => !state.withdraws.includes(id),
      );

      if (activeDances.length === 0) {
        console.log(`[${this.id}] No agents available for task ${taskId}`);
        return;
      }

      // 选择支持最多的Agent
      let maxSupports = 0;
      let selectedId = activeDances[0][0];
      let selectedDance = activeDances[0][1];

      for (const [id, d] of activeDances) {
        const supports = state.supports.get(id) || [];
        if (supports.length > maxSupports) {
          maxSupports = supports.length;
          selectedId = id;
          selectedDance = d;
        }
      }

      agentId = selectedId;
      dance = selectedDance;
    }

    // 获取支持者列表
    const supporters = state.supports.get(agentId)?.map((s) => s.agentId) || [];

    const consensus: ConsensusReached = {
      type: "CONSENSUS_REACHED",
      taskId,
      result: {
        action: dance?.proposal || "direct",
        assignedAgent: agentId,
        supporters: [agentId, ...supporters],
      },
      timestamp: Date.now(),
    };

    // 发布共识达成事件
    this.eventBus
      .publish({
        type: "CONSENSUS_REACHED",
        sourceAgent: this.id,
        payload: consensus,
      })
      .catch((err) => {
        console.error(`[${this.id}] Failed to publish CONSENSUS_REACHED:`, err);
      });

    // 清理状态
    this.activeConsensuses.delete(taskId);
  }

  /**
   * 发布讨论消息
   */
  protected async publishDiscussion(
    taskId: string,
    message: string,
    targetAgentId?: string,
  ): Promise<void> {
    const discussion: Discussion = {
      type: "DISCUSSION",
      taskId,
      fromAgentId: this.id,
      toAgentId: targetAgentId,
      message,
      timestamp: Date.now(),
    };

    await this.eventBus.publish({
      type: "DISCUSSION",
      sourceAgent: this.id,
      payload: discussion,
    });
  }

  /**
   * 更新技能记录
   */
  updateSkill(skillName: string, score: number): void {
    this.skills.set(skillName, {
      score,
      lastUsed: Date.now(),
    });
  }

  /**
   * 获取所有技能
   */
  getSkills(): Map<string, { score: number; lastUsed: number }> {
    return new Map(this.skills);
  }
}
