/**
 * ModelConfig - Agent 模型配置工具
 *
 * 统一管理不同 Agent 的模型配置
 */

import type { HiveConfig, AgentModelConfig, ModelTier } from '../hive/HiveConfig.js';

export interface ModelUsage {
  tier: ModelTier;
  modelName: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  estimatedCostPer1K: number;  // 美分 per 1K tokens
  estimatedLatency: number;    // 毫秒 per 1K tokens
}

/**
 * 估算模型成本（每 1K tokens）
 */
const MODEL_COSTS: Record<ModelTier, number> = {
  nano: 0.01,      // $0.00001 per 1K
  light: 0.05,     // $0.00005 per 1K
  standard: 0.20,  // $0.00020 per 1K
  heavy: 0.80,     // $0.00080 per 1K
};

/**
 * 估算模型延迟（每 1K tokens）
 */
const MODEL_LATENCY: Record<ModelTier, number> = {
  nano: 10,        // 10ms per 1K
  light: 50,       // 50ms per 1K
  standard: 150,   // 150ms per 1K
  heavy: 400,      // 400ms per 1K
};

/**
 * 获取 Agent 的模型配置
 */
export function getAgentModelConfig(
  agentType: 'orchestrator' | 'interface' | 'memory' | 'reflection' | 'functional',
  agentRole?: string,  // 用于 functional agents 的覆盖配置
  hiveConfig?: HiveConfig,
): ModelUsage {
  const config = hiveConfig?.agentModels;

  if (!config) {
    // 如果没有配置，返回默认值
    return getDefaultModelConfig(agentType);
  }

  let modelConfig: AgentModelConfig;

  if (agentType === 'functional' && agentRole && config.functional.overrides[agentRole]) {
    // 使用覆盖配置
    modelConfig = config.functional.overrides[agentRole];
  } else if (config.system[agentType]) {
    // System agent 配置
    modelConfig = config.system[agentType];
  } else {
    // 默认配置
    modelConfig = config.functional.default;
  }

  // 获取实际模型名称
  const modelName = modelConfig.model || config.tierMapping[modelConfig.tier] || modelConfig.tier;

  return {
    tier: modelConfig.tier,
    modelName,
    temperature: modelConfig.temperature ?? 0.5,
    maxTokens: modelConfig.maxTokens ?? 1000,
    timeout: modelConfig.timeout ?? 30,
    estimatedCostPer1K: MODEL_COSTS[modelConfig.tier],
    estimatedLatency: MODEL_LATENCY[modelConfig.tier],
  };
}

/**
 * 获取默认模型配置（fallback）
 */
function getDefaultModelConfig(agentType: string): ModelUsage {
  const defaults: Record<string, ModelUsage> = {
    orchestrator: {
      tier: 'light',
      modelName: 'llama-7b',
      temperature: 0.1,
      maxTokens: 500,
      timeout: 30,
      estimatedCostPer1K: MODEL_COSTS.light,
      estimatedLatency: MODEL_LATENCY.light,
    },
    interface: {
      tier: 'standard',
      modelName: 'llama-13b',
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60,
      estimatedCostPer1K: MODEL_COSTS.standard,
      estimatedLatency: MODEL_LATENCY.standard,
    },
    memory: {
      tier: 'nano',
      modelName: 'distilbert-base',
      temperature: 0.0,
      maxTokens: 100,
      timeout: 10,
      estimatedCostPer1K: MODEL_COSTS.nano,
      estimatedLatency: MODEL_LATENCY.nano,
    },
    reflection: {
      tier: 'standard',
      modelName: 'llama-13b',
      temperature: 0.3,
      maxTokens: 1500,
      timeout: 60,
      estimatedCostPer1K: MODEL_COSTS.standard,
      estimatedLatency: MODEL_LATENCY.standard,
    },
    functional: {
      tier: 'light',
      modelName: 'llama-7b',
      temperature: 0.5,
      maxTokens: 1000,
      timeout: 30,
      estimatedCostPer1K: MODEL_COSTS.light,
      estimatedLatency: MODEL_LATENCY.light,
    },
  };

  return defaults[agentType] || defaults.functional;
}

/**
 * 估算调用成本
 */
export function estimateCost(modelUsage: ModelUsage, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * modelUsage.estimatedCostPer1K * 0.5;  // 输入成本通常 50%
  const outputCost = (outputTokens / 1000) * modelUsage.estimatedCostPer1K;

  return inputCost + outputCost;
}

/**
 * 估算延迟
 */
export function estimateLatency(modelUsage: ModelUsage, totalTokens: number): number {
  return (totalTokens / 1000) * modelUsage.estimatedLatency;
}

/**
 * 比较两个模型配置的成本
 */
export function compareModelCost(config1: ModelUsage, config2: ModelUsage): {
  ratio: number;  // config2 cost / config1 cost
  savings: number;  // % savings when using config1 instead of config2
} {
  const cost1 = config1.estimatedCostPer1K;
  const cost2 = config2.estimatedCostPer1K;

  const ratio = cost2 / cost1;
  const savings = (1 - (cost1 / cost2)) * 100;

  return { ratio, savings };
}

/**
 * 生成模型配置报告
 */
export function generateModelReport(config?: HiveConfig): string {
  if (!config) {
    return 'Model config not available';
  }

  const lines: string[] = [];
  lines.push('🤖 HiveMind Model Configuration Report');
  lines.push('');

  const models = config.agentModels;

  // 模型映射
  lines.push('📋 Model Tier Mapping:');
  for (const [tier, model] of Object.entries(models.tierMapping)) {
    if (model) {
      const cost = MODEL_COSTS[tier as ModelTier];
      const latency = MODEL_LATENCY[tier as ModelTier];
      lines.push(`  - ${tier.padEnd(10)} → ${model.padEnd(20)} | Cost: $${(cost * 0.00001).toFixed(4)}/1K | Latency: ${latency}ms/1K`);
    }
  }
  lines.push('');

  // System Agents 配置
  lines.push('🧠 System Agents:');
  for (const [agent, modelConfig] of Object.entries(models.system)) {
    const modelUsage = getAgentModelConfig(agent as any, undefined, config);
    lines.push(`  - ${agent.padEnd(12)} → tier=${modelUsage.tier}, temp=${modelUsage.temperature}, max=${modelUsage.maxTokens}`);
  }
  lines.push('');

  // Functional 默认配置
  lines.push('⚙️  Functional Agents (default):');
  const defaultModel = getAgentModelConfig('functional', undefined, config);
  lines.push(`  - tier=${defaultModel.tier}, temp=${defaultModel.temperature}, max=${defaultModel.maxTokens}`);
  lines.push('');

  // 覆盖配置
  if (Object.keys(models.functional.overrides).length > 0) {
    lines.push('🔧 Functional Agents (overrides):');
    for (const [role, modelConfig] of Object.entries(models.functional.overrides)) {
      const modelUsage = getAgentModelConfig('functional', role, config);
      lines.push(`  - ${role.padEnd(25)} → tier=${modelUsage.tier}, temp=${modelUsage.temperature}, max=${modelUsage.maxTokens}`);
    }
    lines.push('');
  }

  // 成本比较
  lines.push('💰 Cost Comparison:');
  const lightConfig = getAgentModelConfig('interface', undefined, config);
  const standardConfig = getAgentModelConfig('interface', undefined, config);
  const comparison = compareModelCost(lightConfig, standardConfig);
  lines.push(`  - Using light instead of standard: ${comparison.savings.toFixed(1)}% cheaper`);

  return lines.join('\n');
}

/**
 * 导出类型和函数
 */
export type { AgentModelConfig, ModelTier };
