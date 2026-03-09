/**
 * Gateway Integrator - 集成 OpenClaw Gateway 与 HiveMind
 *
 * 使用真实 GatewayClient 连接网关事件流，并通过 HiveGatewayBridge 处理消息。
 */

import { randomUUID } from "node:crypto";
import { EventType } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import { GatewayClient, type GatewayClientOptions } from "../gateway/client.js";
import type { EventFrame } from "../gateway/protocol/index.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../utils/message-channel.js";
import { VERSION } from "../version.js";
import type { HiveConfig } from "./HiveConfig.js";
import { HiveGatewayBridge } from "./HiveGatewayBridge.js";
import type { HiveManager } from "./HiveManager.js";

type GatewayBridgeProvider = Pick<HiveManager, "ensureGatewayBridge">;

export interface GatewayIntegratorConfig {
  gatewayUrl: string; // 例如: ws://127.0.0.1:18789
  token?: string; // Gateway auth token
  hiveConfig: HiveConfig;
  eventBus: EventBus;
  bridge?: HiveGatewayBridge;
  hiveManager?: GatewayBridgeProvider;
}

export class GatewayIntegrator {
  private config: GatewayIntegratorConfig;
  private client: GatewayClient | null = null;
  private connected = false;
  private bridge: HiveGatewayBridge | null = null;

  constructor(config: GatewayIntegratorConfig) {
    if (!config.bridge && !config.hiveManager) {
      throw new Error("GatewayIntegrator requires either bridge or hiveManager");
    }
    this.config = config;
  }

  /**
   * 连接到 Gateway
   */
  async connect(): Promise<void> {
    if (this.client && this.connected) {
      return;
    }

    console.log(`[GatewayIntegrator] Connecting to ${this.config.gatewayUrl}...`);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (err?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        settle(new Error("Gateway connect timeout"));
      }, 10_000);

      const opts: GatewayClientOptions = {
        url: this.config.gatewayUrl,
        token: this.config.token,
        instanceId: randomUUID(),
        clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        clientDisplayName: "hivemind-gateway-integrator",
        clientVersion: VERSION,
        platform: process.platform,
        mode: GATEWAY_CLIENT_MODES.BACKEND,
        role: "operator",
        scopes: ["operator.admin"],
        onHelloOk: async () => {
          this.connected = true;
          clearTimeout(timeout);
          try {
            await this.onConnected();
            settle();
          } catch {
            settle(error instanceof Error ? error : new Error(String(error)));
          }
        },
        onEvent: (event) => {
          void this.handleEvent(event).catch((error: unknown) => {
            console.error("[GatewayIntegrator] Event handling failed:", error);
          });
        },
        onConnectError: (error) => {
          clearTimeout(timeout);
          settle(error);
        },
        onClose: (code, reason) => {
          this.connected = false;
          console.log(`[GatewayIntegrator] Gateway closed (${code}): ${reason}`);
        },
      };

