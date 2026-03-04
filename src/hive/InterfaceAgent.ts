/**
 * Interface Agent - HiveMind 的对话 Agent
 *
 * 负责处理用户消息，与 Gateway 交互，通过 EventBus 协调其他 Agents
 */

import { BaseAgent } from '../core/Agent.js';
import { randomUUID } from 'node:crypto';
import { Event, EventType } from '../events/Event.js';
import { EventBus, getGlobalEventBus } from '../events/EventBus.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

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
  private pendingRequests: Map<string, {
    resolve: (value: AgentResponse) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();
  private readonly requestTimeout = 30000; // 30 秒超时

  constructor(
    config: { id: string; role: string; description?: string },
    _hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super({
      id: config.id,
      role: config.role,
      type: 'system',
      description: config.description,
    }, eventBus);

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
      pending.reject(new Error('Agent is stopping'));
      this.pendingRequests.delete(messageId);
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
      case 'TASK_ASSIGNED':
        await this.handleTaskAssigned(event);
        break;

      case 'MESSAGE_PROCESSED':
        await this.handleMessageProcessed(event);
        break;

      case 'MEMORY_RESULT':
        await this.handleMemoryResult(event);
        break;

      case 'AGENT_ERROR':
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
    if (typeof taskData !== 'object' || taskData === null) {
      return;
    }

    const record = taskData as Record<string, unknown>;
    const message = this.coerceMessage(record, assignment.taskId);
    await this.handleNewMessage(message, event.correlationId);
  }

  private coerceMessage(record: Record<string, unknown>, fallbackId?: string): Message {
    return {
      id:
        typeof record.id === 'string'
          ? record.id
          : fallbackId || `msg_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`,
      content: typeof record.content === 'string' ? record.content : JSON.stringify(record),
      userId: typeof record.userId === 'string' ? record.userId : undefined,
      channelId: typeof record.channelId === 'string' ? record.channelId : undefined,
      timestamp: typeof record.timestamp === 'number' ? record.timestamp : Date.now(),
      metadata:
        typeof record.metadata === 'object' && record.metadata !== null
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
          message: 'Failed to process message',
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

    // 先创建 pendingRequest，确保存在
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

    // 发布消息到 EventBus
    await this.eventBus.publish({
      type: EventType.NEW_MESSAGE,
      sourceAgent: this.id,
      payload: message,
      correlationId: message.id,
    });

    // 返回 Promise
    return promise;
  }

  /**
   * 请求记忆（向 Memory Agent）
   * InterfaceAgent 使用 'session' 记忆层级（L1）
   */
  async requestMemory(query: string, options?: {
    limit?: number;
    context?: string;
  }): Promise<unknown> {
    const requestId = `mem_req_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`;

    // 发布查询请求 - 指定记忆层级
    await this.eventBus.publish({
      type: EventType.MEMORY_QUERY,
      sourceAgent: this.id,
      payload: {
        query,
        requestId,
        options: {
          level: 'session',  // L1: 会话记忆
          limit: options?.limit || 5,
          context: options?.context,
          agentId: this.id,
        },
      },
    });

    // TODO: 同步等待或异步处理 MEMORY_RESULT
    // MVP: 返回空，因为 InterfaceAgent 主要用于对话交互
    return {};
  }

  /**
   * 生成响应（模拟 LLM 调用）
   * TODO: 集成 OpenClaw 的 Agent Runtime 或 LLM 调用
   */
  private async generateResponse(message: Message, memory?: unknown): Promise<string> {
    // MVP: 简单的响应生成
    // 后期集成 OpenClaw 的 LLM 调用

    const memoryContext = memory ? '\n[Memory context available]' : '';

    return `[InterfaceAgent ${this.id}]${memoryContext} I received: "${message.content}"`;
  }

  // Private event handlers

  private async handleMessageProcessed(event: Event): Promise<void> {
    const response = event.payload as AgentResponse;

    console.log(`[InterfaceAgent ${this.id}] Handling MESSAGE_PROCESSED for message ${response.messageId}`);
    console.log(`[InterfaceAgent ${this.id}] Pending requests:`, Array.from(this.pendingRequests.keys()));

    const pending = this.pendingRequests.get(response.messageId);
    if (pending) {
      console.log(`[InterfaceAgent ${this.id}] Found pending request, resolving...`);
      this.pendingRequests.delete(response.messageId);
      pending.resolve(response);
    } else {
      console.log(`[InterfaceAgent ${this.id}] No pending request found for message ${response.messageId}`);
    }
  }

  private async handleMemoryResult(event: Event): Promise<void> {
    const result = event.payload as {
      requestId: string;
      data: unknown;
    };

    // TODO: 根据 requestId 找到对应的请求并处理
    console.log(`[InterfaceAgent ${this.id}] Memory result received:`, result);
  }

  private async handleAgentError(event: Event): Promise<void> {
    console.error(`[InterfaceAgent ${this.id}] Agent error:`, event.payload);

    // 如果某个 agent 出错，可能需要清理相关的 pending request
    // TODO: 实现更智能的错误处理
  }
}
