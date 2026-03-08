/**
 * Interface Agent - HiveMind 的对话 Agent
 *
 * 负责处理用户消息，与 Gateway 交互，通过 EventBus 协调其他 Agents
 */

import { randomUUID } from "node:crypto";
import { BaseAgent } from "../core/Agent.js";
import { Event, EventType } from "../events/Event.js";
import { EventBus, getGlobalEventBus } from "../events/EventBus.js";
import type { HiveConfig, MemoryLevel } from "../hive/HiveConfig.js";
import { getAgentModelConfig } from "../utils/ModelConfig.js";
import { LLMRuntime } from "./LLMRuntime.js";

export interface Message {
  id: string;
  content: string;
  userId?: string;
  channelId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  messageId: string;
  content: string;
  agentId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class InterfaceAgent extends BaseAgent {
  private hiveConfig: HiveConfig;
  private llmRuntime: LLMRuntime;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: AgentResponse) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  > = new Map();
  private pendingMemoryRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  > = new Map();
  private readonly requestTimeout = 30000; // 30 秒超时
  private readonly memoryRequestTimeout = 500; // 记忆是增强项，不应阻塞主回复

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
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
    this.llmRuntime = new LLMRuntime(hiveConfig);
    this.eventBus = eventBus || getGlobalEventBus();

