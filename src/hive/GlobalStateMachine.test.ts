import { describe, expect, it } from "vitest";
import { EventBus } from "../events/EventBus.js";
import { GlobalStateMachine } from "./GlobalStateMachine.js";
import { DEFAULT_HIVE_CONFIG } from "./HiveConfig.js";

function createHiveConfig() {
  const config = structuredClone(DEFAULT_HIVE_CONFIG);
  config.enabled = true;
  config.mode = "multi";
  return config;
}

describe("GlobalStateMachine event snapshots", () => {
  it("captures event history metadata in checkpoints", async () => {
    const eventBus = new EventBus(100);
    await eventBus.publish({
      type: "NEW_MESSAGE",
      sourceAgent: "test-agent",
      payload: { text: "hello" },
    });

    const gsm = new GlobalStateMachine(
      {
        enablePersistence: false,
        checkpointPath: "/tmp/hivemind-test-state",
      },
      createHiveConfig(),
      eventBus,
    );

    const checkpoint = await gsm.createCheckpoint("test");
    expect(checkpoint.metadata.eventHistorySize).toBe(1);
    expect(checkpoint.snapshots.events).toContain("NEW_MESSAGE");
  });

  it("updates task counters from EventBus events", async () => {
    const eventBus = new EventBus(100);
    const gsm = new GlobalStateMachine(
      {
        enablePersistence: false,
        checkpointInterval: 60_000,
      },
      createHiveConfig(),
      eventBus,
    );

    await gsm.start();
    await eventBus.publish({
      type: "TASK_REQUESTED",
      sourceAgent: "orchestrator_001",
      payload: { taskId: "t1" },
    });
    await eventBus.publish({
      type: "TASK_COMPLETED",
      sourceAgent: "memory_agent_001",
      payload: { taskId: "t1" },
    });
    await eventBus.publish({
      type: "TASK_REQUESTED",
      sourceAgent: "orchestrator_001",
      payload: { taskId: "t2" },
    });
    await eventBus.publish({
      type: "TASK_FAILED",
      sourceAgent: "interface_agent_001",
      payload: { taskId: "t2" },
    });

    const state = gsm.getState();
    expect(state.metadata.pendingTasks).toBe(0);
    expect(state.metadata.completedTasks).toBe(1);
    expect(state.metadata.failedTasks).toBe(1);

    await gsm.stop();
  });

  it("tracks active agents from lifecycle events", async () => {
    const eventBus = new EventBus(100);
    const gsm = new GlobalStateMachine(
      {
        enablePersistence: false,
        checkpointInterval: 60_000,
      },
      createHiveConfig(),
      eventBus,
    );

    await gsm.start();
    await eventBus.publish({
      type: "AGENT_STARTED",
      sourceAgent: "HiveManager",
      payload: { agentId: "interface_agent_001" },
    });
    await eventBus.publish({
      type: "AGENT_STARTED",
      sourceAgent: "HiveManager",
      payload: { agentId: "memory_agent_001" },
    });
    await eventBus.publish({
      type: "AGENT_STOPPED",
      sourceAgent: "HiveManager",
      payload: { agentId: "interface_agent_001" },
    });

    const state = gsm.getState();
    expect(state.metadata.activeAgents).toContain("memory_agent_001");
    expect(state.metadata.activeAgents).not.toContain("interface_agent_001");

    await gsm.stop();
  });
});
