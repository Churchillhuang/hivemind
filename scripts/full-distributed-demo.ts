#!/usr/bin/env tsx
/**
 * 完整的分布式协作演示
 *
 * 展示：
 * 1. Agent池化 - 预创建多个Agent
 * 2. 任务分解 - 复杂任务自动分解
 * 3. 多Agent竞争 - 多个Agent发布舞蹈
 * 4. 并行执行 - 子任务分头执行
 * 5. 结果聚合 - 合并所有子任务结果
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import { AgentPool } from "../src/hive/AgentPool.js";
import type { TaskAnnouncement, Dance, ConsensusReached } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";
import { TaskDecomposer } from "../src/hive/TaskDecomposer.js";

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

async function fullDistributedDemo() {
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║     🐝 完整的分布式协作演示 - 真正的蜂群模式           ║
║                                                          ║
║  1. Agent池化 - 多个Agent预先等待                       ║
║  2. 任务分解 - 复杂任务自动拆分                         ║
║  3. 多Agent竞争 - 真正的选择过程                        ║
║  4. 并行执行 - 分头行动                                 ║
║  5. 结果聚合 - 协同完成                                 ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  // 1. 创建事件总线和Agent系统
  const eventBus = new EventBus(1000);
  const agentFactory = new AgentFactory(
    { id: "factory_distributed", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  // 2. 创建Agent池 - 预先创建多个Agent
  console.log(`\n${colors.bright}📦 步骤1: 创建Agent池（预先创建多个Agent）${colors.reset}\n`);
  console.log(`  这就像蜂巢里有多个工蜂在等待任务...\n`);

  const agentPool = new AgentPool(eventBus, agentFactory, DEFAULT_HIVE_CONFIG, {
    enabled: true,
    agents: [
      { templateId: "general_assistant", count: 3 },
      { templateId: "file_analyzer", count: 2 },
    ],
    minPoolSize: 4,
    maxPoolSize: 8,
    idleTimeout: 300000,
  });

  await agentPool.start();

  const poolAgents = agentPool.getPoolAgents();
  console.log(
    `\n${colors.green}✓ Agent池创建完成：${poolAgents.length} 个Agent就绪${colors.reset}\n`,
  );

  poolAgents.forEach((agent, i) => {
    console.log(`  ${i + 1}. ${colors.cyan}${agent.instanceId}${colors.reset}`);
    console.log(`     角色: ${agent.role}`);
    console.log(`     能力: ${agent.capabilities.join(", ")}\n`);
  });

  // 3. 创建任务分解器
  const taskDecomposer = new TaskDecomposer({
    enabled: true,
    complexityThreshold: 5, // 降低阈值，更容易触发分解
    minSubtasks: 2,
    maxSubtasks: 4,
    allowParallel: true,
  });

  // 4. 监听所有事件
  const _events: unknown[] = [];
  const dances: Dance[] = [];
  const consensusEvents: ConsensusReached[] = [];
  const _subtaskResults: Map<string, string[]> = new Map();

  eventBus.subscribe("DANCE", (event) => {
    const dance = event.payload as Dance;
    dances.push(dance);

    console.log(
      `${colors.magenta}💃 DANCE${colors.reset} Agent ${String(dance.agentId ?? "")} 发布舞蹈`,
    );
    console.log(`   置信度: ${(dance.confidence * 100).toFixed(0)}%`);
    console.log(`   技能: ${dance.matchedSkills.join(", ")}\n`);
  });

  eventBus.subscribe("CONSENSUS_REACHED", (event) => {
    const consensus = event.payload as ConsensusReached;
    consensusEvents.push(consensus);

    console.log(`${colors.green}✅ CONSENSUS${colors.reset} 共识达成`);
    console.log(`   获胜Agent: ${String(consensus.result.assignedAgent ?? "")}`);
    console.log(`   执行方式: ${String(consensus.result.action ?? "")}\n`);
  });

  eventBus.subscribe("TASK_COMPLETED", (event) => {
    const result = event.payload;
    console.log(`${colors.blue}📨 TASK_COMPLETED${colors.reset} 子任务完成`);
    console.log(`   Agent: ${String(result.agentId ?? "")}\n`);
  });

  // 5. 发布复杂任务
  console.log(`${colors.bright}📋 步骤2: 发布复杂任务（需要分解）${colors.reset}\n`);

  const complexTask: TaskAnnouncement = {
    taskId: `complex_task_${Date.now()}`,
    taskType: "multi_analysis",
    requiredCapabilities: ["text_processing", "file_reading", "content_parsing"],
    priority: "normal",
    description:
      "分析用户上传的文档，提取关键信息，生成摘要，并进行深入分析。这个任务需要多个步骤：首先读取文件内容，然后解析和提取信息，最后生成分析报告。",
    timestamp: Date.now(),
  };

  console.log(`  任务: 分析文档并生成报告`);
  console.log(`  需要能力: ${complexTask.requiredCapabilities.join(", ")}`);
  console.log(`  复杂度: 高（多步骤、多能力需求）\n`);

  // 6. 分析任务是否需要分解
  console.log(`${colors.bright}🔍 步骤3: 分析任务复杂度${colors.reset}\n`);

  const analysis = taskDecomposer.analyzeTask(complexTask);

  console.log(`  分析结果:`);
  console.log(
    `  - 是否分解: ${analysis.shouldDecompose ? colors.green + "是" : colors.red + "否"}${colors.reset}`,
  );
  console.log(`  - 原因: ${analysis.reason}`);
  console.log(`  - 复杂度: ${analysis.estimatedComplexity}`);
  console.log(`  - 可并行: ${analysis.parallelizable ? "是" : "否"}\n`);

  if (analysis.shouldDecompose && analysis.subtasks.length > 0) {
    console.log(
      `${colors.bright}🔧 步骤4: 任务已分解为 ${analysis.subtasks.length} 个子任务${colors.reset}\n`,
    );

    analysis.subtasks.forEach((subtask, i) => {
      console.log(`  子任务 ${i + 1}:`);
      console.log(`  - ID: ${subtask.id}`);
      console.log(`  - 描述: ${subtask.description.substring(0, 60)}...`);
      console.log(`  - 需要技能: ${subtask.requiredSkills.join(", ")}`);
      console.log(`  - 复杂度: ${subtask.estimatedComplexity}`);
      if (subtask.dependencies) {
        console.log(`  - 依赖: ${subtask.dependencies.join(", ")}`);
      }
      console.log();
    });

    // 7. 为每个子任务发布任务公告
    console.log(`${colors.bright}📢 步骤5: 发布子任务公告（多个Agent竞争）${colors.reset}\n`);

    for (const subtask of analysis.subtasks) {
      const subtaskAnnouncement: TaskAnnouncement = {
        taskId: subtask.id,
        taskType: "subtask",
        requiredCapabilities: subtask.requiredSkills,
        priority: "normal",
        description: subtask.description,
        timestamp: Date.now(),
      };

      await eventBus.publish({
        type: "TASK_ANNOUNCEMENT",
        sourceAgent: "decomposer",
        payload: subtaskAnnouncement,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 8. 等待共识和执行
    console.log(`${colors.bright}⏳ 步骤6: 等待Agent竞争和执行...${colors.reset}\n`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } else {
    // 直接发布任务
    console.log(`${colors.bright}📢 直接发布任务（不需要分解）${colors.reset}\n`);

    await eventBus.publish({
      type: "TASK_ANNOUNCEMENT",
      sourceAgent: "interface",
      payload: complexTask,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // 9. 生成完整报告
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                  📊 分布式协作完整报告                   ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`\n${colors.bright}1️⃣ Agent池状态:${colors.reset}`);
  console.log(`   初始Agent数: ${poolAgents.length}`);
  console.log(`   当前活跃Agent: ${agentPool.getActiveAgentCount()}\n`);

  console.log(`${colors.bright}2️⃣ 任务分析:${colors.reset}`);
  console.log(`   任务复杂度: ${analysis.estimatedComplexity}`);
  console.log(`   复杂度分数: ${analysis.reason.split(":")[0]}`);
  console.log(`   是否分解: ${analysis.shouldDecompose ? "是" : "否"}`);
  if (analysis.shouldDecompose) {
    console.log(`   子任务数: ${analysis.subtasks.length}`);
    console.log(`   可并行: ${analysis.parallelizable ? "是" : "否"}`);
  }
  console.log();

  console.log(`${colors.bright}3️⃣ Agent竞争:${colors.reset}`);
  console.log(`   舞蹈事件数: ${dances.length}\n`);

  if (dances.length > 0) {
    console.log(`   各Agent置信度分布:`);
    dances.forEach((dance, i) => {
      console.log(`   ${i + 1}. Agent ${dance.agentId.substring(0, 20)}...`);
      console.log(`      置信度: ${(dance.confidence * 100).toFixed(0)}%`);
      console.log(`      匹配技能: ${dance.matchedSkills.join(", ")}`);
    });
    console.log();
  }

  console.log(`${colors.bright}4️⃣ 共识决策:${colors.reset}`);
  console.log(`   共识事件数: ${consensusEvents.length}\n`);

  if (consensusEvents.length > 0) {
    consensusEvents.forEach((c, i) => {
      console.log(`   子任务 ${i + 1}:`);
      console.log(`   - 被分配Agent: ${c.result.assignedAgent}`);
      console.log(`   - 执行方式: ${c.result.action}`);
    });
    console.log();
  }

  console.log(`${colors.bright}5️⃣ 执行方式:${colors.reset}`);
  if (analysis.shouldDecompose) {
    console.log(`   ${colors.green}✓ 任务已分解并行执行${colors.reset}`);
    console.log(`   子任务数: ${analysis.subtasks.length}`);
    console.log(`   执行模式: ${analysis.parallelizable ? "并行" : "串行"}`);
  } else {
    console.log(`   ${colors.yellow}→ 单Agent直接执行${colors.reset}`);
  }
  console.log();

  // 清理
  await agentPool.stop();
  await agentFactory.stop();

  console.log(`${colors.bright}${colors.green}
╔══════════════════════════════════════════════════════════╗
║                  🎯 分布式协作特性                       ║
╚══════════════════════════════════════════════════════════╝

${colors.reset}${colors.bright}✅ 已实现的功能:${colors.reset}

1. Agent池化
   - 系统启动时预创建多个不同能力的Agent
   - Agent池维护和自动补充
   - 不同角色的Agent协同工作

2. 任务分解
   - 自动分析任务复杂度
   - 复杂任务自动拆分为子任务
   - 支持并行和串行两种执行模式

3. 多Agent竞争
   - 多个Agent同时评估任务
   - 发布舞蹈竞争执行权
   - 最优Agent被选中

4. 共识机制
   - 分布式决策，无中央控制
   - Agent自主评估和选择
   - 支持支持、撤回等行为

5. 并行执行
   - 子任务可并行执行
   - 多Agent同时工作
   - 结果聚合机制

${colors.bright}${colors.cyan}
这就是真正的蜂群模式：
- 多只工蜂预先等待（Agent池）
- 复杂任务自动分配（任务分解）
- 多只工蜂同时出发（并行执行）
- 各自完成部分工作（子任务执行）
- 回巢后聚合结果（结果合并）
${colors.reset}
`);
}

fullDistributedDemo().catch(console.error);
