/**
 * Emergence Monitor
 *
 * 涌现监控：事件追踪、状态可视化、交互图谱、实时监控
 */

import type { Event } from "../events/Event.js";
import { getGlobalEventBus } from "../events/EventBus.js";

/**
 * 事件追踪记录
 */
export interface EventTrace {
  id: string;
  timestamp: number;
  type: string;
  sourceAgentId: string;
  targetAgentId?: string;
  payload: unknown;
  correlationId?: string;
}

/**
 * 状态快照
 */
export interface StateSnapshot {
  timestamp: number;
  agentId: string;
  state: string;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Agent 交互边
 */
export interface InteractionEdge {
  from: string;
  to: string;
  type: "message" | "task" | "notification" | "sync";
  weight: number;
  timestamp: number;
}

/**
 * 交互图谱
 */
export interface InteractionGraph {
  nodes: string[];
  edges: InteractionEdge[];
  lastUpdate: number;
}

/**
 * 实时监控数据
 */
export interface MonitoringData {
  timestamp: number;
  activeAgents: number;
  pendingTasks: number;
  systemLoad: number; // 0-1
  eventRate: number; // events/sec
  anomalyCount: number;
}

/**
 * 涌现监控器
 */
export class EmergenceMonitor {
  private eventBus = getGlobalEventBus();

  // 事件追踪
  private eventTraces: EventTrace[] = [];
  private maxTraceSize = 10000;

  // 状态快照
  private stateSnapshots: Map<string, StateSnapshot[]> = new Map();
  private maxSnapshotsPerAgent = 1000;

  // 交互图谱
  private interactionGraph: InteractionGraph = {
    nodes: [],
    edges: [],
    lastUpdate: Date.now(),
  };
  private interactionEdges: InteractionEdge[] = [];

  // 实时监控
  private monitoringData: MonitoringData[] = [];
  private monitoringInterval = 5000; // 5 秒
  private monitoringTimer?: NodeJS.Timeout;

  // 活跃 agents
  private activeAgents: Set<string> = new Set();

  // 事件数量统计
  private eventCount = 0;
  private eventCountStart = Date.now();

  // 订阅处理器数量
  private subscriptions: Array<{ event: string; unsubscribe: () => void }> = [];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听所有事件
    const unsubscribe = this.eventBus.subscribe("*", this.handleEvent.bind(this));
    this.subscriptions.push({ event: "*", unsubscribe });

    console.log("[Emergence] Emergence monitor started");
  }

  /**
   * 处理事件
   */
  private handleEvent(event: Event): void {
    this.eventCount++;

    // 创建事件追踪
    const trace: EventTrace = {
      id: `${event.id}_trace`,
      timestamp: event.timestamp,
      type: event.type,
      sourceAgentId: event.agentId || "system",
      targetAgentId: this.extractTargetAgent(event),
      payload: event.payload,
      correlationId: event.correlationId,
    };

    this.eventTraces.push(trace);

    // 限制追踪大小
    if (this.eventTraces.length > this.maxTraceSize) {
      this.eventTraces.shift();
    }

    // 更新交互图谱
    this.updateInteractionGraph(event);

    // 更新活跃 agents
    if (event.agentId) {
      this.activeAgents.add(event.agentId);
    }
  }

  /**
   * 提取目标 agent
   */
  private extractTargetAgent(event: Event): string | undefined {
    const payload = event.payload as { targetAgentId?: string; to?: string; agentId?: string };
    return payload.targetAgentId || payload.to || payload.agentId;
  }

  /**
   * 更新交互图谱
   */
  private updateInteractionGraph(event: Event): void {
    const source = event.agentId || "system";
    const target = this.extractTargetAgent(event);

    if (target && target !== source) {
      // 确定交互类型
      let type: InteractionEdge["type"] = "message";
      if (event.type.includes("task")) {
        type = "task";
      } else if (event.type.includes("notification")) {
        type = "notification";
      } else if (event.type.includes("sync")) {
        type = "sync";
      }

      // 查找现有边
      const existingEdge = this.interactionEdges.find(
        (e) => e.from === source && e.to === target && e.type === type,
      );

      if (existingEdge) {
        existingEdge.weight++;
        existingEdge.timestamp = event.timestamp;
      } else {
        const newEdge: InteractionEdge = {
          from: source,
          to: target,
          type,
          weight: 1,
          timestamp: event.timestamp,
        };

        this.interactionEdges.push(newEdge);
      }

      // 更新节点
      if (!this.interactionGraph.nodes.includes(source)) {
        this.interactionGraph.nodes.push(source);
      }
      if (!this.interactionGraph.nodes.includes(target)) {
        this.interactionGraph.nodes.push(target);
      }
    }

    this.interactionGraph.lastUpdate = event.timestamp;
  }

