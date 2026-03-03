/**
 * Metrics Tracker
 *
 * 指标追踪：性能、行为、异常、成本
 */

import type { Event } from '../events/Event.js';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  agentId: string;
  tasksCompleted: number;
  tasksFailed: number;
  averageLatency: number;  // ms
  successRate: number;  // 0-1
  p99Latency: number;  // ms
  throughput: number;  // tasks/min
}

/**
 * 行为模式
 */
export interface BehaviorPattern {
  agentId: string;
  patternType: 'repetitive' | 'sequential' | 'parallel' | 'random';
  frequency: number;  // events/min
  patternDetails: Record<string, any>;
  confidence: number;  // 0-1
}

/**
 * 异常
 */
export interface Anomaly {
  id: string;
  agentId: string;
  type: 'high_latency' | 'high_failure' | 'unexpected_error' | 'resource_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metrics: Record<string, number>;
  description: string;
  resolved: boolean;
}

/**
 * 成本追踪
 */
export interface CostMetrics {
  totalTokens: number;
  totalCost: number;  // USD
  byAgent: Map<string, { tokens: number; cost: number }>;
  byModel: Map<string, { tokens: number; cost: number }>;
  timeWindow: number;  // ms
}

/**
 * 指标追踪器
 */
export class MetricsTracker {
  // 性能指标（按 agent）
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  // 行为模式
  private behaviorPatterns: Map<string, BehaviorPattern> = new Map();

  // 异常列表
  private anomalies: Anomaly[] = [];

  // 成本指标
  private costMetrics: CostMetrics;

  // 事件历史（用于模式分析）
  private eventHistory: Event[] = [];
  private maxHistorySize = 1000;

  // 延迟采样
  private latencySamples: Map<string, number[]> = new Map();

  // 配置
  private anomalyThresholds = {
    highLatency: 5000,  // ms
    highFailureRate: 0.3,  // 30%
    unexpectedErrorThreshold: 3,  // 3 errors in 5 min
  };

  constructor() {
    this.costMetrics = {
      totalTokens: 0,
      totalCost: 0,
      byAgent: new Map(),
      byModel: new Map(),
      timeWindow: 0,
    };
  }

  /**
   * 记录任务完成
   */
  recordTaskCompletion(agentId: string, latency: number, success: boolean, tokensUsed?: number, cost?: number, model?: string): void {
    // 更性能指标
    const metrics = this.performanceMetrics.get(agentId) || {
      agentId,
      tasksCompleted: 0,
      tasksFailed: 0,
      averageLatency: 0,
      successRate: 0,
      p99Latency: 0,
      throughput: 0,
    };

    if (success) {
      metrics.tasksCompleted++;
    } else {
      metrics.tasksFailed++;
    }

    // 更新平均延迟
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.averageLatency = ((metrics.averageLatency * (totalTasks - 1)) + latency) / totalTasks;

    // 记录延迟样本
    if (!this.latencySamples.has(agentId)) {
      this.latencySamples.set(agentId, []);
    }
    this.latencySamples.get(agentId)!.push(latency);

    // 计算 P99 延迟
    const samples = this.latencySamples.get(agentId)!;
    samples.sort((a, b) => a - b);
    const p99Index = Math.floor(samples.length * 0.99);
    metrics.p99Latency = samples[p99Index] || 0;

    // 更新成功率
    metrics.successRate = metrics.tasksCompleted / totalTasks;

    this.performanceMetrics.set(agentId, metrics);

    // 检测异常
    if (latency > this.anomalyThresholds.highLatency) {
      this.createAnomaly(agentId, 'high_latency', 'medium', {
        latency,
        threshold: this.anomalyThresholds.highLatency,
      });
    }

    if (!success && metrics.successRate < (1 - this.anomalyThresholds.highFailureRate)) {
      this.createAnomaly(agentId, 'high_failure', 'high', {
        successRate: metrics.successRate,
        threshold: 1 - this.anomalyThresholds.highFailureRate,
        tasksCompleted: metrics.tasksCompleted,
        tasksFailed: metrics.tasksFailed,
      });
    }

    // 记录成本
    if (tokensUsed !== undefined && cost !== undefined) {
      this.recordCost(agentId, tokensUsed, cost, model || 'unknown');
    }
  }

