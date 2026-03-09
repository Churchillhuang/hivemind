/**
 * Integration test for distributed consensus decision-making
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventBus } from "../events/EventBus.js";
import { AgentFactory } from "./AgentFactory.js";
import type { TaskAnnouncement, Dance } from "./consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "./HiveConfig.js";

describe("Consensus Integration", () => {
  let eventBus: EventBus;
  let agentFactory: AgentFactory;

  beforeEach(async () => {
    eventBus = new EventBus(1000);
    agentFactory = new AgentFactory(
      { id: "factory_001", role: "AgentFactory" },
      DEFAULT_HIVE_CONFIG,
      eventBus,
    );
    await agentFactory.start();
  });

  afterEach(async () => {
    await agentFactory.stop();
  });

  it("should create functional agent that can participate in consensus", async () => {
    const _task: TaskAnnouncement = {
      taskId: "task_test_001",
      taskType: "general",
      requiredCapabilities: ["text_processing"],
      priority: "normal",
      description: "Test task for consensus",
      timestamp: Date.now(),
    };

    // Create a functional agent
    await agentFactory.createInstance({
      templateId: "general_assistant",
      agentId: "test_agent_001",
    });

    const instances = agentFactory.getInstances();
    expect(instances.length).toBeGreaterThan(0);
    expect(instances[0].role).toBe("General Assistant");
  });

  it("should publish DANCE event when functional agent receives task announcement", async () => {
    const task: TaskAnnouncement = {
      taskId: "task_test_002",
      taskType: "general",
      requiredCapabilities: ["text_processing", "question_answering"],
      priority: "normal",
      description: "Test message processing",
      timestamp: Date.now(),
    };

    // Track DANCE events
    const dances: Dance[] = [];
    eventBus.subscribe("DANCE", (event) => {
      dances.push(event.payload as Dance);
    });

    // Publish task announcement (this will trigger AgentFactory to create an agent)
    await eventBus.publish({
      type: "TASK_ANNOUNCEMENT",
      sourceAgent: "test_interface",
      payload: task,
    });

    // Wait a bit for agent to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The functional agent should have published a DANCE event
    expect(dances.length).toBeGreaterThan(0);
    const receivedDance = dances[0];
    expect(receivedDance.taskId).toBe(task.taskId);
    expect(receivedDance.agentId).toMatch(/^func_\d+_[a-z0-9]+$/); // Should be a functional agent ID
    expect(receivedDance.confidence).toBeGreaterThan(0);
    expect(receivedDance.matchedSkills.length).toBeGreaterThan(0);
  });

  it("should reach consensus when agent has high confidence", async () => {
    const task: TaskAnnouncement = {
      taskId: "task_test_003",
      taskType: "general",
      requiredCapabilities: ["text_processing"],
      priority: "normal",
      description: "Test consensus formation",
      timestamp: Date.now(),
    };

    // Create a functional agent
    await agentFactory.createInstance({
      templateId: "general_assistant",
      agentId: "test_agent_003",
    });

    // Track consensus events
    let consensusReached = false;
    eventBus.subscribe("CONSENSUS_REACHED", (_event) => {
      consensusReached = true;
    });

    // Publish task announcement
    await eventBus.publish({
      type: "TASK_ANNOUNCEMENT",
      sourceAgent: "test_interface",
      payload: task,
    });

    // Wait for consensus timeout (should reach consensus quickly with single agent)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have reached consensus (single agent auto-wins)
    expect(consensusReached).toBe(true);
  });

  it("should execute task when consensus reached", async () => {
    const task: TaskAnnouncement = {
      taskId: "task_test_004",
      taskType: "general",
      requiredCapabilities: ["text_processing"],
      priority: "normal",
      description: "Test task execution",
      timestamp: Date.now(),
      payload: {
        message: {
          id: "msg_001",
          content: "Hello, this is a test message",
          userId: "user_001",
          timestamp: Date.now(),
        },
      },
    };

    // Create a functional agent
    await agentFactory.createInstance({
      templateId: "general_assistant",
      agentId: "test_agent_004",
    });

    // Track task completion
    let taskCompleted = false;
    eventBus.subscribe("TASK_COMPLETED", (_event) => {
      taskCompleted = true;
    });

    // Publish task announcement
    await eventBus.publish({
      type: "TASK_ANNOUNCEMENT",
      sourceAgent: "test_interface",
      payload: task,
    });

    // Wait for consensus + execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should have completed task (may fail if no gateway, but should still publish)
    // Note: In test environment without gateway, agent will use fallback response
    expect(taskCompleted).toBe(true);
  });
});
