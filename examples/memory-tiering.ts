/**
 * Example: Memory Tiering System Test
 *
 * 演示记忆分层系统 - 不同层级 Agent 访问不同记忆
 */

import { HiveGatewayBridge } from '../src/hive/HiveGatewayBridge.js';
import { MemoryAgent } from '../src/hive/MemoryAgent.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig, type MemoryQuery } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🧠 Memory Tiering System Test\n');

  // 配置 HiveMind（启用记忆分层）
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
    memory: {
      layers: {
        orchestrator: 'none',       // L0: 零记忆
        interface: 'session',       // L1: 会话记忆（1-2 天）
        functional: 'task',         // L2: 任务记忆
        memory: 'knowledge',        // L3: 知识记忆（全量）
        reflection: 'sample',       // L4: 样本记忆
      },
      retention: {
        sessionDays: 2,
        sampleDays: 14,
        taskMaxFiles: 10,
      },
      indexing: {
        enableSemanticSearch: true,
        enableVectorCache: true,
        workspacePath: '/path/to/openclaw/workspace',  // 实际使用时替换为真实路径
        memoryPath: '/path/to/openclaw/workspace/memory',  // 实际使用时替换为真实路径
      },
    },
  };

  console.log('📋 Config:', JSON.stringify(hiveConfig.memory, null, 2));

  // 获取事件总线
  const eventBus = getGlobalEventBus();
  console.log('✅ EventBus active\n');

  // 创建并启动 MemoryAgent
  console.log('🧠 Initializing MemoryAgent...');
  const memoryAgent = new MemoryAgent(
    {
      id: 'memory_agent_001',
      role: 'Memory Agent',
      description: '记忆检索和管理',
    },
    hiveConfig,
    eventBus,
  );

  await memoryAgent.start();
  console.log('✅ MemoryAgent started\n');

  // 显示索引状态
  const indexStatus = memoryAgent.getIndexStatus();
  console.log('📊 Memory Index Status:');
  console.log(`   Total entries: ${indexStatus.size}`);
  console.log(`   Last updated: ${new Date(indexStatus.lastIndexUpdate).toLocaleString()}`);
  console.log('   By level:');
  for (const [level, count] of Object.entries(indexStatus.levels)) {
    if (count > 0) {
      console.log(`     - ${level}: ${count} entries`);
    }
  }
  console.log('');

  // 测试不同层级的记忆查询
  console.log('🔍 Testing memory queries at different levels...\n');

  const queries: MemoryQuery[] = [
    {
      query: 'Moltbook',
      requestId: 'query_001',
      options: {
        level: 'session',     // L1: 会话记忆
        limit: 3,
      },
    },
    {
      query: 'HiveMind',
      requestId: 'query_002',
      options: {
        level: 'knowledge',   // L3: 知识记忆
        limit: 5,
      },
    },
    {
      query: 'WordPress',
      requestId: 'query_003',
      options: {
        level: 'knowledge',
        limit: 5,
      },
    },
  ];

  // 订阅 MEMORY_RESULT 事件以捕获结果
  const results: Map<string, any> = new Map();

  eventBus.subscribe(EventType.MEMORY_RESULT, (event) => {
    const result = event.payload as {
      requestId: string;
      data: any[];
    };
    console.log(`✅ [MEMORY_RESULT] Request ${result.requestId}:`);
    console.log(`   Found ${result.data.length} results:`);
    for (const item of result.data) {
      console.log(`     - Level: ${item.level}`);
      console.log(`       Source: ${item.source.split('/').pop() || item.source}`);
      console.log(`       Preview: ${item.content.substring(0, 80)}...`);
    }
    console.log('');
    results.set(result.requestId, result.data);
  });

  // 执行查询
  for (const query of queries) {
    console.log(`📤 Query: "${query.query}" (Level: ${query.options?.level})`);

    await eventBus.publish({
      type: EventType.MEMORY_QUERY,
      sourceAgent: 'test_script',
      payload: query,
    });

    // 等待结果（简单方式：延迟）
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 显示汇总
  console.log('📊 Query Summary:');
  console.log(`   Total queries: ${queries.length}`);
  console.log(`   Results received: ${results.size}`);

  for (const [requestId, data] of results.entries()) {
    const query = queries.find(q => q.requestId === requestId);
    console.log(`   - ${requestId} (${query?.query}): ${data.length} results`);
  }

  // 清理
  console.log('\n\n🛑 Shutting down...');
  await memoryAgent.stop();
  console.log('✅ MemoryAgent stopped\n');
}

main().catch(console.error);