      this.client = new GatewayClient(opts);
      this.client.start();
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.client?.stop();
    this.client = null;
    this.connected = false;
    console.log("[GatewayIntegrator] Disconnected");
  }

  /**
   * 发送请求到 Gateway
   */
  async sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.client || !this.connected) {
      throw new Error("Not connected to Gateway");
    }
    return await this.client.request<T>(method, params);
  }

  /**
   * 处理 Gateway 事件
   */
  async handleEvent(event: EventFrame): Promise<void> {
    console.log(
      `[GatewayIntegrator] Received event: ${event.event}`,
      JSON.stringify(event.payload).substring(0, 200),
    );
    const bridge = await this.resolveBridge();
    if (!bridge.isHiveEnabled()) {
      console.log(`[GatewayIntegrator] Hive not enabled, skipping event`);
      return;
    }
    await this.routeGatewayEvent(event, bridge);
  }

  /**
   * 路由 Gateway 事件到 HiveMind
   */
  private async routeGatewayEvent(event: EventFrame, bridge: HiveGatewayBridge): Promise<void> {
    switch (event.event) {
      case "chat.send":
        await this.handleChatSend(event, bridge);
        break;
      case "chat.event":
        await this.handleChatEvent(event);
        break;
      case "agent":
        await this.handleAgentEvent(event);
        break;
      default:
        break;
    }
  }

  /**
   * 处理 chat.send 事件
   */
  private async handleChatSend(event: EventFrame, bridge: HiveGatewayBridge): Promise<void> {
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

    try {
      const response = await bridge.interceptMessage(message);
      await this.sendRequest("chat.send", {
        to: payload.to,
        message: response.content,
        metadata: response.metadata,
      });
    } catch {
      console.error("[GatewayIntegrator] Error processing message:", error);
    }
  }

  private async handleChatEvent(event: EventFrame): Promise<void> {
    await this.config.eventBus.publish({
      type: EventType.NEW_MESSAGE,
      sourceAgent: "GatewayIntegrator",
      payload: event.payload,
    });
  }

  private async handleAgentEvent(event: EventFrame): Promise<void> {
    const payload = (event.payload ?? {}) as {
      status?: string;
      agentId?: string;
      error?: string;
    };

    if (payload.status === "started" || payload.status === "online") {
      await this.config.eventBus.publish({
        type: EventType.AGENT_STARTED,
        sourceAgent: "GatewayIntegrator",
        payload: event.payload,
      });
      return;
    }

    if (payload.status === "stopped" || payload.status === "offline") {
      await this.config.eventBus.publish({
        type: EventType.AGENT_STOPPED,
        sourceAgent: "GatewayIntegrator",
        payload: event.payload,
      });
      return;
    }

    if (payload.status === "error" || Boolean(payload.error)) {
      await this.config.eventBus.publish({
        type: EventType.AGENT_ERROR,
        sourceAgent: "GatewayIntegrator",
        payload: event.payload,
      });
      return;
    }

    await this.config.eventBus.publish({
      type: "GATEWAY_AGENT_EVENT",
      sourceAgent: "GatewayIntegrator",
      payload: event.payload,
    });
  }

  private async onConnected(): Promise<void> {
    const bridge = await this.resolveBridge();
    await bridge.initialize();

    // Note: BACKEND mode receives health/tick events but not chat.send
    // Use polling to fetch chat messages
    this.startMessagePolling(bridge);

    console.log("[GatewayIntegrator] Connection established (BACKEND mode with polling)");
  }

  private lastMessageId: string | null = null; // Reset to process all messages
  private pollInterval: NodeJS.Timeout | null = null;

  private startMessagePolling(bridge: HiveGatewayBridge): void {
    const pollChatMessages = async () => {
      if (!this.connected) {
        return;
      }
      try {
        // Poll for messages on the default agent session
        const result = await this.sendRequest<{
          messages?: Array<unknown>;
        }>("chat.history", { sessionKey: "agent:main:main", limit: 10 });

        if (result?.messages && result.messages.length > 0) {
          // Process messages in reverse order (oldest first)
          const messages = [...result.messages].toReversed();
          for (const msg of messages) {
            const msgObj = msg as {
              role?: string;
              content?: Array<{ type: string; text?: string }>;
              timestamp?: number;
            };

            // Only process user messages (inbound)
            if (msgObj.role === "user") {
              // Extract text from content array
              const textContent = msgObj.content?.find((c) => c.type === "text");
              const text = textContent?.text;

              if (text && msgObj.timestamp) {
                const msgId = `msg_${msgObj.timestamp}`;
                if (msgId !== this.lastMessageId) {
                  console.log(
                    `[GatewayIntegrator] New chat message:`,
                    msgId,
                    text.substring(0, 30),
                  );
                  await this.handleChatMessage(
                    { id: msgId, message: { text }, userId: "user" },
                    bridge,
                  );
                  this.lastMessageId = msgId;
                }
              }
            }
          }
        }
      } catch {
        // Silently ignore polling errors - they happen when no session exists
      }
    };

    // Poll every 2 seconds
    this.pollInterval = setInterval(pollChatMessages, 2000);
    // Initial poll
    void pollChatMessages();
  }

  private async handleChatMessage(
    msg: { id: string; message?: { text?: string }; userId?: string },
    _bridge: HiveGatewayBridge,
  ): Promise<void> {
    const content = msg.message?.text;
    if (!content) {
      return;
    }

    // Publish message to event bus for InterfaceAgent to process
    await this.config.eventBus.publish({
      type: EventType.NEW_MESSAGE,
      sourceAgent: "GatewayIntegrator",
      payload: {
        message: {
          id: msg.id,
          content,
          userId: msg.userId,
          channelId: "default",
        },
      },
    });
  }

  private async resolveBridge(): Promise<HiveGatewayBridge> {
    if (this.bridge) {
      return this.bridge;
    }
    if (this.config.bridge) {
      this.bridge = this.config.bridge;
      return this.bridge;
    }
    if (this.config.hiveManager) {
      this.bridge = await this.config.hiveManager.ensureGatewayBridge();
      return this.bridge;
    }
    throw new Error("Gateway bridge is unavailable");
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats(): {
    connected: boolean;
  } {
    return {
      connected: this.connected,
    };
  }
}
