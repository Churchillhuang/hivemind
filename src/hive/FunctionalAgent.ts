/**
 * FunctionalAgent - 具有共识决策和任务执行能力的功能Agent
 *
 * 这类Agent由AgentFactory动态创建，参与共识决策，
 * 当被选中时可以实际执行任务。
 */

import { randomUUID } from "node:crypto";
import { EventType } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "../hive/HiveConfig.js";
import { getAgentModelConfig } from "../utils/ModelConfig.js";
import type { TaskAnnouncement, ConsensusState, SkillMatch, Dance } from "./consensus-types.js";
import { ConsensusAgent } from "./ConsensusAgent.js";
import { IncentiveSystem } from "./IncentiveSystem.js";
import { LLMRuntime } from "./LLMRuntime.js";
import { TaskNegotiation, NegotiationProposal } from "./TaskNegotiation.js";

/**
 * 功能Agent配置
 */
export interface FunctionalAgentConfig {
  instanceId: string;
  role: string;
  description: string;
  capabilities: string[];
  templateId: string;
  taskId?: string;
}

/**
 * 功能Agent - 可以参与共识并执行任务
 */
export class FunctionalAgent extends ConsensusAgent {
  private llmRuntime: LLMRuntime;
  private capabilities: string[];
  private templateId: string;
  private currentTaskId?: string;
  private taskAnnouncement?: TaskAnnouncement;
  private incentiveSystem: IncentiveSystem; // 激励系统

  constructor(config: FunctionalAgentConfig, hiveConfig: HiveConfig, eventBus: EventBus) {
    super(
      {
        id: config.instanceId,
        role: config.role,
        type: "functional",
        description: config.description,
      },
      hiveConfig,
      eventBus,
    );

    this.llmRuntime = new LLMRuntime(hiveConfig);
    this.capabilities = config.capabilities;
    this.templateId = config.templateId;
    this.currentTaskId = config.taskId;
    this.incentiveSystem = new IncentiveSystem();

    // 初始化激励系统
    this.incentiveSystem.initializeAgent(this.id, this.capabilities);

    // 设置技能（基于能力）
    for (const cap of this.capabilities) {
      this.updateSkill(cap, 0.7);
    }
  }

  async start(): Promise<void> {
    await super.start();
    console.log(
      `[FunctionalAgent ${this.id}] Started with capabilities: ${this.capabilities.join(", ")}`,
    );
  }

  async stop(): Promise<void> {
    await super.stop();
    console.log(`[FunctionalAgent ${this.id}] Stopped`);
  }

  /**
   * 重写任务评估逻辑 - 功能Agent基于能力匹配
   */
  protected evaluateTask(task: TaskAnnouncement): SkillMatch {
    const matchedSkills: string[] = [];
    let totalScore = 0;

    // 1. 精确能力匹配
    for (const cap of task.requiredCapabilities) {
      if (this.capabilities.includes(cap)) {
        matchedSkills.push(cap);
        totalScore += 0.8; // 精确匹配高分
      }
    }

    // 2. 模糊能力匹配（部分匹配）
    for (const cap of this.capabilities) {
      const partialMatch = task.requiredCapabilities.some(
        (reqCap) =>
          reqCap.toLowerCase().includes(cap.toLowerCase()) ||
          cap.toLowerCase().includes(reqCap.toLowerCase()),
      );
      if (partialMatch && !matchedSkills.includes(cap)) {
        matchedSkills.push(cap);
        totalScore += 0.5; // 部分匹配中等分
      }
    }

    // 3. 描述关键词匹配
    const desc = task.description.toLowerCase();
    for (const cap of this.capabilities) {
      if (desc.includes(cap.toLowerCase()) && !matchedSkills.includes(cap)) {
        matchedSkills.push(cap);
        totalScore += 0.3; // 描述匹配较低分
      }
    }

    const score = matchedSkills.length > 0 ? Math.min(1, totalScore / matchedSkills.length) : 0.1; // 无匹配也有基础分

    return {
      score,
      matchedSkills,
      reasoning:
        score > 0.5
          ? `Strong match: ${matchedSkills.join(", ")}`
          : score > 0.2
            ? `Partial match: ${matchedSkills.join(", ")}`
            : "Limited match, but can attempt",
    };
  }

