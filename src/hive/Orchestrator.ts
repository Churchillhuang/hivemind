/**
 * Orchestrator - 任务路由和 Agent 生命周期管理 (混合路由)
 *
 * 使用 L0 记忆（零记忆），专注于路由决策
 *
 * 路由模式：
 * 1. 直接路由 (Direct Routing) - 用于系统级核心功能（腦幹）
 *    - 反射式、快速、预定义规则
 *    - 示例：memory_query → MemoryAgent
 * 2. 协商路由 (Negotiation Routing) - 用于功能级复杂任务（大脑皮层）
 *    - 动态协商、性能优化
 *    - 示例：file_analysis → 投标选择最优
 */

import { randomUUID } from "node:crypto";
import { BaseAgent } from "../core/Agent.js";
import { Event, EventType } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";
import { NegotiationRouter } from "./NegotiationRouter.js";
import { SkillBasedNegotiationRouter } from "./SkillBasedNegotiationRouter.js";

/**
 * Task - 待处理任务
 */
export interface Task {
  id: string;
  type: "message" | "action" | "query";
  priority: "low" | "medium" | "high" | "urgent";
  sourceAgent: string;
  payload: {
    [key: string]: unknown;
  };
  createdAt: number;
  status: "pending" | "Processing" | "completed" | "failed";
  assignedAgent?: string;
  result?: unknown;
  error?: string;
}

/**
 * AgentInfo - Agent 状态信息
 */
export interface AgentInfo {
  id: string;
  type: "system" | "functional";
  role: string;
  capabilities: string[];
  isRunning: boolean;
  currentTasks: string[];
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    avgProcessingTime: number;
  };
}

/**
 * RoutingDecision - 路由决策
 */
export interface RoutingDecision {
  taskId: string;
  targetAgent: string;
  reasoning: string;
  routingMode: "direct" | "negotiated"; // 新增：路由模式
  newAgent?: {
    type: "system" | "functional";
    role: string;
    description: string;
  };
}

/**
 * 路由模式定义
 */
export enum RoutingMode {
  DIRECT = "direct", // 硬编码规则，快速、反射式
  NEGOTIATED = "negotiated", // 协商路由，动态、优化
}

