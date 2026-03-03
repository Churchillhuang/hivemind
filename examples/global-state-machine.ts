/**
 * Example: Global State Machine Test
 *
 * 演示 GlobalStateMachine - 全局状态管理，检查点，持久化，回滚
 */

import { GlobalStateMachine } from '../src/hive/GlobalStateMachine.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';

async function main() {
  console.log('⚙️  Global State Machine Test\n');

  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  // 创建 Global State Machine
  console.log('📦 Creating GlobalStateMachine...');
  const gsm = new GlobalStateMachine({
    enablePersistence: true,
    checkpointPath: '/tmp/hivemind_gsm_test',
    maxCheckpoints: 5,
    checkpointInterval: 5000,  // 5 秒（测试用，实际应该更长）
    enableRollback: true,
  }, hiveConfig);

  console.log('✅ GlobalStateMachine created\n');

  // 1. 启动状态机
  console.log('1️⃣  Starting state machine...');
  await gsm.start();
  console.log('');

  // 2. 获取初始状态
  console.log('2️⃣  Initial Status:');
  const initialStatus = gsm.getStatus();
  console.log(`   Current State: ${initialStatus.currentState}`);
  console.log(`   Generation: ${initialStatus.generation}`);
  console.log(`   Checkpoints: ${initialStatus.checkpoints}`);
  console.log(`   Transitions: ${initialStatus.transitions}`);
  console.log(`   Uptime: ${initialStatus.uptime}ms`);
  console.log('');

  // 3. 更新元数据
  console.log('3️⃣  Updating metadata...');
  gsm.updateMetadata({
    activeAgents: ['orchestrator_001', 'interface_agent_001'],
    pendingTasks: 5,
    completedTasks: 3,
  });
  console.log('✅ Metadata updated\n');

  // 4. 状态转换：idle → processing
  console.log('4️⃣  Transition: idle → processing');
  await gsm.transition('processing', 'Start processing messages', 'orchestrator_001');
  console.log('');

  // 5. 获取转换历史
  console.log('5️⃣  Transition History:');
  const transitions = gsm.getTransitions(3);
  for (const t of transitions) {
    const time = new Date(t.timestamp).toLocaleTimeString();
    console.log(`   [${time}] ${t.from} → ${t.to} (${t.reason})`);
    if (t.agentId) {
      console.log(`     Agent: ${t.agentId}`);
    }
  }
  console.log('');

  // 6. 创建检查点（手动）
  console.log('6️⃣  Creating manual checkpoint...');
  const checkpoint1 = await gsm.createCheckpoint('manual_1');
  console.log(`   Checkpoint ID: ${checkpoint1.id}`);
  console.log(`   State: ${checkpoint1.state}`);
  console.log(`   Hash: ${checkpoint1.stateHash}`);
  console.log('');

  // 7. 继续状态转换
  console.log('7️⃣  Continue transitions...');

  await gsm.transition('blocked', 'Waiting for user input', 'interface_agent_001');
  await new Promise(resolve => setTimeout(resolve, 1000));

  await gsm.transition('idle', 'Input received, ready to process', 'orchestrator_001');
  await new Promise(resolve => setTimeout(resolve, 1000));

  await gsm.transition('processing', 'Processing messages', 'orchestrator_001');
  console.log('');

  // 8. 显示所有检查点
  console.log('8️⃣  All Checkpoints:');
  const checkpoints = gsm.getCheckpoints();
  console.log(`   Total: ${checkpoints.length}`);
  for (const cp of checkpoints) {
    const time = new Date(cp.timestamp).toLocaleTimeString();
    console.log(`   - ${cp.id} (${cp.state}) [${time}]`);
    console.log(`     Generation: ${cp.metadata.generation}`);
  }
  console.log('');

  // 9. 保存检查点 2（在 idle 状态）
  console.log('9️⃣  Creating checkpoint 2...');
  const checkpoint2 = await gsm.createCheckpoint('manual_2');
  console.log(`   Checkpoint ID: ${checkpoint2.id}`);
  console.log('');

  // 10. 状态转换到 error（模拟错误）
  console.log('🔟 Transition to error (simulate failure)...');
  try {
    await gsm.transition('error', 'Simulated system error', 'system');
  } catch (error) {
    console.log(`   Transition error: ${error}`);
  }
  console.log('');

  // 11. 回滚到检查点
  console.log('1️⃣1️⃣  Rollback to checkpoint 2 (idle state)...');
  const rollbackCheckpointId = checkpoint2.id;
  try {
    await gsm.rollback(rollbackCheckpointId);
    console.log('✅ Rollback succeeded\n');

    const currentStatus = gsm.getStatus();
    console.log(`   Current State: ${currentStatus.currentState}`);
    console.log(`   Generation: ${currentStatus.generation}`);
  } catch (error) {
    console.log(`   ❌ Rollback failed: ${error}\n`);
  }

  // 12. 最终状态
  console.log('1️⃣2️⃣  Final Status:');
  const finalStatus = gsm.getStatus();
  const state = gsm.getState();
  console.log(`   Current State: ${finalStatus.currentState}`);
  console.log(`   Generation: ${finalStatus.generation}`);
  console.log(`   Checkpoints: ${finalStatus.checkpoints}`);
  console.log(`   Transitions: ${finalStatus.transitions}`);
  console.log(`   Uptime: ${finalStatus.uptime}ms`);
  console.log('');
  console.log(`   Metadata:`);
  console.log(`     Active Agents: [${state.metadata.activeAgents.join(', ')}]`);
  console.log(`     Pending Tasks: ${state.metadata.pendingTasks}`);
  console.log(`     Completed Tasks: ${state.metadata.completedTasks}`);
  console.log(`     Failed Tasks: ${state.metadata.failedTasks}`);
  console.log('');

  // 13. 等待自动检查点
  console.log('1️⃣3️⃣  Waiting for scheduled checkpoint (5s)...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  console.log('✅ Scheduled checkpoint created\n');

  // 14. 最终检查点
  console.log('1️⃣4️⃣  All Checkpoints (after rollback):');
  const finalCheckpoints = gsm.getCheckpoints();
  console.log(`   Total: ${finalCheckpoints.length}`);
  for (const cp of finalCheckpoints) {
    const time = new Date(cp.timestamp).toLocaleTimeString();
    console.log(`   - ${cp.id} (${cp.state}) [${time}]`);
  }
  console.log('');

  // 15. 停止状态机
  console.log('1️⃣5️⃣  Stopping state machine...');
  await gsm.stop();
  console.log('✅ State machine stopped\n');

  // 16. 清理
  console.log('🧹 Cleaning up test directory...');
  const { promises: fs } = await import('fs');
  try {
    await fs.rm('/tmp/hivemind_gsm_test', { recursive: true, force: true });
    console.log('✅ Test directory cleaned');
  } catch {
    console.log('ℹ️  Test directory clean up skipped');
  }
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Global State Machine Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
