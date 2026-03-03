/**
 * Example: OpenClaw Session Integration Test
 *
 * 演示 SessionManager - 读取和写入 OpenClaw session 数据，支持多 agent 上下文
 */

import { SessionManager, type SessionEntry } from '../src/hive/SessionManager.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  console.log('🗂️  OpenClaw Session Integration Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  // 创建临时测试目录
  const testDir = '/tmp/hivemind-sessions';
  const testAgentId = 'test_agent_001';

  try {
    await fs.mkdir(path.join(testDir, testAgentId, 'sessions'), { recursive: true });
  } catch (error) {
    // 目录可能已存在
  }

  // 创建 SessionManager
  console.log('📦 Creating SessionManager...');
  const sessionManager = new SessionManager(testAgentId, hiveConfig, testDir);
  console.log('✅ SessionManager created\n');

  // 1. 创建测试 session
  console.log('⚙️  Creating test session...');

  const testSession: SessionEntry = {
    sessionId: 'test_session_001',
    updatedAt: Date.now(),
    displayName: 'Test Session',
    channel: 'telegram',
    origin: {
      label: 'Test Conversation',
      provider: 'telegram',
      from: 'test_user',
      to: 'test_bot',
    },
  };

  await sessionManager.setEntry('agent:test_agent_001:telegram:test_user', testSession);
  console.log('✅ Test session created\n');

  // 2. 读取 session
  console.log('📖 Reading session...');
  const entry = await sessionManager.getEntry('agent:test_agent_001:telegram:test_user');
  console.log('✅ Session entry:');
  console.log(`   SessionId: ${entry?.sessionId}`);
  console.log(`   DisplayName: ${entry?.displayName}`);
  console.log(`   Channel: ${entry?.channel}`);
  console.log(`   UpdatedAt: ${entry ? new Date(entry.updatedAt).toLocaleString() : 'N/A'}`);
  console.log('');

  // 3. 添加 HiveMind agents
  console.log('🤖 Adding HiveMind agents...');

  await sessionManager.addAgentToSession('agent:test_agent_001:telegram:test_user', 'orchestrator_001', false);
  await sessionManager.addAgentToSession('agent:test_agent_001:telegram:test_user', 'interface_agent_001', true);
  await sessionManager.addAgentToSession('agent:test_agent_001:telegram:test_user', 'memory_agent_001', false);

  console.log('✅ Agents added\n');

  // 4. 设置 Orchestrator ID
  console.log('🧠 Setting Orchestrator ID...');
  await sessionManager.setOrchestratorId('agent:test_agent_001:telegram:test_user', 'orchestrator_001');
  console.log('✅ Orchestrator ID set\n');

  // 5. 再次读取 session，查看 HiveMind 数据
  console.log('📖 Reading updated session...');
  const updatedEntry = await sessionManager.getEntry('agent:test_agent_001:telegram:test_user');
  console.log('✅ Updated session entry:');

  if (updatedEntry) {
    console.log(`   SessionId: ${updatedEntry.sessionId}`);
    console.log('   HiveMind:');
    if (updatedEntry.hiveMind) {
      console.log(`     Mode: ${updatedEntry.hiveMind.mode}`);
      console.log(`     Primary Agent: ${updatedEntry.hiveMind.primaryAgent}`);
      console.log(`     Orchestrator: ${updatedEntry.hiveMind.orchestratorId}`);
      console.log(`     Agents: [${updatedEntry.hiveMind.agents.join(', ')}]`);
      if (updatedEntry.hiveMind.createdAt) {
        console.log(`     Created At: ${new Date(updatedEntry.hiveMind.createdAt).toLocaleString()}`);
      }
    }
  }
  console.log('');

  // 6. 列出所有 sessions
  console.log('📋 Listing all sessions...');
  const allSessions = await sessionManager.listSessions();
  console.log(`✅ Found ${allSessions.length} session(s):`);
  for (const s of allSessions) {
    console.log(`   - ${s.sessionId}`);
    console.log(`     DisplayName: ${s.displayName || 'N/A'}`);
    console.log(`     HiveMind: ${s.hiveMind ? 'Yes' : 'No'}`);
  }
  console.log('');

  // 7. 获取统计信息
  console.log('📊 Session statistics...');
  const stats = await sessionManager.getStats();
  console.log('✅ Stats:');
  console.log(`   Total sessions: ${stats.totalSessions}`);
  console.log(`   Active sessions: ${stats.activeSessions}`);
  console.log(`   HiveMind sessions: ${stats.hiveMindSessions}`);
  console.log('');

  // 8. 写入 transcript
  console.log('📝 Writing transcript...');
  await sessionManager.writeTranscript('test_session_001', {
    timestamp: Date.now(),
    role: 'user',
    content: 'Hello, HiveMind!',
  });
  await sessionManager.writeTranscript('test_session_001', {
    timestamp: Date.now() + 1000,
    role: 'assistant',
    content: 'Hello! I am HiveMind.',
    agentId: 'interface_agent_001',
  });
  console.log('✅ Transcript written\n');

  // 9. 读取 transcript
  console.log('📖 Reading transcript...');
  const transcript = await sessionManager.readTranscript('test_session_001');
  console.log('✅ Transcript:');
  for (const line of transcript) {
    const role = line.agentId ? `${line.role} (${line.agentId})` : line.role;
    const time = new Date(line.timestamp).toLocaleTimeString();
    console.log(`   [${time}] ${role}: ${line.content}`);
  }
  console.log('');

  // 10. 移除 agent
  console.log('🗑️  Removing agent from session...');
  await sessionManager.removeAgentFromSession('agent:test_agent_001:telegram:test_user', 'memory_agent_001');
  console.log('✅ Agent removed\n');

  // 再次读取，验证
  const finalEntry = await sessionManager.getEntry('agent:test_agent_001:telegram:test_user');
  if (finalEntry?.hiveMind) {
    console.log('📖 Final HiveMind agents:', finalEntry.hiveMind.agents.join(', '));
  }
  console.log('');

  // 11. 清理测试数据
  console.log('🧹 Cleaning up test data...');
  const cleaned = await sessionManager.cleanupHiveMindSessions(0);  // 清理所有
  console.log(`✅ Cleaned ${cleaned} session(s)\n`);

  // 12. 验证清理结果
  const statsAfter = await sessionManager.getStats();
  console.log('📊 Statistics after cleanup:');
  console.log(`   Total sessions: ${statsAfter.totalSessions}`);
  console.log(`   HiveMind sessions: ${statsAfter.hiveMindSessions}`);
  console.log('');

  // 13. 清理临时文件
  console.log('🧹 Removing test directory...');
  await fs.rm(testDir, { recursive: true, force: true });
  console.log('✅ Test directory removed\n');
}

main().catch(console.error);