    // 订阅事件
    this.subscribeTo(EventType.TASK_ASSIGNED);
    this.subscribeTo(EventType.MESSAGE_PROCESSED);
    this.subscribeTo(EventType.MEMORY_RESULT);
    this.subscribeTo(EventType.AGENT_ERROR);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    await this.eventBus.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // 清理待处理的请求
    for (const [messageId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Agent is stopping"));
      this.pendingRequests.delete(messageId);
    }
    for (const [requestId, pending] of this.pendingMemoryRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Agent is stopping"));
      this.pendingMemoryRequests.delete(requestId);
    }

    this.running = false;

    await this.eventBus.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });
  }

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case "TASK_ASSIGNED":
        await this.handleTaskAssigned(event);
        break;

      case "MESSAGE_PROCESSED":
        await this.handleMessageProcessed(event);
        break;

      case "MEMORY_RESULT":
        await this.handleMemoryResult(event);
        break;

      case "AGENT_ERROR":
        await this.handleAgentError(event);
        break;
    }
  }

  // Private event handlers

  private async handleTaskAssigned(event: Event): Promise<void> {
    const assignment = event.payload as {
      taskId?: string;
      assignedTo?: string;
      taskData?: unknown;
    };
    if (assignment.assignedTo !== this.id) {
      return;
    }

    const taskData = assignment.taskData;
    if (typeof taskData !== "object" || taskData === null) {
      return;
    }

    const record = taskData as Record<string, unknown>;
    const message = this.coerceMessage(record, assignment.taskId);
    await this.handleNewMessage(message, event.correlationId);
  }

  private coerceMessage(record: Record<string, unknown>, fallbackId?: string): Message {
    return {
      id:
        typeof record.id === "string"
          ? record.id
          : fallbackId || `msg_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`,
      content: typeof record.content === "string" ? record.content : JSON.stringify(record),
      userId: typeof record.userId === "string" ? record.userId : undefined,
      channelId: typeof record.channelId === "string" ? record.channelId : undefined,
      timestamp: typeof record.timestamp === "number" ? record.timestamp : Date.now(),
      metadata:
        typeof record.metadata === "object" && record.metadata !== null
          ? (record.metadata as Record<string, unknown>)
          : undefined,
    };
  }

  private async handleNewMessage(message: Message, correlationId?: string): Promise<void> {
    console.log(`[InterfaceAgent ${this.id}] Processing message:`, message);

    try {
      // MVP: 不检查 sourceAgent，让所有消息都能被处理
      // 这样 Orchestrator 可以路由消息给它
      // 后期可以添加更智能的循环检测

      // 请求记忆（可选）
      const memory = await this.requestMemory(message.content.substring(0, 50));

      // 生成响应
      const content = await this.generateResponse(message, memory);

      // 发布响应
      const response: AgentResponse = {
        messageId: message.id,
        content,
        agentId: this.id,
        timestamp: Date.now(),
      };

      await this.eventBus.publish({
        type: EventType.MESSAGE_PROCESSED,
        sourceAgent: this.id,
        payload: response,
        correlationId,
      });

      console.log(`[InterfaceAgent ${this.id}] Response published:`, content);
    } catch (error) {
      console.error(`[InterfaceAgent ${this.id}] Error processing message:`, error);

      await this.eventBus.publish({
        type: EventType.AGENT_ERROR,
        sourceAgent: this.id,
        payload: {
          message: "Failed to process message",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * 处理用户消息（主入口）
   */
  async processMessage(message: Message): Promise<AgentResponse> {
    if (!this.running) {
      throw new Error(`Agent ${this.id} is not running`);
    }

    // 1. 分析任务复杂度
    const analysis = this.analyzeTaskComplexity(message);
    console.log(`[InterfaceAgent ${this.id}] Task analysis:`, {
      messageId: message.id,
      shouldDelegate: analysis.shouldDelegate,
      taskType: analysis.taskType,
      complexityScore: analysis.complexityScore,
      reasons: analysis.reasons,
    });

    // 2. 先创建 pendingRequest，确保存在
    const promise = new Promise<AgentResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
        }
        reject(new Error(`Request timeout for message ${message.id}`));
      }, this.requestTimeout);

      this.pendingRequests.set(message.id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });
    });

    // 3. 根据复杂度决定处理方式
    if (analysis.shouldDelegate && this.hiveConfig.agents.functional.enabled) {
      // 复杂任务：委托给专业代理
      const delegationResponse = await this.delegateComplexTask(message, analysis);

      // 立即返回委托确认
      const response: AgentResponse = {
        messageId: message.id,
        content: delegationResponse,
        agentId: this.id,
        timestamp: Date.now(),
        metadata: {
          delegated: true,
          taskType: analysis.taskType,
          complexityScore: analysis.complexityScore,
          originalMessageId: message.id,
        },
      };

      // 手动resolve，因为任务已被委托，不会通过正常流程返回
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        pending.resolve(response);
      }

      return promise;
    } else {
      // 简单任务：按原流程处理
      // 发布消息到 EventBus
      await this.eventBus.publish({
        type: EventType.NEW_MESSAGE,
        sourceAgent: this.id,
        payload: {
          ...message,
          taskType: analysis.taskType, // 添加任务类型信息
          complexityScore: analysis.complexityScore,
        },
        correlationId: message.id,
      });

      // 返回 Promise
      return promise;
    }
  }

  /**
   * 请求记忆（向 Memory Agent）
   * InterfaceAgent 使用 'session' 记忆层级（L1）
   */
  async requestMemory(
    query: string,
    options?: {
      limit?: number;
      context?: string;
    },
  ): Promise<unknown> {
    const requestId = `mem_req_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`;
    const memoryLevel: MemoryLevel = this.hiveConfig.memory?.layers.interface || "session";

    const resultPromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingMemoryRequests.has(requestId)) {
          this.pendingMemoryRequests.delete(requestId);
        }
        // 记忆不可用时降级为空上下文，避免阻塞主流程
        resolve({});
      }, this.memoryRequestTimeout);
      this.pendingMemoryRequests.set(requestId, { resolve, reject, timer });
    });

    // 发布查询请求 - 使用配置驱动的记忆层级
    await this.eventBus.publish({
      type: EventType.MEMORY_QUERY,
      sourceAgent: this.id,
      payload: {
        query,
        requestId,
        options: {
          level: memoryLevel,
          limit: options?.limit || 5,
          context: options?.context,
          agentId: this.id,
        },
      },
    });

    return resultPromise;
  }

  /**
   * Analyze task complexity and determine if delegation is needed
   */
  private analyzeTaskComplexity(message: Message): {
    shouldDelegate: boolean;
    taskType: string;
    complexityScore: number;
    reasons: string[];
  } {
    const content = message.content.toLowerCase();
    const metadata = message.metadata || {};
    let complexityScore = 0;
    const reasons: string[] = [];

    // 1. Length analysis
    if (content.length > 200) {
      complexityScore += 2;
      reasons.push("length > 200 chars");
    } else if (content.length > 100) {
      complexityScore += 1;
      reasons.push("length > 100 chars");
    }

    // 2. Keyword analysis for complex tasks
    const complexKeywords = [
      "analyze",
      "generate",
      "create",
      "develop",
      "build",
      "implement",
      "first",
      "then",
      "finally",
      "next",
      "after",
      "step",
      "test",
      "document",
      "security",
      "vulnerability",
      "bug",
      "error",
      "multi",
      "phase",
      "complex",
      "large",
      "comprehensive",
      "complete",
    ];

    const foundKeywords = complexKeywords.filter((keyword) =>
      content.includes(keyword.toLowerCase()),
    );

    if (foundKeywords.length >= 3) {
      complexityScore += 3;
      reasons.push(`multiple complex keywords: ${foundKeywords.slice(0, 3).join(", ")}`);
    } else if (foundKeywords.length >= 2) {
      complexityScore += 2;
      reasons.push(`complex keywords: ${foundKeywords.slice(0, 2).join(", ")}`);
    }

    // 3. Instruction patterns (multi-step tasks)
    const instructionPatterns = ["first.*then", "step 1.*step 2", "analyze.*then.*generate"];
    const hasMultiStep = instructionPatterns.some((pattern) =>
      new RegExp(pattern, "i").test(content),
    );

    if (hasMultiStep) {
      complexityScore += 3;
      reasons.push("multi-step instructions detected");
    }

    // 4. Domain complexity (multiple domains)
    const domains = ["security", "testing", "documentation", "frontend", "backend", "database"];
    const foundDomains = domains.filter((domain) => content.includes(domain.toLowerCase()));

    if (foundDomains.length >= 2) {
      complexityScore += 2;
      reasons.push(`multiple domains: ${foundDomains.join(", ")}`);
    }

    // 5. Metadata flags
    if (metadata.force_delegation === true || metadata.expected_agents) {
      complexityScore += 5;
      reasons.push("metadata forces delegation");
    }

    // 6. Special markers
    if (content.includes("[complex_task]") || content.includes("[multi_step]")) {
      complexityScore += 4;
      reasons.push("special complexity marker");
    }

    // Determine task type based on content
    let taskType = "message";
    if (content.includes("analyze") && content.includes("code")) {
      taskType = "code_analysis";
    } else if (content.includes("test") || content.includes("testing")) {
      taskType = "testing_task";
    } else if (content.includes("document") || content.includes("api")) {
      taskType = "documentation";
    } else if (hasMultiStep || foundDomains.length >= 2) {
      taskType = "multi_phase";
    }

    // Decision threshold
    const shouldDelegate =
      complexityScore >= 6 ||
      metadata.force_delegation === true ||
      (complexityScore >= 4 && this.hiveConfig.agents.functional.enabled);

    return {
      shouldDelegate,
      taskType,
      complexityScore,
      reasons,
    };
  }

  /**
   * Delegate complex task to specialized agents
   */
  private async delegateComplexTask(
    message: Message,
    analysis: ReturnType<typeof this.analyzeTaskComplexity>,
  ): Promise<string> {
    console.log(`[InterfaceAgent ${this.id}] Delegating complex task:`, {
      messageId: message.id,
      taskType: analysis.taskType,
      complexityScore: analysis.complexityScore,
      reasons: analysis.reasons,
    });

    // Publish TASK_REQUESTED event to trigger negotiation routing
    await this.eventBus.publish({
      type: "TASK_REQUESTED",
      sourceAgent: this.id,
      payload: {
        taskId: `delegated_${message.id}`,
        taskType: analysis.taskType,
        description: `Delegated task: ${message.content.substring(0, 100)}${message.content.length > 100 ? "..." : ""}`,
        payload: {
          originalMessage: message,
          complexityAnalysis: analysis,
          requiredCapabilities: this.determineRequiredCapabilities(message.content),
          estimatedComplexity: analysis.complexityScore >= 8 ? "high" : "medium",
        },
      },
    });

    // Return delegation acknowledgment
    return `[InterfaceAgent ${this.id}] Task delegated to specialized agents. Complexity: ${analysis.complexityScore}/10. Task type: ${analysis.taskType}.`;
  }

  /**
   * Determine required capabilities for the task
   */
  private determineRequiredCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("security") || lowerContent.includes("vulnerability")) {
      capabilities.push("security_analysis");
    }
    if (lowerContent.includes("test") || lowerContent.includes("testing")) {
      capabilities.push("testing");
    }
    if (lowerContent.includes("document") || lowerContent.includes("api")) {
      capabilities.push("documentation");
    }
    if (lowerContent.includes("code") || lowerContent.includes("programming")) {
      capabilities.push("code_analysis");
    }
    if (
      lowerContent.includes("frontend") ||
      lowerContent.includes("ui") ||
      lowerContent.includes("react")
    ) {
      capabilities.push("frontend");
    }
    if (
      lowerContent.includes("backend") ||
      lowerContent.includes("server") ||
      lowerContent.includes("api")
    ) {
      capabilities.push("backend");
    }
    if (
      lowerContent.includes("database") ||
      lowerContent.includes("sql") ||
      lowerContent.includes("mongodb")
    ) {
      capabilities.push("database");
    }

    return capabilities.length > 0 ? capabilities : ["general_problem_solving"];
  }

  private async generateResponse(message: Message, memory?: unknown): Promise<string> {
    const hasGatewayConfig = Boolean(
      process.env.OPENCLAW_GATEWAY_HTTP_URL ||
      process.env.OPENCLAW_GATEWAY_URL ||
      process.env.CLAWDBOT_GATEWAY_URL,
    );

    const memoryContext = memory ? "\n[Memory context available]" : "";
    if (!hasGatewayConfig) {
      return `[InterfaceAgent ${this.id}]${memoryContext} I received: "${message.content}"`;
    }

    try {
      const modelUsage = getAgentModelConfig("interface", undefined, this.hiveConfig);
      const response = await this.llmRuntime.call(
        {
          messages: [
            {
              role: "system",
              content:
                "You are the HiveMind Interface Agent. Respond helpfully and concisely to the user.",
            },
            {
              role: "user",
              content: memory
                ? `${message.content}\n\nMemory context:\n${JSON.stringify(memory)}`
                : message.content,
            },
          ],
        },
        {
          agentId: this.id,
          modelUsage,
          timeout: Math.min(modelUsage.timeout * 1000, 15000),
        },
      );

      return (
        response.content ||
        `[InterfaceAgent ${this.id}]${memoryContext} I received: "${message.content}"`
      );
    } catch (error) {
      console.warn(`[InterfaceAgent ${this.id}] LLM call failed, using fallback response`, error);
      return `[InterfaceAgent ${this.id}]${memoryContext} I received: "${message.content}"`;
    }
  }

  // Private event handlers

  private async handleMessageProcessed(event: Event): Promise<void> {
    const response = event.payload as AgentResponse;

    console.log(
      `[InterfaceAgent ${this.id}] Handling MESSAGE_PROCESSED for message ${response.messageId}`,
    );
    console.log(
      `[InterfaceAgent ${this.id}] Pending requests:`,
      Array.from(this.pendingRequests.keys()),
    );

    const pending = this.pendingRequests.get(response.messageId);
    if (pending) {
      console.log(`[InterfaceAgent ${this.id}] Found pending request, resolving...`);
      this.pendingRequests.delete(response.messageId);
      pending.resolve(response);
    } else {
      console.log(
        `[InterfaceAgent ${this.id}] No pending request found for message ${response.messageId}`,
      );
    }
  }

  private async handleMemoryResult(event: Event): Promise<void> {
    const result = event.payload as {
      requestId: string;
      data: unknown;
    };

    const pending = this.pendingMemoryRequests.get(result.requestId);
    if (!pending) {
      return;
    }

    this.pendingMemoryRequests.delete(result.requestId);
    clearTimeout(pending.timer);
    pending.resolve(result.data);
  }

  private async handleAgentError(event: Event): Promise<void> {
    console.error(`[InterfaceAgent ${this.id}] Agent error:`, event.payload);

    // 如果某个 agent 出错，可能需要清理相关的 pending request
    // TODO: 实现更智能的错误处理
  }
}