  /**
   * 重写任务公告处理 - Agent基于激励机制自主决策
   */
  protected async onTaskAnnounced(task: TaskAnnouncement): Promise<void> {
    this.taskAnnouncement = task;
    this.currentTaskId = task.taskId;

    console.log(`[FunctionalAgent ${this.id}] Received task: ${task.taskId}`);
    console.log(`[FunctionalAgent ${this.id}] Evaluating based on incentive system...`);

    // Agent评估技能匹配度
    const match = this.evaluateTask(task);

    // 计算缺失的技能
    const matchedSkills = match.matchedSkills;
    const missingSkills = task.requiredCapabilities.filter(
      (cap) => !this.capabilities.includes(cap),
    );

    // 使用激励机制做决策（不是硬编码规则！）
    const decision = this.incentiveSystem.decide(this.id, {
      matchedSkills,
      missingSkills,
      confidence: match.score,
    });

    console.log(`[FunctionalAgent ${this.id}] Decision: ${decision.action}`);
    console.log(`[FunctionalAgent ${this.id}] Reasoning: ${decision.reasoning}`);
    console.log(
      `[FunctionalAgent ${this.id}] Expected reward: ${decision.expectedReward.toFixed(2)}`,
    );

    // 根据决策行动
    switch (decision.action) {
      case "execute_alone":
        // 有信心独自完成，发布高置信度舞蹈
        await this.publishDance(task, {
          score: match.score,
          matchedSkills,
          reasoning: `I can execute alone: ${decision.reasoning}`,
        });
        break;

      case "seek_collaboration":
        // 需要协作，发布舞蹈但标记为寻求协作
        await this.publishDance(task, {
          score: match.score * 0.8, // 降低置信度，表示需要支持
          matchedSkills,
          reasoning: `Seeking collaboration: ${decision.reasoning}`,
        });

        // 发布协作请求
        await this.publishDiscussion(
          task.taskId,
          `I can handle ${matchedSkills.join(", ")}, but need help with: ${missingSkills.join(", ")}. ${decision.reasoning}`,
          undefined,
        );

        // 🔥 新增：启动协商流程
        // Agent会等待其他Agent的DANCE，然后启动协商
        this.startNegotiationWhenReady(task, match);
        break;

      case "reject":
        // 不参与
        console.log(`[FunctionalAgent ${this.id}] Rejecting task: ${decision.reasoning}`);
        break;
    }

    // 启动共识监控
    this.startConsensusMonitor(task.taskId);
  }

  /**
   * 公共方法：处理任务公告（供AgentFactory调用）
   */
  async handleTaskAnnouncement(task: TaskAnnouncement): Promise<void> {
    await this.onTaskAnnounced(task);
  }

