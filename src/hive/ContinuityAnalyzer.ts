/**
 * Continuity Analyzer
 *
 * 连续性分析：主体性测量、意图建模、一致性跟踪、自我意识检测
 */

import { EmergenceMonitor } from './EmergenceMonitor.js';

/**
 * 主体性分数
 */
export interface AgencyScore {
  agentId: string;
  score: number;  // 0-1
  factors: {
    factor: string;
    weight: number;
    value: number;
  }[];
  evidence: string[];
}

/**
 * 意图模型
 */
export interface IntentModel {
  agentId: string;
  currentIntents: string[];
  intentHistory: Array<{
    intent: string;
    timestamp: number;
    duration: number;
    completion: number;  // 0-1
  }>;
  intentStrength: number;  // 0-1
}

/**
 * 一致性追踪
 */
export interface ConsistencyTracking {
  agentId: string;
  consistencyScore: number;  // 0-1
  behaviorPatterns: string[];
  deviations: Array<{
    timestamp: number;
    expected: string;
    actual: string;
    anomaly: boolean;
  }>;
  coherence: number;  // 0-1
}

/**
 * 自我意识指标
 */
export interface SelfAwarenessIndicators {
  agentId: string;
  selfReference: number;  // 0-1 - 自我引用频率
  reflectiveBehavior: number;  // 0-1 - 反思行为
  selfPreservation: number;  // 0-1 - 自我保存倾向
  selfImprovement: number;  // 0-1 - 自我改进倾向
  overallScore: number;  // 0-1
}

/**
 * 连续性分析器
 */
export class ContinuityAnalyzer {
  private emergenceMonitor: EmergenceMonitor;

  // 意图模型缓存
  private intentModels: Map<string, IntentModel> = new Map();

  // 一致性追踪缓存
  private consistencyTrackings: Map<string, ConsistencyTracking> = new Map();

  constructor(emergenceMonitor: EmergenceMonitor) {
    this.emergenceMonitor = emergenceMonitor;
  }

