/**
 * Autonomous Tuner
 *
 * 自主调优：参数调优、策略调整、架构演化、模型选择优化
 */

import { MetricsTracker } from './MetricsTracker.js';
import { AnalysisEngine, type ImprovementSuggestion } from './AnalysisEngine.js';
import { getGlobalEventBus } from '../events/EventBus.js';

/**
 * 调优参数
 */
export interface TuningParameter {
  name: string;
  value: number;
  minValue: number;
  maxValue: number;
  description: string;
}

/**
 * 调优结果
 */
export interface TuningResult {
  parameterName: string;
  oldValue: number;
  newValue: number;
  reason: string;
  timestamp: number;
  expectedImpact: number;
}

/**
 * 策略配置
 */
export interface StrategyConfig {
  routingStrategy: 'round-robin' | 'least-loaded' | 'random' | 'specialized';
  loadBalancingEnabled: boolean;
  autoScalingEnabled: boolean;
  costOptimizationLevel: number;  // 0-1
  performance prioritizationLevel: number;  // 0-1
}

/**
 * 模型选择策略
 */
export interface ModelSelectionStrategy {
  agentId: string;
  recommendedModel: string;
  reason: string;
  cost: number;
  expectedLatency: number;
}

/**
 * A/B 测试结果
 */
export interface ABTestResult {
  testName: string;
  variantA: { value: number; performance: number };
  variantB: { value: number; performance: number };
  winner: 'A' | 'B' | 'tie';
  confidence: number;
  timestamp: number;
}

/**
 * 自主调优器
 */
export class AutonomousTuner {
  private metricsTracker: MetricsTracker;
  private analysisEngine: AnalysisEngine;

  // 调优参数
  private parameters: Map<string, TuningParameter> = new Map();

  // 调优历史
  private tuningHistory: TuningResult[] = [];

  // 策略配置
  private strategyConfig: StrategyConfig;

  // 模型选择策略
  private modelSelectionStrategies: Map<string, ModelSelectionStrategy> = new Map();

  // A/B 测试结果
  private abTestResults: ABTestResult[] = [];

  // 事件总线
  private eventBus = getGlobalEventBus();

  // 统计
  private stats = {
    totalTunings: 0,
    totalApplies: 0,
    totalRollbacks: 0,
    totalModelSelections: 0,
  };

  constructor(metricsTracker: MetricsTracker, analysisEngine: AnalysisEngine) {
    this.metricsTracker = metricsTracker;
    this.analysisEngine = analysisEngine;

    this.strategyConfig = {
      routingStrategy: 'round-robin',
      loadBalancingEnabled: true,
      autoScalingEnabled: false,
      costOptimizationLevel: 0.5,
      performancePrioritizationLevel: 0.5,
    };

    // 初始化调优参数
    this.initializeParameters();
  }

  /**
   * 初始化调优参数
   */
  private initializeParameters(): void {
    const parameters: TuningParameter[] = [
      { name: 'timeout_ms', value: 5000, minValue: 1000, maxValue: 30000, description: 'Agent task timeout' },
      { name: 'max_retries', value: 3, minValue: 0, maxValue: 10, description: 'Max retry attempts' },
      { name: 'queue_size', value: 100, minValue: 10, maxValue: 1000, description: 'Task queue size' },
      { name: 'worker_threads', value: 4, minValue: 1, maxValue: 16, description: 'Worker thread count' },
      { name: 'memory_limit_mb', value: 512, minValue: 128, maxValue: 4096, description: 'Memory limit in MB' },
    ];

    for (const param of parameters) {
      this.parameters.set(param.name, param);
    }
  }