  /**
   * 执行被分配的任务 - 实际调用LLM
   */
  protected async executeAssignedTask(state: ConsensusState): Promise<void> {
    console.log(`[FunctionalAgent ${this.id}] Executing task: ${state.taskId}`);

    if (!this.taskAnnouncement) {
      console.error(`[FunctionalAgent ${this.id}] No task announcement found`);
      return;
    }

    try {
      // 1. 准备执行上下文
      const payload = this.taskAnnouncement.payload as { message?: { content: string } };
      const userMessage = payload?.message?.content || this.taskAnnouncement.description;

      console.log(`[FunctionalAgent ${this.id}] Processing: ${userMessage.substring(0, 100)}...`);

      // 2. 调用LLM执行任务
      const result = await this.callLLM(userMessage, this.taskAnnouncement);

      // 3. 发布执行结果
      await this.publishTaskResult(state.taskId, result);

      // 4. 记录成功（激励系统学习）
      this.incentiveSystem.recordOutcome(this.id, {
        success: true,
        wasCollaboration: false, // 暂时简化
        confidence: this.getCurrentConfidence(),
      });

      console.log(`[FunctionalAgent ${this.id}] Task completed: ${state.taskId}`);
      console.log(this.incentiveSystem.getStats(this.id));
    } catch (error) {
      console.error(`[FunctionalAgent ${this.id}] Task execution failed:`, error);

      // 发布失败事件
      await this.eventBus.publish({
        type: "TASK_FAILED",
        sourceAgent: this.id,
        payload: {
          taskId: state.taskId,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      success = false;

      // 记录失败（激励系统学习）
      this.incentiveSystem.recordOutcome(this.id, {
        success: false,
        wasCollaboration: false,
        confidence: this.getCurrentConfidence(),
      });

      console.log(this.incentiveSystem.getStats(this.id));
    }
  }

  /**
   * 获取当前置信度
   */
  private getCurrentConfidence(): number {
    // 从技能映射中获取平均置信度
    let total = 0;
    let count = 0;
    for (const [, skill] of this.skills) {
      total += skill.score;
      count++;
    }
    return count > 0 ? total / count : 0.5;
  }

  /**
   * 启动协商（当准备好时）
   */
  private startNegotiationWhenReady(task: TaskAnnouncement, match: SkillMatch): void {
    console.log(`[FunctionalAgent ${this.id}] Preparing to negotiate for task ${task.taskId}`);

    // 等待一段时间，收集其他Agent的DANCE
    setTimeout(() => {
      // 获取所有DANCE事件
      const allDances = this.getRecentDances(task.taskId);

      if (allDances.length > 0) {
        console.log(
          `[FunctionalAgent ${this.id}] Starting negotiation with ${allDances.length} participants`,
        );

        // 创建协商器
        const negotiation = new TaskNegotiation(this.eventBus);
        negotiation.startNegotiation(task, this.id, allDances);

        // 提交提案：我认领我擅长的部分
        const mySubtaskId = `subtask_${this.id}_${Date.now()}`;
        const proposal: NegotiationProposal = {
          id: `proposal_${randomUUID().substring(0, 8)}`,
          taskId: task.taskId,
          proposerId: this.id,
          type: "claim_subtask",
          subtaskId: mySubtaskId,
          subtaskDescription: `Handle ${match.matchedSkills.join(", ")}: ${task.description.substring(0, 100)}`,
          timestamp: Date.now(),
        };

        negotiation.submitProposal(proposal);

        // 监听协商结果
        this.eventBus.subscribe("NEGOTIATION_RESOLVED", (event) => {
          const payload = event.payload as {
            taskId: string;
            assignments: { agentId: string; subtaskId: string }[];
          };
          if (payload.taskId === task.taskId) {
            const mine = payload.assignments.find((a) => a.agentId === this.id);
            console.log(`[FunctionalAgent ${this.id}] Negotiation resolved, my assignment:`, mine);
          }
        });
      }
    }, 1000); // 等待1秒收集DANCE
  }

  /**
   * 获取最近的任务舞蹈事件
   */
  private getRecentDances(_taskId: string): Dance[] {
    // 从事件历史获取DANCE
    const dances: Dance[] = [];
    // 这里简化处理，实际应该从EventBus获取
    return dances;
  }

  /**
   * 调用LLM执行任务
   */
  private async callLLM(userMessage: string, task: TaskAnnouncement): Promise<string> {
    const hasGatewayConfig = Boolean(
      process.env.OPENCLAW_GATEWAY_HTTP_URL ||
      process.env.OPENCLAW_GATEWAY_URL ||
      process.env.CLAWDBOT_GATEWAY_URL,
    );

    if (!hasGatewayConfig) {
      // 无Gateway配置，返回模拟响应
      return `[FunctionalAgent ${this.id}] Processed: "${userMessage.substring(0, 50)}..."`;
    }

    try {
      const modelUsage = getAgentModelConfig("functional", this.templateId, this.hiveConfig);

      // 构建系统提示
      const systemPrompt = this.buildSystemPrompt(task);

      const response = await this.llmRuntime.call(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        },
        {
          agentId: this.id,
          modelUsage,
          timeout: Math.min(modelUsage.timeout * 1000, 30000),
        },
      );

      return response.content || `[FunctionalAgent ${this.id}] No response generated`;
    } catch (error) {
      console.warn(`[FunctionalAgent ${this.id}] LLM call failed:`, error);
      throw error;
    }
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(task: TaskAnnouncement): string {
    const capabilitiesDesc = this.capabilities.join(", ");

    return `You are ${this.role}.

Capabilities: ${capabilitiesDesc}

Current task type: ${task.taskType}
Required capabilities: ${task.requiredCapabilities.join(", ")}

Provide a helpful and accurate response based on your specialized capabilities.`;
  }

  /**
   * 发布任务结果 + 提取技能
   */
  private async publishTaskResult(taskId: string, result: string): Promise<void> {
    // 发布 MESSAGE_PROCESSED 事件（与InterfaceAgent兼容）
    await this.eventBus.publish({
      type: EventType.MESSAGE_PROCESSED,
      sourceAgent: this.id,
      payload: {
        messageId: taskId,
        content: result,
        agentId: this.id,
        timestamp: Date.now(),
      },
    });

    // 发布 TASK_COMPLETED 事件
    await this.eventBus.publish({
      type: "TASK_COMPLETED",
      sourceAgent: this.id,
      payload: {
        taskId,
        result,
        agentId: this.id,
        timestamp: Date.now(),
      },
    });

    // 🔥 关键：提取技能并发布SKILL_LEARNED事件
    await this.extractAndPublishSkills(taskId, result);

    console.log(`[FunctionalAgent ${this.id}] Result published for task ${taskId}`);
  }

  /**
   * 从任务执行中提取技能
   *
   * Agent执行完任务后，反思：
   * "我用了哪些能力？效果如何？"
   */
  private async extractAndPublishSkills(taskId: string, result: string): Promise<void> {
    if (!this.taskAnnouncement) {
      return;
    }

    // 1. 提取使用的技能
    const usedSkills = this.identifyUsedSkills(this.taskAnnouncement, result);

    // 2. 为每个使用的技能发布SKILL_LEARNED事件
    for (const skill of usedSkills) {
      const successRate = this.calculateSkillSuccessRate(skill, result);

      await this.eventBus.publish({
        type: EventType.SKILL_LEARNED,
        sourceAgent: this.id,
        payload: {
          skillName: skill,
          successRate,
          agentId: this.id,
          taskId,
          tags: this.capabilities,
          description: `Skill extracted from task: ${this.taskAnnouncement.description.substring(0, 100)}`,
        },
      });

      console.log(
        `[FunctionalAgent ${this.id}] Extracted skill: ${skill} (${(successRate * 100).toFixed(0)}% success rate)`,
      );
    }
  }

  /**
   * 识别使用的技能
   */
  private identifyUsedSkills(task: TaskAnnouncement, result: string): string[] {
    const skills: string[] = [];

    // 1. 直接使用的能力
    for (const cap of this.capabilities) {
      if (task.requiredCapabilities.includes(cap)) {
        skills.push(cap);
      }
    }

    // 2. 从结果中推断的新技能
    // 例如：结果中包含代码片段 → 可能学会了code_generation
    const inferredSkills = this.inferSkillsFromResult(result);
    for (const skill of inferredSkills) {
      if (!skills.includes(skill)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * 从执行结果推断新技能
   */
  private inferSkillsFromResult(result: string): string[] {
    const skills: string[] = [];

    // 简单的启发式规则（未来可以用LLM分析）
    if (result.includes("```") || result.includes("function") || result.includes("class ")) {
      skills.push("code_generation");
    }

    if (result.includes("步骤") || result.includes("Step") || result.includes("首先")) {
      skills.push("structured_thinking");
    }

    if (result.length > 500 && result.includes("\n\n")) {
      skills.push("detailed_explanation");
    }

    return skills;
  }

  /**
   * 计算技能成功率
   */
  private calculateSkillSuccessRate(skill: string, result: string): number {
    // 基础成功率
    let rate = 0.8;

    // 如果结果长度合理，提高成功率
    if (result.length > 100) {
      rate += 0.1;
    }

    // 如果结果包含错误标记，降低成功率
    if (result.includes("错误") || result.includes("error") || result.includes("失败")) {
      rate -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, rate));
  }

  /**
   * 获取Agent信息
   */
  getInfo(): {
    id: string;
    role: string;
    capabilities: string[];
    templateId: string;
    currentTaskId?: string;
  } {
    return {
      id: this.id,
      role: this.role,
      capabilities: this.capabilities,
      templateId: this.templateId,
      currentTaskId: this.currentTaskId,
    };
  }
}
