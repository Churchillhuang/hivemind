/**
 * HiveGatewayBridge - HiveMind 的 Gateway 集成桥接器
 *
 * 负责拦截来自 Gateway 的消息，发布到 EventBus，
 * 等待 Agent 处理完成，返回响应。
 */

import { EventBus, getGlobalEventBus } from '../events/EventBus.js';
import { EventType } from '../events/Event.js';
import { InterfaceAgent, type Message, type AgentResponse } from '../hive/InterfaceAgent.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

/**
 * OpenClaw 的消息格式（简化）
 * 实际集成时需要与 OpenClaw 的协议对齐
 */
export interface InboundMessage {
  id: string;
  content: string;
  userId?: string;
  channelId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface OutboundMessage {
  messageId: string;
  content: string;
  agentId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface GatewayBridgeOptions {
  hiveConfig: HiveConfig;
  eventBus?: EventBus;
  // TODO: 添加实际的 Gateway 引用
  // originalHandler?: (msg: InboundMessage) => Promise<OutboundMessage>;
}

export class HiveGatewayBridge {
  private eventBus: EventBus;
  private hiveConfig: HiveConfig;
  private interfaceAgent?: InterfaceAgent;
  private initialized = false;

  constructor(options: GatewayBridgeOptions) {
    this.hiveConfig = options.hiveConfig;
    this.eventBus = options.eventBus || getGlobalEventBus();
  }

  /**
   * 初始化桥接器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 创建 Interface Agent
    this.interfaceAgent = new InterfaceAgent(
      {
        id: 'interface_agent_001',
        role: 'Interface Agent',
        description: '处理用户对话的主接口 Agent',
      },
      this.hiveConfig,
      this.eventBus,
    );

    // 启动 Agent
    await this.interfaceAgent.start();

    this.initialized = true;

    await this.eventBus.publish({
      type: 'HIVE_BRIDGE_INITIALIZED',
      sourceAgent: 'HiveGatewayBridge',
      payload: {
        agentId: this.interfaceAgent.id,
        config: this.hiveConfig,
      },
    });
  }

  /**
   * 拦截并处理消息（主入口）
   */
  async interceptMessage(inbound: InboundMessage): Promise<OutboundMessage> {
    if (!this.hiveConfig.enabled || this.hiveConfig.mode !== 'multi') {
      // 如果 HiveMind 未启用，返回错误或调用原始处理
      throw new Error('HiveMind is not enabled. Please call original handler.');
    }

    if (!this.interfaceAgent) {
      throw new Error('HiveGatewayBridge is not initialized.');
    }

    // 转换消息格式
    const message: Message = {
      id: inbound.id,
      content: inbound.content,
      userId: inbound.userId,
      channelId: inbound.channelId,
      timestamp: inbound.timestamp ?? Date.now(),
      metadata: inbound.metadata,
    };

    try {
      // 发送到 Interface Agent 处理
      const response = await this.interfaceAgent.processMessage(message);

      // 转换响应格式
      return {
        messageId: response.messageId,
        content: response.content,
        agentId: response.agentId,
        timestamp: response.timestamp,
        metadata: response.metadata,
      };
    } catch (error) {
      console.error('[HiveGatewayBridge] Error processing message:', error);

      // 发布错误事件
      await this.eventBus.publish({
        type: EventType.AGENT_ERROR,
        sourceAgent: 'HiveGatewayBridge',
        payload: {
          originalInbound: inbound,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  /**
   * 检查 HiveMind 是否启用
   */
  isHiveEnabled(): boolean {
    return this.hiveConfig.enabled && this.hiveConfig.mode === 'multi';
  }

  /**
   * 获取 Hive 配置
   */
  getConfig(): HiveConfig {
    return { ...this.hiveConfig };
  }

  /**
   * 更新 Hive 配置（运行时）
   */
  updateConfig(updates: Partial<HiveConfig>): void {
    this.hiveConfig = {
      ...this.hiveConfig,
      ...updates,
    };
  }

  /**
   * 获取状态信息
   */
  getStatus(): {
    initialized: boolean;
    agentRunning: boolean;
    config: HiveConfig;
  } {
    return {
      initialized: this.initialized,
      agentRunning: this.interfaceAgent?.isRunning() ?? false,
      config: this.hiveConfig,
    };
  }

  /**
   * 停止桥接器
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    if (this.interfaceAgent) {
      await this.interfaceAgent.stop();
    }

    this.initialized = false;

    await this.eventBus.publish({
      type: 'HIVE_BRIDGE_SHUTDOWN',
      sourceAgent: 'HiveGatewayBridge',
      payload: {},
    });
  }
}

/**
 * 全局示例（用于测试和简单使用）
 */
let globalBridge: HiveGatewayBridge | null = null;

export function getGlobalBridge(config: HiveConfig): HiveGatewayBridge {
  if (!globalBridge) {
    globalBridge = new HiveGatewayBridge({
      hiveConfig: config,
    });
  }
  return globalBridge;
}

export function resetGlobalBridge(): void {
  if (globalBridge) {
    globalBridge = null;
  }
}
