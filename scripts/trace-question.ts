#!/usr/bin/env tsx
/**
 * 实时监控：追踪当前问题的执行过程
 *
 * 这个脚本会：
 * 1. 监听所有共识相关事件
 * 2. 显示每个阶段的详细信息
 * 3. 追踪Agent如何被创建、评估、选择和执行
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
      CONSENSUS: `${colors.green}✅ CONSENSUS${colors.reset}`,
      EXECUTE: `${colors.yellow}⚡ EXECUTE${colors.reset}`,
      RESULT: `${colors.blue}📨 RESULT${colors.reset}`,
      AGENT: `${colors.cyan}🤖 AGENT${colors.reset}`,
      ERROR: `${colors.red}❌ ERROR${colors.reset}`,
    }[type] || `${colors.bright}•${colors.reset}`;

  console.log(`\n${prefix} [${timestamp}]`);
  console.log(`  ${message}`);
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(`  ${colors.bright}${key}:${colors.reset} ${String(value)}`);
    });
  }
}

async function traceCurrentQuestion() {
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║     🔍 HiveMind 共识决策追踪器 - 实时监控               ║
║                                                          ║
║  当前问题: "看看我现在这个问题怎么执行的"              ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  // 创建事件总线
  const eventBus = new EventBus(1000);

  // 创建AgentFactory
  const agentFactory = new AgentFactory(
    { id: "factory_monitor", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  // 监听所有事件
  const events: unknown[] = [];
  const agentCreations: unknown[] = [];
  const dances: Dance[] = [];
  const consensusEvents: ConsensusReached[] = [];
  const taskResults: unknown[] = [];

  // 1. 任务公告监听
  eventBus.subscribe("TASK_ANNOUNCEMENT", (event) => {
    const task = event.payload as TaskAnnouncement;
    events.push({ type: "TASK_ANNOUNCEMENT", time: Date.now(), data: task });

    log("TASK", "新任务已广播", {
      任务ID: task.taskId,
      任务类型: task.taskType,
      需要能力: task.requiredCapabilities.join(", "),
      优先级: task.priority,
      描述: task.description.substring(0, 80) + "...",
    });
  });

  // 2. Agent创建监听
  eventBus.subscribe("AGENT_CREATED", (event) => {
    const data = event.payload;
    agentCreations.push(data);

    log("AGENT", "功能Agent已创建", {
      "Agent ID": data.agentId,
      角色: data.role,
      模板: data.templateId,
      能力: data.capabilities?.join(", "),
    });
  });

  // 3. 舞蹈监听
  eventBus.subscribe("DANCE", (event) => {
    const dance = event.payload as Dance;
    dances.push(dance);
    events.push({ type: "DANCE", time: Date.now(), data: dance });

    log("DANCE", "Agent发布了舞蹈（声明可以处理任务）", {
      "Agent ID": dance.agentId,
      任务ID: dance.taskId,
      置信度: `${(dance.confidence * 100).toFixed(0)}%`,
      匹配技能: dance.matchedSkills.join(", "),
      评估理由: dance.reasoning,
    });
  });

  // 4. 支持监听
  eventBus.subscribe("SUPPORT", (event) => {
    const support = event.payload;
    events.push({ type: "SUPPORT", time: Date.now(), data: support });

    log("SUPPORT", "Agent支持了另一个Agent", {
      支持者: support.agentId,
      被支持者: support.targetAgentId,
      理由: support.reason,
      信心: `${(support.confidence * 100).toFixed(0)}%`,
    });
  });

  // 5. 撤回监听
  eventBus.subscribe("WITHDRAW", (event) => {
    const withdraw = event.payload;
    events.push({ type: "WITHDRAW", time: Date.now(), data: withdraw });

    log("AGENT", "Agent撤回了舞蹈", {
      "Agent ID": withdraw.agentId,
      任务ID: withdraw.taskId,
      理由: withdraw.reason,
    });
  });

  // 6. 共识达成监听
  eventBus.subscribe("CONSENSUS_REACHED", (event) => {
    const consensus = event.payload as ConsensusReached;
    consensusEvents.push(consensus);
    events.push({ type: "CONSENSUS_REACHED", time: Date.now(), data: consensus });

    log("CONSENSUS", "共识已达成！", {
      任务ID: consensus.taskId,
      执行方式: consensus.result.action,
      被选中Agent: consensus.result.assignedAgent || "分解任务",
      支持者: consensus.result.supporters?.join(", "),
      子任务数: consensus.result.subtasks?.length || 0,
    });
  });

  // 7. 任务完成监听
  eventBus.subscribe("TASK_COMPLETED", (event) => {
    const result = event.payload;
    taskResults.push(result);
    events.push({ type: "TASK_COMPLETED", time: Date.now(), data: result });

    log("RESULT", "任务已完成", {
      任务ID: result.taskId,
      "Agent ID": result.agentId,
      执行时长: `${result.processingTime || 0}ms`,
      结果预览: (result.result || "").substring(0, 100) + "...",
    });
  });

  // 8. 消息处理监听
  eventBus.subscribe("MESSAGE_PROCESSED", (event) => {
    const msg = event.payload;
    events.push({ type: "MESSAGE_PROCESSED", time: Date.now(), data: msg });

    log("RESULT", "消息已处理", {
      消息ID: msg.messageId,
      Agent: msg.agentId,
      内容长度: `${msg.content?.length || 0} 字符`,
    });
  });

  // 模拟当前问题
  console.log(`\n${colors.bright}📝 准备发送问题...${colors.reset}\n`);

  const currentQuestion: TaskAnnouncement = {
    taskId: `question_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing", "question_answering"],
    priority: "normal",
    description: "看看我现在这个问题怎么执行的",
    timestamp: Date.now(),
    payload: {
      message: {
        id: "msg_current_question",
        content: "看看我现在这个问题怎么执行的",
        userId: "user_current",
        timestamp: Date.now(),
      },
    },
  };

  // 发送任务
  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "interface_current",
    payload: currentQuestion,
  });

  console.log(`\n${colors.bright}⏳ 等待共识形成和任务执行...${colors.reset}`);

  // 等待执行完成
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 生成详细报告
  console.log(`\n${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║                  📊 执行流程完整报告                     ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`\n${colors.bright}1️⃣ 事件流程时间线:${colors.reset}`);
  events.forEach((e, i) => {
    const elapsed = i === 0 ? "0ms" : `+${e.time - events[0].time}ms`;
    console.log(`   ${i + 1}. [${elapsed}] ${e.type}`);
  });

  console.log(`\n${colors.bright}2️⃣ Agent创建情况:${colors.reset}`);
  console.log(`   总共创建: ${agentCreations.length} 个Agent`);
  agentCreations.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.agentId} (${a.role})`);
  });

  console.log(`\n${colors.bright}3️⃣ 舞蹈事件分析:${colors.reset}`);
  console.log(`   总共舞蹈: ${dances.length} 次`);
  dances.forEach((d, i) => {
    console.log(`   ${i + 1}. Agent: ${d.agentId}`);
    console.log(`      置信度: ${(d.confidence * 100).toFixed(0)}%`);
    console.log(`      匹配技能: ${d.matchedSkills.join(", ")}`);
  });

  console.log(`\n${colors.bright}4️⃣ 共识决策:${colors.reset}`);
  if (consensusEvents.length > 0) {
    const c = consensusEvents[0];
    console.log(`   ✓ 共识已达成`);
    console.log(`   被选中Agent: ${c.result.assignedAgent}`);
    console.log(`   执行方式: ${c.result.action}`);
    console.log(`   支持者数量: ${c.result.supporters?.length || 0}`);
  } else {
    console.log(`   ✗ 未达成共识`);
  }

  console.log(`\n${colors.bright}5️⃣ 任务执行结果:${colors.reset}`);
  if (taskResults.length > 0) {
    taskResults.forEach((r, i) => {
      console.log(`   ${i + 1}. Agent ${r.agentId} 完成`);
      console.log(`      任务ID: ${r.taskId}`);
    });
  } else {
    console.log(`   ⚠ 没有任务完成事件`);
  }

  console.log(`\n${colors.bright}6️⃣ 完整事件序列:${colors.reset}`);
  events.forEach((e, i) => {
    console.log(`\n   事件 ${i + 1}: ${e.type}`);
    if (e.type === "TASK_ANNOUNCEMENT") {
      const t = e.data as TaskAnnouncement;
      console.log(`     - 任务类型: ${t.taskType}`);
      console.log(`     - 需要能力: ${t.requiredCapabilities.join(", ")}`);
    } else if (e.type === "DANCE") {
      const d = e.data as Dance;
      console.log(`     - Agent: ${d.agentId}`);
      console.log(`     - 置信度: ${(d.confidence * 100).toFixed(0)}%`);
      console.log(`     - 技能: ${d.matchedSkills.join(", ")}`);
    } else if (e.type === "CONSENSUS_REACHED") {
      const c = e.data as ConsensusReached;
      console.log(`     - 被选中Agent: ${c.result.assignedAgent}`);
      console.log(`     - 支持者: ${c.result.supporters?.join(", ")}`);
    } else if (e.type === "TASK_COMPLETED") {
      const r = e.data;
      console.log(`     - Agent: ${r.agentId}`);
      console.log(`     - 任务ID: ${r.taskId}`);
    }
  });

  // 清理
  await agentFactory.stop();

  console.log(`\n${colors.bright}${colors.green}
╔══════════════════════════════════════════════════════════╗
║                  ✓ 追踪完成                              ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}
`);
}

traceCurrentQuestion().catch(console.error);
