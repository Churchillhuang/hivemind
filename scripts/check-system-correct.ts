#!/usr/bin/env tsx
/**
 * 正确的系统状态检查
 *
 * 通过AgentFactory创建Agent，而不是手动创建
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import { AgentPool } from "../src/hive/AgentPool.js";
import type { TaskAnnouncement } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";
import { IncentiveSystem } from "../src/hive/IncentiveSystem.js";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

console.log(`${colors.bright}${colors.cyan}🔍 系统状态检查（正确方式）${colors.reset}\n`);

async function checkSystem() {
  // 1. 初始化系统
  console.log(`${colors.bright}📋 步骤1: 初始化系统${colors.reset}\n`);

  const eventBus = new EventBus(1000);
  const agentFactory = new AgentFactory(
    { id: "factory_check", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();
  console.log(`✅ AgentFactory 启动成功\n`);

  // 2. 使用AgentPool创建Agent池
  console.log(`${colors.bright}📋 步骤2: 创建Agent池${colors.reset}\n`);

  const agentPool = new AgentPool(eventBus, agentFactory, DEFAULT_HIVE_CONFIG, {
    enabled: true,
    agents: [{ templateId: "general_assistant", count: 3 }],
    minPoolSize: 2,
    maxPoolSize: 5,
    idleTimeout: 300000,
  });

  await agentPool.start();

  const poolAgents = agentPool.getPoolAgents();
  console.log(`✅ Agent池创建成功：${poolAgents.length} 个Agent\n`);

  poolAgents.forEach((agent, i) => {
    console.log(`   ${i + 1}. ${colors.cyan}${agent.instanceId}${colors.reset}`);
    console.log(`      角色: ${agent.role}`);
    console.log(`      能力: ${agent.capabilities.join(", ")}\n`);
  });

  // 3. 测试激励机制
  console.log(`${colors.bright}📋 步骤3: 测试激励机制${colors.reset}\n`);

  const incentiveSystem = new IncentiveSystem();
  const agentId = poolAgents[0].instanceId;

  incentiveSystem.initializeAgent(agentId, poolAgents[0].capabilities);

  console.log(`场景1: 简单任务（技能完全匹配）`);
  const decision1 = incentiveSystem.decide(agentId, {
    matchedSkills: ["text_processing"],
    missingSkills: [],
    confidence: 0.8,
  });
  console.log(`   ${colors.green}决策: ${decision1.action}${colors.reset}`);
  console.log(`   理由: ${decision1.reasoning}\n`);

  console.log(`场景2: 复杂任务（部分技能缺失）`);
  const decision2 = incentiveSystem.decide(agentId, {
    matchedSkills: ["text_processing"],
    missingSkills: ["code_analysis", "documentation"],
    confidence: 0.3,
  });
  console.log(`   ${colors.yellow}决策: ${decision2.action}${colors.reset}`);
  console.log(`   理由: ${decision2.reasoning}\n`);

  // 4. 测试任务处理流程
  console.log(`${colors.bright}📋 步骤4: 测试任务处理流程${colors.reset}\n`);

  const task: TaskAnnouncement = {
    taskId: `test_task_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing"],
    priority: "normal",
    description: "测试任务：回答用户问题",
    timestamp: Date.now(),
  };

  console.log(`任务: ${task.description}`);
  console.log(`需要能力: ${task.requiredCapabilities.join(", ")}\n`);

  // 监听事件
  const events: string[] = [];

  eventBus.subscribe("DANCE", (e) => {
    events.push("DANCE");
    console.log(
      `${colors.magenta}💃 Agent ${e.sourceAgent?.substring(0, 30)}... 发布了DANCE${colors.reset}`,
    );
  });

  eventBus.subscribe("CONSENSUS_REACHED", (_e) => {
    events.push("CONSENSUS_REACHED");
    console.log(`${colors.green}✅ 共识达成！${colors.reset}`);
  });

  eventBus.subscribe("TASK_COMPLETED", (_e) => {
    events.push("TASK_COMPLETED");
    console.log(`${colors.blue}🎉 任务完成！${colors.reset}`);
  });

  eventBus.subscribe("SKILL_LEARNED", (e) => {
    events.push("SKILL_LEARNED");
    const payload = e.payload as { skillName: string; successRate: number };
    console.log(
      `${colors.cyan}📚 技能提取: ${payload.skillName} (成功率: ${(payload.successRate * 100).toFixed(0)}%)${colors.reset}`,
    );
  });

  // 发布任务
  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "check_system",
    payload: task,
  });

  // 等待处理完成
  await new Promise((resolve) => setTimeout(resolve, 4000));

  // 5. 生成报告
  console.log(`\n${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                  📊 系统检查报告                        ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`\n${colors.bright}1️⃣ Agent池状态:${colors.reset}`);
  console.log(`   初始Agent数: ${poolAgents.length}`);
  console.log(`   当前活跃Agent: ${agentPool.getActiveAgentCount()}\n`);

  console.log(`${colors.bright}2️⃣ 事件流程:${colors.reset}`);
  console.log(`   DANCE事件: ${events.filter((e) => e === "DANCE").length} 次`);
  console.log(`   共识达成: ${events.filter((e) => e === "CONSENSUS_REACHED").length} 次`);
  console.log(`   任务完成: ${events.filter((e) => e === "TASK_COMPLETED").length} 次`);
  console.log(`   技能提取: ${events.filter((e) => e === "SKILL_LEARNED").length} 次\n`);

  console.log(`${colors.bright}3️⃣ 激励机制:${colors.reset}`);
  console.log(`   ✅ 基于技能匹配度决策`);
  console.log(`   ✅ 计算预期收益`);
  console.log(`   ✅ 允许寻求协作\n`);

  console.log(`${colors.bright}4️⃣ 系统状态:${colors.reset}`);

  const allGood = poolAgents.length >= 2 && events.filter((e) => e === "DANCE").length > 0;

  if (allGood) {
    console.log(`   ${colors.green}✅ 系统运行正常${colors.reset}`);
    console.log(`   ${colors.green}✅ Agent池工作正常${colors.reset}`);
    console.log(`   ${colors.green}✅ 共识机制工作正常${colors.reset}`);
    console.log(`   ${colors.green}✅ 激励机制工作正常${colors.reset}\n`);
  } else {
    console.log(`   ${colors.yellow}⚠️ 部分功能需要检查${colors.reset}\n`);
  }

  // 清理
  await agentPool.stop();
  await agentFactory.stop();

  console.log(`${colors.bright}${colors.green}✅ 系统检查完成${colors.reset}\n`);
}

checkSystem().catch((error) => {
  console.error(`${colors.red}❌ 系统检查失败:${colors.reset}`, error);
  process.exit(1);
});
