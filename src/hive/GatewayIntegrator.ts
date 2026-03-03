/**
 * Gateway Integrator - 集成 OpenClaw Gateway 与 HiveMind
 *
 * 连接到 OpenClaw Gateway，使用 HiveGatewayBridge 拦截并路由消息
 */

import { HiveGatewayBridge } from './HiveGatewayBridge.js';
import { EventBus } from '../events/EventBus.js';
import type { HiveConfig } from './HiveConfig.js';

// Gateway 协议的简化定义（实际使用时从 OpenClaw 导入）
export interface EventFrame {
  type: 'event';
  event: string;
  seq?: number;
  stateVersion?: { presence: number; health: number };
  payload?: unknown;
}

export interface HelloOk {
  type: 'hello-ok';
  payload: {
    presence?: unknown;
    health?: unknown;
  };
}

/**
 * Gateway 集成配置
 */
export interface GatewayIntegratorConfig {
  gatewayUrl: string;              // 例如: ws://127.0.0.1:18789
  token?: string;                 // Gateway auth token
  hiveConfig: HiveConfig;
  eventBus: EventBus;
  bridge: HiveGatewayBridge;
}

/**
 * Gateway 集成器
 */
export class GatewayIntegrator {
  private config: GatewayIntegratorConfig;
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
    method: string;
  }>();

  constructor(config: GatewayIntegratorConfig) {
    this.config = config;
  }

  /**
   * 连接到 Gateway
   */
  async connect(): Promise<void> {
    if (this.ws && this.connected) {
      return;
    }

    console.log(`[GatewayIntegrator] Connecting to ${this.config.gatewayUrl}...`);

    // 这里简化实现 - 实际应该导入 GatewayClient
    // 由于依赖问题，这里模拟一个简单的 WebSocket 连接

    // 在实际实现中：
    // import { GatewayClient } from 'openclaw/gateway/client';
    // const client = new GatewayClient({ url: this.config.gatewayUrl, token: this.config.token, ... });

    // 模拟连接（实际使用需要集成真实的 GatewayClient）
    this.connected = true;
    console.log('[GatewayIntegrator] Connected (simulated)');

    // 触发回调
    await this.onConnected();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    console.log('[GatewayIntegrator] Disconnected');
  }

  /**
   * 发送请求到 Gateway
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // 检查连接
      if (!this.connected) {
        reject(new Error('Not connected to Gateway'));
        return;
      }

      // 记录待处理的请求
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        method,
      });

      // 发送请求
      // 实际应该是：
      // this.ws.send(JSON.stringify({ type: 'req', id: requestId, method, params }));

      // 模拟发送
      console.log(`[GatewayIntegrator] Sent request: ${method} (${requestId})`);

      // 模拟响应（实际应该从 WebSocket 接收）
      setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({ ok: true, payload: { result: 'simulated-response' } });
      }, 100);
    });
  }

  /**
   * 处理 Gateway 事件
   */
  async handleEvent(event: EventFrame): Promise<void> {
    console.log(`[GatewayIntegrator] Received event: ${event.event}`);

    // 检查是否需要路由到 HiveMind
    if (this.config.bridge.isHiveEnabled()) {
      // 将 Gateway 事件转换为 HiveMind 事件
      await this.routeGatewayEvent(event);
    }
  }

  /**
   * 路由 Gateway 事件到 HiveMind
   */
  private async routeGatewayEvent(event: EventFrame): Promise<void> {
    switch (event.event) {
      case 'chat.send':
        // 聊天消息 -> 通过 HiveGatewayBridge 处理
        await this.handleChatSend(event);
        break;

      case 'chat.event':
        // 聊天事件 (回复、反应等)
        await this.handleChatEvent(event);
        break;

      case 'agent':
        // Agent 事件
        await this.handleAgentEvent(event);
        break;

      case 'presence':
      case 'health':
      case 'tick':
        // 系统事件，不路由
        break;

      default:
        console.log(`[GatewayIntegrator] Unhandled event: ${event.event}`);
    }
  }

  /**
   * 处理 chat.send 事件
   */
  private async handleChatSend(event: EventFrame): Promise<void> {
    const payload = event.payload as {
      id: string;
      to: string;
      message: string;
      channel?: string;
      userId?: string;
    };

    const message = {
      id: payload.id,
      content: payload.message,
      userId: payload.userId,
      channelId: payload.channel,
      timestamp: Date.now(),
    };

    // 通过 HiveGatewayBridge 拦截和处理消息
    try {
      const response = await this.config.bridge.interceptMessage(message);
      console.log(`[GatewayIntegrator] Bridge response:`, response);

      // 将响应发送回 Gateway
      await this.sendRequest('chat.send', {
        to: payload.to,
        message: response.content,
        metadata: response.metadata,
      });
    } catch (error) {
      console.error(`[GatewayIntegrator] Error processing message:`, error);
    }
  }

  /**
   * 处理 chat.event 事件
   */
  private async handleChatEvent(event: EventFrame): Promise<void> {
    console.log(`[GatewayIntegrator] Chat event:`, event.payload);
    // TODO: 处理回复、反应等
  }

  /**
   * 处理 agent 事件
   */
  private async handleAgentEvent(event: EventFrame): Promise<void> {
    console.log(`[GatewayIntegrator] Agent event:`, event.payload);
    // TODO: 处理 agent 状态变化
  }

  /**
   * 连接成功回调
   */
  private async onConnected(): Promise<void> {
    console.log('[GatewayIntegrator] Connection established');

    // 初始化 Gateway Bridge
    await this.config.bridge.initialize();

    // 发送认证请求（可选）
    if (this.config.token) {
      // await this.sendRequest('gateway.auth', { token: this.config.token });
    }

    // 订阅事件
  // await this.sendRequest('gateway.subscribe', { events: ['chat.send', 'chat.event', 'agent'] });
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    connected: boolean;
    pendingRequests: number;
    reconnectDelay: number;
  } {
    return {
      connected: this.connected,
      pendingRequests: this.pendingRequests.size,
      reconnectDelay: this.reconnectDelay,
    };
  }
}
