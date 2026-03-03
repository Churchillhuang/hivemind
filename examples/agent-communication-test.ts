/**
 * Agent Communication Test
 *
 * 演示直接消息、请求/响应、广播频道、死锁检测和预防
 */

import { AgentCommunication } from '../src/hive/AgentCommunication.js';
import { DEFAULT_HIVE_CONFIG } from '../src/hive/HiveConfig.js';

async function main() {
  console.log('📡 Agent Communication Test\n');

  const hiveConfig = DEFAULT_HIVE_CONFIG;

  // 创建 Communication Framework
  console.log('1️⃣  Creating Communication Framework...\n');

  const comm = new AgentCommunication(hiveConfig);

  console.log('✅ Communication Framework created\n');

  // ========== Test 1: Direct Messages ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Direct Messages');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📤 Sending direct messages...\n');

  // Agent A 发送消息给 Agent B
  await comm.sendDirect('agent_A', 'agent_B', 'Hello Agent B!', { type: 'greeting' });

  // Agent B 发送消息给 Agent C
  await comm.sendDirect('agent_B', 'agent_C', 'Message from Agent A: "Hello Agent B!"');

  // Agent C 发送消息给 Agent A
  await comm.sendDirect('agent_C', 'agent_A', 'Acknowledged!');

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('✅ Direct messages sent\n');

  // ========== Test 2: Request/Response ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Request/Response Pattern');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📤 Sending requests...\n');

  // Agent A 请求 Agent B 获取数据
  const requestPromise = comm.sendRequest(
    'agent_A',
    'agent_B',
    'Get current system status',
    { query: 'status' },
    { timeout: 5000 },
  ).catch(error => {
    console.log(`   ⚠️  Request from A: ${error.message}`);
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  // 获取统计
  const stats = comm.getStats();
  console.log('📊 Statistics:');
  console.log(`   Requests sent: ${stats.requestsSent}`);
  console.log(`   Responses sent: ${stats.responsesSent}`);
  console.log('   Messages received included in counts');
  console.log('');

  // 等待请求完成（超时）
  await requestPromise;

  // ========== Test 3: Broadcast Channels ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Broadcast Channels');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📢 Creating broadcast channels...\n');

  // 创建系统通知频道
  const systemChannel = comm.createChannel('system', 'System Notifications');
  console.log(`✅ Channel created: ${systemChannel.id} (${systemChannel.name})`);

  // 创建任务更新频道
  const taskChannel = comm.createChannel('tasks', 'Task Updates');
  console.log(`✅ Channel created: ${taskChannel.id} (${taskChannel.name})`);
  console.log('');

  // Agents 订阅频道
  console.log('👥 Agents subscribing to channels...\n');

  comm.subscribeToChannel('system', 'agent_A');
  comm.subscribeToChannel('system', 'agent_B');
  comm.subscribeToChannel('system', 'agent_C');

  comm.subscribeToChannel('tasks', 'agent_B');
  comm.subscribeToChannel('tasks', 'agent_C');

  console.log('✅ Agents subscribed\n');

  // 获取频道订阅者
  const systemSubscribers = comm.getChannelSubscribers('system');
  const taskSubscribers = comm.getChannelSubscribers('tasks');

  console.log('📊 Channel Subscribers:');
  console.log(`   System channel: ${systemSubscribers.length} (${systemSubscribers.join(', ')})`);
  console.log(`   Tasks channel: ${taskSubscribers.length} (${taskSubscribers.join(', ')})`);
  console.log('');

  // 广播消息
  console.log('📢 Broadcasting messages...\n');

  const systemCount = await comm.broadcast(
    'system',
    'system',
    'System maintenance scheduled at 3 AM',
    { type: 'maintenance', time: '03:00 UTC' },
  );

  const taskCount = await comm.broadcast(
    'agent_A',
    'tasks',
    'New task assigned: Analyze data',
    { taskId: 'task_001' },
  );

  console.log(`✅ System broadcast: ${systemCount} subscribers`);
  console.log(`✅ Task broadcast: ${taskCount} subscribers`);
  console.log('');

  // ========== Test 4: Deadlock Detection ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Deadlock Detection and Prevention');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🕵️  Simulating deadlock scenario...\n');

  // 创建多个请求，形成等待环
  // Agent A 等待 Agent B
  const reqA = comm.sendRequest('agent_A', 'agent_B', 'Request from A', {}, { timeout: 5000 })
    .catch(error => console.log(`   ⚠️  Request from A: ${error.message}`));

  // Agent B 等待 Agent C
  const reqB = comm.sendRequest('agent_B', 'agent_C', 'Request from B', {}, { timeout: 5000 })
    .catch(error => console.log(`   ⚠️  Request from B: ${error.message}`));

  // Agent C 等待 Agent A（形成环）
  const reqC = comm.sendRequest('agent_C', 'agent_A', 'Request from C', {}, { timeout: 5000 })
    .catch(error => console.log(`   ⚠️  Request from C: ${error.message}`));

  await new Promise(resolve => setTimeout(resolve, 500));

  // 检查等待关系
  const waitingRelations = comm.getWaitingRelations();
  console.log('🕸️  Waiting Relations:');
  for (const [agent, waitingFor] of waitingRelations.entries()) {
    console.log(`   ${agent} → ${waitingFor}`);
  }
  console.log('');

  // 检测死锁
  console.log('🔍 Detecting deadlock...\n');

  const detection = comm.detectDeadlock();

  console.log('📊 Detection Result:');
  console.log(`   Detected: ${detection.detected ? '✅ YES' : '❌ NO'}`);
  if (detection.detected) {
    console.log(`   Waiting chain: ${detection.waitingChain.join(' → ')}`);
    console.log(`   Deadlock agents: ${detection.deadlockAgents.join(', ')}`);
    console.log('');

    // 解决死锁 (捕获拒绝的 Promise)
    console.log('🔧 Resolving deadlock (timeout abort)...\n');

    await Promise.allSettled([reqA, reqB, reqC]);

    setTimeout(() => {
      comm.resolveDeadlock(detection.deadlockAgents);
      console.log('✅ Deadlock resolved\n');
    }, 1000);
  }
  console.log('');

  // 等待死锁解决后清理
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Wait for any remaining timeout errors to be processed
  await Promise.allSettled([reqA, reqB, reqC]);

  // Check stats after deadlock
  const postDeadlockStats = comm.getStats();
  console.log('📊 Statistics after deadlock:');
  console.log(`   Deadlocks detected: ${postDeadlockStats.deadlocksDetected}`);
  console.log(`   Deadlocks resolved: ${postDeadlockStats.deadlocksResolved}`);
  console.log('');

  // ========== Test 5: Channel Management ==========
  console.log('─'.repeat(60));
  console.log('Test 5: Channel Management');
  console.log('─'.repeat(60));
  console.log('');

  // 取消订阅
  console.log('👥 Managing channel subscriptions...\n');

  comm.unsubscribeFromChannel('tasks', 'agent_B');
  console.log('✅ Agent B unsubscribed from tasks');

  const postUnsubTaskSubs = comm.getChannelSubscribers('tasks');
  console.log(`   Tasks channel now has: ${postUnsubTaskSubs.length} subscribers (${postUnsubTaskSubs.join(', ')})`);
  console.log('');

  // 获取所有频道
  const allChannels = comm.getAllChannels();
  console.log('📊 All Channels:');
  for (const channel of allChannels) {
    const subs = comm.getChannelSubscribers(channel.id);
    console.log(`   - ${channel.name} (${channel.id})`);
    console.log(`     Subscribers: ${subs.length} (${subs.join(', ')})`);
  }
  console.log('');

  // ========== Final Statistics ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  const finalStats = comm.getStats();

  console.log(`📊 Communication Statistics:`);
  console.log(`   Messages sent: ${finalStats.messagesSent}`);
  console.log(`   Messages received: ${finalStats.messagesReceived}`);
  console.log(`   Requests sent: ${finalStats.requestsSent}`);
  console.log(`   Responses sent: ${finalStats.responsesSent}`);
  console.log(`   Broadcasts sent: ${finalStats.broadcastsSent}`);
  console.log(`   Broadcasts received: ${finalStats.broadcastsReceived}`);
  console.log(`   Deadlocks detected: ${finalStats.deadlocksDetected}`);
  console.log(`   Deadlocks resolved: ${finalStats.deadlocksResolved}`);
  console.log('');

  console.log('📊 Pending Requests:');
  const pending = comm.getPendingRequests();
  console.log(`   Total: ${pending.length}`);
  for (const req of pending) {
    console.log(`   - ${req.id} (${req.from} → ${req.to})`);
  }
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Agent Communication Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