  /**
   * 运行自主调优
   */
  async tune(): Promise<{
    tuningResults: TuningResult[];
    strategyChanges: StrategyConfig;
    modelSelections: ModelSelectionStrategy[];
  }> {
    const tuningResults: TuningResult[] = [];
    const modelSelections: ModelSelectionStrategy[] = [];

    // 分析建议
    const analysis = await this.analysisEngine.analyze();

    // 处理高优先级建议
    const highPrioritySuggestions = analysis.suggestions.filter(s => s.priority === 'high' || s.priority === 'critical');

    for (const suggestion of highPrioritySuggestions) {
      if (suggestion.type === 'performance') {
        // 调优参数
        const tuningResult = this.tuneParameters(suggestion);
        if (tuningResult) {
          tuningResults.push(tuningResult);
        }
      } else if (suggestion.type === 'cost') {
        // 优化模型选择
        const modelSelection = this.optimizeModelSelection(suggestion);
        if (modelSelection) {
          modelSelections.push(modelSelection);
        }
      } else if (suggestion.type === 'reliability') {
        // 调优可靠性参数
        const tuningResult = this.tuneReliabilityParameters(suggestion);
        if (tuningResult) {
          tuningResults.push(tuningResult);
        }
      }
    }

    // 自动调优策略
    this.autoTuneStrategy();

    this.stats.totalTunings += tuningResults.length;
    this.stats.totalApplies += tuningResults.length;
    this.stats.totalModelSelections += modelSelections.length;

    return {
      tuningResults,
      strategyChanges: { ...this.strategyConfig },
      modelSelections,
    };
  }

  /**
   * 调优参数
   */
  private tuneParameters(suggestion: ImprovementSuggestion): TuningResult | null {
    let paramToTune: string | null = null;
    let newValue: number | null = null;

    // 根据建议类型选择参数
    if (suggestion.description.includes('latency')) {
      paramToTune = 'timeout_ms';
      const param = this.parameters.get(paramToTune)!;
      const currentLatency = this.metricsTracker.getPerformanceMetrics(suggestion.targetId) as PerformanceMetrics;
      if (currentLatency && currentLatency.p99Latency > param.value) {
        newValue = Math.min(currentLatency.p99Latency * 1.5, param.maxValue);
      }
    } else if (suggestion.description.includes('throughput')) {
      paramToTune = 'worker_threads';
      const param = this.parameters.get(paramToTune)!;
      if (param.value < param.maxValue) {
        newValue = Math.min(param.value * 2, param.maxValue);
      }
    }

    if (paramToTune && newValue !== null) {
      const param = this.parameters.get(paramToTune)!;
      const oldValue = param.value;
      param.value = newValue;

      const result: TuningResult = {
        parameterName: paramToTune,
        oldValue,
        newValue,
        reason: suggestion.description,
        timestamp: Date.now(),
        expectedImpact: suggestion.expectedImpact,
      };

      this.tuningHistory.push(result);

      console.log(`[Tuner] Tuned ${paramToTune}: ${oldValue} → ${newValue} (${result.reason})`);

      this.eventBus.publish({
        type: 'parameter_tuned',
        agentId: 'autonomous_tuner',
        payload: {
          parameterName: paramToTune,
          oldValue,
          newValue,
          reason: result.reason,
        },
      }).catch(err => console.warn(`[Tuner] Failed to publish parameter_tuned event: ${err}`));

      return result;
    }

    return null;
  }

  /**
   * 调优可靠性参数
   */
  private tuneReliabilityParameters(suggestion: ImprovementSuggestion): TuningResult | null {
    let paramToTune = 'max_retries';
    let newValue: number | null = null;

    const param = this.parameters.get(paramToTune)!;
    const metrics = this.metricsTracker.getPerformanceMetrics(suggestion.targetId) as PerformanceMetrics;

    if (metrics && metrics.successRate < 0.9 && param.value < param.maxValue) {
      newValue = Math.min(param.value + 1, param.maxValue);
    }

    if (newValue !== null) {
      const oldValue = param.value;
      param.value = newValue;

      const result: TuningResult = {
        parameterName: paramToTune,
        oldValue,
        newValue,
        reason: suggestion.description,
        timestamp: Date.now(),
        expectedImpact: 1 - metrics.successRate,
      };

      this.tuningHistory.push(result);

      console.log(`[Tuner] Tuned ${paramToTune}: ${oldValue} → ${newValue} (${result.reason})`);

      return result;
    }

    return null;
  }

