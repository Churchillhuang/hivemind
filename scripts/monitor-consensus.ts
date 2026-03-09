#!/usr/bin/env tsx
/**
 * 监控脚本：观察用户提问时的共识决策流程
 */

import { EventBus } from "../src/events/EventBus.js";
import { AgentFactory } from "../src/hive/AgentFactory.js";
import type { TaskAnnouncement, Dance, ConsensusReached } from "../src/hive/consensus-types.js";
import { DEFAULT_HIVE_CONFIG } from "../src/hive/HiveConfig.js";

async function monitor() {
  console.log("🔍 共识决策监控器已启动\n");
  console.log("=".repeat(60));

  // 1. 创建事件总线
  const eventBus = new EventBus(1000);

  // 2. 创建Agent工厂
  const agentFactory = new AgentFactory(
    { id: "factory_001", role: "AgentFactory" },
    DEFAULT_HIVE_CONFIG,
    eventBus,
  );

  await agentFactory.start();

  // 3. 监听所有关键事件
  let taskCounter = 0;
  let danceCounter = 0;
  let consensusCounter = 0;
  let completedCounter = 0;

  eventBus.subscribe("TASK_ANNOUNCEMENT", (event) => {
    taskCounter++;
    const task = event.payload as TaskAnnouncement;
    console.log(`\n📢 [${new Date().toLocaleTimeString()}] 任务公告 #${taskCounter}`);
    console.log(`   任务ID: ${task.taskId}`);
    console.log(`   任务类型: ${task.taskType}`);
    console.log(`   需要能力: ${task.requiredCapabilities.join(", ")}`);
    console.log(`   描述: ${task.description.substring(0, 100)}...`);
  });

  eventBus.subscribe("DANCE", (event) => {
    danceCounter++;
    const dance = event.payload as Dance;
    console.log(`\n💃 [${new Date().toLocaleTimeString()}] 舞蹈事件 #${danceCounter}`);
    console.log(`   Agent: ${dance.agentId}`);
    console.log(`   任务: ${dance.taskId}`);
    console.log(`   置信度: ${(dance.confidence * 100).toFixed(0)}%`);
    console.log(`   匹配技能: ${dance.matchedSkills.join(", ")}`);
    console.log(`   理由: ${dance.reasoning}`);
  });

  eventBus.subscribe("SUPPORT", (event) => {
    const support = event.payload as { agentId: string; targetAgentId: string; reason: string };
    console.log(`\n🤝 [${new Date().toLocaleTimeString()}] 支持事件`);
    console.log(`   支持者: ${support.agentId}`);
    console.log(`   被支持者: ${support.targetAgentId}`);
    console.log(`   理由: ${support.reason}`);
  });

  eventBus.subscribe("CONSENSUS_REACHED", (event) => {
    consensusCounter++;
    const consensus = event.payload as ConsensusReached;
    console.log(`\n✅ [${new Date().toLocaleTimeString()}] 共识达成 #${consensusCounter}`);
    console.log(`   任务: ${consensus.taskId}`);
    console.log(`   执行方式: ${String(consensus.result.action ?? "")}`);
    if (consensus.result.assignedAgent) {
      console.log(`   被分配Agent: ${String(consensus.result.assignedAgent ?? "")}`);
    }
    console.log(`   支持者: ${consensus.result.supporters.join(", ")}`);
  });

  eventBus.subscribe("TASK_COMPLETED", (event) => {
    completedCounter++;
    const result = event.payload as { taskId: string; agentId: string; result?: string };
    console.log(`\n🎉 [${new Date().toLocaleTimeString()}] 任务完成 #${completedCounter}`);
    console.log(`   任务ID: ${result.taskId}`);
    console.log(`   Agent: ${result.agentId}`);
    if (result.result) {
      console.log(`   结果长度: ${String(result.result.length ?? "")} 字符`);
    }
  });

  eventBus.subscribe("MESSAGE_PROCESSED", (event) => {
    const msg = event.payload as { messageId: string; agentId: string; content: string };
    console.log(`\n📨 [${new Date().toLocaleTimeString()}] 消息处理完成`);
    console.log(`   消息ID: ${msg.messageId}`);
    console.log(`   Agent: ${msg.agentId}`);
    console.log(`   内容预览: ${msg.content.substring(0, 100)}...`);
  });

  // 4. 模拟用户提问
  console.log("\n🧪 模拟用户提问...\n");

  const userQuestion: TaskAnnouncement = {
    taskId: `user_question_${Date.now()}`,
    taskType: "message",
    requiredCapabilities: ["text_processing", "question_answering"],
    priority: "normal",
    description: "你好，请帮我分析一下分布式系统的优缺点",
    timestamp: Date.now(),
    payload: {
      message: {
        id: "msg_user_001",
        content: "你好，请帮我分析一下分布式系统的优缺点",
        userId: "user_001",
        timestamp: Date.now(),
      },
    },
  };

  await eventBus.publish({
    type: "TASK_ANNOUNCEMENT",
    sourceAgent: "interface_001",
    payload: userQuestion,
  });

  // 5. 等待共识完成
  console.log("\n⏳ 等待共识形成和任务执行...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 6. 显示统计信息
  console.log("\n" + "=".repeat(60));
  console.log("📊 统计信息:");
  console.log(`   任务公告数: ${taskCounter}`);
  console.log(`   舞蹈事件数: ${danceCounter}`);
  console.log(`   共识达成数: ${consensusCounter}`);
  console.log(`   任务完成数: ${completedCounter}`);
  console.log("=".repeat(60));

  // 7. 清理
  await agentFactory.stop();
  console.log("\n✓ 监控结束");
}

monitor().catch(console.error);

/**
 * 预期输出示例：
 *
 * 🔍 共识决策监控器已启动
 *
 * ============================================================
 *
 * 🧪 模拟用户提问...
 *
 * 📢 [15:40:00] 任务公告 #1
 *    任务ID: user_question_1234567890
 *    任务类型: message
 *    需要能力: text_processing, question_answering
 *    描述: 你好，请帮我分析一下分布式系统的优缺点...
 *
 * [AgentFactory factory_001] Task announcement received: user_question_1234567890 (message)
 *
 * 💃 [15:40:00] 舞蹈事件 #1
 *    Agent: func_1234567890_abc123
 *    任务: user_question_1234567890
 *    置信度: 80%
 *    匹配技能: text_processing, question_answering
 *    理由: Strong match: text_processing, question_answering
 *
 * ✅ [15:40:00] 共识达成 #1
 *    任务: user_question_1234567890
 *    执行方式: direct
 *    被分配Agent: func_1234567890_abc123
 *    支持者: func_1234567890_abc123
 *
 * 🎉 [15:40:01] 任务完成 #1
 *    任务ID: user_question_1234567890
 *    Agent: func_1234567890_abc123
 *    结果长度: 150 字符
 *
 * 📨 [15:40:01] 消息处理完成
 *    消息ID: user_question_1234567890
 *    Agent: func_1234567890_abc123
 *    内容预览: [FunctionalAgent func_1234567890_abc123] Processed: "你好，请帮我分析一下分布式系统的优缺...
 *
 * ============================================================
 * 📊 统计信息:
 *    任务公告数: 1
 *    舞蹈事件数: 1
 *    共识达成数: 1
 *    任务完成数: 1
 * ============================================================
 *
 * ✓ 监控结束
 */