  /**
   * 记录成本
   */
  recordCost(agentId: string, tokens: number, cost: number, model: string): void {
    this.costMetrics.totalTokens += tokens;
    this.costMetrics.totalCost += cost;

    // 按 agent 统计
    if (!this.costMetrics.byAgent.has(agentId)) {
      this.costMetrics.byAgent.set(agentId, { tokens: 0, cost: 0 });
    }
    const agentCost = this.costMetrics.byAgent.get(agentId)!;
    agentCost.tokens += tokens;
    agentCost.cost += cost;

    // 按模型统计
    if (!this.costMetrics.byModel.has(model)) {
      this.costMetrics.byModel.set(model, { tokens: 0, cost: 0 });
    }
    const modelCost = this.costMetrics.byModel.get(model)!;
    modelCost.tokens += tokens;
    modelCost.cost += cost;
  }

  /**
   * 记录事件
   */
  recordEvent(event: Event): void {
    this.eventHistory.push(event);

    // 限制历史大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // 检测错误
    if (event.type === 'agent_error') {
      const payload = event.payload as { agentId?: string; error?: string };
      const agentId = payload.agentId || 'unknown';

      // 检查过去 5 分钟的错误数量
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentErrors = this.eventHistory.filter(
        e => e.type === 'agent_error' && e.timestamp >= fiveMinutesAgo,
      ).length;

      if (recentErrors >= this.anomalyThresholds.unexpectedErrorThreshold) {
        this.createAnomaly(agentId, 'unexpected_error', 'medium', {
          errorCount: recentErrors,
          lastError: payload.error || 'Unknown error',
        });
      }
    }
  }

  /**
   * 创建异常
   */
  private createAnomaly(agentId: string, type: Anomaly['type'], severity: Anomaly['severity'], metrics: Record<string, number>): void {
    const anomaly: Anomaly = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId,
      type,
      severity,
      timestamp: Date.now(),
      metrics,
      description: this.generateAnomalyDescription(type, metrics),
      resolved: false,
    };

    this.anomalies.push(anomaly);

