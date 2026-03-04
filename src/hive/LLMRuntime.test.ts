import { describe, expect, it, vi, afterEach } from "vitest";
import { DEFAULT_HIVE_CONFIG } from "./HiveConfig.js";
import { LLMRuntime, type LLMResponse } from "./LLMRuntime.js";

describe("LLMRuntime statistics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks avg latency and resets all counters", async () => {
    const runtime = new LLMRuntime(DEFAULT_HIVE_CONFIG);
    const callGatewayOpenAiCompat = vi
      .spyOn(
        runtime as unknown as {
          callGatewayOpenAiCompat: () => Promise<LLMResponse>;
        },
        "callGatewayOpenAiCompat",
      )
      .mockResolvedValue({
        id: "resp_1",
        model: "test-model",
        content: "ok",
        finishReason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });

    await runtime.call(
      {
        messages: [{ role: "user", content: "hello" }],
      },
      { agentId: "interface_agent_001" },
    );

    await runtime.call(
      {
        messages: [{ role: "user", content: "world" }],
      },
      { agentId: "interface_agent_001" },
    );

    expect(callGatewayOpenAiCompat).toHaveBeenCalledTimes(2);

    const stats = runtime.getStatistics();
    expect(stats.callsCount).toBe(2);
    expect(stats.totalTokens).toBe(60);
    expect(stats.avgLatency).toBeGreaterThanOrEqual(0);
    expect(stats.avgTokensPerCall).toBe(30);

    runtime.resetStatistics();
    const reset = runtime.getStatistics();

    expect(reset.callsCount).toBe(0);
    expect(reset.totalTokens).toBe(0);
    expect(reset.totalCost).toBe(0);
    expect(reset.avgTokensPerCall).toBe(0);
    expect(reset.avgLatency).toBe(0);
  });
});
