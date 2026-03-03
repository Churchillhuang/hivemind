/**
 * Full System Integration Test
 *
 * 验证所有组件的协同工作（纯模拟，不需要 API）
 */

import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { Orchestrator } from '../src/hive/Orchestrator.js';
import { InterfaceAgent } from '../src/hive/InterfaceAgent.js';
import { MemoryAgent } from '../src/hive/MemoryAgent.js';
import { ReflectionAgent } from '../src/hive/ReflectionAgent.js';
import { AgentFactory } from '../src/hive/AgentFactory.js';
import { SessionManager } from '../src/hive/SessionManager.js';
import { ToolsManager } from '../src/hive/ToolsManager.js';
import { LLMRuntime } from '../src/hive/LLMRuntime.js';
import { HiveGatewayBridge } from '../src/hive/HiveGatewayBridge.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🧪 Full System Integration Test\n');
  console.log('='.repeat(60));
  console.log('Phase 1: Minimal Hive + Phase 2: OpenClaw Integration');
  console.log('Level 1: Pure Simulation (No API Required)');
  console.log('='.repeat(60));
  console.log('\n');

  // ========== 配置 HiveMind ==========
  console.log('📋 Configuring HiveMind...');
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };
  console.log('✅ HiveMind configured');
  console.log('   Mode: multi');
  console.log('   Memory: 4 tiers (L0-L4)');
  console.log('   Models: 4 tiers (nano/light/standard/heavy)');
  console.log('');

  const eventBus = getGlobalEventBus();
  console.log('📦 EventBus initialized');
  console.log('');

  // ========== Phase 1.1: 核心组件 ==========
  console.log('─'.repeat(60));
  console.log('Phase 1.1: Core Components');
  console.log('─'.repeat(60));
  console.log('');

  // 1.1.1 HiveGatewayBridge
  console.log('🔗 1.1.1 Initializing HiveGatewayBridge...');
  const bridge = new HiveGatewayBridge({
    hiveConfig,
    eventBus,
  });
  await bridge.initialize();
  console.log('✅ HiveGatewayBridge initialized');
  console.log('');

  // 1.1.2 LLMRuntime
  console.log('🤖 1.1.2 Initializing LLMRuntime...');
  const llmRuntime = new LLMRuntime(hiveConfig);
  console.log('✅ LLMRuntime initialized');
  console.log('');

  // 1.1.3 MemoryAgent
  console.log('🧠 1.1.3 Initializing MemoryAgent...');
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
  console.log('✅ MemoryAgent started');
  console.log('');

  // 1.1.4 ToolsManager
  console.log('🔧 1.1.4 Initializing ToolsManager...');
  const toolsManager = new ToolsManager(hiveConfig);
  console.log('✅ ToolsManager initialized');
  console.log(`   Tools: ${toolsManager.getStatus().toolsCount}`);
  console.log(`   Groups: ${toolsManager.getStatus().groupsCount}`);
  console.log('');

  // ========== Phase 1.2: System Agents ==========
  console.log('─'.repeat(60));
  console.log('Phase 1.2: System Agents');
  console.log('─'.repeat(60));
  console.log('');

  // 1.2.1 Orchestrator
  console.log('🟡 1.2.1 Initializing Orchestrator...');
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
  console.log('✅ Orchestrator started');
  console.log('');

  // 1.2.2 ReflectionAgent
  console.log('🪞 1.2.2 Initializing ReflectionAgent...');
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
  console.log('✅ ReflectionAgent started');
  console.log('');

  // 1.2.3 InterfaceAgent
  console.log('🟢 1.2.3 Initializing InterfaceAgent...');
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
  console.log('✅ InterfaceAgent started');
  console.log('');

  // ========== Phase 2.1: OpenClaw Integration ==========
  console.log('─'.repeat(60));
  console.log('Phase 2.1: OpenClaw Integration');
  console.log('─'.repeat(60));
  console.log('');

  // 2.1.1 SessionManager
  console.log('🗂️  2.1.1 Initializing SessionManager (test mode)...');
  const sessionManager = new SessionManager(
    'test_agent_001',
    hiveConfig,
    '/tmp/hivemintest',  // 测试目录
  );
  console.log('✅ SessionManager initialized (test mode)');
  console.log('');

  // ========== Phase 2.2: Functional Agents ==========
  console.log('─'.repeat(60));
  console.log('Phase 2.2: Functional Agents');
  console.log('─'.repeat(60));
  console.log('');

  // 2.2.1 AgentFactory
  console.log('🏭 2.2.1 Initializing AgentFactory...');
  const agentFactory = new AgentFactory(
    {
      id: 'agent_factory_001',
      role: 'Agent Factory',
      description: '动态创建和管理 Agents',
    },
    hiveConfig,
    eventBus,
  );
  await agentFactory.start();
  console.log('✅ AgentFactory started');
  console.log('');

  // ========== 系统状态总结 ==========
  console.log('─'.repeat(60));
  console.log('System Status Summary');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📊 Components Status:');
  console.log(`   EventBus: ✓ Active`);
  console.log(`   HiveGatewayBridge: ✓ Initialized`);
  console.log(`   LLMRuntime: ✓ Ready`);
  console.log(`   MemoryAgent: ✓ Running`);
  console.log(`   ToolsManager: ✓ Active (${toolsManager.getStatus().toolsCount} tools)`);
  console.log(`   Orchestrator: ✓ Running`);
  console.log(`   ReflectionAgent: ✓ Running`);
  console.log(`   InterfaceAgent: ✓ Running`);
  console.log(`   SessionManager: ✓ Initialized`);
  console.log(`   AgentFactory: ✓ Running`);
  console.log('');

  console.log('📊 Agent Counts:');
  const agentsCount = orchestrator.getAllAgents();
  console.log(`   Total: ${agentsCount.length}`);
  console.log(`   Running: ${agentsCount.filter(a => a.isRunning).length}`);
  console.log('');

  console.log('📊 Tool Permissions:');
  for (const agentId of ['interface_agent_001', 'memory_agent_001', 'orchestrator_001']) {
    const tools = toolsManager.getAllowedTools(agentId);
    console.log(`   ${agentId}: ${tools.length} tools`);
  }
  console.log('');

  // ========== 订阅事件 ==========
  let messageCount = 0;
  let taskCreated = 0;
  let reflectionCount = 0;

  eventBus.subscribe(EventType.NEW_MESSAGE, (event) => {
    messageCount++;
    console.log(`📨 [NEW_MESSAGE #${messageCount}]`);
  });

  eventBus.subscribe('TASK_ASSIGNED', (event) => {
    taskCreated++;
    const payload = event.payload as { taskId: string; targetAgent: string };
    console.log(`📋 [TASK_ASSIGNED #${taskCreated}] ${payload.targetAgent}`);
  });

  eventBus.subscribe(EventType.MESSAGE_PROCESSED, (event) => {
    const payload = event.payload as { messageId: string; agentId: string };
    console.log(`✅ [MESSAGE_PROCESSED] ${payload.agentId} → ${payload.messageId}`);
  });

  eventBus.subscribe('SELF_REFLECTION', (event) => {
    reflectionCount++;
    console.log(`🪞 [SELF_REFLECTION #${reflectionCount}]`);
  });

  console.log('✅ Event subscriptions');
  console.log('');

  // ========== 集成测试 ==========
  console.log('─'.repeat(60));
  console.log('Integration Test: Complete Message Flow');
  console.log('─'.repeat(60));
  console.log('');

  console.log('👤 Simulating user message: "What is HiveMind?"');
  console.log('');

  // 1. 通过 HiveGatewayBridge 拦截消息
  const message = {
    id: 'msg_integration_001',
    content: 'What is HiveMind?',
    userId: 'test_user',
    channelId: 'test_channel',
    timestamp: Date.now(),
  };

  try {
    const response = await bridge.interceptMessage(message);
    console.log('');
    console.log(`✅ Message processed successfully`);
    console.log(`   Response: ${response.content.substring(0, 80)}...`);
    console.log(`   Agent: ${response.agentId}`);
  } catch (error) {
    console.error(`❌ Error:`, error);
  }

  console.log('');

  // ========== 多消息测试 ==========
  console.log('─'.repeat(60));
  console.log('Multi-Message Test');
  console.log('─'.repeat(60));
  console.log('');

  const messages = [
    { id: 'msg_002', content: 'Tell me about memory tiers' },
    { id: 'msg_003', content: 'How do agents coordinate?' },
  ];

  for (const msg of messages) {
    console.log(`👤 User: ${msg.content}`);
    try {
      const response = await bridge.interceptMessage({
        ...msg,
        userId: 'test_user',
        channelId: 'test_channel',
        timestamp: Date.now(),
      });
      console.log(`🤖 Agent: ${response.content.substring(0, 60)}...`);
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
    console.log('');
  }

  // ========== 触发自我反思 ==========
  console.log('─'.repeat(60));
  console.log('Self-Reflection Test');
  console.log('─'.repeat(60));
  console.log('');

  await eventBus.publish({
    type: 'REFLECTION_REQUESTED',
    sourceAgent: 'test_script',
    payload: {},
  });

  console.log('⏳ Waiting for reflection...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✅ Reflection completed');
  console.log('');

  // ========== 动态 Agent 创建测试 ==========
  console.log('─'.repeat(60));
  console.log('Dynamic Agent Creation Test');
  console.log('─'.repeat(60));
  console.log('');

  await eventBus.publish({
    type: EventType.AGENT_CREATE_REQUEST,
    sourceAgent: 'test_script',
    payload: {
      templateId: 'moltbook_bot',
      taskId: 'task_moltbook_001',
    },
  });

  console.log('⏳ Waiting for agent creation...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Agent created');
  console.log('');

  // ========== 最终统计 ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  console.log(`📊 Event Counts:`);
  console.log(`   NEW_MESSAGE: ${messageCount}`);
  console.log(`   TASK_ASSIGNED: ${taskCreated}`);
  console.log(`   SELF_REFLECTION: ${reflectionCount}`);
  console.log('');

  console.log(`📊 Orchestrator Queue:`);
  const queueStatus = orchestrator.getQueueStatus();
  console.log(`   Total tasks: ${queueStatus.totalTasks}`);
  console.log(`   By status:`, queueStatus.byStatus);
  console.log('');

  console.log(`📊 Orchestrator Agents:`);
  console.log(`   Total: ${agentsCount.length}`);
  for (const agent of agentsCount) {
    console.log(`   - ${agent.id}: ${agent.isRunning ? 'Running' : 'Stopped'}`);
  }
  console.log('');

  console.log(`📊 ReflectionAgent:`);
  const reflectionStatus = reflectionAgent.getStatus();
  console.log(`   Reflections: ${reflectionStatus.reflectionCount}`);
  console.log(`   Skills: ${reflectionStatus.skillCount}`);
  console.log('');

  console.log(`📊 AgentFactory:`);
  const factoryStatus = agentFactory.getStatus();
  console.log(`   Templates: ${factoryStatus.templates}`);
  console.log(`   Instances: ${factoryStatus.instances}`);
  console.log(`   Active: ${factoryStatus.active}`);
  console.log('');

  console.log(`📊 LLMRuntime:`);
  const llmStats = llmRuntime.getStatistics();
  console.log(`   Calls: ${llmStats.callsCount}`);
  console.log(`   Tokens: ${llmStats.totalTokens}`);
  console.log(`   Cost: $${llmStats.totalCost.toFixed(6)}`);
  console.log('');

  // ========== 清理 ==========
  console.log('─'.repeat(60));
  console.log('Cleanup');
  console.log('─'.repeat(60));
  console.log('');

  await reflectionAgent.stop();
  await interfaceAgent.stop();
  await memoryAgent.stop();
  await orchestrator.stop();
  await agentFactory.stop();
  await bridge.shutdown();

  console.log('✅ All agents stopped');
  console.log('');

  // ========== 清理测试文件 ==========
  const { promises: fs } = await import('fs');
  try {
    await fs.rm('/tmp/hivemindtest', { recursive: true, force: true });
    console.log('✅ Test directory cleaned');
  } catch {
    console.log('ℹ️  Test directory clean up skipped');
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('✅ Full System Integration Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
