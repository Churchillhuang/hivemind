/**
 * Example: LLM Runtime Test
 *
 * 演示 LLMRuntime - 统一 LLM 调用接口
 */

import { LLMRuntime } from '../src/hive/LLMRuntime.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import {
  getAgentModelConfig,
  type ModelUsage,
} from '../src/utils/ModelConfig.js';

async function main() {
  console.log('🤖 LLM Runtime Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  // 创建 LLMRuntime
  console.log('📦 Creating LLMRuntime...');
  const llmRuntime = new LLMRuntime(hiveConfig);
  console.log('✅ LLMRuntime created\n');

  // 1. 测试不同 agents 的 model 配置
  console.log('🔍 Agent Model Configurations:\n');

  const agents = ['orchestrator', 'interface', 'memory', 'reflection', 'functional'];
  const agentsToTest: Record<string, ModelUsage> = {};

  for (const agent of agents) {
    const config = getAgentModelConfig(agent as any, undefined, hiveConfig);
    agentsToTest[agent] = config;

    console.log(`  ${agent}:`);
    console.log(`    Model: ${config.modelName}`);
    console.log(`    Tier: ${config.tier}`);
    console.log(`    Temperature: ${config.temperature}`);
    console.log(`    Max Tokens: ${config.maxTokens}`);
    console.log(`    Cost/1K: $${(config.estimatedCostPer1K * 0.00001).toFixed(6)}`);
    console.log('');
  }

  // 2. 测试 LLM 调用
  console.log('📞 Testing LLM Calls:\n');

  const calls = [
    {
      agent: 'interface',
      modelUsage: agentsToTest['interface'],
      messages: [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user' as const,
          content: 'Hello, how are you?',
        },
      ],
    },
    {
      agent: 'functional',
      modelUsage: agentsToTest['functional'],
      messages: [
        {
          role: 'user' as const,
          content: 'What is the capital of France?',
        },
      ],
    },
    {
      agent: 'orchestrator',
      modelUsage: agentsToTest['orchestrator'],
      messages: [
        {
          role: 'user' as const,
          content: 'What agent should handle this?',
        },
      ],
    },
  ];

  for (const call of calls) {
    console.log(`📤 [${call.agent}]: Calling LLM...`);

    const response = await llmRuntime.call(
      {
        messages: call.messages,
      },
      {
        agentId: `${call.agent}_agent_001`,
        modelUsage: call.modelUsage,
        enableCostTracking: true,
        enableTokenCounting: true,
      },
    );

    console.log(`📥 [${call.agent}]: Response received:`);
    console.log(`   Content: ${response.content.substring(0, 100)}...`);
    console.log(`   Tokens: ${response.usage.totalTokens} (${response.usage.promptTokens} + ${response.usage.completionTokens})`);
    console.log(`   Cost: $${(response.cost || 0).toFixed(6)}`);
    console.log(`   Latency: ${response.latency}ms`);
    console.log(`   Finish Reason: ${response.finishReason}`);
    console.log('');
  }

  // 3. 显示统计信息
  console.log('📊 LLM Runtime Statistics:\n');

  const stats = llmRuntime.getStatistics();
  console.log(`  Total Calls: ${stats.callsCount}`);
  console.log(`  Total Tokens: ${stats.totalTokens}`);
  console.log(`  Total Cost: $${stats.totalCost.toFixed(6)}`);
  console.log(`  Avg Tokens/Call: ${stats.avgTokensPerCall.toFixed(2)}`);
  console.log('');

  // 4. 成本比较
  console.log('💰 Cost Comparison:\n');

  const interfaceConfig = agentsToTest['interface'];
  const functionalConfig = agentsToTest['functional'];
  const orchestratorConfig = agentsToTest['orchestrator'];

  const interfaceCost = interfaceConfig.estimatedCostPer1K * 0.00001;
  const functionalCost = functionalConfig.estimatedCostPer1K * 0.00001;
  const orchestratorCost = orchestratorConfig.estimatedCostPer1K * 0.00001;

  console.log(`  Orchestrator vs Interface: $${orchestratorCost.toFixed(6)}/1K vs $${interfaceCost.toFixed(6)}/1K`);
  console.log(`    Savings: ${((1 - (orchestratorCost / interfaceCost)) * 100).toFixed(1)}%`);
  console.log('');

  console.log(`  Orchestrator vs Functional: $${orchestratorCost.toFixed(6)}/1K vs $${functionalCost.toFixed(6)}/1K`);
  console.log(`    Savings: ${((1 - (orchestratorCost / functionalCost)) * 100).toFixed(1)}%`);
  console.log('');
}

main().catch(console.error);
