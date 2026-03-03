/**
 * Advanced Router Test
 *
 * 演示优先级队列、负载均衡、Agent 特化和任务依赖
 */

import { AdvancedRouter, type TaskPriority } from '../src/hive/AdvancedRouter.js';
import { DEFAULT_HIVE_CONFIG } from '../src/hive/HiveConfig.js';

async function main() {
  console.log('🔀 Advanced Router Test\n');

  const hiveConfig = DEFAULT_HIVE_CONFIG;

  // 创建 Advanced Router
  console.log('1️⃣  Creating Advanced Router...\n');

  const router = new AdvancedRouter({
    priorityConfig: {
      defaultPriority: 'normal',
      priorityWeights: {
        critical: 10,
        high: 5,
        normal: 1,
        low: 0.5,
      },
      ageBonus: 0.1,
    },
    loadBalancing: 'least-loaded',
    enableTaskDeps: true,
    maxQueueSize: 100,
    priorityQueueSize: 50,
  }, hiveConfig);

  console.log('✅ Advanced Router created\n');

  // 注册 Agent 负载
  console.log('2️⃣  Registering Agent Loads...\n');

  const agents: Array<{ id: string; name: string; specializations: string[] }> = [
    {
      id: 'interface_agent_001',
      name: 'Interface Agent',
      specializations: ['dialogue', 'q&a', 'text_processing'],
    },
    {
      id: 'content_writer_001',
      name: 'Content Writer',
      specializations: ['content_writing', 'blogging', 'article_creation'],
    },
    {
      id: 'search_agent_001',
      name: 'Search Agent',
      specializations: ['search', 'lookup', 'finding'],
    },
    {
      id: 'analysis_agent_001',
      name: 'Analysis Agent',
      specializations: ['analysis', 'understanding', 'explain'],
    },
  ];

  for (const agent of agents) {
    router.registerAgentLoad(agent.id, agent.specializations);
    console.log(`✅ Registered: ${agent.name} (${agent.specializations.join(', ')})`);
  }

  console.log('');

  // ========== 测试 1: 优先级队列 ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Priority Queue');
  console.log('─'.repeat(60));
  console.log('');

  const tasks: Array<{ id: string; content: string; priority: TaskPriority }> = [
    { id: 'task_1', content: 'Low priority task', priority: 'low' },
    { id: 'task_2', content: 'Normal task', priority: 'normal' },
    { id: 'task_3', content: 'High priority task', priority: 'high' },
    { id: 'task_4', content: 'Critical task', priority: 'critical' },
    { id: 'task_5', content: 'Another normal task', priority: 'normal' },
  ];

  console.log('📤 Enqueuing 5 tasks with different priorities...\n');

  for (const task of tasks) {
    const result = await router.enqueue(task, task.priority);
    console.log(`   [${result.queued ? '✅' : '❌'}] ${task.id} (${task.priority}): "${task.content}"`);
  }

  console.log('');

  // 查看队列统计
  const queueStats = router.getQueueStats();
  console.log('📊 Queue Statistics:');
  console.log(`   Total tasks: ${queueStats.total}`);
  console.log(`   By priority:`);
  console.log(`     - Critical: ${queueStats.byPriority.critical}`);
  console.log(`     - High: ${queueStats.byPriority.high}`);
  console.log(`     - Normal: ${queueStats.byPriority.normal}`);
  console.log(`     - Low: ${queueStats.byPriority.low}`);
  console.log(`   Avg wait time: ${Math.round(queueStats.avgWaitTime)}ms`);
  console.log('');

  // ========== 测试 2: 负载均衡 ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Load Balancing');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📤 Enqueuing additional tasks to test load balancing...\n');

  for (let i = 1; i <= 10; i++) {
    await router.enqueue(
      { id: `task_load_${i}`, content: `Load balance test ${i}` },
      i % 2 === 0 ? 'high' : 'normal',
    );
  }

  console.log('✅ 10 tasks enqueued\n');

  // 更新负载以模拟
  console.log('📊 Simulating agent load...\n');
  router.updateAgentLoad('interface_agent_001', 5, 10, 0);
  router.updateAgentLoad('content_writer_001', 2, 5, 0);
  router.updateAgentLoad('search_agent_001', 0, 3, 0);
  router.updateAgentLoad('analysis_agent_001', 1, 4, 0);

  const agentStats = router.getAgentStats();
  console.log('💼 Agent Load:');
  for (const stats of agentStats) {
    const agent = agents.find(a => a.id === stats.agentId);
    const name = agent?.name || 'Unknown';
    console.log(`   - ${name}`);
    console.log(`     Current: ${stats.currentTasks} | Completed: ${stats.completedTasks} | Failed: ${stats.failedTasks}`);
    console.log(`     Avg processing: ${Math.round(stats.avgProcessingTime)}ms`);
  }
  console.log('');

  // ========== 测试 3: Agent 特化 ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Agent Specialization');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📤 Enqueuing tasks for specialized agents...\n');

  const specializedTasks = [
    { id: 'task_write_1', content: 'Write a blog post about AI' },
    { id: 'task_search_1', content: 'Search for recent AI news' },
    { id: 'task_analyze_1', content: 'Analyze this code' },
    { id: 'task_write_2', content: 'Create content for social media' },
  ];

  for (const task of specializedTasks) {
    await router.enqueue(task, 'high');
    console.log(`   ✅ ${task.id}: "${task.content}"`);
  }

  console.log('');

  // 切换到专业化路由
  console.log('🔄 Switching to "specialized" load balancing strategy...\n');

  // 创建模拟 Agents
  const mockAgents = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    isRunning: true,
  }));

  // 路由几个任务
  console.log('🚀 Routing tasks with specialization...\n');

  for (let i = 0; i < 3; i++) {
    const result = await router.route(mockAgents as any);
    if (result) {
      const agent = agents.find(a => a.id === result.agentId);
      console.log(`   ✅ ${result.taskId} → ${agent?.name || result.agentId} (${agent?.specializations.join(', ')})`);
    }
  }

  console.log('');

  // ========== 测试 4: 任务依赖 ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Task Dependencies');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📤 Creating tasks with dependencies...\n');

  // 任务 A 独立
  await router.enqueue(
    { id: 'task_A', content: 'Prepare data analysis' },
    'high',
  );

  // 任务 B 依赖任务 A
  await router.enqueue(
    { id: 'task_B', content: 'Create report from analysis' },
    'normal',
  );

  // 注册依赖
  router.registerDependency('task_B', ['task_A']);
  console.log('   ✅ task_B depends on task_A');
  console.log('');

  // 尝试路由任务 B（应该被阻塞）
  console.log('🚀 Attempting to route task_B (dependencies not ready)...\n');

  const blockedResult = await router.route(mockAgents as any);
  if (!blockedResult) {
    console.log('   ⚠️  Task blocked due to dependencies\n');
  }

  // 标记任务 A 完成
  console.log('✅ Marking task_A as completed...\n');
  router.markTaskCompleted('task_A');

  // 再次尝试路由任务 B
  console.log('🚀 Attempting to route task_B (dependencies ready)...\n');

  const readyResult = await router.route(mockAgents as any);
  if (readyResult) {
    const agent = agents.find(a => a.id === readyResult.agentId);
    console.log(`   ✅ ${readyResult.taskId} → ${agent?.name || readyResult.agentId}`);
  }

  console.log('');

  // ========== 最终统计 ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  const finalQueueStats = router.getQueueStats();
  const finalRoutingStats = router.getRoutingStats();

  console.log(`📊 Queue:`);
  console.log(`   Total: ${finalQueueStats.total}`);
  console.log(`   Avg wait time: ${Math.round(finalQueueStats.avgWaitTime)}ms`);
  console.log('');

  console.log(`📊 Routing:`);
  console.log(`   Routed: ${finalRoutingStats.routed}`);
  console.log(`   Queued: ${finalRoutingStats.queued}`);
  console.log(`   Failed: ${finalRoutingStats.failed}`);
  console.log(`   Avg routing time: ${Math.round(finalRoutingStats.avgRoutingTime)}ms`);
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Advanced Router Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
