/**
 * Agent Communication Framework
 *
 * Agent 间通信 - 直接消息、请求/响应、广播、死锁预防
 */

import { randomUUID } from "node:crypto";
import type { Event } from "../events/Event.js";
import { getGlobalEventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";

/**
 * 消息类型
 */
export type MessageType = "direct" | "request" | "response" | "broadcast";

/**
 * 消息优先级
 */
export type MessagePriority = "urgent" | "normal" | "low";

/**
 * Agent Message - Agent 间消息
 */
export interface AgentMessage {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  from: string;
  to: string | string[]; // 单或多接收者
  content: string;
  data?: Record<string, unknown>;
  timestamp: number;
  correlationId?: string; // 用于 request/response 关联
  replyTo?: string; // 原始消息 ID
  channelId?: string; // 用于广播
  ttl?: number; // TTL (毫秒)
  headers?: Record<string, string>;
}

/**
 * 请求配置
 */
export interface RequestConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

/**
 * 广播频道配置
 */
export interface BroadcastChannel {
  id: string;
  name: string;
  subscribers: Set<string>;
  filters?: Record<string, unknown>; // 消息过滤条件
}

/**
 * 死锁检测结果
 */
export interface DeadlockDetection {
  detected: boolean;
  waitingChain: string[];
  deadlockAgents: string[];
}

/**
 * 通信统计
 */
export interface CommunicationStats {
  messagesSent: number;
  messagesReceived: number;
  requestsSent: number;
  responsesSent: number;
  broadcastsSent: number;
  broadcastsReceived: number;
  deadlocksDetected: number;
  deadlocksResolved: number;
}

/**
 * Agent Communication Framework
 */
export class AgentCommunication {
  private hiveConfig: HiveConfig;
  private eventBus = getGlobalEventBus();

  // 消息队列
  private messageQueue: Map<string, AgentMessage> = new Map();
  private pendingRequests: Map<
    string,
    {
      message: AgentMessage;
      resolve: (response: AgentMessage) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
      retryCount: number;
    }
  > = new Map();

  // 广播频道
  private broadcastChannels: Map<string, BroadcastChannel> = new Map();

  // 死锁预防
  private waitingFor: Map<string, string> = new Map(); // agent -> waiting for
  private requestTimeout: Map<string, number> = new Map(); // request -> timestamp

  // 统计
  private stats: CommunicationStats = {
    messagesSent: 0,
    messagesReceived: 0,
    requestsSent: 0,
    responsesSent: 0,
    broadcastsSent: 0,
    broadcastsReceived: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0,
  };

  // 默认配置
  private defaultRequestConfig: RequestConfig = {
    timeout: 10000, // 10 秒
    retryCount: 3,
    retryDelay: 1000, // 1 秒
  };

  constructor(hiveConfig: HiveConfig) {
    this.hiveConfig = hiveConfig;

    // 订阅消息事件
    this.eventBus.subscribe("AGENT_MESSAGE_RECEIVED", this.handleMessageReceived.bind(this));
  }

  /**
   * 发送直接消息
   */
  async sendDirect(
    from: string,
    to: string,
    content: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: "direct",
      priority: "normal",
      from,
      to,
      content,
      data,
      timestamp: Date.now(),
    };

    await this.sendMessage(message);

    this.stats.messagesSent++;

    console.log(`[Comm] Direct message: ${from} → ${to} (${message.id})`);
  }

  /**
   * 发送请求（期望响应）
   */
  async sendRequest(
    from: string,
    to: string,
    content: string,
    data?: Record<string, unknown>,
    config?: Partial<RequestConfig>,
  ): Promise<AgentMessage> {
    const requestConfig = { ...this.defaultRequestConfig, ...config };

    const messageId = this.generateMessageId();

    const message: AgentMessage = {
      id: messageId,
      type: "request",
      priority: "normal",
      from,
      to,
      content,
      data,
      timestamp: Date.now(),
      correlationId: messageId,
      ttl: requestConfig.timeout,
    };

    // 记录等待关系（死锁检测）
    this.waitingFor.set(from, to);

    console.log(`[Comm] Request: ${from} → ${to} (${message.id})`);

    return new Promise<AgentMessage>((resolve, reject) => {
      // 创建超时计时器
      const timer = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        this.waitingFor.delete(from);
        reject(new Error(`Request timeout: ${message.id}`));
      }, requestConfig.timeout);

      // 保存请求
      this.pendingRequests.set(message.id, {
        message,
        resolve,
        reject,
        timer,
        retryCount: 0,
      });

      // 发送请求
      void this.sendMessage(message);

      this.stats.requestsSent++;
    });
  }

  /**
   * 发送响应
   */
  async sendResponse(
    from: string,
    to: string,
    originalMessageId: string,
    content: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: "response",
      priority: "urgent",
      from,
      to,
      content,
      data,
      timestamp: Date.now(),
      correlationId: originalMessageId,
      replyTo: originalMessageId,
    };

    await this.sendMessage(message);

    this.stats.responsesSent++;

    console.log(`[Comm] Response: ${from} → ${to} (${message.id}, reply to ${originalMessageId})`);
  }

  /**
   * 广播消息到频道
   */
  async broadcast(
    from: string,
    channelId: string,
    content: string,
    data?: Record<string, unknown>,
  ): Promise<number> {
    const channel = this.broadcastChannels.get(channelId);

    if (!channel) {
      throw new Error(`Broadcast channel not found: ${channelId}`);
    }

    const message: AgentMessage = {
      id: this.generateMessageId(),
      type: "broadcast",
      priority: "normal",
      from,
      to: Array.from(channel.subscribers),
      content,
      data,
      timestamp: Date.now(),
      channelId,
      headers: {
        "Broadcast-Channel": channelId,
        "Subscriber-Count": channel.subscribers.size.toString(),
      },
    };

    await this.sendMessage(message);

    this.stats.broadcastsSent++;

    console.log(
      `[Comm] Broadcast: ${from} → ${channelId} (${channel.subscribers.size} subscribers)`,
    );

    return channel.subscribers.size;
  }

  /**
   * 创建广播频道
   */
  createChannel(channelId: string, name: string): BroadcastChannel {
    const channel: BroadcastChannel = {
      id: channelId,
      name,
      subscribers: new Set(),
    };

    this.broadcastChannels.set(channelId, channel);

    console.log(`[Comm] Channel created: ${channelId} (${name})`);

    return channel;
  }

  /**
   * 订阅频道
   */
  subscribeToChannel(channelId: string, agentId: string): boolean {
    const channel = this.broadcastChannels.get(channelId);

    if (!channel) {
      return false;
    }

    channel.subscribers.add(agentId);

    console.log(`[Comm] ${agentId} subscribed to channel: ${channelId}`);

    return true;
  }

  /**
   * 取消订阅频道
   */
  unsubscribeFromChannel(channelId: string, agentId: string): boolean {
    const channel = this.broadcastChannels.get(channelId);

    if (!channel) {
      return false;
    }

    channel.subscribers.delete(agentId);

    console.log(`[Comm] ${agentId} unsubscribed from channel: ${channelId}`);

    return true;
  }

  /**
   * 获取频道订阅者
   */
  getChannelSubscribers(channelId: string): string[] {
    const channel = this.broadcastChannels.get(channelId);

    if (!channel) {
      return [];
    }

    return Array.from(channel.subscribers);
  }

  /**
   * 获取所有频道
   */
  getAllChannels(): BroadcastChannel[] {
    return Array.from(this.broadcastChannels.values());
  }

  /**
   * 发送消息
   */
  private async sendMessage(message: AgentMessage): Promise<void> {
    // 检查 TTL
    if (message.ttl && message.ttl <= 0) {
      console.log(`[Comm] Message expired: ${message.id}`);
      return;
    }

    // 检查目的地
    const destinations = Array.isArray(message.to) ? message.to : [message.to];

    // 发布事件
    for (const to of destinations) {
      await this.eventBus.publish({
        type: "AGENT_MESSAGE_RECEIVED",
        sourceAgent: message.from,
        targetAgent: to,
        payload: {
          message,
          to,
        },
      });
    }
  }

  /**
   * 处理接收的消息
   */
  private async handleMessageReceived(event: Event): Promise<void> {
    const { message } = event.payload as { message: AgentMessage };

    // 统计
    this.stats.messagesReceived++;

    if (message.type === "broadcast") {
      this.stats.broadcastsReceived++;
    }

    // 处理响应
    if (message.type === "response" && message.correlationId) {
      const pending = this.pendingRequests.get(message.correlationId);

      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.correlationId);

        // 清除等待关系
        this.waitingFor.delete(pending.message.from);

        pending.resolve(message);

        console.log(`[Comm] Response received: ${message.id} for request ${message.correlationId}`);
      }

      return;
    }

    console.log(`[Comm] Message received: ${message.id} (${message.type})`);
  }

  /**
   * 死锁检测
   */
  detectDeadlock(): DeadlockDetection {
    // 构建等待链
    const waitingChain: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // 深度优先搜索检测环
    const dfs = (agent: string): boolean => {
      visited.add(agent);
      recursionStack.add(agent);

      const waitingForAgent = this.waitingFor.get(agent);
      if (waitingForAgent) {
        waitingChain.push(agent);

        if (!visited.has(waitingForAgent)) {
          if (dfs(waitingForAgent)) {
            return true;
          }
        } else if (recursionStack.has(waitingForAgent)) {
          // 检测到环
          return true;
        }

        waitingChain.pop();
      }

      recursionStack.delete(agent);
      return false;
    };

    // 检查所有等待中的 agents
    for (const [agent] of this.waitingFor.entries()) {
      if (!visited.has(agent)) {
        if (dfs(agent)) {
          // 找到死锁
          this.stats.deadlocksDetected++;

          // 识别环中的 agents
          const deadlockAgents = new Set<string>();
          for (let i = 0; i < waitingChain.length; i++) {
            deadlockAgents.add(waitingChain[i]);
          }

          console.log(`[Comm] Deadlock detected: ${Array.from(deadlockAgents).join(" → ")}`);

          return {
            detected: true,
            waitingChain: [...waitingChain],
            deadlockAgents: Array.from(deadlockAgents),
          };
        }
      }
    }

    return {
      detected: false,
      waitingChain: [],
      deadlockAgents: [],
    };
  }

  /**
   * 解决死锁（超时强制回收）
   */
  resolveDeadlock(agents: string[]): void {
    console.log(`[Comm] Resolving deadlock for agents: ${agents.join(", ")}`);

    for (const agent of agents) {
      // 查找这个 agent 的所有请求
      for (const [requestId, pending] of this.pendingRequests.entries()) {
        if (pending.message.from === agent) {
          // 取消请求
          clearTimeout(pending.timer);
          this.pendingRequests.delete(requestId);

          // 清除等待关系
          this.waitingFor.delete(agent);

          // 拒绝 promise
          pending.reject(new Error(`Deadlock resolved, request ${requestId} aborted`));

          console.log(`[Comm] Aborted request ${requestId} to resolve deadlock`);
        }
      }
    }

    this.stats.deadlocksResolved++;

    console.log(`[Comm] Deadlock resolved`);
  }

  /**
   * 检查并自动解决死锁
   */
  async checkAndResolveDeadlock(): Promise<DeadlockDetection> {
    const detection = this.detectDeadlock();

    if (detection.detected) {
      setTimeout(() => {
        this.resolveDeadlock(detection.deadlockAgents);
      }, 1000);
    }

    return detection;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`;
  }

  /**
   * 获取统计
   */
  getStats(): CommunicationStats {
    return { ...this.stats };
  }

  /**
   * 获取待处理请求
   */
  getPendingRequests(): AgentMessage[] {
    return Array.from(this.pendingRequests.values()).map((p) => p.message);
  }

  /**
   * 获取等待关系
   */
  getWaitingRelations(): Map<string, string> {
    return new Map(this.waitingFor);
  }

  /**
   * 重置状态
   */
  reset(): void {
    // 取消所有待处理请求
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Communication reset"));
    }

    this.pendingRequests.clear();
    this.messageQueue.clear();
    this.waitingFor.clear();
    this.requestTimeout.clear();
    this.broadcastChannels.clear();

    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      requestsSent: 0,
      responsesSent: 0,
      broadcastsSent: 0,
      broadcastsReceived: 0,
      deadlocksDetected: 0,
      deadlocksResolved: 0,
    };

    console.log("[Comm] Communication framework reset");
  }
}
