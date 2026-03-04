import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events/EventBus.js";
import { GatewayIntegrator } from "./GatewayIntegrator.js";
import { DEFAULT_HIVE_CONFIG } from "./HiveConfig.js";

function createConfig() {
  const cfg = structuredClone(DEFAULT_HIVE_CONFIG);
  cfg.enabled = true;
  cfg.mode = "multi";
  return cfg;
}

describe("GatewayIntegrator bridge resolution", () => {
  it("resolves bridge from HiveManager and caches it", async () => {
    const initialize = vi.fn(async () => {});
    const isHiveEnabled = vi.fn(() => true);
    const interceptMessage = vi.fn(async () => ({
      messageId: "resp-1",
      content: "ok",
      agentId: "interface_agent_001",
      timestamp: Date.now(),
    }));
    const bridge = {
      initialize,
      isHiveEnabled,
      interceptMessage,
    };

    const ensureGatewayBridge = vi.fn(async () => bridge);
    const integrator = new GatewayIntegrator({
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "test",
      hiveConfig: createConfig(),
      eventBus: new EventBus({ maxHistorySize: 100 }),
      hiveManager: {
        ensureGatewayBridge,
      },
    });

    await (integrator as unknown as { onConnected: () => Promise<void> }).onConnected();
    await (integrator as unknown as { onConnected: () => Promise<void> }).onConnected();

    expect(ensureGatewayBridge).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("routes chat.send via resolved bridge", async () => {
    const bridge = {
      initialize: vi.fn(async () => {}),
      isHiveEnabled: vi.fn(() => true),
      interceptMessage: vi.fn(async () => ({
        messageId: "resp-2",
        content: "reply",
        agentId: "interface_agent_001",
        timestamp: Date.now(),
        metadata: { via: "hive" },
      })),
    };

    const integrator = new GatewayIntegrator({
      gatewayUrl: "ws://127.0.0.1:18789",
      hiveConfig: createConfig(),
      eventBus: new EventBus({ maxHistorySize: 100 }),
      bridge: bridge as unknown as import("./HiveGatewayBridge.js").HiveGatewayBridge,
    });

    const sendRequest = vi.spyOn(integrator, "sendRequest").mockResolvedValue({ ok: true });

    await integrator.handleEvent({
      event: "chat.send",
      payload: {
        id: "msg-1",
        to: "room-1",
        message: "hello",
      },
    } as never);

    expect(bridge.isHiveEnabled).toHaveBeenCalledTimes(1);
    expect(bridge.interceptMessage).toHaveBeenCalledTimes(1);
    expect(sendRequest).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        to: "room-1",
        message: "reply",
      }),
    );
  });

  it("bridges chat.event to EventBus NEW_MESSAGE", async () => {
    const eventBus = new EventBus(100);
    const bridge = {
      initialize: vi.fn(async () => {}),
      isHiveEnabled: vi.fn(() => true),
      interceptMessage: vi.fn(async () => ({
        messageId: "resp-3",
        content: "reply",
        agentId: "interface_agent_001",
        timestamp: Date.now(),
      })),
    };

    const integrator = new GatewayIntegrator({
      gatewayUrl: "ws://127.0.0.1:18789",
      hiveConfig: createConfig(),
      eventBus,
      bridge: bridge as unknown as import("./HiveGatewayBridge.js").HiveGatewayBridge,
    });

    await integrator.handleEvent({
      event: "chat.event",
      payload: { id: "evt-1", text: "hello" },
    } as never);

    const history = eventBus.getHistory();
    const routedEvent = history.find((event) => event.type === "NEW_MESSAGE");
    expect(routedEvent).toBeDefined();
    expect(routedEvent?.payload).toEqual({ id: "evt-1", text: "hello" });
  });

  it("bridges agent status updates to lifecycle events", async () => {
    const eventBus = new EventBus(100);
    const bridge = {
      initialize: vi.fn(async () => {}),
      isHiveEnabled: vi.fn(() => true),
      interceptMessage: vi.fn(async () => ({
        messageId: "resp-4",
        content: "reply",
        agentId: "interface_agent_001",
        timestamp: Date.now(),
      })),
    };

    const integrator = new GatewayIntegrator({
      gatewayUrl: "ws://127.0.0.1:18789",
      hiveConfig: createConfig(),
      eventBus,
      bridge: bridge as unknown as import("./HiveGatewayBridge.js").HiveGatewayBridge,
    });

    await integrator.handleEvent({
      event: "agent",
      payload: { agentId: "a1", status: "started" },
    } as never);
    await integrator.handleEvent({
      event: "agent",
      payload: { agentId: "a1", status: "stopped" },
    } as never);
    await integrator.handleEvent({
      event: "agent",
      payload: { agentId: "a1", status: "error", error: "boom" },
    } as never);

    const types = eventBus.getHistory().map((event) => event.type);
    expect(types).toContain("AGENT_STARTED");
    expect(types).toContain("AGENT_STOPPED");
    expect(types).toContain("AGENT_ERROR");
  });
});
