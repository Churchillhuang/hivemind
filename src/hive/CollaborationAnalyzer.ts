/**
 * Collaboration Analyzer
 *
 * 协作分析：事件流分析、协作热力图、涌现指标
 */

import { EmergenceMonitor } from './EmergenceMonitor.js';

/**
 * 协作指标
 */
export interface CollaborationMetrics {
  totalInteractions: number;
  avgInteractionsPerAgent: number;
  mostActiveAgent: string;
  mostCollaborativeAgent: string;
  interactionTypeDistribution: Map<string, number>;
  collaborationStrength: number;  // 0-1
}

/**
 * 涌现指标
 */
export interface EmergenceMetrics {
  agency: number;  // 0-1 - 自主性
  coherence: number;  // 0-1 - 连贯性
  complexity: number;  // 0-1 - 复杂性
  autonomy: number;  // 0-1 - 自主性
  selfAwareness: number;  // 0-1 - 自我意识
}

/**
 * 事件流分析结果
 */
export interface EventFlowAnalysis {
  patterns: string[];  // 识别的模式
  bottlenecks: string[];  // 瓶颈点
  deadEnds: string[];  // 死胡同
  loops: string[];  // 循环
  emergenceScore: number;  // 0-1
}

/**
 * 协作分析器
 */
export class CollaborationAnalyzer {
  private emergenceMonitor: EmergenceMonitor;

  constructor(emergenceMonitor: EmergenceMonitor) {
    this.emergenceMonitor = emergenceMonitor;
  }

  /**
   * 分析协作指标
   */
  analyzeCollaboration(): CollaborationMetrics {
    const graph = this.emergenceMonitor.getInteractionGraph();
    const traces = this.emergenceMonitor.getEventTraces();

    const totalInteractions = graph.edges.length;
    const agents = graph.nodes;
    const avgInteractionsPerAgent = agents.length > 0 ? totalInteractions / agents.length : 0;

    // 最活跃的 agent（发出/接收最多交互）
    const interactionCount = new Map<string, number>();
    for (const edge of graph.edges) {
      interactionCount.set(edge.from, (interactionCount.get(edge.from) || 0) + edge.weight);
      interactionCount.set(edge.to, (interactionCount.get(edge.to) || 0) + edge.weight);
    }
    const mostActiveAgent = Array.from(interactionCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    // 最协作的 agent（与最多不同的 agents 交互）
    const collaborationMap = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      if (!collaborationMap.has(edge.from)) {
        collaborationMap.set(edge.from, new Set());
      }
      collaborationMap.get(edge.from)!.add(edge.to);

      if (!collaborationMap.has(edge.to)) {
        collaborationMap.set(edge.to, new Set());
      }
      collaborationMap.get(edge.to)!.add(edge.from);
    }
    const mostCollaborativeAgent = Array.from(collaborationMap.entries())
      .sort((a, b) => b[1].size - a[1].size)[0]?.[0] || 'none';

    // 交互类型分布
    const typeDistribution = new Map<string, number>();
    for (const edge of graph.edges) {
      typeDistribution.set(edge.type, (typeDistribution.get(edge.type) || 0) + 1);
    }

    // 协作强度（简化：交互密度）
    const collaborationStrength = Math.min(1, totalInteractions / (agents.length * 5));

    return {
      totalInteractions,
      avgInteractionsPerAgent,
      mostActiveAgent,
      mostCollaborativeAgent,
      interactionTypeDistribution: typeDistribution,
      collaborationStrength,
    };
  }