export class Orchestrator extends BaseAgent {
  private hiveConfig: HiveConfig;
  private taskQueue: Map<string, Task> = new Map();
  private agents: Map<string, AgentInfo> = new Map();
  private routingRules: Map<string, string[]> = new Map(); // 规则 -> agent IDs
  private directRoutingTasks: Set<string>; // 使用直接路由的任务类型
  private negotiationRouter?: NegotiationRouter; // 协商路由器

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
    negotiationRouter?: NegotiationRouter,
  ) {
    super(
      {
        id: config.id,
        role: config.role,
        type: "system",
        description: config.description,
      },
      eventBus,
    );

    this.hiveConfig = hiveConfig;
    this.negotiationRouter = negotiationRouter;
    this.directRoutingTasks = new Set();

    this.initializeRoutingRules();
    this.initializeDirectRoutingTasks();
  }

  /**
   * 初始化路由规则
   */
  private initializeRoutingRules(): void {
    // 系统级 Agents 的固定路由（直接路由 - 像腦幹）
    this.routingRules.set("message", ["interface_agent_001"]);
    this.routingRules.set("memory_query", ["memory_agent_001"]);
    this.routingRules.set("reflection", ["reflection_agent_001"]);

    // 功能级 Agents（如果已预定义，也用直接路由）
    this.routingRules.set("moltbook_post", ["moltbook_bot"]);
    this.routingRules.set("wordpress_upload", ["wp_uploader"]);
  }

  /**
   * 初始化直接路由任务类型
   * 这些是核心/底层功能，不需要协商
   */
  private initializeDirectRoutingTasks(): void {
    // 系统核心功能 - 必须快速、直接
    this.directRoutingTasks.add("message"); // 用户消息处理
    this.directRoutingTasks.add("memory_query"); // 记忆查询
    this.directRoutingTasks.add("reflection"); // 反思

    // 如果你需要某些预定义功能也用直接路由，可以添加：
    // this.directRoutingTasks.add('moltbook_post');
  }

  /**
   * 判断使用哪种路由模式
   */
  private getRoutingMode(taskType: string): RoutingMode {
    if (this.directRoutingTasks.has(taskType) || this.routingRules.has(taskType)) {
      return RoutingMode.DIRECT;
    }

    // 其他任务类型使用协商路由
    return RoutingMode.NEGOTIATED;
  }

  /**
   * 创建协商路由器（如果没有）
   */
  private ensureNegotiationRouter(): void {
    if (!this.negotiationRouter) {
      this.negotiationRouter = this.hiveConfig.skillLearning.enabled
        ? new SkillBasedNegotiationRouter(this.hiveConfig, this.eventBus)
        : new NegotiationRouter(this.hiveConfig, this.eventBus);
      this.negotiationRouter.start();
      // NegotiationRouter can be lazily initialized during routing, so ensure the
      // orchestrator listens for negotiation outcomes even after start().
      this.subscribeTo("TASK_ASSIGNED");
      this.subscribeTo("TASK_NEGOTIATION_FAILED");
      console.log(
        `[Orchestrator ${this.id}] ${
          this.hiveConfig.skillLearning.enabled
            ? "SkillBasedNegotiationRouter"
            : "NegotiationRouter"
        } initialized`,
      );
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 注册已知的系统级 agents
    this.registerAgent({
      id: "interface_agent_001",
      type: "system",
      role: "Interface Agent",
      capabilities: ["handle_user_message", "对话交互"],
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    this.registerAgent({
      id: "memory_agent_001",
      type: "system",
      role: "Memory Agent",
      capabilities: ["memory_query", "memory_retrieval", "记忆检索"],
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    // 订阅事件
    this.subscribeTo(EventType.NEW_MESSAGE);
    this.subscribeTo(EventType.TASK_REQUESTED);
    this.subscribeTo(EventType.AGENT_STARTED);
    this.subscribeTo(EventType.AGENT_STOPPED);
    this.subscribeTo(EventType.MESSAGE_PROCESSED);

    // 订阅协商路由事件
    if (this.negotiationRouter) {
      this.subscribeTo("TASK_ASSIGNED");
      this.subscribeTo("TASK_NEGOTIATION_FAILED");
    }

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        rules: Array.from(this.routingRules.keys()),
        directRoutingTasks: Array.from(this.directRoutingTasks),
      },
    });

    console.log(`[Orchestrator ${this.id}] Started with hybrid routing`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.negotiationRouter) {
      this.negotiationRouter.stop();
    }

    await this.eventBus?.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });

    console.log(`[Orchestrator ${this.id}] Stopped`);
  }

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case "NEW_MESSAGE":
        await this.handleNewMessage(event);
        break;

      case "TASK_REQUESTED":
        await this.handleTaskRequest(event);
        break;

      case "AGENT_STARTED":
        await this.handleAgentStarted(event);
        break;

      case "AGENT_STOPPED":
        await this.handleAgentStopped(event);
        break;

      case "MESSAGE_PROCESSED":
        await this.handleMessageProcessed(event);
        break;

      case "TASK_ASSIGNED":
        await this.handleTaskAssigned(event);
        break;

      case "TASK_NEGOTIATION_FAILED":
        await this.handleNegotiationFailed(event);
        break;
    }
  }

  /**
   * 处理任务分配（协商路由）
   */
  private async handleTaskAssigned(event: Event): Promise<void> {
    if (event.sourceAgent === this.id || event.sourceAgent === "Orchestrator") {
      return;
    }

    const assignment = event.payload as {
      taskId: string;
      assignedTo: string;
      bidScore: number;
      taskData?: Record<string, unknown>;
    };

    // 查找任务并更新状态
    const task = this.taskQueue.get(assignment.taskId);
    if (task) {
      task.assignedAgent = assignment.assignedTo;
      task.status = "Processing";
    } else {
      // Keep failure/assignment accounting visible even when task was externally injected.
      this.taskQueue.set(assignment.taskId, {
        id: assignment.taskId,
        type: "action",
        priority: "medium",
        sourceAgent: event.sourceAgent,
        payload: {},
        createdAt: Date.now(),
        status: "Processing",
        assignedAgent: assignment.assignedTo,
      });
    }

    await this.eventBus?.publish({
      type: EventType.TASK_ASSIGNED,
      sourceAgent: "Orchestrator",
      routingMode: "negotiated",
      payload: {
        taskId: assignment.taskId,
        assignedTo: assignment.assignedTo,
        taskData: task?.payload ?? assignment.taskData ?? {},
      },
    });

    console.log(
      `[Orchestrator ${this.id}] Task negotiated and assigned: ${assignment.taskId} → ${assignment.assignedTo}`,
    );
  }

  /**
   * 处理协商失败
   */
  private async handleNegotiationFailed(event: Event): Promise<void> {
    const payload = event.payload as {
      taskId: string;
      reason: string;
      announcement: unknown;
    };

    // 记录失败，可以尝试降级到直接路由
    console.error(
      `[Orchestrator ${this.id}] Negotiation failed for task ${payload.taskId}: ${payload.reason}`,
    );

    const task = this.taskQueue.get(payload.taskId);
    if (task) {
      task.status = "failed";
      task.error = `Negotiation failed: ${payload.reason}`;
    } else {
      this.taskQueue.set(payload.taskId, {
        id: payload.taskId,
        type: "action",
        priority: "medium",
        sourceAgent: event.sourceAgent,
        payload: payload.announcement ?? {},
        createdAt: Date.now(),
        status: "failed",
        error: `Negotiation failed: ${payload.reason}`,
      });
    }

    if (!this.hiveConfig.agents.functional.enabled) {
      return;
    }

    const announcement = (payload.announcement ?? {}) as {
      taskType?: unknown;
      description?: unknown;
    };
    const taskType =
      typeof announcement.taskType === "string" && announcement.taskType.trim() !== ""
        ? announcement.taskType
        : "general_task";

    try {
      const fallbackAgentId = await this.createAgent({
        type: "functional",
        role: `${taskType}_fallback_agent`,
        description:
          typeof announcement.description === "string" && announcement.description.trim() !== ""
            ? announcement.description
            : `Fallback agent for ${taskType}`,
        templateId: this.resolveTemplateForTask(taskType),
        taskId: payload.taskId,
        taskType,
      });

      const fallbackTask = this.taskQueue.get(payload.taskId);
      if (!fallbackTask) {
        return;
      }

      fallbackTask.assignedAgent = fallbackAgentId;
      fallbackTask.status = "Processing";
      fallbackTask.error = undefined;
      this.routingRules.set(taskType, [fallbackAgentId]);

      await this.eventBus?.publish({
        type: EventType.TASK_ASSIGNED,
        sourceAgent: this.id,
        routingMode: "direct",
        payload: {
          taskId: fallbackTask.id,
          assignedTo: fallbackAgentId,
          taskData: fallbackTask.payload,
          reason: "negotiation_fallback",
        },
      });

      console.log(
        `[Orchestrator ${this.id}] Negotiation fallback assigned: ${fallbackTask.id} → ${fallbackAgentId}`,
      );
    } catch (error) {
      console.error(`[Orchestrator ${this.id}] Fallback agent creation failed:`, error);
    }
  }

  /**
   * 处理新消息
   */
  async handleNewMessage(event: Event): Promise<void> {
    const task: Task = {
      id: `task_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`,
      type: "message",
      priority: "medium",
      sourceAgent: event.sourceAgent,
      payload: event.payload,
      createdAt: Date.now(),
      status: "pending",
    };

    this.taskQueue.set(task.id, task);

    // 混合路由决策
    const decision = this.makeRoutingDecision(task);
    await this.executeRoutingDecision(decision);
  }

  /**
   * 处理任务请求
   */
  async handleTaskRequest(event: Event): Promise<void> {
    const task: Task = {
      id: `task_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`,
      type: "action",
      priority: "medium",
      sourceAgent: event.sourceAgent,
      payload: event.payload,
      createdAt: Date.now(),
      status: "pending",
    };

    this.taskQueue.set(task.id, task);

    // 混合路由决策
    const decision = this.makeRoutingDecision(task);
    await this.executeRoutingDecision(decision);
  }

  /**
   * 混合路由决策
   */
  private makeRoutingDecision(task: Task): RoutingDecision {
    const taskType = task.payload.taskType || (task.type as string);
    const routingMode = this.getRoutingMode(taskType);

    if (routingMode === RoutingMode.DIRECT) {
      // 直接路由：使用预定义规则（像腦幹-反射）
      return this.makeDirectRoutingDecision(task, taskType);
    } else {
      // 协商路由：使用 NegotiationRouter（像大脑皮层-思考）
      return this.makeNegotiatedRoutingDecision(task, taskType);
    }
  }

  /**
   * 直接路由决策（腦幹模式 - 快速、反射）
   */
  private makeDirectRoutingDecision(task: Task, taskType: string): RoutingDecision {
    // 查找预定义的路由规则
    const targetAgents = this.routingRules.get(taskType);

    if (targetAgents && targetAgents.length > 0) {
      const targetAgent = targetAgents[0];

      return {
        taskId: task.id,
        targetAgent,
        reasoning: `Direct routing: ${taskType} → ${targetAgent} (brainstem reflex)`,
        routingMode: "direct",
      };
    }

    // 默认: interface_agent
    const defaultTarget = this.routingRules.get("message")?.[0] || "interface_agent_001";
    return {
      taskId: task.id,
      targetAgent: defaultTarget,
      reasoning: `Default direct routing → ${defaultTarget}`,
      routingMode: "direct",
    };
  }

  /**
   * 协商路由决策（大脑皮层模式 - 动态协商）
   */
  private makeNegotiatedRoutingDecision(task: Task, taskType: string): RoutingDecision {
    // 确保协商路由器初始化
    this.ensureNegotiationRouter();

    // 构建任务公告
    const announcement = {
      taskId: task.id,
      taskType,
      requiredCapabilities: task.payload.requiredCapabilities || [],
      priority: task.priority,
      description: task.payload.description || taskType,
      timestamp: Date.now(),
    };

    // 公告任务，让 agents 投标
    if (this.negotiationRouter) {
      this.negotiationRouter.announceTask(announcement);

      console.log(
        `[Orchestrator ${this.id}] Task announced for negotiation: ${task.id} (${taskType})`,
      );
    }

    // 任务最终通过 TASK_ASSIGNED 事件回调处理
    return {
      taskId: task.id,
      targetAgent: "pending_negotiation", // 临时值，待协商完成
      reasoning: `Task announced for negotiation (cortex coordination)`,
      routingMode: "negotiated",
    };
  }

  /**
   * 执行路由决策
   */
  private async executeRoutingDecision(decision: RoutingDecision): Promise<void> {
    // 协商模式不需要立即执行（等待 TASK_ASSIGNED 事件）
    if (decision.routingMode === "negotiated") {
      console.log(`[Orchestrator ${this.id}] Waiting for negotiation completion...`);
      return;
    }

    // 直接模式：立即执行路由
    const task = this.taskQueue.get(decision.taskId);
    if (!task) {
      console.error(`[Orchestrator ${this.id}] Task not found: ${decision.taskId}`);
      return;
    }

    task.assignedAgent = decision.targetAgent;
    task.status = "Processing";

    await this.eventBus?.publish({
      type: EventType.TASK_ASSIGNED,
      sourceAgent: this.id,
      routingMode: "direct",
      payload: {
        taskId: task.id,
        assignedTo: decision.targetAgent,
        taskData: task.payload,
      },
    });

    console.log(
      `[Orchestrator ${this.id}] Direct routing: ${task.id} → ${decision.targetAgent} (${decision.reasoning})`,
    );
  }

  /**
   * 创建新 Agent（动态）
   */
  private async createAgent(config: {
    type: "system" | "functional";
    role: string;
    description: string;
    templateId?: string;
    taskId?: string;
    taskType?: string;
  }): Promise<string> {
    console.log(`[Orchestrator ${this.id}] Creating agent: ${config.role}`);

    const agentId = `${config.type}_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`;

    // 注册 Agent（实际创建由 AgentFactory 负责，这里先注册）
    this.registerAgent({
      id: agentId,
      type: config.type,
      role: config.role,
      capabilities: config.taskType ? [config.taskType] : [],
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    // 发布 Agent 创建事件
    await this.eventBus?.publish({
      type: "AGENT_CREATE_REQUEST",
      sourceAgent: this.id,
      payload: {
        agentId,
        templateId: config.templateId,
        taskId: config.taskId,
        ...config,
      },
    });

    return agentId;
  }

  /**
   * Agent 已启动
   */
  private async handleAgentStarted(event: Event): Promise<void> {
    const payload = event.payload as {
      agentId: string;
      role?: string;
    };

    let agent = this.agents.get(payload.agentId);
    if (!agent) {
      // Dynamic agents may come from external creators; register a minimal runtime view.
      agent = {
        id: payload.agentId,
        type: payload.agentId.startsWith("system_") ? "system" : "functional",
        role: payload.role || payload.agentId,
        capabilities: [],
        isRunning: false,
        currentTasks: [],
        stats: {
          tasksCompleted: 0,
          tasksFailed: 0,
          avgProcessingTime: 0,
        },
      };
      this.registerAgent(agent);
    }

    agent.isRunning = true;
    console.log(`[Orchestrator ${this.id}] Agent started: ${payload.agentId}`);
  }

  private resolveTemplateForTask(taskType: string): string {
    switch (taskType) {
      case "file_analysis":
        return "file_analyzer";
      case "wordpress_upload":
        return "wp_uploader";
      case "moltbook_post":
        return "moltbook_bot";
      default:
        return "general_assistant";
    }
  }

  /**
   * Agent 已停止
   */
  private async handleAgentStopped(event: Event): Promise<void> {
    const payload = event.payload as {
      agentId: string;
      role?: string;
    };

    const agent = this.agents.get(payload.agentId);
    if (agent) {
      agent.isRunning = false;
      console.log(`[Orchestrator ${this.id}] Agent stopped: ${payload.agentId}`);
    }
  }

  /**
   * 消息已处理
   */
  private async handleMessageProcessed(event: Event): Promise<void> {
    const response = event.payload as {
      messageId: string;
      agentId: string;
    };

    console.log(`[Orchestrator ${this.id}] Message processed by ${response.agentId}`);

    // 更新 Agent 统计
    const agent = this.agents.get(response.agentId);
    if (agent) {
      agent.stats.tasksCompleted += 1;
    }
  }

  /**
   * 注册 Agent
   */
  registerAgent(agentInfo: AgentInfo): void {
    this.agents.set(agentInfo.id, agentInfo);
  }

  /**
   * 获取 Agent 信息
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 添加路由规则
   */
  addRoutingRule(taskType: string, agentIds: string[]): void {
    this.routingRules.set(taskType, agentIds);
  }

  /**
   * 设置直接路由任务类型
   */
  setDirectRoutingTask(taskType: string, isDirect: boolean = true): void {
    if (isDirect) {
      this.directRoutingTasks.add(taskType);
    } else {
      this.directRoutingTasks.delete(taskType);
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    totalTasks: number;
    pendingTasks: number;
    processingTasks: number;
  } {
    let pending = 0;
    let processing = 0;

    for (const task of this.taskQueue.values()) {
      if (task.status === "pending") {
        pending += 1;
      } else if (task.status === "Processing") {
        processing += 1;
      }
    }

    return {
      totalTasks: this.taskQueue.size,
      pendingTasks: pending,
      processingTasks: processing,
    };
  }
}