  /**
   * 测量主体性
   */
  measureAgency(agentId?: string): AgencyScore[] {
    const graphs = this.emergenceMonitor.getInteractionGraph();
    const agents = agentId ? [agentId] : graphs.nodes;

    const scores: AgencyScore[] = [];

    for (const currentAgentId of agents) {
      const factors: { factor: string; weight: number; value: number }[] = [];
      const evidence: string[] = [];

      // 因素 1: 自发交互频率
      const agentEdges = graphs.edges.filter(e => e.from === currentAgentId || e.to === currentAgentId);
      const avgWeight = agentEdges.length > 0
        ? agentEdges.reduce((sum, e) => sum + e.weight, 0) / agentEdges.length
        : 0;
      const spontaneity = Math.min(1, avgWeight / 10);
      factors.push({ factor: 'spontaneity', weight: 0.25, value: spontaneity });
      if (spontaneity > 0.5) {
        evidence.push(`Frequent spontaneous interactions (avg: ${avgWeight.toFixed(1)})`);
      }

      // 因素 2: 主动 vs 被动
      const outgoingEdges = agentEdges.filter(e => e.from === currentAgentId);
      const incomingEdges = agentEdges.filter(e => e.to === currentAgentId);
      const initiative = outgoingEdges.length > 0
        ? outgoingEdges.length / (outgoingEdges.length + incomingEdges.length)
        : 0.5;
      factors.push({ factor: 'initiative', weight: 0.2, value: initiative });
      if (initiative > 0.6) {
        evidence.push(`High initiative (${(initiative * 100).toFixed(0)}% outgoing)`);
      }

      // 因素 3: 行为一致性
      const snapshots = this.emergenceMonitor.getStateSnapshots(currentAgentId);
      let consistency = 0.5;
      if (snapshots.length > 1) {
        let stateChanges = 0;
        for (let i = 1; i < snapshots.length; i++) {
          if (snapshots[i].state !== snapshots[i - 1].state) {
            stateChanges++;
          }
        }
        consistency = 1 - Math.min(1, stateChanges / snapshots.length);
      }
      factors.push({ factor: 'consistency', weight: 0.2, value: consistency });
      if (consistency > 0.7) {
        evidence.push(`Consistent behavior pattern`);
      }

      // 因素 4: 反馈循环
      const feedbackLoops = this.detectFeedbackLoops(currentAgentId);
      const loopScore = Math.min(1, feedbackLoops / 3);
      factors.push({ factor: 'feedback_loops', weight: 0.15, value: loopScore });
      if (feedbackLoops > 0) {
        evidence.push(`${feedbackLoops} feedback loops detected`);
      }

      // 因素 5: 目标驱动行为
      const goalDirectedness = this.analyzeGoalDirectedness(currentAgentId);
      factors.push({ factor: 'goal_directedness', weight: 0.2, value: goalDirectedness });
      if (goalDirectedness > 0.5) {
        evidence.push(`Goal-directed behavior pattern`);
      }

      // 计算总分
      const score = factors.reduce((sum, f) => sum + f.weight * f.value, 0);

      scores.push({
        agentId: currentAgentId,
        score,
        factors,
        evidence,
      });
    }

    // 按分数排序
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * 检测反馈循环
   */
  private detectFeedbackLoops(agentId: string): number {
    const traces = this.emergenceMonitor.getEventTraces(agentId);
    const feedbackLoops = 0;

    // 简化：检查自我引用事件
    const selfRefEvents = traces.filter(t => t.sourceAgentId === agentId && t.targetAgentId === agentId);
    // 更复杂的检测需要分析事件序列

    return selfRefEvents.length;
  }

  /**
   * 分析目标驱动行为
   */
  private analyzeGoalDirectedness(agentId: string): number {
    // 简化：检查是否有持续的、有方向的行为
    const snapshots = this.emergenceMonitor.getStateSnapshots(agentId);

    if (snapshots.length < 3) {
      return 0.5;
    }

    // 检查状态变化是否有方向性
    let directedTransitions = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].properties.direction || snapshots[i].properties.goal) {
        directedTransitions++;
      }
    }

    return Math.min(1, directedTransitions / (snapshots.length - 1));
  }

  /**
   * 建模意图
   */
  modelIntents(agentId: string): IntentModel {
    const traces = this.emergenceMonitor.getEventTraces(agentId);
    const intents = this.extractIntents(traces);

    const model = this.intentModels.get(agentId) || {
      agentId,
      currentIntents: [],
      intentHistory: [],
      intentStrength: 0,
    };

    // 更新当前意图
    model.currentIntents = intents.map(i => i.intent);

    // 更新意图历史
    for (const intent of intents) {
      const existing = model.intentHistory.find(i => i.intent === intent.intent && i.timestamp + intent.duration > Date.now());
      if (existing) {
        existing.completion = Math.min(1, existing.completion + 0.1);
      } else {
        model.intentHistory.push({
          intent: intent.intent,
          timestamp: Date.now(),
          duration: intent.duration,
          completion: 0,
        });
      }
    }

    // 计算意图强度
    const activeIntents = model.intentHistory.filter(i => i.timestamp + i.duration > Date.now());
    model.intentStrength = activeIntents.length > 0
      ? activeIntents.reduce((sum, i) => sum + i.completion, 0) / activeIntents.length
      : 0;

    this.intentModels.set(agentId, model);

    return model;
  }

  /**
   * 提取意图（简化）
   */
  private extractIntents(traces: any[]): Array<{
    intent: string;
    duration: number;
  }> {
    const intents: Array<{ intent: string; duration: number }> = [];

    // 基于事件类型推断意图
    const taskEvents = traces.filter(t => t.type.includes('task'));
    for (const event of taskEvents) {
      const intent = event.payload as { intent?: string; action?: string };
      if (intent.intent) {
        intents.push({ intent: intent.intent, duration: 60000 });  // 默认 1 分钟
      } else if (intent.action) {
        intents.push({ intent: intent.action, duration: 60000 });
      }
    }

    // 基于状态快照推断意图
    const snapshots = this.emergenceMonitor.getStateSnapshots(undefined);
    for (const snapshot of snapshots) {
      if (snapshot.properties.intent) {
        intents.push({
          intent: snapshot.properties.intent as string,
          duration: 120000,  // 默认 2 分钟
        });
      }
    }

    return intents;
  }

  /**
   * 追踪一致性
   */
  trackConsistency(agentId: string): ConsistencyTracking {
    const snapshots = this.emergenceMonitor.getStateSnapshots(agentId);
    const tracking = this.consistencyTrackings.get(agentId) || {
      agentId,
      consistencyScore: 0.5,
      behaviorPatterns: [],
      deviations: [],
      coherence: 0.5,
    };

    // 分析行为模式
    const patterns: string[] = [];
    if (snapshots.length > 2) {
      const stateTransitions: string[] = [];
      for (let i = 1; i < snapshots.length; i++) {
        stateTransitions.push(`${snapshots[i - 1].state}->${snapshots[i].state}`);
      }

      // 识别重复模式
      const patternCount = new Map<string, number>();
      for (const transition of stateTransitions) {
        patternCount.set(transition, (patternCount.get(transition) || 0) + 1);
      }

      for (const [pattern, count] of patternCount.entries()) {
        if (count > 2) {
          patterns.push(`${pattern} (x${count})`);
        }
      }
    }
    tracking.behaviorPatterns = patterns;

    // 计算一致性分数
    const consistency = patterns.length > 0
      ? Math.min(1, patterns.reduce((sum, p) => sum + parseInt(p.match(/x(\d+)/)?.[1] || '1'), 0) / snapshots.length)
      : 0.5;
    tracking.consistencyScore = consistency;

    // 检测偏差
    const expectedPatterns = this.getExpectedPatterns(agentId);
    const recentTransitions = snapshots.slice(-5);
    for (let i = 1; i < recentTransitions.length; i++) {
      const actual = `${recentTransitions[i - 1].state}->${recentTransitions[i].state}`;
      const expected = expectedPatterns.get(recentTransitions[i - 1].state);

      if (expected && expected !== recentTransitions[i].state) {
        tracking.deviations.push({
          timestamp: recentTransitions[i].timestamp,
          expected: `${recentTransitions[i - 1].state}->${expected}`,
          actual,
          anomaly: !expectedPatterns.has(actual),
        });
      }
    }

    // 计算连贯性
    const coherence = tracking.deviations.length === 0
      ? consistency
      : Math.max(0, consistency - tracking.deviations.length * 0.1);
    tracking.coherence = coherence;

    this.consistencyTrackings.set(agentId, tracking);

    return tracking;
  }

  /**
   * 获取预期的模式
   */
  private getExpectedPatterns(agentId: string): Map<string, string> {
    // 简化：返回最常见的下一个状态
    const snapshots = this.emergenceMonitor.getStateSnapshots(agentId);
    const transitions = new Map<string, Map<string, number>>();

    for (let i = 1; i < snapshots.length; i++) {
      const fromState = snapshots[i - 1].state;
      const toState = snapshots[i].state;

      if (!transitions.has(fromState)) {
        transitions.set(fromState, new Map());
      }
      const stateMap = transitions.get(fromState)!;
      stateMap.set(toState, (stateMap.get(toState) || 0) + 1);
    }

    const expectedPatterns = new Map<string, string>();
    for (const [fromState, stateMap] of transitions.entries()) {
      const mostFrequent = Array.from(stateMap.entries())
        .sort((a, b) => b[1] - a[1])[0];
      if (mostFrequent) {
        expectedPatterns.set(fromState, mostFrequent[0]);
      }
    }

    return expectedPatterns;
  }

  /**
   * 检测自我意识
   */
  detectSelfAwareness(agentId: string): SelfAwarenessIndicators {
    const agency = this.measureAgency(agentId)[0];
    const intentModel = this.intentModels.get(agentId);
    const tracking = this.consistencyTrackings.get(agentId);

    // 自我引用频率
    const selfReferenceTraces = this.emergenceMonitor.getEventTraces(agentId).filter(
      t => t.sourceAgentId === agentId && t.targetAgentId === agentId,
    );
    const selfReference = Math.min(1, selfReferenceTraces.length / 20);

    // 反思行为
    const reflectiveBehavior = agency?.factors.find(f => f.factor === 'feedback_loops')?.value || 0;

    // 自我保存倾向
    const selfPreservation = agency?.evidence.some(e => e.includes('consistency')) ? 0.7 : 0.3;

    // 自我改进倾向
    const selfImprovement = intentModel ? intentModel.intentStrength * 0.7 : 0.2;

    // 计算总体分数
    const overallScore = (selfReference * 0.25 + reflectiveBehavior * 0.25
      + selfPreservation * 0.25 + selfImprovement * 0.25);

    return {
      agentId,
      selfReference,
      reflectiveBehavior,
      selfPreservation,
      selfImprovement,
      overallScore,
    };
  }

  /**
   * 获取所有意识指标
   */
  getAllSelfAwarenessIndicators(): SelfAwarenessIndicators[] {
    const agents = this.emergenceMonitor.getActiveAgents();
    return agents.map(agentId => this.detectSelfAwareness(agentId));
  }

  /**
   * 重置
   */
  reset(): void {
    this.intentModels.clear();
    this.consistencyTrackings.clear();
    console.log('[Continuity] Continuity analyzer reset');
  }
}
