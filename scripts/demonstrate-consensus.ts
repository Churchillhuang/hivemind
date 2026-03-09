#!/usr/bin/env tsx
/**
 * 真正的分布式共识演示
 *
 * 这次会：
 * 1. 预先创建多个功能Agent（池化）
 * 2. 所有Agent同时收到任务公告
 * 3. 多个Agent发布舞蹈（竞争）
 * 4. Agent之间互相支持或撤回
 * 5. 通过共识选择最合适的Agent
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import type { TaskAnnouncement, Dance, ConsensusReached } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";

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

function log(type: string, message: string, details?: unknown) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix =
    {
      TASK: `${colors.cyan}📢 TASK${colors.reset}`,
      DANCE: `${colors.magenta}💃 DANCE${colors.reset}`,
      SUPPORT: `${colors.green}🤝 SUPPORT${colors.reset}`,
      WITHDRAW: `${colors.yellow}↩️ WITHDRAW${colors.reset}`,
      CONSENSUS: `${colors.green}✅ CONSENSUS${colors.reset}`,
      AGENT: `${colors.cyan}🤖 AGENT${colors.reset}`,
    }[type] || `${colors.bright}•${colors.reset}`;

  console.log(`\n${prefix} [${timestamp}]`);
  console.log(`  ${message}`);
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(`  ${colors.bright}${key}:${colors.reset} ${String(value)}`);
    });
  }
}

async function demonstrateRealConsensus() {
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║     🐝 真正的分布式共识演示 - 多Agent竞争              ║
║                                                          ║
║  这次不再是流水线，而是真正的共识决策！                ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  const eventBus = new EventBus(1000);

  // 创建AgentFactory
  const agentFactory = new AgentFactory(
    { id: "factory_consensus", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  // 监听所有事件
  const dances: Dance[] = [];
  const supports: unknown[] = [];
  const withdraws: unknown[] = [];
  const agents: unknown[] = [];

  // 1. 监听Agent创建
  eventBus.subscribe("AGENT_CREATED", (event) => {
    const data = event.payload;
    agents.push(data);
    log("AGENT", "功能Agent已创建并加入池", {
      "Agent ID": data.agentId,
      角色: data.role,
      能力: data.capabilities?.join(", "),
    });
  });

  // 2. 监听舞蹈
  eventBus.subscribe("DANCE", (event) => {
    const dance = event.payload as Dance;
    dances.push(dance);

    log("DANCE", `Agent ${dance.agentId} 发布了舞蹈！`, {
      任务ID: dance.taskId,
      置信度: `${(dance.confidence * 100).toFixed(0)}%`,
      匹配技能: dance.matchedSkills.join(", "),
      理由: dance.reasoning,
    });
  });

  // 3. 监听支持
  eventBus.subscribe("SUPPORT", (event) => {
    const support = event.payload;
    supports.push(support);

    log("SUPPORT", `Agent ${support.agentId} 支持了 ${support.targetAgentId}`, {
      理由: support.reason,
      信心: `${(support.confidence * 100).toFixed(0)}%`,
    });
  });

  // 4. 监听撤回
  eventBus.subscribe("WITHDRAW", (event) => {
    const withdraw = event.payload;
    withdraws.push(withdraw);

    log("WITHDRAW", `Agent ${withdraw.agentId} 撤回了舞蹈`, {
      理由: withdraw.reason,
    });
  });

  // 5. 监听共识达成
  eventBus.subscribe("CONSENSUS_REACHED", (event) => {
    const consensus = event.payload as ConsensusReached;

    log("CONSENSUS", `共识达成！`, {
      任务ID: consensus.taskId,
      获胜Agent: consensus.result.assignedAgent,
      执行方式: consensus.result.action,
      支持者: consensus.result.supporters?.join(", "),
    });
  });

  console.log(`\n${colors.bright}📝 步骤1: 预先创建多个功能Agent（池化）${colors.reset}\n`);
  console.log(`  这步模拟了真实的蜂群场景：`);
  console.log(`  - 蜂巢里有多个工蜂`);
  console.log(`  - 它们都有能力处理不同类型的任务`);
  console.log(`  - 当任务来了，所有合适的工蜂都会跳摇摆舞\n`);

  // 预先创建3个不同能力的Agent
  const templates = [
    { id: "general_assistant", name: "General Assistant" },
    { id: "file_analyzer", name: "File Analyzer" },
    { id: "wp_uploader", name: "WordPress Uploader" },
  ];

  for (const template of templates) {
    await agentFactory.createInstance({
      templateId: template.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 100)); // 稍微延迟一下
  }

  console.log(`\n${colors.bright}⏳ 等待所有Agent准备就绪...${colors.reset}`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`\n${colors.bright}📝 步骤2: 发布任务公告${colors.reset}\n`);
  console.log(`  任务：处理用户消息并回答问题`);
  console.log(`  需要能力：text_processing, question_answering\n`);
  console.log(`  注意：这个任务能力匹配General Assistant\n`);
  console.log(`  但File Analyzer和WordPress Uploader也可能部分匹配\n`);

  const task: TaskAnnouncement = {
    taskId: `task_message_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing", "question_answering"],
    priority: "normal",
    description: "处理用户消息并生成回复",
    timestamp: Date.now(),
  };

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "interface_consensus",
    payload: task,
  });

  console.log(`\n${colors.bright}⏳ 步骤3: 观察Agent竞争（舞蹈阶段）${colors.reset}\n`);
  console.log(`  所有匹配的Agent都会评估自己的能力`);
  console.log(`  然后发布舞蹈声明自己可以处理`);
  console.log(`  置信度低的Agent会支持置信度高的\n`);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 显示竞争结果
  console.log(`\n${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                  📊 共识竞争分析                         ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`\n${colors.bright}1️⃣ Agent池情况:${colors.reset}`);
  console.log(`   总共创建: ${agents.length} 个Agent\n`);
  agents.forEach((a, i) => {
    console.log(`   ${i + 1}. ${colors.cyan}${a.agentId}${colors.reset} (${a.role})`);
    console.log(`      能力: ${a.capabilities?.join(", ")}`);
  });

  console.log(`\n${colors.bright}2️⃣ 舞蹈竞争:${colors.reset}`);
  console.log(`   总共舞蹈: ${dances.length} 次\n`);
  dances.forEach((d, i) => {
    console.log(`   ${i + 1}. ${colors.magenta}${d.agentId}${colors.reset}`);
    console.log(`      置信度: ${(d.confidence * 100).toFixed(0)}%`);
    console.log(`      匹配技能: ${d.matchedSkills.join(", ")}`);
  });

  if (supports.length > 0) {
    console.log(`\n${colors.bright}3️⃣ 支持行为:${colors.reset}`);
    console.log(`   总共支持: ${supports.length} 次\n`);
    supports.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.agentId} → ${s.targetAgentId}`);
      console.log(`      理由: ${s.reason}`);
    });
  }

  if (withdraws.length > 0) {
    console.log(`\n${colors.bright}4️⃣ 撤回行为:${colors.reset}`);
    console.log(`   总共撤回: ${withdraws.length} 次\n`);
    withdraws.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.agentId}`);
      console.log(`      理由: ${w.reason}`);
    });
  }

  console.log(`\n${colors.bright}5️⃣ 共识结果:${colors.reset}`);
  if (dances.length > 0) {
    const bestDance = dances.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
    console.log(`   ${colors.green}✓ 获胜Agent: ${bestDance.agentId}${colors.reset}`);
    console.log(`   置信度: ${(bestDance.confidence * 100).toFixed(0)}%`);
    console.log(`   匹配技能: ${bestDance.matchedSkills.join(", ")}`);

    if (dances.length === 1) {
      console.log(`\n   ${colors.yellow}注意: 只有一个Agent参与，自动达成共识${colors.reset}`);
    } else {
      console.log(
        `\n   ${colors.green}✓ 有${dances.length}个Agent竞争，通过共识机制选出最优${colors.reset}`,
      );
    }
  }

  // 清理
  await agentFactory.stop();

  console.log(`\n${colors.bright}${colors.green}
╔══════════════════════════════════════════════════════════╗
║                  🎯 关键区别                             ║
╚══════════════════════════════════════════════════════════╝

${colors.reset}${colors.bright}流水线模式:${colors.reset}
  创建Agent → 执行任务 → 完成
  (单一Agent，无选择过程)

${colors.bright}共识模式:${colors.reset}
  多Agent池化 → 同时评估 → 发布舞蹈 → 竞争/支持 → 达成共识 → 执行
  (多个Agent，真正的选择过程)

${colors.bright}${colors.cyan}
这就是蜜蜂的"摇摆舞"机制：
- 多只工蜂发现食物源
- 都回来跳摇摆舞
- 舞蹈质量（距离、方向）决定支持度
- 最优的获胜，其他工蜂支持它

而不是：
- 只有一只工蜂出去
- 找到食物就回来
- 没有选择过程
${colors.reset}
`);
}

demonstrateRealConsensus().catch(console.error);
