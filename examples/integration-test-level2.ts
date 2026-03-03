/**
 * Level 2: Semi-Real Integration Test
 *
 * 尝试连接真实服务，失败则回退到模拟
 * 不需要 API keys（LLM 仍然模拟）
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
import { GatewayIntegrator } from '../src/hive/GatewayIntegrator.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';
import { promises as fs } from 'fs';
import net from 'net';

async function main() {
  console.log('🔬 Level 2: Semi-Real Integration Test\n');
  console.log('='.repeat(60));
  console.log('尝试连接真实服务，失败则回退到模拟');
  console.log('='.repeat(60));
  console.log('\n');

  // ========== 环境检查 ==========
  console.log('─'.repeat(60));
  console.log('Environment Check');
  console.log('─'.repeat(60));
  console.log('');

  // 检查 Gateway 是否运行
  const gatewayUrl = 'ws://127.0.0.1:18789';
  const gatewayHost = '127.0.0.1';
  const gatewayPort = 18789;
  let gatewayRunning = false;

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect(gatewayPort, gatewayHost, () => {
        gatewayRunning = true;
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        gatewayRunning = false;
        socket.destroy();
        resolve();
      });
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 1000);
    });
  } catch (error) {
    gatewayRunning = false;
  }

  console.log(`🌐 Gateway Status: ${gatewayRunning ? '✅ Running' : '❌ Not Running'} (${gatewayUrl})`);
  if (gatewayRunning) {
    console.log('   Will attempt real Gateway connection');
  } else {
    console.log('   Will use simulated Gateway');
  }
  console.log('');

  // 检查 OpenClaw sessions 目录
  const sessionsDir = '/root/.openclaw/agents/main/sessions';
  const sessionsJsonPath = '/root/.openclaw/agents/main/sessions/sessions.json';
  let sessionsDirExists = false;
  let sessionsJsonExists = false;
  let sessionCount = 0;

  try {
    const stats = await fs.stat(sessionsDir);
    sessionsDirExists = stats.isDirectory();

    if (sessionsDirExists) {
      const sessionsJson = await fs.readFile(sessionsJsonPath, 'utf-8');
      const sessions = JSON.parse(sessionsJson);
      sessionCount = Object.keys(sessions).length;
      sessionsJsonExists = true;
    }
  } catch (error) {
    sessionsDirExists = false;
    sessionsJsonExists = false;
  }

  console.log(`🗂️  Sessions Directory: ${sessionsDirExists ? '✅ Exists' : '❌ Not Found'} (${sessionsDir})`);
  if (sessionsJsonExists) {
    console.log(`   Sessions JSON: ✅ Exists (${sessionCount} sessions)`);
    console.log('   Will use real SessionManager');
  } else {
    console.log('   Sessions JSON: ❌ Not Found');
    console.log('   Will use simulated SessionManager');
  }
  console.log('');

  // ========== 配置 HiveMind ==========
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  const eventBus = getGlobalEventBus();

  // ========== 初始化组件 ==========
  console.log('─'.repeat(60));
  console.log('Initializing Components');
  console.log('─'.repeat(60));
  console.log('');

  // 1. ToolsManager（纯内存，无副作用）
  console.log('🔧 Initializing ToolsManager...');
  const toolsManager = new ToolsManager(hiveConfig);
  console.log('✅ ToolsManager initialized');
  console.log('');

  // 2. LLMRuntime（模拟，无需 API key）
  console.log('🤖 Initializing LLMRuntime (simulated, no API key required)...');
  const llmRuntime = new LLMRuntime(hiveConfig);
  console.log('✅ LLMRuntime initialized');
  console.log('');

  // 3. SessionManager（尝试使用真实文件）
  console.log('🗂️  Initializing SessionManager...');
  let sessionManager: SessionManager;
  let sessionManagerMode: 'real' | 'simulated';

  if (sessionsJsonExists) {
    try {
      sessionManager = new SessionManager(
        'main',
        hiveConfig,
        '/root/.openclaw/agents',
      );
      sessionManagerMode = 'real';
      console.log('✅ SessionManager initialized (real mode)');
      console.log(`   Reading from: ${sessionsJsonPath}`);
    } catch (error) {
      console.log(`⚠️  Failed to use real sessions: ${(error as Error).message}`);
      console.log('   Falling back to simulated mode');
      sessionManager = new SessionManager(
        'test_agent_001',
        hiveConfig,
        '/tmp/hivemindtest',
      );
      sessionManagerMode = 'simulated';
    }
  } else {
    sessionManager = new SessionManager(
      'test_agent_001',
      hiveConfig,
      '/tmp/hivemindtest',
    );
    sessionManagerMode = 'simulated';
    console.log('✅ SessionManager initialized (simulated mode)');
  }
  console.log('');

  // 4. HiveGatewayBridge
  console.log('🔗 Initializing HiveGatewayBridge...');
  const bridge = new HiveGatewayBridge({
    hiveConfig,
    eventBus,
  });
  await bridge.initialize();
  console.log('✅ HiveGatewayBridge initialized');
  console.log('');

  // 5. System Agents
  console.log('🟡 Initializing System Agents...');

  console.log('   - MemoryAgent');
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

  console.log('   - Orchestrator');
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

  console.log('   - ReflectionAgent');
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

  console.log('   - InterfaceAgent');
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

  console.log('✅ System agents started');
  console.log('');

  // 6. AgentFactory
  console.log('🏭 Initializing AgentFactory...');
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

  // 7. GatewayIntegrator（尝试连接真实 Gateway）
  console.log('🌐 Initializing GatewayIntegrator...');
  let gatewayIntegrator: GatewayIntegrator | null;
  let gatewayMode: 'real' | 'simulated';

  if (gatewayRunning) {
    try {
      gatewayIntegrator = new GatewayIntegrator({
        gatewayUrl,
        token: undefined,
        hiveConfig,
        eventBus,
        bridge,
      });
      await gatewayIntegrator.connect();
      gatewayMode = 'real';
      console.log('✅ GatewayIntegrator connected to real Gateway');
      console.log(`   URL: ${gatewayUrl}`);
    } catch (error) {
      console.log(`⚠️  Failed to connect to Gateway: ${(error as Error).message}`);
      console.log('   Falling back to simulated mode');
      gatewayMode = 'simulated';
      gatewayIntegrator = new GatewayIntegrator({
        gatewayUrl: 'ws://simulated:18789',
        token: undefined,
        hiveConfig,
        eventBus,
        bridge,
      });
      await gatewayIntegrator.connect();
    }
  } else {
    gatewayIntegrator = new GatewayIntegrator({
      gatewayUrl: 'ws://simulated:18789',
      token: undefined,
      hiveConfig,
      eventBus,
      bridge,
    });
    await gatewayIntegrator.connect();
    gatewayMode = 'simulated';
    console.log('✅ GatewayIntegrator initialized (simulated mode)');
  }
  console.log('');

  // ========== 测试场景 1: 真实文件操作 ==========
  console.log('─'.repeat(60));
  console.log('Test Scenario 1: Real File Operations');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📝 Creating test file...');
  const testFilePath = '/tmp/hivemind_test_file.txt';
  const testContent = 'Hello, HiveMind Level 2 Test!';
  await fs.writeFile(testFilePath, testContent, 'utf-8');
  console.log(`✅ File created: ${testFilePath}`);
  console.log('');

  console.log('📖 Reading file with ToolsManager...');
  const hasReadPermission = toolsManager.hasPermission('interface_agent_001', 'read');
  console.log(`   InterfaceAgent can read: ${hasReadPermission ? '✅ Yes' : '❌ No'}`);
  console.log('');

  const content = await fs.readFile(testFilePath, 'utf-8');
  console.log(`✅ File content: "${content}"`);
  console.log('');

  console.log('🗑️  Cleaning up test file...');
  await fs.unlink(testFilePath);
  console.log('✅ Test file deleted');
  console.log('');

  // ========== 测试场景 2: SessionManager 集成 ==========
  console.log('─'.repeat(60));
  console.log('Test Scenario 2: SessionManager Integration');
  console.log('─'.repeat(60));
  console.log('');

  console.log(`📊 SessionManager Mode: ${sessionManagerMode}`);
  console.log('');

  if (sessionManagerMode === 'real') {
    const stats = await sessionManager.getStats();
    console.log(`📊 Session Statistics:`);
    console.log(`   Total sessions: ${stats.totalSessions}`);
    console.log(`   Active sessions: ${stats.activeSessions}`);
    console.log(`   HiveMind sessions: ${stats.hiveMindSessions}`);
    console.log('');

    if (stats.activeSessions > 0) {
      console.log(`📋 Recent Active Sessions:`);
      const recentSessions = await sessionManager.listSessions(60);
      for (const session of recentSessions.slice(0, 5)) {
        console.log(`   - ${session.sessionId}`);
        console.log(`     UpdatedAt: ${new Date(session.updatedAt).toLocaleString()}`);
        console.log(`     DisplayName: ${session.displayName || 'N/A'}`);
        console.log(`     HiveMind: ${session.hiveMind ? 'Yes' : 'No'}`);
      }
    }
  } else {
    console.log('ℹ️  Simulated mode - no real sessions to show');
  }
  console.log('');

  // ========== 测试场景 3: 消息路由 ==========
  console.log('─'.repeat(60));
  console.log('Test Scenario 3: Message Routing');
  console.log('─'.repeat(60));
  console.log('');

  let messageCount = 0;

  eventBus.subscribe(EventType.NEW_MESSAGE, (event) => {
    messageCount++;
    console.log(`📨 [NEW_MESSAGE #${messageCount}]`);
  });

  eventBus.subscribe('TASK_ASSIGNED', (event) => {
    const payload = event.payload as { taskId: string; targetAgent: string };
    console.log(`📋 [TASK_ASSIGNED] → ${payload.targetAgent}`);
  });

  eventBus.subscribe(EventType.MESSAGE_PROCESSED, (event) => {
    const payload = event.payload as { agentId: string; messageId: string };
    console.log(`✅ [MESSAGE_PROCESSED] ${payload.agentId}`);
  });

  console.log('👤 Simulating message: "Level 2 test message"');
  console.log('');

  try {
    const response = await bridge.interceptMessage({
      id: 'msg_level2_001',
      content: 'Level 2 test message',
      userId: 'test_user_level2',
      channelId: 'test_level2',
      timestamp: Date.now(),
    });
    console.log(`✅ Response: ${response.content.substring(0, 80)}...`);
  } catch (error) {
    console.error(`❌ Error:`, error);
  }
  console.log('');

  // ========== 测试场景 4: Gateway 事件 ==========
  console.log('─'.repeat(60));
  console.log('Test Scenario 4: Gateway Event Processing');
  console.log('─'.repeat(60));
  console.log('');

  console.log(`🌐 Gateway Mode: ${gatewayMode}`);
  console.log('');

  const mockGatewayEvent = {
    type: 'event' as const,
    event: 'chat.send',
    payload: {
      id: 'msg_gateway_level2_001',
      to: 'test_channel',
      message: 'Gateway test message',
      channel: 'test',
      userId: 'test_user',
    },
  };

  console.log(`📨 Simulating Gateway event: chat.send`);
  console.log('');

  if (gatewayIntegrator) {
    await gatewayIntegrator.handleEvent(mockGatewayEvent);
    console.log('✅ Gateway event processed');
  }
  console.log('');

  // ========== 最终统计 ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  console.log(`📊 Environment:`);
  console.log(`   Gateway: ${gatewayRunning ? '✅ Real' : '❌ Simulated'}`);
  console.log(`   Sessions: ${sessionManagerMode === 'real' ? '✅ Real' : '❌ Simulated'}`);
  console.log('');

  console.log(`📊 Event Counts:`);
  console.log(`   NEW_MESSAGE: ${messageCount}`);
  console.log('');

  console.log(`📊 System Status:`);
  const agents = orchestrator.getAllAgents();
  console.log(`   Agents: ${agents.length}`);
  console.log(`   Running: ${agents.filter(a => a.isRunning).length}`);
  console.log('');

  // ========== 清理 ==========
  console.log('─'.repeat(60));
  console.log('Cleanup');
  console.log('─'.repeat(60));
  console.log('');

  if (gatewayIntegrator && gatewayMode === 'real') {
    await gatewayIntegrator.disconnect();
    console.log('✅ GatewayIntegrator disconnected');
  }

  await reflectionAgent.stop();
  await interfaceAgent.stop();
  await memoryAgent.stop();
  await orchestrator.stop();
  await agentFactory.stop();
  await bridge.shutdown();

  console.log('✅ All agents stopped');
  console.log('');

  if (sessionManagerMode === 'simulated') {
    try {
      await fs.rm('/tmp/hivemindtest', { recursive: true, force: true });
      console.log('✅ Test directory cleaned');
    } catch {
      console.log('ℹ️  Test directory clean up skipped');
    }
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log('✅ Level 2: Semi-Real Integration Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
