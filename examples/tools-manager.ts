/**
 * Example: ToolsManager Test
 *
 * 演示 ToolsManager - 工具权限管理和调用统计
 */

import { ToolsManager } from '../src/hive/ToolsManager.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';

async function main() {
  console.log('🔧 ToolsManager Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  // 创建 ToolsManager
  console.log('📦 Creating ToolsManager...');
  const toolsManager = new ToolsManager(hiveConfig);
  console.log('✅ ToolsManager created\n');

  // 显示状态
  console.log('📊 ToolsManager Status:');
  const status = toolsManager.getStatus();
  console.log(`   Tools: ${status.toolsCount}`);
  console.log(`   Groups: ${status.groupsCount}`);
  console.log(`   Agents: ${status.agentsCount}`);
  console.log(`   Total Calls: ${status.totalCalls}`);
  console.log('');

  // 显示所有工具
  console.log('🔨 Available Tools:');
  const allTools = toolsManager.getAllTools();
  for (const tool of allTools) {
    const actionsStr = tool.actions.join(', ');
    console.log(`   - ${tool.id.padEnd(15)} (${tool.group}): ${actionsStr}`);
  }
  console.log('');

  // 显示 agent 权限
  const agents = ['orchestrator_001', 'interface_agent_001', 'memory_agent_001', 'default_functional'];
  for (const agentId of agents) {
    console.log(`🤖 ${agentId} Permissions:`);

    const allowedTools = toolsManager.getAllowedTools(agentId);
    console.log(`   Allowed (${allowedTools.length}):`);
    for (const tool of allowedTools) {
      console.log(`     - ${tool.id} (${tool.group})`);
    }

    const deniedTools = toolsManager.getAgentPermissions(agentId).denied;
    if (deniedTools.length > 0) {
      console.log(`   Denied (${deniedTools.length}):`);
      for (const toolId of deniedTools) {
        console.log(`     - ${toolId}`);
      }
    }
    console.log('');
  }

  // 检查权限
  console.log('🔍 Permission Checks:\n');

  const checkCases = [
    { agent: 'interface_agent_001', tool: 'message' },
    { agent: 'interface_agent_001', tool: 'exec' },
    { agent: 'memory_agent_001', tool: 'read' },
    { agent: 'memory_agent_001', tool: 'message' },
    { agent: 'orchestrator_001', tool: 'session_status' },
    { agent: 'orchestrator_001', tool: 'exec' },
  ];

  for (const { agent, tool } of checkCases) {
    const hasPerm = toolsManager.hasPermission(agent, tool);
    const status = hasPerm ? '✅' : '❌';
    console.log(`   ${status} ${agent}: ${tool}`);
  }
  console.log('');

  // 模拟工具调用
  console.log('📞 Simulating Tool Calls:\n');

  const calls = [
    {
      agent: 'interface_agent_001',
      tool: 'memory_search',
      success: true,
      duration: 50,
    },
    {
      agent: 'memory_agent_001',
      tool: 'read',
      success: true,
      duration: 20,
    },
    {
      agent: 'memory_agent_001',
      tool: 'write',
      success: true,
      duration: 30,
    },
    {
      agent: 'interface_agent_001',
      tool: 'message',
      success: true,
      duration: 100,
    },
    {
      agent: 'default_functional',
      tool: 'web_search',
      success: true,
      duration: 500,
    },
    {
      agent: 'default_functional',
      tool: 'web_search',
      success: false,
      duration: 1000,
    },
  ];

  for (const call of calls) {
    if (toolsManager.hasPermission(call.agent, call.tool)) {
      toolsManager.recordCall({
        toolId: call.tool,
        agentId: call.agent,
        timestamp: Date.now(),
        duration: call.duration,
        success: call.success,
      });

      const status = call.success ? '✅' : '❌';
      console.log(`   ${status} ${call.agent}: ${call.tool} (${call.duration}ms)`);
    } else {
      console.log(`   ❌ ${call.agent}: ${call.tool} (denied)`);
    }
  }
  console.log('');

  // 显示工具统计
  console.log('📊 Tool Statistics:\n');

  const toolsWithCalls = ['read', 'write', 'memory_search', 'message', 'web_search'];
  for (const toolId of toolsWithCalls) {
    const stats = toolsManager.getToolStatistics(toolId);
    if (stats && stats.totalCalls > 0) {
      const successRate = (stats.successfulCalls / stats.totalCalls * 100).toFixed(1);
      console.log(`   ${toolId}:`);
      console.log(`     Total: ${stats.totalCalls}`);
      console.log(`     Success: ${stats.successfulCalls} (${successRate}%)`);
      console.log(`     Failed: ${stats.failedCalls}`);
      console.log(`     Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
      console.log(`     Last Called: ${new Date(stats.lastCalled).toLocaleTimeString()}`);
      console.log('');
    }
  }

  // 显示 Agent 历史记录
  console.log('📜 Agent History:\n');

  const interfaceHistory = toolsManager.getAgentHistory('interface_agent_001', 10);
  console.log(`   interface_agent_001 (${interfaceHistory.length} calls):`);
  for (const record of interfaceHistory) {
    const status = record.success ? '✅' : '❌';
    const time = new Date(record.timestamp).toLocaleTimeString();
    console.log(`     ${status} [${time}] ${record.toolId} (${record.duration}ms)`);
  }
  console.log('');

  // 最终状态
  console.log('📊 Final Status:');
  const finalStatus = toolsManager.getStatus();
  console.log(`   Tools: ${finalStatus.toolsCount}`);
  console.log(`   Groups: ${finalStatus.groupsCount}`);
  console.log(`   Agents: ${finalStatus.agentsCount}`);
  console.log(`   Total Calls: ${finalStatus.totalCalls}`);
  console.log('');
}

main().catch(console.error);
