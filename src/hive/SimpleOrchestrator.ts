/**
 * SimpleOrchestrator - 极简编排器
 *
 * 核心简化：
 * 1. 只有 2 种路由方式：直路由 vs 协商路由
 * 2. 直路由：预定义规则（腦幹）
 * 3. 协商路由：依赖 SimpleNegotiationRouter
 * 4. 不再维护复杂的任务队列和状态
 */

import { BaseAgent } from "../core/Agent.js";
import type { Event } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";
import { SimpleNegotiationRouter } from "./SimpleNegotiationRouter.js";

enum SimpleRoutingMode {
  DIRECT = "direct",
  NEGOTIATED = "negotiated",
}

export interface SimpleRoutingDecision {
  taskId: string;
  targetAgent: string | null;
  routingMode: SimpleRoutingMode;
  reason: string;
}

type RequestedTaskPayload = {
  taskId?: string;
  taskType?: string;
  description?: string;
  payload?: unknown;
};

export class SimpleOrchestrator extends BaseAgent {
  private config: HiveConfig;
  private negotiationRouter?: SimpleNegotiationRouter;
  private directRoutingRules: Map<string, string>; // taskType -> agentId
  private directRoutingTasks: Set<string>;
  private running: boolean = false;

  constructor(
    config: {
      id: string;
      role: string;
      description?: string;
    },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
    negotiationRouter?: SimpleNegotiationRouter,
  ) {
    super(config, eventBus);

    this.config = hiveConfig;
    this.negotiationRouter = negotiationRouter;
    this.directRoutingRules = new Map();
    this.directRoutingTasks = new Set();

    // 初始化直路由规则
    this.initializeDirectRoutingRules();
  }

  /**
   * 初始化直路由规则
   * 这些是"腦幹"功能，不需要协商
   */
  private initializeDirectRoutingRules(): void {
    // 核心功能
    this.directRoutingRules.set("message", "interface_agent");
    this.directRoutingRules.set("memory_query", "memory_agent");
    this.directRoutingRules.set("reflection", "reflection_agent");

    // 标记为直路由任务
    this.directRoutingTasks.add("message");
    this.directRoutingTasks.add("memory_query");
    this.directRoutingTasks.add("reflection");
  }

  /**
   * 判断路由模式
   */
  private getRoutingMode(taskType: string): SimpleRoutingMode {
    if (this.directRoutingTasks.has(taskType)) {
      return SimpleRoutingMode.DIRECT;
    }
    return SimpleRoutingMode.NEGOTIATED;
  }

  /**
   * 确保协商路由器存在
   */
  private ensureNegotiationRouter(): void {
    if (!this.negotiationRouter) {
      this.negotiationRouter = new SimpleNegotiationRouter(this.config, this.eventBus);
      this.negotiationRouter.start();
      console.log("[SimpleOrchestrator] NegotiationRouter initialized");
    }
  }

  /**
   * 处理新任务
   */
  async handleNewTask(task: {
    taskId: string;
    taskType: string;
    description: string;
    payload?: unknown;
  }): Promise<void> {
    console.log(`[SimpleOrchestrator] New task: ${task.taskId} (${task.taskType})`);

    // 决定路由模式
    const routingMode = this.getRoutingMode(task.taskType);
    const routingDecision = this.makeRoutingDecision(task, routingMode);

    // 执行路由
    await this.executeRouting(routingDecision);
  }

  /**
   * 做出路由决策
   */
  private makeRoutingDecision(
    task: { taskId: string; taskType: string; description: string },
    routingMode: SimpleRoutingMode,
  ): SimpleRoutingDecision {
    if (routingMode === SimpleRoutingMode.DIRECT) {
      // 直路由
      const targetAgent = this.directRoutingRules.get(task.taskType);
      if (targetAgent) {
        return {
          taskId: task.taskId,
          targetAgent,
          routingMode: SimpleRoutingMode.DIRECT,
          reason: `Direct routing: ${task.taskType} → ${targetAgent}`,
        };
      }
    }

    // 协商路由
    return {
      taskId: task.taskId,
      targetAgent: null, // 协商结果未知
      routingMode: SimpleRoutingMode.NEGOTIATED,
      reason: `Negotiated routing: ${task.taskType}`,
    };
  }

  /**
   * 执行路由
   */
  private async executeRouting(decision: SimpleRoutingDecision): Promise<void> {
    if (decision.routingMode === SimpleRoutingMode.DIRECT && decision.targetAgent) {
      // 直接分配
      await this.eventBus?.publish({
        type: "TASK_ASSIGNED",
        payload: {
          taskId: decision.taskId,
          assignedTo: decision.targetAgent,
        },
        timestamp: Date.now(),
      });

      console.log(`[SimpleOrchestrator] Direct routing: ${decision.reason}`);
    } else if (decision.routingMode === SimpleRoutingMode.NEGOTIATED) {
      // 协商路由
      this.ensureNegotiationRouter();
      if (this.negotiationRouter) {
        this.negotiationRouter.announceTask({
          taskId: decision.taskId,
          taskType: "", // 将由其他机制填充
          description: "", // 将由其他机制填充
          timestamp: Date.now(),
        });

        console.log(`[SimpleOrchestrator] Negotiated routing: ${decision.reason}`);
      }
    }
  }

  /**
   * 处理事件
   */
  async handle(event: Event): Promise<void> {
    // 简化处理：只关心 NEW_MESSAGE 和 TASK_REQUESTED
    switch (event.type) {
      case "NEW_MESSAGE": {
        await this.handleNewTask({
          taskId: `task_${Date.now()}`,
          taskType: "message",
          description: "Handle user message",
          payload: event.payload,
        });
        break;
      }

      case "TASK_REQUESTED": {
        const payload = event.payload as RequestedTaskPayload;
        await this.handleNewTask({
          taskId: payload.taskId || `task_${Date.now()}`,
          taskType: payload.taskType || "generic",
          description: payload.description || "",
          payload: payload.payload || {},
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * 启动
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 订阅事件
    this.eventBus?.subscribe("NEW_MESSAGE", this.handle.bind(this));
    this.eventBus?.subscribe("TASK_REQUESTED", this.handle.bind(this));

    console.log("[SimpleOrchestrator] Started");
  }

  /**
   * 停止
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.negotiationRouter) {
      this.negotiationRouter.stop();
    }

    console.log("[SimpleOrchestrator] Stopped");
  }

  /**
   * 获取状态
   */
  getStatus(): {
    running: boolean;
    directRoutingTasks: string[];
    negotiationRouterActive: boolean;
  } {
    return {
      running: this.running,
      directRoutingTasks: Array.from(this.directRoutingTasks),
      negotiationRouterActive: this.negotiationRouter?.getStatus().running || false,
    };
  }
}