  /**
   * 优化模型选择
   */
  private optimizeModelSelection(suggestion: ImprovementSuggestion): ModelSelectionStrategy | null {
    const costMetrics = this.metricsTracker.getCostMetrics();
    const metrics = this.metricsTracker.getPerformanceMetrics(suggestion.targetId) as PerformanceMetrics;

    if (!metrics || !costMetrics.byModel.has(suggestion.targetId)) {
      return null;
    }

    // 选择一个更轻量级的模型
    const modelTiers = ['nano', 'light', 'standard', 'heavy'];
    const modelsByTier: Record<string, string[]> = {
      nano: ['qwen2.5-0.5b', 'phi-3-mini-4k'],
      light: ['qwen2.5-7b', 'llama3.2-3b'],
      standard: ['qwen2.5-14b', 'llama3-8b'],
      heavy: ['qwen2.5-72b', 'llama3-70b'],
    };

    // 找到当前模型所在的 tier
    let currentTier = 'standard';  // 默认
    for (const [tier, models] of Object.entries(modelsByTier)) {
      for (const model of models) {
        if (costMetrics.byModel.has(model)) {
          currentTier = tier;
          break;
        }
      }
      if (currentTier !== 'standard') break;
    }

    // 选择下一层级的模型
    const tierIndex = modelTiers.indexOf(currentTier);
    if (tierIndex > 0) {
      const lighterTier = modelTiers[tierIndex - 1];
      const lighterModels = modelsByTier[lighterTier];
      const recommendedModel = lighterModels[0];

      const strategy: ModelSelectionStrategy = {
        agentId: suggestion.targetId,
        recommendedModel,
        reason: suggestion.description,
        cost: costMetrics.byModel.get(suggestion.targetId)!.cost * 0.3,  // 预期节省 70%
        expectedLatency: metrics.averageLatency * 0.5,
      };

      this.modelSelectionStrategies.set(suggestion.targetId, strategy);

      console.log(`[Tuner] Model selection for ${suggestion.targetId}: ${recommendedModel} (expected savings: 70%)`);

      return strategy;
    }

    return null;
  }

  /**
   * 自动调优策略
   */
  private autoTuneStrategy(): void {
    const summary = this.metricsTracker.getSummary();

    // 成本优化模式
    if (summary.totalCost > 10 && this.strategyConfig.costOptimizationLevel < 0.8) {
      this.strategyConfig.costOptimizationLevel = 0.8;
      this.strategyConfig.performancePrioritizationLevel = 0.5;
      console.log('[Tuner] Enabled cost optimization mode');
    }

    // 性能优先模式
    if (summary.averageLatency > 2000 && this.strategyConfig.performancePrioritizationLevel < 0.8) {
      this.strategyConfig.performancePrioritizationLevel = 0.8;
      this.strategyConfig.costOptimizationLevel = 0.5;
      console.log('[Tuner] Enabled performance prioritization mode');
    }

    // 负载均衡策略选择
    const activeAgents = summary.totalAgents;
    if (activeAgents > 5 && this.strategyConfig.routingStrategy !== 'least-loaded') {
      this.strategyConfig.routingStrategy = 'least-loaded';
      console.log('[Tuner] Changed routing strategy to least-loaded');
    }
  }

