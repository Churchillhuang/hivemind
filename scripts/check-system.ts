#!/usr/bin/env tsx
/**
 * 系统状态检查
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import type { TaskAnnouncement } from "../src/hive/consensus-types.js";
import { FunctionalAgent } from "../src/hive/FunctionalAgent.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";
import { IncentiveSystem } from "../src/hive/IncentiveSystem.js";

console.log("🔍 系统状态检查\n");

async function checkSystem() {
  const eventBus = new EventBus(1000);
  const agentFactory = new AgentFactory(
    { id: "factory_check", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  console.log("✅ AgentFactory 启动成功\n");

  // 创建一个Agent
  console.log("📝 创建 FunctionalAgent...\n");

  const agent = new FunctionalAgent(
    {
      instanceId: "test_agent_001",
      role: "Test Agent",
      description: "Test agent for checking",
      capabilities: ["text_processing", "question_answering"],
      templateId: "general_assistant",
    },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agent.start();

  console.log("✅ FunctionalAgent 启动成功");
  console.log(`   ID: ${agent.id}`);
  console.log(`   角色: ${agent.role}`);
  console.log(`   能力: text_processing, question_answering\n`);

  // 测试激励机制
  console.log("📝 测试激励机制...\n");

  const incentiveSystem = new IncentiveSystem();
  incentiveSystem.initializeAgent(agent.id, ["text_processing", "question_answering"]);

  // 场景1：简单任务
  console.log("场景1: 简单任务（只需要text_processing）");
  const decision1 = incentiveSystem.decide(agent.id, {
    matchedSkills: ["text_processing"],
    missingSkills: [],
    confidence: 0.8,
  });
  console.log(`   决策: ${decision1.action}`);
  console.log(`   理由: ${decision1.reasoning}\n`);

  // 场景2：复杂任务
  console.log("场景2: 复杂任务（需要多种能力，部分缺失）");
  const decision2 = incentiveSystem.decide(agent.id, {
    matchedSkills: ["text_processing"],
    missingSkills: ["code_analysis", "documentation"],
    confidence: 0.3,
  });
  console.log(`   决策: ${decision2.action}`);
  console.log(`   理由: ${decision2.reasoning}\n`);

  // 场景3：完全不匹配
  console.log("场景3: 完全不匹配的任务");
  const decision3 = incentiveSystem.decide(agent.id, {
    matchedSkills: [],
    missingSkills: ["image_recognition", "computer_vision"],
    confidence: 0.1,
  });
  console.log(`   决策: ${decision3.action}`);
  console.log(`   理由: ${decision3.reasoning}\n`);

  // 测试任务处理
  console.log("📝 测试任务处理流程...\n");

  const task: TaskAnnouncement = {
    taskId: "test_task_001",
    taskType: "message",
    requiredCapabilities: ["text_processing"],
    priority: "normal",
    description: "测试任务",
    timestamp: Date.now(),
  };

  // 监听事件
  let danceReceived = false;
  let skillLearnedReceived = false;

  eventBus.subscribe("DANCE", () => {
    danceReceived = true;
    console.log("✅ 收到 DANCE 事件");
  });

  eventBus.subscribe("SKILL_LEARNED", () => {
    skillLearnedReceived = true;
    console.log("✅ 收到 SKILL_LEARNED 事件");
  });

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "test",
    payload: task,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`\n📊 测试结果:`);
  console.log(`   DANCE 事件: ${danceReceived ? "✅" : "❌"}`);
  console.log(
    `   SKILL_LEARNED 事件: ${skillLearnedReceived ? "✅ (技能提取工作正常)" : "⚠️ (需要等待共识完成)"}\n`,
  );

  // 清理
  await agent.stop();
  await agentFactory.stop();

  console.log("✅ 系统检查完成\n");
}

checkSystem().catch((error) => {
  console.error("❌ 系统检查失败:", error);
  process.exit(1);
});
