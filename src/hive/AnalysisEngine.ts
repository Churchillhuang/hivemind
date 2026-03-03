/**
 * Analysis Engine
 *
 * 分析引擎：模式分析、性能改进建议、规则发现、根因分析
 */

import { MetricsTracker } from './MetricsTracker.js';
import type { PerformanceMetrics, BehaviorPattern, Anomaly } from './MetricsTracker.js';

/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  id: string;
  type: 'performance' | 'cost' | 'reliability' | 'resource';
  priority: 'low' | 'medium' | 'high' | 'critical';
  target: 'agent' | 'system' | 'model';
  targetId: string;
  description: string;
  expectedImpact: number;  // 0-1
  confidence: number;  // 0-1
  action: string;
  estimatedCost?: number;
  estimatedBenefit?: number;
}

/**
 * 发现的规则
 */
export interface DiscoveredRule {
  id: string;
  pattern: string;
  description: string;
  confidence: number;  // 0-1
  support: number;  // 训练样本中出现的次数
  examples: string[];
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  anomalyId: string;
  rootCauses: string[];
  factors: {
    factor: string;
    impact: number;  // 0-1
    confidence: number;
  }[];
  recommendedActions: string[];
}

/**
 * 模式分析结果
 */
export interface PatternAnalysisResult {
  pattern: string;
  description: string;
  frequency: number;
  confidence: number;
  implications: string[];
}

/**
 * 分析引擎
 */
export class AnalysisEngine {
  private metricsTracker: MetricsTracker;
  private suggestions: ImprovementSuggestion[] = [];
  private rules: DiscoveredRule[] = [];

  constructor(metricsTracker: MetricsTracker) {
    this.metricsTracker = metricsTracker;
  }

  /**
   * 运行全面分析
   */
  async analyze(): Promise<{
    suggestions: ImprovementSuggestion[];
    rules: DiscoveredRule[];
    patterns: PatternAnalysisResult[];
  }> {
    // 分析性能
    const performanceSuggestions = this.analyzePerformance();

    // 分析成本
    const costSuggestions = this.analyzeCost();

    // 分析可靠性
    const reliabilitySuggestions = this.analyzeReliability();

    // 发现规则
    const rules = await this.discoverRules();

    // 分析模式
    const patterns = this.analyzePatterns();

    // 合并建议
    this.suggestions = [...performanceSuggestions, ...costSuggestions, ...reliabilitySuggestions];

    return {
      suggestions: this.suggestions,
      rules,
      patterns,
    };
  }

  /**
   * 分析性能
   */
  private analyzePerformance(): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const metrics = this.metricsTracker.getPerformanceMetrics() as Map<string, PerformanceMetrics>;

    for (const [agentId, agentMetrics] of metrics.entries()) {
      // 高延迟
      if (agentMetrics.averageLatency > 3000) {
        suggestions.push({
          id: `perf_latency_${agentId}`,
          type: 'performance',
          priority: agentMetrics.averageLatency > 5000 ? 'high' : 'medium',
          target: 'agent',
          targetId: agentId,
          description: `Agent ${agentId} has high average latency: ${agentMetrics.averageLatency}ms`,
          expectedImpact: agentMetrics.averageLatency / 10000,
          confidence: 0.8,
          action: 'Consider using a lighter model or optimizing task processing',
          estimatedBenefit: (agentMetrics.averageLatency - 2000) / 1000000,  // 粗略估算
        });
      }

      // 低吞吐量
      if (agentMetrics.throughput < 1) {
        suggestions.push({
          id: `perf_throughput_${agentId}`,
          type: 'performance',
          priority: 'medium',
          target: 'agent',
          targetId: agentId,
          description: `Agent ${agentId} has low throughput: ${agentMetrics.throughput.toFixed(2)} tasks/min`,
          expectedImpact: 0.5,
          confidence: 0.7,
          action: 'Consider batching tasks or parallel processing',
        });
      }

      // 成功率低
      if (agentMetrics.successRate < 0.9) {
        suggestions.push({
          id: `perf_success_${agentId}`,
          type: 'reliability',
          priority: 'high',
          target: 'agent',
          targetId: agentId,
          description: `Agent ${agentId} has low success rate: ${(agentMetrics.successRate * 100).toFixed(1)}%`,
          expectedImpact: 1 - agentMetrics.successRate,
          confidence: 0.9,
          action: 'Investigate error patterns and add error handling or retry logic',
          estimatedBenefit: (1 - agentMetrics.successRate) * 10,  // 粗略估算
        });
      }
    }

