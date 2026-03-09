/**
 * Example: Distributed Consensus Decision-Making
 *
 * This example demonstrates how to use the consensus mechanism
 * for task distribution among functional agents.
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import type { TaskAnnouncement } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";

async function main() {
  // 1. Create event bus for agent communication
  const eventBus = new EventBus(1000);

  // 2. Create agent factory
  const agentFactory = new AgentFactory(
    { id: "factory_001", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();
  console.log("✓ AgentFactory started");

  // 3. Monitor consensus events
  eventBus.subscribe("DANCE", (event) => {
    const dance = event.payload as {
      agentId: string;
      taskId: string;
      confidence: number;
      matchedSkills: string[];
    };
    console.log(`💃 Agent ${dance.agentId} published dance for task ${dance.taskId}`);
    console.log(`   Confidence: ${String(dance.confidence.toFixed(2) ?? "")}`);
    console.log(`   Skills: ${dance.matchedSkills.join(", ")}`);
  });

  eventBus.subscribe("CONSENSUS_REACHED", (event) => {
    const consensus = event.payload as { taskId: string; result: { assignedAgent: string } };
    console.log(`✓ Consensus reached for task ${consensus.taskId}`);
    console.log(`  Agent selected: ${consensus.result.assignedAgent}`);
    console.log(`  Supporters: ${consensus.result.supporters.join(", ")}`);
  });

  eventBus.subscribe("TASK_COMPLETED", (event) => {
    const result = event.payload as { taskId: string; agentId: string };
    console.log(`✓ Task ${result.taskId} completed by ${result.agentId}`);
  });

  // 4. Publish a task announcement
  const task: TaskAnnouncement = {
    taskId: `task_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing", "question_answering"],
    priority: "normal",
    description: "Hello, can you help me analyze this text?",
    timestamp: Date.now(),
    payload: {
      message: {
        id: "msg_001",
        content: "Hello, can you help me analyze this text?",
        userId: "user_001",
        timestamp: Date.now(),
      },
    },
  };

  console.log("\n📢 Broadcasting task announcement...");
  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "interface_001",
    payload: task,
  });

  // 5. Wait for consensus and execution
  console.log("\n⏳ Waiting for consensus...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 6. Cleanup
  await agentFactory.stop();
  console.log("\n✓ AgentFactory stopped");
}

// Run the example
main().catch(console.error);

/**
 * Expected output:
 *
 * ✓ AgentFactory started
 *
 * 📢 Broadcasting task announcement...
 *
 * ⏳ Waiting for consensus...
 * 💃 Agent func_123456789 published dance for task task_123456789
 *    Confidence: 0.75
 *    Skills: text_processing, question_answering
 * ✓ Consensus reached for task task_123456789
 *   Agent selected: func_123456789
 *   Supporters: func_123456789
 * ✓ Task task_123456789 completed by func_123456789
 *
 * ✓ AgentFactory stopped
 */
