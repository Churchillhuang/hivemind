/**
 * Example: Agent Model Configuration
 *
 * 演示不同 Agent 使用不同的模型配置
 */

import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import {
  getAgentModelConfig,
  estimateCost,
  estimateLatency,
  compareModelCost,
  generateModelReport,
  type ModelUsage,
} from '../src/utils/ModelConfig.js';

 async function main() {
  console.log('🤖 Agent Model Configuration Test\n');

  // 1. 显示完整报告
  console.log(generateModelReport(DEFAULT_HIVE_CONFIG));
  console.log('---\n');

  // 2. 获取各个 Agent 的模型配置
  console.log('🔍 Agent Model Configurations:\n');

  const agentTypes = ['orchestrator', 'interface', 'memory', 'reflection', 'functional'];
  for (const agentType of agentTypes) {
    const config = getAgentModelConfig(agentType as any, undefined, DEFAULT_HIVE_CONFIG);
    console.log(`  Agent: ${agentType.padEnd(15)}`);
    console.log(`    Model: ${config.modelName}`);
    console.log(`    Tier: ${config.tier}`);
    console.log(`    Temperature: ${config.temperature}`);
    console.log(`    Max Tokens: ${config.maxTokens}`);
    console.log(`    Timeout: ${config.timeout}s`);
    console.log(`    Cost/1K: $${(config.estimatedCostPer1K * 0.00001).toFixed(6)}`);
    console.log(`    Latency/1K: ${config.estimatedLatency}ms`);
    console.log('');
  }

  // 3. 比较不同 Agent 的成本
  console.log('💰 Cost Comparison (per 1K input + 1K output tokens):\n');

  const orchConfig = getAgentModelConfig('orchestrator', undefined, DEFAULT_HIVE_CONFIG);
  const ifaceConfig = getAgentModelConfig('interface', undefined, DEFAULT_HIVE_CONFIG);
  const reflConfig = getAgentModelConfig('reflection', undefined, DEFAULT_HIVE_CONFIG);

  console.log(`  Orchestrator: $${(estimateCost(orchConfig, 1000, 1000) * 0.00001).toFixed(6)}`);
  console.log(`  Interface:   $${(estimateCost(ifaceConfig, 1000, 1000) * 0.00001).toFixed(6)}`);
  console.log(`  Reflection:  $${(estimateCost(reflConfig, 1000, 1000) * 0.00001).toFixed(6)}`);
  console.log('');

  const savings = compareModelCost(orchConfig, ifaceConfig);
  console.log(`  💡 Orchestrator is ${savings.savings.toFixed(1)}% cheaper than Interface\n`);

  // 4. 比较延迟
  console.log('⏱️  Latency Comparison (10K tokens):\n');

  console.log(`  Orchestrator (light):  ${estimateLatency(orchConfig, 10000)}ms`);
  console.log(`  Interface (standard):  ${estimateLatency(ifaceConfig, 10000)}ms`);
  console.log(`  Reflection (standard): ${estimateLatency(reflConfig, 10000)}ms`);
  console.log('');
  console.log(`  💡 Orchestrator is ${((1 - (estimateLatency(orchConfig, 10000) / estimateLatency(ifaceConfig, 10000))) * 100).toFixed(0)}% faster than Interface\n`);

  // 5. 展示覆盖配置
  console.log('🔧 Functional Agent Override Examples:\n');

  const functionalDefault = getAgentModelConfig('functional', undefined, DEFAULT_HIVE_CONFIG);
  const philosophyModel = getAgentModelConfig('functional', 'philosophy_generation', DEFAULT_HIVE_CONFIG);
  const analysisModel = getAgentModelConfig('functional', 'complex_analysis', DEFAULT_HIVE_CONFIG);

  console.log(`  Default (light):` );
  console.log(`    Model: ${functionalDefault.modelName}`);
  console.log(`    Cost/1K: $${(functionalDefault.estimatedCostPer1K * 0.00001).toFixed(6)}`);
  console.log('');

  console.log(`  Philosophy Generation (standard):`);
  console.log(`    Model: ${philosophyModel.modelName}`);
  console.log(`    Cost/1K: $${(philosophyModel.estimatedCostPer1K * 0.00001).toFixed(6)}`);
  console.log('');

  console.log(`  Complex Analysis (standard):`);
  console.log(`    Model: ${analysisModel.modelName}`);
  console.log(`    Cost/1K: $${(analysisModel.estimatedCostPer1K * 0.00001).toFixed(6)}`);
  console.log('');
}

main().catch(console.error);