  /**
   * 分析事件流
   */
  analyzeEventFlow(): EventFlowAnalysis {
    const traces = this.emergenceMonitor.getEventTraces();
    const graph = this.emergenceMonitor.getInteractionGraph();

    const patterns: string[] = [];
    const bottlenecks: string[] = [];
    const deadEnds: string[] = [];
    const loops: string[] = [];

    // 检测模式
    const agentSequences = new Map<string, number>();
    for (let i = 0; i < traces.length - 1; i++) {
      if (traces[i].targetAgentId && traces[i + 1].sourceAgentId === traces[i].targetAgentId) {
        const sequence = `${traces[i].sourceAgentId}->${traces[i].targetAgentId}->${traces[i + 1].targetAgentId}`;
        agentSequences.set(sequence, (agentSequences.get(sequence) || 0) + 1);
      }
    }

    // 识别重复模式
    for (const [sequence, count] of agentSequences.entries()) {
      if (count > 5) {
        patterns.push(`Pattern: ${sequence} (repeated ${count} times)`);
      }
    }

    // 检测瓶颈（高负载节点）
    const nodeLoad = new Map<string, number>();
    for (const edge of graph.edges) {
      nodeLoad.set(edge.to, (nodeLoad.get(edge.to) || 0) + edge.weight);
    }

    const avgLoad = Array.from(nodeLoad.values()).reduce((sum, val) => sum + val, 0) / nodeLoad.size;
    for (const [node, load] of nodeLoad.entries()) {
      if (load > avgLoad * 3) {
        bottlenecks.push(`Bottleneck: ${node} (${load} interactions)`);
      }
    }

    // 检测死胡同（只接收但不发送）
    const outgoingEdges = new Set<string>();
    const incomingEdges = new Set<string>();
    for (const edge of graph.edges) {
      outgoingEdges.add(edge.from);
      incomingEdges.add(edge.to);
    }

    for (const node of incomingEdges) {
      if (!outgoingEdges.has(node)) {
        deadEnds.push(`Dead end: ${node} (only incoming)`);
      }
    }

    // 检测循环（简化检测）
    const visited = new Set<string>();
    for (const edge of graph.edges) {
      if (!visited.has(edge.from)) {
        visited.add(edge.from);
        const path = this.findPath(edge.from, edge.to, graph.edges, new Set([edge.from]));
        if (path && path.length > 3) {
          loops.push(`Loop: ${path.join(' -> ')}`);
        }
      }
    }

    // 计算涌现分数
    const emergenceScore = this.calculateEmergenceScore(patterns.length, loops.length, bottlenecks.length);

    return {
      patterns,
      bottlenecks,
      deadEnds,
      loops,
      emergenceScore,
    };
  }

  /**
   * 查找路径
   */
  private findPath(from: string, to: string, edges: any[], visited: Set<string>): string[] | null {
    const stack: { node: string; path: string[] }[] = [{ node: from, path: [from] }];

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;

      for (const edge of edges) {
        if (edge.from === node && !visited.has(edge.to)) {
          const newPath = [...path, edge.to];

          if (edge.to === to) {
            return newPath;
          }

          visited.add(edge.to);
          stack.push({ node: edge.to, path: newPath });
        }
      }
    }

    return null;
  }

  /**
   * 计算涌现分数
   */
  private calculateEmergenceScore(patterns: number, loops: number, bottlenecks: number): number {
    const complexity = Math.min(1, (patterns + loops) / 20);
    const efficiency = Math.max(0, 1 - bottlenecks / 10);
    return (complexity * 0.6 + efficiency * 0.4);
  }

  /**
   * 计算涌现指标
   */
  calculateEmergenceMetrics(): EmergenceMetrics {
    const collaboration = this.analyzeCollaboration();
    const flow = this.analyzeEventFlow();

    // Agency: 自主性 - 基于协作强度和交互类型多样性
    const typeDiversity = collaboration.interactionTypeDistribution.size / 4;  // 假设最多 4 种类型
    const agency = (collaboration.collaborationStrength * 0.6 + typeDiversity * 0.4);

    // Coherence: 连贯性 - 基于模式一致性
    const coherence = Math.min(1, flow.patterns.length / 10);

    // Complexity: 复杂性 - 基于事件流复杂度
    const complexity = flow.emergenceScore;

    // Autonomy: 自主性 - 基于循环数量（自主循环 = 自主行为）
    const autonomy = Math.min(1, flow.loops.length / 5);

    // Self-Awareness: 自我意识 - 简化：based on feedback loops
    const selfAwareness = Math.min(1, flow.loops.length / 3);

    return {
      agency,
      coherence,
      complexity,
      autonomy,
      selfAwareness,
    };
  }
}