  /**
   * A/B 测试
   */
  async runABTest(
    testName: string,
    parameterName: string,
    variantA: number,
    variantB: number,
    durationMs: number = 60000,
  ): Promise<ABTestResult> {
    console.log(`[Tuner] Starting A/B test: ${testName} (${parameterName}: ${variantA} vs ${variantB})`);

    // 获取初始性能
    const initialMetrics = this.metricsTracker.getSummary();

    // 应用 variant A
    const param = this.parameters.get(parameterName);
    if (!param) {
      throw new Error(`Parameter ${parameterName} not found`);
    }
    const originalValue = param.value;
    param.value = variantA;

    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, durationMs / 2));

    // 获取 variant A 性能
    const metricsA = this.metricsTracker.getSummary();
    const performanceA = metricsA.averageSuccessRate / (metricsA.averageLatency / 1000);

    // 应用 variant B
    param.value = variantB;

    // 等待剩余时间
    await new Promise(resolve => setTimeout(resolve, durationMs / 2));

    // 获取 variant B 性能
    const metricsB = this.metricsTracker.getSummary();
    const performanceB = metricsB.averageSuccessRate / (metricsB.averageLatency / 1000);

    // 恢复原始值
    param.value = originalValue;

    // 确定 winner
    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (performanceA > performanceB * 1.1) {
      winner = 'A';
    } else if (performanceB > performanceA * 1.1) {
      winner = 'B';
    }

    const confidence = Math.abs(performanceA - performanceB) / Math.max(performanceA, performanceB);

    const result: ABTestResult = {
      testName,
      variantA: { value: variantA, performance: performanceA },
      variantB: { value: variantB, performance: performanceB },
      winner,
      confidence,
      timestamp: Date.now(),
    };

    this.abTestResults.push(result);

    console.log(`[Tuner] A/B test completed: ${result.winner} won (confidence: ${(confidence * 100).toFixed(1)}%)`);

    return result;
  }

  /**
   * 应用调优结果
   */
  applyTuning(tuningResult: TuningResult): void {
    const param = this.parameters.get(tuningResult.parameterName);
    if (param) {
      param.value = tuningResult.newValue;
      this.stats.totalApplies++;
      console.log(`[Tuner] Applied tuning: ${tuningResult.parameterName} = ${tuningResult.newValue}`);
    }
  }

  /**
   * 回滚调优
   */
  rollbackTuning(tuningResult: TuningResult): void {
    const param = this.parameters.get(tuningResult.parameterName);
    if (param) {
      param.value = tuningResult.oldValue;
      this.stats.totalRollbacks++;
      console.log(`[Tuner] Rolled back tuning: ${tuningResult.parameterName} = ${tuningResult.oldValue}`);
    }
  }

  /**
   * 获取调优参数
   */
  getParameters(): Map<string, TuningParameter> {
    return new Map(this.parameters);
  }

  /**
   * 设置参数值
   */
  setParameter(name: string, value: number): void {
    const param = this.parameters.get(name);
    if (param) {
      const oldValue = param.value;
      param.value = Math.max(param.minValue, Math.min(param.maxValue, value));

      const result: TuningResult = {
        parameterName: name,
        oldValue,
        newValue: param.value,
        reason: 'Manual update',
        timestamp: Date.now(),
        expectedImpact: 0,
      };

      this.tuningHistory.push(result);

      console.log(`[Tuner] Parameter ${name} set: ${oldValue} → ${param.value}`);
    }
  }

  /**
   * 获取策略配置
   */
  getStrategyConfig(): StrategyConfig {
    return { ...this.strategyConfig };
  }

  /**
   * 设置策略配置
   */
  setStrategyConfig(config: Partial<StrategyConfig>): void {
    Object.assign(this.strategyConfig, config);
    console.log('[Tuner] Strategy config updated');
  }

  /**
   * 获取模型选择策略
   */
  getModelSelectionStrategies(): Map<string, ModelSelectionStrategy> {
    return new Map(this.modelSelectionStrategies);
  }

  /**
   * 获取调优历史
   */
  getTuningHistory(limit?: number): TuningResult[] {
    let history = [...this.tuningHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalTunings: number;
    totalApplies: number;
    totalRollbacks: number;
    totalModelSelections: number;
  } {
    return { ...this.stats };
  }

  /**
   * 重置
   */
  reset(): void {
    this.tuningHistory = [];
    this.modelSelectionStrategies.clear();
    this.abTestResults = [];

    this.stats = {
      totalTunings: 0,
      totalApplies: 0,
      totalRollbacks: 0,
      totalModelSelections: 0,
    };

    this.initializeParameters();

    console.log('[Tuner] Autonomous tuner reset');
  }
}
