/**
 * Demo: Global State Machine in Real Environment
 *
 * 在实际 OpenClaw 环境中使用 GlobalStateMachine
 */

import { GlobalStateMachine } from '../src/hive/GlobalStateMachine.js';
import { DEFAULT_HIVE_CONFIG } from '../src/hive/HiveConfig.js';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  console.log('🔥 Global State Machine - Real Environment Demo\n');
  console.log('='.repeat(60));
  console.log('');
  console.log('This demo simulates a real HiveMind deployment scenario');
  console.log('='.repeat(60));
  console.log('\n');

  const hiveConfig = DEFAULT_HIVE_CONFIG;

  // 创建 Global State Machine（使用持久化）
  const gsm = new GlobalStateMachine({
    enablePersistence: true,
    checkpointPath: '/root/.openclaw/.hivemind/state',
    maxCheckpoints: 10,
    checkpointInterval: 30000,  // 30 秒
    enableRollback: true,
  }, hiveConfig);

  console.log('📦 GlobalStateMachine created');
  console.log('   Persistence: /root/.openclaw/.hivemind/state');
  console.log('   Checkpoint Interval: 30s');
  console.log('   Max Checkpoints: 10');
  console.log('   Rollback Enabled: Yes\n');

  // 启动状态机
  await gsm.start();
  console.log('');

  // ============ 场景 1: 系统启动 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('🚀 SCENARIO 1: System Startup');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('📥 System starting...');
  gsm.updateMetadata({
    activeAgents: [],
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  });

  const status1 = gsm.getStatus();
  console.log(`   State: ${status1.currentState}`);
  console.log(`   Uptime: ${status1.uptime}ms`);
  console.log('');

  // ============ 场景 2: Agent 初始化 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('🤖 SCENARIO 2: Agent Initialization');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('🔧 Initializing Orchestrator...');
  gsm.updateMetadata({
    activeAgents: ['orchestrator_001'],
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  });

  console.log('🔧 Initializing InterfaceAgent...');
  gsm.updateMetadata({
    activeAgents: ['orchestrator_001', 'interface_agent_001'],
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  });

  console.log('🔧 Initializing MemoryAgent...');
  gsm.updateMetadata({
    activeAgents: ['orchestrator_001', 'interface_agent_001', 'memory_agent_001'],
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  });

  console.log('✅ All agents initialized');
  console.log('');

  // ============ 场景 3: 开始处理消息 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('📨 SCENARIO 3: Message Processing');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('📨 Transition: idle → processing');
  await gsm.transition('processing', 'Start processing messages', 'orchestrator_001');
  console.log('');

  console.log('📨 Processing 5 messages...');
  for (let i = 1; i <= 5; i++) {
    gsm.updateMetadata({
      pendingTasks: 5 - i,
      completedTasks: i,
    });
    console.log(`   [${i}/5] Message processed`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ All messages processed');
  console.log('');

  // 创建检查点 1
  console.log('💾 Creating checkpoint (post-processing)...');
  const cp1 = await gsm.createCheckpoint('post_batch_1');
  console.log(`   Checkpoint ID: ${cp1.id}`);
  console.log(`   State: ${cp1.state}`);
  console.log(`   Pending: ${cp1.metadata.pendingTasks}`);
  console.log(`   Completed: ${cp1.metadata.completedTasks}`);
  console.log('');

  // ============ 场景 4: 错误恢复 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('❌ SCENARIO 4: Error Recovery');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('❌ Simulating error...');
  gsm.updateMetadata({
    failedTasks: 1,
  });

  console.log('⚠️  Transition: processing → error');
  await gsm.transition('error', 'Memory corruption detected', 'memory_agent_001');

  console.log('🔧 Transition: error → recovery');
  await gsm.transition('recovery', 'Starting recovery process', 'orchestrator_001');

  console.log('✅ Recovery completed');
  await gsm.transition('idle', 'Recovery finished', 'orchestrator_001');
  console.log('');

  // ============ 场景 5: 回滚 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('🔄 SCENARIO 5: Rollback');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('📊 Current state:');
  const currentStatus = gsm.getStatus();
  console.log(`   State: ${currentStatus.currentState}`);
  console.log(`   Checkpoints: ${currentStatus.checkpoints}\n`);

  console.log('🔄 Rolling back to post-processing checkpoint...');
  try {
    await gsm.rollback(cp1.id);
    console.log('✅ Rollback completed\n');

    const rollbackStatus = gsm.getStatus();
    console.log(`📊 State after rollback:`);
    console.log(`   State: ${rollbackStatus.currentState}`);
    console.log(`   Generation: ${rollbackStatus.generation}`);
  } catch (error) {
    console.log(`❌ Rollback failed: ${error}`);
  }
  console.log('');

  // ============ 场景 6: 持续运行 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('🔄 SCENARIO 6: Continuous Operation');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('📨 Message processing loop (10 more messages)...');
  await gsm.transition('processing', 'Processing next batch', 'orchestrator_001');

  for (let i = 1; i <= 10; i++) {
    gsm.updateMetadata({
      pendingTasks: 10 - i,
      completedTasks: 5 + i,
    });
    if (i % 5 === 0) {
      console.log(`   [${i}/10] Message processed`);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('✅ Batch 2 completed\n');

  console.log('💾 Creating checkpoint (post-batch-2)...');
  const cp2 = await gsm.createCheckpoint('post_batch_2');
  console.log(`   Checkpoint ID: ${cp2.id}`);
  console.log(`   State: ${cp2.state}`);
  console.log('');

  // ============ 场景 7: 优雅关闭 ============
  console.log('────────────────────────────────────────────────────────────');
  console.log('🛑 SCENARIO 7: Graceful Shutdown');
  console.log('────────────────────────────────────────────────────────────\n');

  console.log('📨 Transition: processing → idle');
  await gsm.transition('idle', 'All tasks completed', 'orchestrator_001');

  console.log('🛑 Transition: idle → shutdown');
  await gsm.transition('shutdown', 'System shutdown requested', 'system');
  console.log('');

  // ============ 最终统计 ============
  console.log('─'.repeat(60));
  console.log('📊 FINAL STATISTICS');
  console.log('─'.repeat(60));
  console.log('');

  const finalStatus = gsm.getStatus();
  const finalState = gsm.getState();
  const finalTransitions = gsm.getTransitions(10);
  const finalCheckpoints = gsm.getCheckpoints();

  console.log(`📊 System Status:`);
  console.log(`   Final State: ${finalStatus.currentState}`);
  console.log(`   Generation: ${finalStatus.generation}`);
  console.log(`   Total Transitions: ${finalStatus.transitions}`);
  console.log(`   Total Checkpoints: ${finalStatus.checkpoints}`);
  console.log(`   Uptime: ${finalStatus.uptime}ms`);
  console.log('');

  console.log(`📊 Metadata:`);
  console.log(`   Active Agents: [${finalState.metadata.activeAgents.join(', ')}]`);
  console.log(`   Completed Tasks: ${finalState.metadata.completedTasks}`);
  console.log(`   Failed Tasks: ${finalState.metadata.failedTasks}`);
  console.log('');

  console.log(`📊 Recent Transitions (last 5):`);
  for (let i = 0; i < Math.min(5, finalTransitions.length); i++) {
    const t = finalTransitions[i];
    const time = new Date(t.timestamp).toLocaleTimeString();
    console.log(`   [${time}] ${t.from} → ${t.to} (${t.reason})`);
  }
  console.log('');

  console.log(`📊 Checkpoints:`);
  console.log(`   Total: ${finalCheckpoints.length}`);
  for (let cp of finalCheckpoints) {
    const time = new Date(cp.timestamp).toLocaleTimeString();
    console.log(`   - ${cp.id} (${cp.state}) [${time}]`);
  }
  console.log('');

  // 检查持久化文件
  console.log(`💾 Persistence Files:`);
  const statePath = '/root/.openclaw/.hivemind/state';

  try {
    const files = await fs.readdir(statePath);
    console.log(`   Path: ${statePath}`);
    console.log(`   Files: ${files.length}`);
    for (const file of files.slice(0, 5)) {
      const filePath = path.join(statePath, file);
      const stats = await fs.stat(filePath);
      console.log(`   - ${file} (${stats.size} bytes)`);
    }
    if (files.length > 5) {
      console.log(`   ... and ${files.length - 5} more files`);
    }
  } catch (error) {
    console.log(`   No persistence files found`);
  }
  console.log('');

  // 停止状态机
  console.log('─'.repeat(60));
  console.log('🛑 Shutting down...');
  console.log('─'.repeat(60));
  console.log('');

  await gsm.stop();
  console.log('✅ GlobalStateMachine stopped');
  console.log('');
  console.log('💾 Final state saved to: /root/.openclaw/.hivemind/state/final_state.json');
  console.log('');
  console.log('─'.repeat(60));
  console.log('✅ Demo Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