  /**
   * 记录状态快照
   */
  recordStateSnapshot(
    agentId: string,
    state: string,
    properties: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      agentId,
      state,
      properties: { ...properties },
      metadata: metadata || {},
    };

    if (!this.stateSnapshots.has(agentId)) {
      this.stateSnapshots.set(agentId, []);
    }

    const snapshots = this.stateSnapshots.get(agentId)!;
    snapshots.push(snapshot);

    // 限制大小
    if (snapshots.length > this.maxSnapshotsPerAgent) {
      snapshots.shift();
    }
  }

  /**
   * 开始实时监控
   */
  startMonitoring(): void {
    if (this.monitoringTimer) {
      console.log("[Emergence] Monitoring already started");
      return;
    }

    this.monitoringTimer = setInterval(() => this.collectMonitoringData(), this.monitoringInterval);

    console.log("[Emergence] Real-time monitoring started");
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log("[Emergence] Real-time monitoring stopped");
  }

  /**
   * 收集监控数据
   */
  private collectMonitoringData(): void {
    const now = Date.now();

    // 计算事件速率
    const timeSpan = (now - this.eventCountStart) / 1000; // 秒
    const eventRate = this.eventCount / timeSpan;

    // 估算系统负载（简化）
    const systemLoad = Math.min(
      1,
      this.activeAgents.size / 10 + this.interactionEdges.length / 100,
    );

    const data: MonitoringData = {
      timestamp: now,
      activeAgents: this.activeAgents.size,
      pendingTasks: this.eventTraces.filter((t) => t.type.includes("task")).length,
      systemLoad,
      eventRate,
      anomalyCount: 0, // 将从 MetricsTracker 获取
    };

    this.monitoringData.push(data);

    // 限制大小
    if (this.monitoringData.length > 1000) {
      this.monitoringData.shift();
    }

    console.log(
      `[Emergence] Monitoring: ${data.activeAgents} agents, ${data.pendingTasks} tasks, load: ${(data.systemLoad * 100).toFixed(0)}%`,
    );
  }

  /**
   * 获取事件追踪
   */
  getEventTraces(agentId?: string, limit?: number, since?: number): EventTrace[] {
    let traces = [...this.eventTraces];

    if (agentId) {
      traces = traces.filter((t) => t.sourceAgentId === agentId || t.targetAgentId === agentId);
    }

    if (since) {
      traces = traces.filter((t) => t.timestamp >= since);
    }

    const ordered = traces.toReversed(); // 最新的在前
    return limit ? ordered.slice(0, limit) : ordered;
  }

  /**
   * 获取状态快照
   */
  getStateSnapshots(agentId?: string, since?: number): StateSnapshot[] {
    if (agentId) {
      const snapshots = this.stateSnapshots.get(agentId) || [];
      const filtered = since ? snapshots.filter((s) => s.timestamp >= since) : snapshots;
      return filtered.toReversed();
    }

    // 返回所有 agent 的快照，反转时间顺序
    const allSnapshots: StateSnapshot[] = [];
    for (const snapshots of this.stateSnapshots.values()) {
      allSnapshots.push(...snapshots);
    }
    const filtered = since ? allSnapshots.filter((s) => s.timestamp >= since) : allSnapshots;
    return filtered.toSorted((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取交互图谱
   */
  getInteractionGraph(since?: number): InteractionGraph {
    let edges = [...this.interactionEdges];

    if (since) {
      edges = edges.filter((e) => e.timestamp >= since);
    }

    // 重建节点列表
    const nodes = new Set<string>();
    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }

    return {
      nodes: Array.from(nodes),
      edges,
      lastUpdate: this.interactionGraph.lastUpdate,
    };
  }

  /**
   * 获取监控数据
   */
  getMonitoringData(since?: number): MonitoringData[] {
    let data = [...this.monitoringData];

    if (since) {
      data = data.filter((d) => d.timestamp >= since);
    }

    return data;
  }

  /**
   * 生成事件流可视化（JSON 格式）
   */
  generateEventFlowVisualization(
    agentId?: string,
    since?: number,
  ): {
    nodes: Array<{ id: string; type: string }>;
    edges: Array<{ from: string; to: string; type: string; weight: number }>;
    timeline: Array<{ time: number; type: string; from: string; to?: string }>;
  } {
    const traces = this.getEventTraces(agentId, undefined, since);
    const nodes = new Map<string, { id: string; type: string }>();
    const edges = new Map<string, { from: string; to: string; type: string; weight: number }>();
    const timeline: Array<{ time: number; type: string; from: string; to?: string }> = [];

    for (const trace of traces) {
      // 处理节点
      if (!nodes.has(trace.sourceAgentId)) {
        nodes.set(trace.sourceAgentId, { id: trace.sourceAgentId, type: "source" });
      }
      if (trace.targetAgentId && !nodes.has(trace.targetAgentId)) {
        nodes.set(trace.targetAgentId, { id: trace.targetAgentId, type: "target" });
      }

      // 处理边
      if (trace.targetAgentId) {
        const edgeKey = `${trace.sourceAgentId}-${trace.targetAgentId}-${trace.type}`;
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            from: trace.sourceAgentId,
            to: trace.targetAgentId,
            type: trace.type,
            weight: 0,
          });
        }
        edges.get(edgeKey)!.weight++;
      }

      // 处理时间线
      timeline.push({
        time: trace.timestamp,
        type: trace.type,
        from: trace.sourceAgentId,
        to: trace.targetAgentId,
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      timeline,
    };
  }

  /**
   * 生成状态转移图
   */
  generateStateTransitionDiagram(agentId?: string): {
    nodes: Array<{ id: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; weight: number }>;
  } {
    const snapshots = this.getStateSnapshots(agentId);
    const stateTransitions = new Map<string, number>();

    for (let i = 1; i < snapshots.length; i++) {
      const fromState = snapshots[i - 1].state;
      const toState = snapshots[i].state;

      const key = `${fromState}->${toState}`;
      stateTransitions.set(key, (stateTransitions.get(key) || 0) + 1);
    }

    // 收集所有状态
    const states = new Set<string>();
    for (const transition of stateTransitions.keys()) {
      const [from, to] = transition.split("->");
      states.add(from);
      states.add(to);
    }

    // 生成节点位置（简化布局）
    const nodes: Array<{ id: string; x: number; y: number }> = [];
    const stateArray = Array.from(states);
    for (let i = 0; i < stateArray.length; i++) {
      const angle = (i / stateArray.length) * 2 * Math.PI;
      nodes.push({
        id: stateArray[i],
        x: Math.cos(angle) * 100,
        y: Math.sin(angle) * 100,
      });
    }

    // 生成边
    const edges: Array<{ from: string; to: string; weight: number }> = [];
    for (const [transition, weight] of stateTransitions.entries()) {
      const [from, to] = transition.split("->");
      edges.push({ from, to, weight });
    }

    return { nodes, edges };
  }

  /**
   * 生成协作热力图
   */
  generateCollaborationHeatmap(): {
    agents: string[];
    matrix: number[][];
  } {
    const agents = Array.from(this.activeAgents);
    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i < agents.length; i++) {
      matrix[i] = Array.from({ length: agents.length }, () => 0);
    }

    // 填充矩阵
    for (const edge of this.interactionEdges) {
      const fromIndex = agents.indexOf(edge.from);
      const toIndex = agents.indexOf(edge.to);

      if (fromIndex !== -1 && toIndex !== -1) {
        matrix[fromIndex][toIndex] += edge.weight;
      }
    }

    return { agents, matrix };
  }

  /**
   * 获取活跃 agents
   */
  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  /**
   * 重置
   */
  reset(): void {
    this.eventTraces = [];
    this.stateSnapshots.clear();
    this.interactionEdges = [];
    this.interactionGraph = {
      nodes: [],
      edges: [],
      lastUpdate: Date.now(),
    };
    this.monitoringData = [];
    this.activeAgents.clear();
    this.eventCount = 0;
    this.eventCountStart = Date.now();

    if (this.monitoringTimer) {
      this.stopMonitoring();
    }

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];

    console.log("[Emergence] Emergence monitor reset");
  }
}