    return suggestions;
  }

  /**
   * 分析成本
   */
  private analyzeCost(): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const costMetrics = this.metricsTracker.getCostMetrics();

    // 按模型分析成本
    for (const [model, modelCost] of costMetrics.byModel.entries()) {
      if (modelCost.cost > 10) {  // 超过 $10
        suggestions.push({
          id: `cost_model_${model}`,
          type: 'cost',
          priority: 'high',
          target: 'model',
          targetId: model,
          description: `Model ${model} has high cost: $${modelCost.cost.toFixed(2)} (${modelCost.tokens} tokens)`,
          expectedImpact: modelCost.cost / 100,
          confidence: 0.9,
          action: 'Consider using a lighter model for this task type',
          estimatedBenefit: modelCost.cost * 0.3,  // 预期节省 30%
        });
      }
    }

    // 按 agent 分析成本
    for (const [agentId, agentCost] of costMetrics.byAgent.entries()) {
      if (agentCost.cost > 5) {  // 超过 $5
        const metrics = this.metricsTracker.getPerformanceMetrics(agentId) as PerformanceMetrics;
        const costPerTask = metrics
          ? agentCost.cost / (metrics.tasksCompleted + metrics.tasksFailed)
          : 0;

        if (costPerTask > 0.01) {  // 每个任务超过 $0.01
          suggestions.push({
            id: `cost_agent_${agentId}`,
            type: 'cost',
            priority: 'medium',
            target: 'agent',
            targetId: agentId,
            description: `Agent ${agentId} has high cost per task: $${costPerTask.toFixed(4)}`,
            expectedImpact: 0.5,
            confidence: 0.7,
            action: 'Optimize task logic or reduce memory/context size',
            estimatedBenefit: costPerTask * 0.2,  // 预期节省 20%
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * 分析可靠性
   */
  private analyzeReliability(): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const anomalies = this.metricsTracker.getAnomalies(undefined, false);

    // 按严重程度分组
    const activeHighSeverityAnomalies = anomalies.filter(a => a.severity === 'high' || a.severity === 'critical');

    for (const anomaly of activeHighSeverityAnomalies) {
      suggestions.push({
        id: `rel_anomaly_${anomaly.id}`,
        type: 'reliability',
        priority: anomaly.severity,
        target: 'agent',
        targetId: anomaly.agentId,
        description: anomaly.description,
        expectedImpact: 0.8,
        confidence: 0.9,
        action: this.generateAnomalyAction(anomaly),
      });
    }

    return suggestions;
  }

  /**
   * 生成异常行动建议
   */
  private generateAnomalyAction(anomaly: Anomaly): string {
    switch (anomaly.type) {
      case 'high_latency':
        return 'Increase timeout, use lighter model, or optimize processing logic';
      case 'high_failure':
        return 'Add retry logic, improve error handling, or investigate task requirements';
      case 'unexpected_error':
        return 'Review error logs, validate input data, and update error handling code';
      case 'resource_leak':
        return 'Review memory usage and ensure proper cleanup';
      default:
        return 'Investigate and resolve the anomaly';
    }
  }

  /**
   * 发现规则
   */
  private async discoverRules(): Promise<DiscoveredRule[]> {
    const rules: DiscoveredRule[] = [];
    const metrics = this.metricsTracker.getPerformanceMetrics() as Map<string, PerformanceMetrics>;
    const patterns = this.metricsTracker.getBehaviorPatterns() as Map<string, BehaviorPattern>;

    // 规则 1: 高成本 agents 倾向于有大模型
    const highCostAgents: string[] = [];
    const costMetrics = this.metricsTracker.getCostMetrics();
    for (const [agentId, agentCost] of costMetrics.byAgent.entries()) {
      if (agentCost.cost > 1) {
        highCostAgents.push(agentId);
      }
    }

    if (highCostAgents.length > 0) {
      rules.push({
        id: 'rule_high_cost_agents',
        pattern: 'Agents with cost > $1',
        description: 'Agents with high cost tend to use large models or process complex tasks',
        confidence: 0.8,
        support: highCostAgents.length,
        examples: highCostAgents.slice(0, 3),
      });
    }

    // 规则 2: 重复模式 agents 有高吞吐量
    const repetitiveAgents: string[] = [];
    for (const [agentId, pattern] of patterns.entries()) {
      if (pattern.patternType === 'repetitive') {
        const metrics = this.metricsTracker.getPerformanceMetrics(agentId) as PerformanceMetrics;
        if (metrics && metrics.throughput > 2) {
          repetitiveAgents.push(agentId);
        }
      }
    }

    if (repetitiveAgents.length > 0) {
      rules.push({
        id: 'rule_repetitive_high_throughput',
        pattern: 'Repetitive pattern agents',
        description: 'Agents with repetitive behavior patterns tend to have higher throughput',
        confidence: 0.75,
        support: repetitiveAgents.length,
        examples: repetitiveAgents.slice(0, 3),
      });
    }

    // 规则 3: 高延迟意味着低成功率
    const highLatencyAgents: string[] = [];
    for (const [agentId, agentMetrics] of metrics.entries()) {
      if (agentMetrics.averageLatency > 2000 && agentMetrics.successRate < 0.8) {
        highLatencyAgents.push(agentId);
      }
    }

    if (highLatencyAgents.length > 0) {
      rules.push({
        id: 'rule_latency_success_correlation',
        pattern: 'High latency with low success rate',
        description: 'Agents with high latency tend to have lower success rates',
        confidence: 0.7,
        support: highLatencyAgents.length,
        examples: highLatencyAgents.slice(0, 3),
      });
    }

    this.rules = rules;
    return rules;
  }

  /**
   * 分析模式
   */
  private analyzePatterns(): PatternAnalysisResult[] {
    const patterns: PatternAnalysisResult[] = [];
    const metrics = this.metricsTracker.getPerformanceMetrics() as Map<string, PerformanceMetrics>;

    // 模式 1: 早高峰
    const activeAgents = Array.from(metrics.values()).length;
    if (activeAgents > 3) {
      patterns.push({
        pattern: 'high_concurrency',
        description: 'High number of active agents detected',
        frequency: activeAgents,
        confidence: 0.9,
        implications: [
          'Consider load balancing agents',
          'Monitor resource usage',
          'May need to scale infrastructure',
        ],
      });
    }

    // 模式 2: 系统稳定运行
    const summary = this.metricsTracker.getSummary();
    if (summary.averageSuccessRate > 0.95 && summary.activeAnomalies === 0) {
      patterns.push({
        pattern: 'stable_operation',
        description: 'System operating normally with high success rate',
        frequency: summary.totalTasks,
        confidence: 1.0,
        implications: [
          'System is healthy',
          'Can consider increasing workload',
          'Continue monitoring',
        ],
      });
    }

    // 模式 3: 成本优化机会
    if (summary.totalCost > 5 && summary.averageSuccessRate < 0.9) {
      patterns.push({
        pattern: 'cost_optimization_opportunity',
        description: 'High cost with suboptimal success rate suggests optimization opportunity',
        frequency: summary.totalTasks,
        confidence: 0.8,
        implications: [
          'Review model selection',
          'Optimize task batching',
          'Consider memory tiering',
        ],
      });
    }

    return patterns;
  }

  /**
   * 根因分析
   */
  async analyzeRootCause(anomalyId: string): Promise<RootCauseAnalysis> {
    const anomaly = this.metricsTracker.getAnomalies(undefined, false).find(a => a.id === anomalyId);

    if (!anomaly) {
      throw new Error(`Anomaly ${anomalyId} not found`);
    }

    const rootCauses: string[] = [];
    const factors: {
      factor: string;
      impact: number;
      confidence: number;
    }[] = [];
    const recommendedActions: string[] = [];

    switch (anomaly.type) {
      case 'high_latency':
        rootCauses.push('Model is too large for the task', 'Processing logic is inefficient', 'Network latency');
        factors.push({ factor: 'Model size', impact: 0.6, confidence: 0.8 });
        factors.push({ factor: 'Processing logic', impact: 0.4, confidence: 0.7 });
        factors.push({ factor: 'Network', impact: 0.2, confidence: 0.5 });
        recommendedActions.push('Switch to a lighter model', 'Optimize code', 'Check network connectivity');
        break;

      case 'high_failure':
        rootCauses.push('Task requirements unclear', 'Error handling insufficient', 'Model lacks knowledge');
        factors.push({ factor: 'Task clarity', impact: 0.5, confidence: 0.7 });
        factors.push({ factor: 'Error handling', impact: 0.4, confidence: 0.6 });
        factors.push({ factor: 'Model knowledge', impact: 0.3, confidence: 0.5 });
        recommendedActions.push('Improve task prompts', 'Add retry logic', 'Use larger model');
        break;

      case 'unexpected_error':
        rootCauses.push('Input validation missing', 'Edge case not handled', 'Dependency issue');
        factors.push({ factor: 'Input validation', impact: 0.5, confidence: 0.6 });
        factors.push({ factor: 'Edge cases', impact: 0.4, confidence: 0.5 });
        factors.push({ factor: 'Dependencies', impact: 0.3, confidence: 0.4 });
        recommendedActions.push('Add input validation', 'Test edge cases', 'Check dependencies');
        break;

      case 'resource_leak':
        rootCauses.push('Memory not released', 'Connections not closed', 'Buffers not flushed');
        factors.push({ factor: 'Memory management', impact: 0.6, confidence: 0.8 });
        factors.push({ factor: 'Connection management', impact: 0.5, confidence: 0.7 });
        factors.push({ factor: 'Buffer management', impact: 0.3, confidence: 0.4 });
        recommendedActions.push('Fix memory leaks', 'Close connections', 'Flush buffers');
        break;

      default:
        rootCauses.push('Unknown cause');
        factors.push({ factor: 'Unknown', impact: 1.0, confidence: 0.1 });
        recommendedActions.push('Investigate further');
    }

    return {
      anomalyId,
      rootCauses,
      factors,
      recommendedActions,
    };
  }

  /**
   * 获取改进建议
   */
  getSuggestions(limit?: number): ImprovementSuggestion[] {
    let suggestions = [...this.suggestions];

    // 按优先级排序
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return limit ? suggestions.slice(0, limit) : suggestions;
  }

  /**
   * 获取发现的规则
   */
  getRules(): DiscoveredRule[] {
    return this.rules;
  }

  /**
   * 重置
   */
  reset(): void {
    this.suggestions = [];
    this.rules = [];
    console.log('[Analysis] Analysis engine reset');
  }
}
