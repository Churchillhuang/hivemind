import { describe, expect, it } from "vitest";
import { EventBus } from "../events/EventBus.js";
import { AgentFactory } from "./AgentFactory.js";
import { DEFAULT_HIVE_CONFIG } from "./HiveConfig.js";

function createHiveConfig() {
  const config = structuredClone(DEFAULT_HIVE_CONFIG);
  config.enabled = true;
  config.mode = "multi";
  return config;
}

describe("AgentFactory functional constraints", () => {
  it("enforces agents.functional.maxConcurrent", async () => {
    const eventBus = new EventBus(200);
    const config = createHiveConfig();
    config.agents.functional.maxConcurrent = 1;
    const factory = new AgentFactory(
      {
        id: "agent_factory_001",
        role: "Agent Factory",
      },
      config,
      eventBus,
    );

    await factory.start();
    await eventBus.publish({
      type: "AGENT_CREATE_REQUEST",
      sourceAgent: "orchestrator_001",
      payload: {
        templateId: "file_analyzer",
        agentId: "functional_a1",
        type: "functional",
        role: "File Analyzer",
        description: "Analyze files",
      },
    });
    await eventBus.publish({
      type: "AGENT_CREATE_REQUEST",
      sourceAgent: "orchestrator_001",
      payload: {
        templateId: "wp_uploader",
        agentId: "functional_a2",
        type: "functional",
        role: "WordPress Uploader",
        description: "Upload posts",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    const status = factory.getStatus();
    expect(status.instances).toBe(1);
    const errorEvent = eventBus
      .getHistory()
      .find((event) => event.type === "AGENT_ERROR" && event.sourceAgent === "agent_factory_001");
    expect(errorEvent).toBeDefined();

    await factory.stop();
  });

  it("destroys task-scoped instances when task completes", async () => {
    const eventBus = new EventBus(200);
    const config = createHiveConfig();
    config.agents.functional.lifespan = "task";
    const factory = new AgentFactory(
      {
        id: "agent_factory_001",
        role: "Agent Factory",
      },
      config,
      eventBus,
    );

    await factory.start();
    await eventBus.publish({
      type: "AGENT_CREATE_REQUEST",
      sourceAgent: "orchestrator_001",
      payload: {
        templateId: "general_assistant",
        agentId: "functional_task_1",
        taskId: "task-001",
        type: "functional",
        role: "General Assistant",
        description: "Handle task",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(factory.getStatus().instances).toBe(1);

    await eventBus.publish({
      type: "TASK_COMPLETED",
      sourceAgent: "orchestrator_001",
      payload: {
        taskId: "task-001",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(factory.getStatus().instances).toBe(0);
    const stopped = eventBus
      .getHistory()
      .find(
        (event) => event.type === "AGENT_STOPPED" && event.payload.agentId === "functional_task_1",
      );
    expect(stopped).toBeDefined();

    await factory.stop();
  });
});
