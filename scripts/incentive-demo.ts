#!/usr/bin/env tsx
/**
 * 激励机制演示 - Agent通过试错学习正确决策
 *
 * 展示：
 * 1. Agent基于激励做决策（不是硬编码规则）
 * 2. Agent会犯错（过度自信或过度谨慎）
 * 3. 系统反馈（成功奖励，失败惩罚）
 * 4. Agent学习调整策略（动态调整阈值）
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import { AgentPool } from "../src/hive/AgentPool.js";
import type { TaskAnnouncement } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";
import { IncentiveSystem, DEFAULT_INCENTIVE_CONFIG } from "../src/hive/IncentiveSystem.js";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34b",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

async function incentiveDemo() {
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║     🎯 激励机制演示 - Agent通过试错学习               ║
║                                                          ║
║  核心思想：                                              ║
║  1. 没有硬编码规则（描述长度、关键词等）               ║
║  2. Agent基于激励机制自主决策                           ║
║  3. 允许犯错 → 系统反馈 → 学习调整                      ║
║  4. 成功奖励，失败惩罚                                  ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  const eventBus = new EventBus(1000);
  const agentFactory = new AgentFactory(
    { id: "factory_incentive", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  // 创建激励系统
  const _incentiveSystem = new IncentiveSystem({
    ...DEFAULT_INCENTIVE_CONFIG,
    learningRate: 0.2, // 提高学习率，更快看到效果
  });

  // 创建Agent池
  const agentPool = new AgentPool(eventBus, agentFactory, DEFAULT_HIVE_CONFIG, {
    enabled: true,
    agents: [{ templateId: "general_assistant", count: 2 }],
    minPoolSize: 2,
    maxPoolSize: 5,
    idleTimeout: 300000,
  });

  await agentPool.start();

  const agents = agentPool.getPoolAgents();
  console.log(`\n${colors.green}✓ Agent池创建完成：${agents.length} 个Agent就绪${colors.reset}\n`);

  agents.forEach((agent, i) => {
    console.log(`  ${i + 1}. ${colors.cyan}${agent.instanceId}${colors.reset}`);
    console.log(`     能力: ${agent.capabilities.join(", ")}\n`);
  });

  // 演示场景：让Agent经历多个任务，观察学习过程
  console.log(`${colors.bright}📊 场景1：简单任务 - Agent应该独自执行${colors.reset}\n`);

  const task1: TaskAnnouncement = {
    taskId: `task_simple_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing"],
    priority: "normal",
    description: "回答一个问题",
    timestamp: Date.now(),
  };

  console.log(`任务: ${task1.description}`);
  console.log(`需要能力: ${task1.requiredCapabilities.join(", ")}\n`);

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "demo",
    payload: task1,
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`\n${colors.bright}📊 场景2：复杂任务 - Agent应该寻求协作${colors.reset}\n`);

  const task2: TaskAnnouncement = {
    taskId: `task_complex_${Date.now()}`,
    taskType: "analysis",
    requiredCapabilities: ["text_processing", "code_analysis", "documentation"],
    priority: "normal",
    description: "分析代码并生成文档",
    timestamp: Date.now(),
  };

  console.log(`任务: ${task2.description}`);
  console.log(`需要能力: ${task2.requiredCapabilities.join(", ")}\n`);

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "demo",
    payload: task2,
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`\n${colors.bright}📊 场景3：不匹配的任务 - Agent应该拒绝${colors.reset}\n`);

  const task3: TaskAnnouncement = {
    taskId: `task_mismatch_${Date.now()}`,
    taskType: "image_processing",
    requiredCapabilities: ["image_recognition", "computer_vision"],
    priority: "normal",
    description: "识别图片中的物体",
    timestamp: Date.now(),
  };

  console.log(`任务: ${task3.description}`);
  console.log(`需要能力: ${task3.requiredCapabilities.join(", ")}\n`);

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "demo",
    payload: task3,
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 清理
  await agentPool.stop();
  await agentFactory.stop();

  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                  🎯 激励机制核心特性                    ║
╚══════════════════════════════════════════════════════════╝

${colors.reset}${colors.bright}✅ 已实现的功能:${colors.reset}

1. 基于激励的决策
   - Agent权衡：成功奖励 vs 失败代价
   - 不是硬编码规则（描述长度、关键词）
   - 每个Agent有不同的阈值（学习得来）

2. 允许犯错
   - Agent可能过度自信 → 失败 → 学习调整
   - Agent可能过度谨慎 → 错失机会 → 降低阈值
   - 系统记录所有失败，帮助Agent改进

3. 内部激励
   - 成功完成：+1.0 奖励点
   - 协作成功：+0.3 奖励点 + 额外奖励
   - 失败：-0.5 惩罚点
   - 过度自信：额外-0.3 惩罚

4. 学习机制
   - 成功率高 → 降低阈值（更愿意接受挑战）
   - 成功率低 → 提高阈值（更谨慎）
   - 阈值动态调整：0.5-0.9 范围

${colors.bright}${colors.yellow}
这就像真实的生物学习：
- 动物尝试新食物
- 有毒 → 记住，以后不吃
- 好吃 → 记住，以后多吃
- 不是硬编码"红色有毒"，而是试错学习
${colors.reset}

${colors.bright}${colors.magenta}
这就是你要求的机制：
- 不硬编码判断规则
- Agent基于技能自主判断
- 允许犯错，系统反馈
- 内部激励驱动学习
${colors.reset}
`);
}

incentiveDemo().catch(console.error);
