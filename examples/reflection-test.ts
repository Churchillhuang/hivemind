/**
 * Example: ReflectionAgent Self-Reflection Test
 *
 * 演示 ReflectionAgent 的自我评估和技能学习
 */

import { ReflectionAgent } from '../src/hive/ReflectionAgent.js';
import { Orchestrator } from '../src/hive/Orchestrator.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🪞 ReflectionAgent Self-Reflection Test\n');

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

  // 2. 创建并启动 ReflectionAgent
  console.log('🪞 Initializing ReflectionAgent...');
  const reflectionAgent = new ReflectionAgent(
    {
      id: 'reflection_agent_001',
      role: 'Reflection Agent',
      description: '自我反思和技能学习',
    },
    hiveConfig,
    eventBus,
  );

  await reflectionAgent.start();
  console.log('✅ ReflectionAgent started\n');

  // 显示 ReflectionAgent 状态
  console.log('📊 ReflectionAgent Status:');
  const status = reflectionAgent.getStatus();
  console.log(`   Reflections: ${status.reflectionCount}`);
  console.log(`   Skills: ${status.skillCount}`);
  console.log(`   Agents: ${status.agentCount}`);
  if (status.latestReflection) {
    console.log(`   Latest: ${status.latestReflection}`);
  }
  console.log('');

  // 3. 订阅反思事件
  let reflectionCount = 0;

  eventBus.subscribe('SELF_REFLECTION', (event) => {
    const reflection = event.payload as {
      id: string;
      timestamp: number;
      findings: any[];
      recommendations: any[];
      summary: string;
    };

    reflectionCount++;

    console.log(`🪞 [SELF_REFLECTION #${reflectionCount}]`);
    console.log(`   Time: ${new Date(reflection.timestamp).toLocaleString()}`);
    console.log(`   ${reflection.summary}`);

    if (reflection.findings.length > 0) {
      console.log('   Findings:');
      for (const finding of reflection.findings) {
        console.log(`     - [${finding.type.toUpperCase()}] ${finding.description}`);
        if (finding.evidence.length > 0) {
          console.log(`       Evidence: ${finding.evidence.join(', ')}`);
        }
      }
    }

    if (reflection.recommendations.length > 0) {
      console.log('   Recommendations:');
      for (const rec of reflection.recommendations) {
        console.log(`     - [${rec.priority.toUpperCase()}] ${rec.description}`);
      }
    }

    console.log('');
  });

  eventBus.subscribe(EventType.AGENT_STARTED, (event) => {
    const agent = event.payload as { agentId: string; role: string };
    console.log(`🟢 [AGENT_STARTED] ${agent.agentId} (${agent.role})`);
    reflectionAgent.recordAgentStats({
      id: agent.agentId,
      type: 'system',
      role: agent.role,
      capabilities: [],
      isRunning: true,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });
  });

  eventBus.subscribe(EventType.MESSAGE_PROCESSED, (event) => {
    const payload = event.payload as { messageId: string; agentId: string };
    console.log(`✅ [MESSAGE_PROCESSED] ${payload.messageId} by ${payload.agentId}`);
  });

  // 4. 模拟消息处理（触发反思）
  console.log('👤 Simulating message processing...\n');

  for (let i = 0; i < 3; i++) {
    const msgId = `msg_${i}`;
    const agentId = 'interface_agent_001';

    // 发布 MESSAGE_PROCESSED 事件（模拟处理完成）
    await eventBus.publish({
      type: EventType.MESSAGE_PROCESSED,
      sourceAgent: agentId,
      payload: {
        messageId: msgId,
        agentId,
      },
    });

    // 等待一小段时间
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n🕐 Waiting for scheduled reflection...');

  // 等待反思（每 60 秒一次，但我们手动触发）
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔄 Manually triggering reflection...\n');

  // 手动触发反思
  await eventBus.publish({
    type: 'REFLECTION_REQUESTED',
    sourceAgent: 'test_script',
    payload: {},
  });

  // 等待反思完成
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. 显示反思记录
  console.log('📜 Reflection History:');
  const reflections = reflectionAgent.getReflections(5);
  for (const ref of reflections) {
    console.log(`   - ${ref.id.slice(0, 20)}... (${new Date(ref.timestamp).toLocaleTimeString()})`);
    console.log(`     ${ref.summary}`);
  }
  console.log('');

  // 6. 显示技能状态
  console.log('🎯 Skills:');
  const skills = reflectionAgent.getSkills();
  if (skills.length === 0) {
    console.log('   (No skills learned yet)');
  } else {
    for (const skill of skills) {
      console.log(`   - ${skill.name}: ${skill.learned ? 'Learned' : 'Not learned'}`);
      if (skill.learned) {
        console.log(`     Success rate: ${(skill.successRate * 100).toFixed(1)}%`);
        console.log(`     Usage count: ${skill.usageCount}`);
      }
    }
  }
  console.log('');

  // 7. 模拟技能学习
  console.log('🎓 Simulating skill learning...\n');

  await eventBus.publish({
    type: EventType.SKILL_LEARNED,
    sourceAgent: 'test_script',
    payload: {
      skillName: 'message_routing',
      successRate: 0.95,
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  await eventBus.publish({
    type: EventType.SKILL_LEARNED,
    sourceAgent: 'test_script',
    payload: {
      skillName: 'memory_retrieval',
      successRate: 0.88,
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // 再次触发反思
  await eventBus.publish({
    type: 'REFLECTION_REQUESTED',
    sourceAgent: 'test_script',
    payload: {},
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 显示更新后的技能状态
  console.log('🎯 Updated Skills:');
  const updatedSkills = reflectionAgent.getSkills();
  for (const skill of updatedSkills) {
    console.log(`   - ${skill.name}: ${skill.learned ? '✓' : '✗'}`);
    if (skill.learned) {
      console.log(`     Success rate: ${(skill.successRate * 100).toFixed(1)}%`);
    }
  }
  console.log('');

  // 清理
  console.log('🛑 Shutting down...');
  await reflectionAgent.stop();
  await orchestrator.stop();
  console.log('✅ All agents stopped\n');

  console.log('📊 Final Statistics:');
  const finalStatus = reflectionAgent.getStatus();
  console.log(`   Reflections: ${finalStatus.reflectionCount}`);
  console.log(`   Skills: ${finalStatus.skillCount}`);
  console.log(`   Agents: ${finalStatus.agentCount}`);
}

main().catch(console.error);
