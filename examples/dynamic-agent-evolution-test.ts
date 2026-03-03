/**
 * Dynamic Agent Evolution Test
 *
 * 演示 Agent 演化、性能监控、角色适应和演化建议
 */

import { DynamicAgentEvolution } from '../src/hive/DynamicAgentEvolution.js';
import { DEFAULT_HIVE_CONFIG } from '../src/hive/HiveConfig.js';
import { getGlobalEventBus } from '../src/events/EventBus.js';

async function main() {
  console.log('🧬 Dynamic Agent Evolution Test\n');

  const eventBus = getGlobalEventBus();

  // 创建 Dynamic Agent Evolution
  console.log('1️⃣  Creating Dynamic Agent Evolution...\n');

  const evolution = new DynamicAgentEvolution({
    hiveConfig: DEFAULT_HIVE_CONFIG,
    monitoringInterval: 5000,  // 5 秒（测试用）
    evaluationWindow: 30000,
    performanceThreshold: 70,
    skillProficiencyThreshold: 0.75,
  });

  console.log('✅ Dynamic Agent Evolution created\n');

  // 启动演化引擎
  console.log('2️⃣  Starting evolution engine...\n');

  await evolution.start();

  console.log('✅ Evolution engine started\n');

  // ========== Test 1: Track Agent Performance ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Agent Performance Tracking');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📊 Simulating agent started events...\n');

  // 模拟 Agents 启动
  await eventBus.publish({
    type: 'AGENT_STARTED',
    sourceAgent: 'system',
    payload: {
      agentId: 'agent_writer_001',
      role: 'content_writer',
    },
  });

  await eventBus.publish({
    type: 'AGENT_STARTED',
    sourceAgent: 'system',
    payload: {
      agentId: 'agent_search_001',
      role: 'search_agent',
    },
  });

  await eventBus.publish({
    type: 'AGENT_STARTED',
    sourceAgent: 'system',
    payload: {
      agentId: 'agent_general_001',
      role: 'general_assistant',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  // 查看初始性能
  const writerPerf = evolution.getAgentPerformance('agent_writer_001');
  const searchPerf = evolution.getAgentPerformance('agent_search_001');
  const generalPerf = evolution.getAgentPerformance('agent_general_001');

  console.log('📊 Initial Performance:');
  console.log(`   Writer: Score ${writerPerf?.score || 'N/A'}, Skills: ${writerPerf?.skills.size || 0}`);
  console.log(`   Search: Score ${searchPerf?.score || 'N/A'}, Skills: ${searchPerf?.skills.size || 0}`);
  console.log(`   General: Score ${generalPerf?.score || 'N/A'}, Skills: ${generalPerf?.skills.size || 0}`);
  console.log('');

  // ========== Test 2: Learning from Tasks ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Learning from Task Execution');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📚 Simulating task completions...\n');

  // 模拟内容写作任务
  for (let i = 1; i <= 10; i++) {
    await eventBus.publish({
      type: 'TASK_COMPLETED',
      sourceAgent: 'agent_writer_001',
      payload: {
        agentId: 'agent_writer_001',
        skillId: 'content_writing',
        responseTime: 800 + Math.random() * 400,
      },
    });
  }

  // 模拟搜索任务
  for (let i = 1; i <= 8; i++) {
    await eventBus.publish({
      type: 'TASK_COMPLETED',
      sourceAgent: 'agent_search_001',
      payload: {
        agentId: 'agent_search_001',
        skillId: 'search',
        responseTime: 300 + Math.random() * 200,
      },
    });
  }

  // 模拟通用任务（有些成功，有些失败）
  for (let i = 1; i <= 12; i++) {
    const isSuccess = i <= 8;  // 8 成功，4 失败

    if (isSuccess) {
      await eventBus.publish({
        type: 'TASK_COMPLETED',
        sourceAgent: 'agent_general_001',
        payload: {
          agentId: 'agent_general_001',
          skillId: i % 2 === 0 ? 'dialogue' : 'analysis',
          responseTime: 1000 + Math.random() * 500,
        },
      });
    } else {
      await eventBus.publish({
        type: 'TASK_FAILED',
        sourceAgent: 'agent_general_001',
        payload: {
          agentId: 'agent_general_001',
          skillId: 'analysis',
        },
      });
    }
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('✅ Tasks completed');
  console.log('');

  // 查看学习后的性能
  const updatedWriter = evolution.getAgentPerformance('agent_writer_001');
  const updatedSearch = evolution.getAgentPerformance('agent_search_001');
  const updatedGeneral = evolution.getAgentPerformance('agent_general_001');

  console.log('📊 Updated Performance:');
  console.log(`   Writer: ${updatedWriter?.tasksCompleted || 0} tasks, Score ${updatedWriter?.score.toFixed(1) || 'N/A'}`);
  console.log(`   Search: ${updatedSearch?.tasksCompleted || 0} tasks, Score ${updatedSearch?.score.toFixed(1) || 'N/A'}`);
  console.log(`   General: ${updatedGeneral?.tasksCompleted || 0} completed, ${updatedGeneral?.tasksFailed || 0} failed, Score ${updatedGeneral?.score.toFixed(1) || 'N/A'}`);
  console.log('');

  // ========== Test 3: Evolution Suggestions ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Evolution Suggestions');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📊 Checking for evolution suggestions...\n');

  const suggestions = evolution.getEvolutionSuggestions();

  console.log(`📊 Suggestions (${suggestions.length}):`);
  for (const s of suggestions) {
    console.log(`   - ${s.suggestion}`);
    console.log(`     Reason: ${s.reason}`);
    console.log(`     Priority: ${s.priority} | Impact: ${Math.round(s.estimatedImpact)}% | Confidence: ${(s.confidence * 100).toFixed(1)}%`);
  }
  console.log('');

  // ========== Test 4: Role Adaptation ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Role Adaptation');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🔄 Applying role adaptation...\n');

  // 为表现不佳的通用 Agent 应用角色适应（假设）
  if (suggestions.length > 0) {
    const suggestion = suggestions[0];

    try {
      await evolution.applyRoleAdaptation(
        suggestion.agentId,
        'content_writer',  // 转为 Content Writer
        `High proficiency in content writing can maximize efficiency`,
      );

      console.log(`✅ Role adaptation applied for ${suggestion.agentId}`);
    } catch (error) {
      console.log(`⚠️  Role adaptation failed: ${error}`);
    }
  } else {
    // 手动应用一个
    await evolution.applyRoleAdaptation(
      'agent_general_001',
      'content_writer',
      'Adapting to specialized role for better efficiency',
    );
  }

  console.log('');

  // 查看适应历史
  const adaptations = evolution.getRoleAdaptations();
  console.log('📜 Role Adaptation History:');
  for (const a of adaptations) {
    const time = new Date(a.timestamp).toLocaleTimeString();
    console.log(`   [${time}] ${a.agentId}: ${a.fromRole} → ${a.toRole}`);
    console.log(`     Reason: ${a.reason}`);
  }
  console.log('');

  // ========== Test 5: Performance Evaluation ==========
  console.log('─'.repeat(60));
  console.log('Test 5: Performance Evaluation');
  console.log('─'.repeat(60));
  console.log('');

  console.log('⏳ Waiting for automatic evaluation cycle...\n');

  // 等待一个评估周期（6 秒）
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 查看最新建议
  const newSuggestions = evolution.getEvolutionSuggestions();

  console.log('📊 New Evolution Suggestions:');
  for (const s of newSuggestions.slice(0, 3)) {
    console.log(`   - ${s.suggestion}`);
    console.log(`     Priority: ${s.priority} | Estimated Impact: ${Math.round(s.estimatedImpact)}%`);
  }
  console.log('');

  // 查看所有 Agent 性能
  const allPerf = evolution.getAllAgentPerformance();

  console.log('📊 All Agent Performance:');
  for (const perf of allPerf) {
    console.log(`   ${perf.agentId}:`);
    console.log(`     Score: ${perf.score.toFixed(1)}`);
    console.log(`     Tasks: ${perf.tasksCompleted} completed, ${perf.tasksFailed} failed`);
    console.log(`     Success Rate: ${(perf.successRate * 100).toFixed(1)}%`);
    console.log(`     Avg Response: ${Math.round(perf.avgTaskTime)}ms`);

    const skills = Array.from(perf.skills.values()).sort((a, b) => b.proficiency - a.proficiency);
    console.log(`     Top Skills:`);
    for (const skill of skills.slice(0, 2)) {
      console.log(`       - ${skill.name}: ${(skill.proficiency * 100).toFixed(1)}% (${skill.usageCount} uses, ${skill.trend})`);
    }
  }
  console.log('');

  // ========== Test 6: Skill Development ==========
  console.log('─'.repeat(60));
  console.log('Test 6: Skill Development Tracking');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📊 Checking weak skills for development...\n');

  for (const perf of allPerf) {
    const weakSkills = Array.from(perf.skills.values()).filter(s => s.proficiency < 0.75);

    if (weakSkills.length > 0) {
      console.log(`   ${perf.agentId}s weak skills:`);
      for (const skill of weakSkills) {
        console.log(`     - ${skill.name}: ${(skill.proficiency * 100).toFixed(1)}% (${skill.usageCount} uses)`);
        console.log(`       Trend: ${skill.trend} | Success: ${(skill.successRate * 100).toFixed(1)}`);
      }
    }
  }
  console.log('');

  // ========== Final Statistics ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  console.log(`📊 Evolution Engine Statistics:`);
  console.log(`   Tracked Agents: ${allPerf.length}`);
  console.log(`   Total Adaptations: ${adaptations.length}`);
  console.log(`   Current Suggestions: ${newSuggestions.length}`);
  console.log(`   Evaluation Interval: 5s`);
  console.log('');

  // 停止演化引擎
  console.log('🔧 Stopping evolution engine...\n');

  await evolution.stop();

  console.log('✅ Evolution engine stopped');
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Dynamic Agent Evolution Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
