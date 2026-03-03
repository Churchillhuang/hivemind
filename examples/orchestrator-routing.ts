/**
 * Example: Orchestrator Routing Test
 *
 * 演示 Orchestrator 的消息路由和生命周期管理
 */

import { HiveGatewayBridge } from '../src/hive/HiveGatewayBridge.js';
import { MemoryAgent } from '../src/hive/MemoryAgent.js';
import { Orchestrator } from '../src/hive/Orchestrator.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🎯 Orchestrator Routing Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  const eventBus = getGlobalEventBus();
  console.log('✅ EventBus active\n');

  // 1. 创建并启动 Orchestrator
  console.log('🧠 Initializing Orchestrator...');
  const orchestrator = new Orchestrator(
    {
      id: 'orchestrator_001',
      role: 'Orchestrator',
      description: '任务路由和 Agent 生命周期管理',
    },
    hiveConfig,
    eventBus,
  );

  await orchestrator.start();
  console.log('✅ Orchestrator started\n');

  // 显示 Orchestrator 状态
  console.log('📊 Orchestrator Status:');
  const orchestratorStatus = orchestrator.getStatus();
  console.log(`   Agents: ${orchestratorStatus.agents}`);
  console.log(`   Tasks: ${orchestratorStatus.tasks}`);
  console.log(`   Rules: ${orchestratorStatus.rules.join(', ')}`);
  console.log('');

  // 显示注册的 Agents
  console.log('👥 Registered Agents:');
  for (const agent of orchestrator.getAllAgents()) {
    console.log(`   - ${agent.id} (${agent.role})`);
    console.log(`     Status: ${agent.isRunning ? 'Running' : 'Stopped'}`);
    console.log(`     Capabilities: ${agent.capabilities.join(', ') || 'None'}`);
  }
  console.log('');

  // 2. 订阅事件以观察路由过程
  let messageCount = 0;

  eventBus.subscribe(EventType.MESSAGE_PROCESSED, (event) => {
    const response = event.payload as { messageId: string; agentId: string };
    console.log(`✅ [MESSAGE_PROCESSED] Message ${response.messageId} processed by ${response.agentId}`);
    messageCount++;
  });

  eventBus.subscribe(EventType.TASK_ASSIGNED, (event) => {
    const payload = event.payload as {
      taskId: string;
      targetAgent: string;
      task: { payload: { content?: string } };
    };
    console.log(`📋 [TASK_ASSIGNED] Task ${payload.taskId.slice(0, 16)}... → ${payload.targetAgent}`);
    if (payload.task.payload.content) {
      console.log(`   Content: "${payload.task.payload.content}"`);
    }
  });

  eventBus.subscribe(EventType.AGENT_STARTED, (event) => {
    console.log(`🟢 [AGENT_STARTED] ${event.payload.agentId}`);
  });

  eventBus.subscribe(EventType.AGENT_STOPPED, (event) => {
    console.log(`🔴 [AGENT_STOPPED] ${event.payload.agentId}`);
  });

  // 3. 创建并启动 InterfaceAgent
  const { InterfaceAgent } = await import('../src/hive/InterfaceAgent.js');
  console.log('🤖 Initializing InterfaceAgent...');

  const interfaceAgent = new InterfaceAgent(
    {
      id: 'interface_agent_001',
      role: 'Interface Agent',
      description: '处理用户对话',
    },
    hiveConfig,
    eventBus,
  );

  await interfaceAgent.start();
  console.log('✅ InterfaceAgent started\n');

  // 4. 模拟用户消息
  console.log('👤 Simulating user messages...\n');

  const messages = [
    { id: 'msg_001', content: 'Hello' },
    { id: 'msg_002', content: 'What is HiveMind?' },
    { id: 'msg_003', content: 'Tell me about yourself' },
  ];

  for (const msg of messages) {
    console.log(`📥 [User]: ${msg.content}`);

    // 发布 NEW_MESSAGE 事件（模拟 Gateway）
    await eventBus.publish({
      type: EventType.NEW_MESSAGE,
      sourceAgent: 'user_simulation',
      payload: {
        id: msg.id,
        content: msg.content,
        userId: 'user_123',
        channelId: 'simulation',
      },
    });

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');
  }

  // 5. 显示队列状态
  console.log('📊 Task Queue Status:');
  const queueStatus = orchestrator.getQueueStatus();
  console.log(`   Total tasks: ${queueStatus.totalTasks}`);
  console.log('   By status:');
  for (const [status, count] of Object.entries(queueStatus.byStatus)) {
    if (count > 0) {
      console.log(`     - ${status}: ${count}`);
    }
  }
  console.log('   By agent:');
  for (const [agentId, count] of Object.entries(queueStatus.byAgent)) {
    if (count > 0) {
      console.log(`     - ${agentId}: ${count}`);
    }
  }
  console.log('');

  // 6. 显示 Agent 统计
  console.log('📈 Agent Statistics:');
  for (const agent of orchestrator.getAllAgents()) {
    if (agent.stats.tasksCompleted > 0) {
      console.log(`   - ${agent.id}:`);
      console.log(`     Tasks completed: ${agent.stats.tasksCompleted}`);
      console.log(`     Tasks failed: ${agent.stats.tasksFailed}`);
      console.log(`    _avg processing time: ${agent.stats.avgProcessingTime}ms`);
    }
  }
  console.log('');

  // 清理
  console.log('🛑 Shutting down...');
  await interfaceAgent.stop();
  await orchestrator.stop();
  console.log('✅ All agents stopped\n');

  console.log('📜 Event History:');
  const history = eventBus.getHistory(undefined, 10);
  history.forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.type}`);
  });
}

main().catch(console.error);
