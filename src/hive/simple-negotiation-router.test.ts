import { describe, expect, it } from "vitest";
import { EventBus } from "../events/EventBus.js";
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from "./HiveConfig.js";
import { SimpleNegotiationRouter } from "./SimpleNegotiationRouter.js";

function buildConfig(): HiveConfig {
  return {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: "multi",
    orchestrator: {
      ...DEFAULT_HIVE_CONFIG.orchestrator,
      negotiationTimeout: 20,
    },
  };
}

describe("SimpleNegotiationRouter", () => {
  it("should unsubscribe SIMPLE_BID handler on stop and avoid duplicate subscriptions", () => {
    const eventBus = new EventBus();
    const router = new SimpleNegotiationRouter(buildConfig(), eventBus);

    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(1);

    router.start();
    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(1);

    router.start();
    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(1);

    router.stop();
    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(0);

    router.start();
    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(1);

    router.stop();
    expect(eventBus.getSubscriberCount("SIMPLE_BID")).toBe(0);
  });
});