    console.log(`[Metrics] Anomaly detected: ${anomaly.id} - ${anomaly.type} (${anomaly.severity}) for agent ${agentId}`);
  }

  /**
   * 生成异常描述
   */
  private generateAnomalyDescription(type: Anomaly['type'], metrics: Record<string, number>): string {
    switch (type) {
      case 'high_latency':
        return `High latency: ${metrics.latency}ms (threshold: ${metrics.threshold}ms)`;
      case 'high_failure':
        return `High failure rate: success rate ${metrics.successRate} (threshold: ${metrics.threshold}), ${metrics.tasksCompleted} completed, ${metrics.tasksFailed} failed`;
      case 'unexpected_error':
        return `Unexpected errors: ${metrics.errorCount} in last 5 minutes`;
      case 'resource_leak':
        return `Resource leak detected`;
      default:
        return 'Unknown anomaly';
    }
  }

  /**
   * 分析行为模式
   */
  analyzeBehaviorPatterns(agentId: string): BehaviorPattern | null {
    const agentEvents = this.eventHistory.filter(e => e.agentId === agentId);

    if (agentEvents.length < 10) {
      return null;  // 数据不足
    }

    // 计算事件频率
    const timeSpan = (agentEvents[agentEvents.length - 1].timestamp - agentEvents[0].timestamp) / 1000 / 60;  // min
    const frequency = agentEvents.length / timeSpan;

    // 检测模式类型（简化）
    let patternType: BehaviorPattern['patternType'] = 'random';
    let patternDetails: Record<string, any> = {};
    let confidence = 0.5;

    // 检测重复模式
    const eventTypes = agentEvents.map(e => e.type);
    const uniqueTypes = new Set(eventTypes);
    if (uniqueTypes.size < 3) {
      patternType = 'repetitive';
      patternDetails = { eventTypes: Array.from(uniqueTypes) };
      confidence = 0.8;
    }

    // 检测顺序模式
    const isSequential = agentEvents.every((e, i) => {
      if (i === 0) return true;
      return e.timestamp >= agentEvents[i - 1].timestamp;
    });
    if (isSequential && frequency > 5) {
      patternType = 'sequential';
      patternDetails = { avgInterval: timeSpan * 60 / agentEvents.length };
      confidence = 0.7;
    }

    const pattern: BehaviorPattern = {
      agentId,
      patternType,
      frequency,
      patternDetails,
      confidence,
    };

    this.behaviorPatterns.set(agentId, pattern);

    return pattern;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(agentId?: string): PerformanceMetrics | Map<string, PerformanceMetrics> {
    if (agentId) {
      return this.performanceMetrics.get(agentId)!;
    }
    return this.performanceMetrics;
  }

  /**
   * 获取异常
   */
  getAnomalies(agentId?: string, includeResolved: boolean = false): Anomaly[] {
    let anomalies = this.anomalies;

    if (agentId) {
      anomalies = anomalies.filter(a => a.agentId === agentId);
    }

    if (!includeResolved) {
      anomalies = anomalies.filter(a => !a.resolved);
    }

    return anomalies.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 解决异常
   */
  resolveAnomaly(anomalyId: string): void {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.resolved = true;
      console.log(`[Metrics] Anomaly resolved: ${anomalyId}`);
    }
  }

  /**
   * 获取成本指标
   */
  getCostMetrics(): CostMetrics {
    return {
      totalTokens: this.costMetrics.totalTokens,
      totalCost: this.costMetrics.totalCost,
      byAgent: new Map(this.costMetrics.byAgent),
      byModel: new Map(this.costMetrics.byModel),
      timeWindow: this.costMetrics.timeWindow,
    };
  }

  /**
   * 获取行为模式
   */
  getBehaviorPatterns(agentId?: string): Map<string, BehaviorPattern> | BehaviorPattern | null {
    if (agentId) {
      return this.behaviorPatterns.get(agentId) || null;
    }
    return this.behaviorPatterns;
  }

  /**
   * 重置
   */
  reset(): void {
    this.performanceMetrics.clear();
    this.behaviorPatterns.clear();
    this.anomalies = [];
    this.eventHistory = [];
    this.latencySamples.clear();

    this.costMetrics = {
      totalTokens: 0,
      totalCost: 0,
      byAgent: new Map(),
      byModel: new Map(),
      timeWindow: 0,
    };

    console.log('[Metrics] Metrics tracker reset');
  }

  /**
   * 获取统计摘要
   */
  getSummary(): {
    totalAgents: number;
    totalTasks: number;
    averageSuccessRate: number;
    averageLatency: number;
    totalCost: number;
    activeAnomalies: number;
  } {
    const agents = Array.from(this.performanceMetrics.values());
    const totalTasks = agents.reduce((sum, m) => sum + m.tasksCompleted + m.tasksFailed, 0);
    const averageSuccessRate = agents.length > 0
      ? agents.reduce((sum, m) => sum + m.successRate, 0) / agents.length
      : 0;
    const averageLatency = agents.length > 0
      ? agents.reduce((sum, m) => sum + m.averageLatency, 0) / agents.length
      : 0;
    const activeAnomalies = this.anomalies.filter(a => !a.resolved).length;

    return {
      totalAgents: agents.length,
      totalTasks,
      averageSuccessRate,
      averageLatency,
      totalCost: this.costMetrics.totalCost,
      activeAnomalies,
    };
  }
}
