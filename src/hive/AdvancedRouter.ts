/**
 * Advanced Router - 高级路由引擎
 *
 * 功能：
 * - 优先级队列管理
 * - 负载均衡
 * - Agent 特化
 * - 任务依赖 DAG
 */

import type { BaseAgent } from '../core/Agent.js';
import { getGlobalEventBus } from '../events/EventBus.js';
import type { Event } from '../events/Event.js';
import { EventType } from '../events/Event.js';
import type { HiveConfig } from '../hive/HiveConfig.js';
import type { Task, TaskResult } from './Orchestrator.js';

/**
 * 任务优先级
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * 任务依赖
 */
export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  completed: string[];
  failed: string[];
}

/**
 * Agent 负载
 */
export interface AgentLoad {
  agentId: string;
  currentTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgProcessingTime: number; // ms
  lastActive: number;
  specializations: string[];
}

/**
 * 任务优先级配置
 */
export interface TaskPriorityConfig {
  defaultPriority: TaskPriority;
  priorityWeights: Record<TaskPriority, number>;
  ageBonus: number; // 每增加 1 秒的优先级加成
}

/**
 * 负载均衡策略
 */
export type LoadBalancingStrategy = 'round-robin' | 'least-loaded' | 'random' | 'specialized';

/**
 * 高级路由配置
 */
export interface AdvancedRouterConfig {
  priorityConfig?: TaskPriorityConfig;
  loadBalancing?: LoadBalancingStrategy;
  enableTaskDeps?: boolean;
  maxQueueSize?: number;
  priorityQueueSize?: number;
}

/**
 * 带优先级的任务
 */
export interface PriorityTask extends Task {
  priority: TaskPriority;
  createdAt: number;
  queuePosition: number;
  dependentTask?: string[];
}

/**
 * 高级路由器
 */
export class AdvancedRouter {
  private config: Required<AdvancedRouterConfig>;
  private hiveConfig: HiveConfig;

  // 任务队列
  private taskQueue: Map<string, PriorityTask> = new Map();
  private priorityQueue: Map<TaskPriority, PriorityTask[]> = new Map();

  // Agent 负载跟踪
  private agentLoads: Map<string, AgentLoad> = new Map();

  // 任务依赖 DAG
  private taskDependencies: Map<string, TaskDependency> = new Map();

  // 路由统计
  private stats = {
    routed: 0,
    queued: 0,
    failed: 0,
    avgRoutingTime: 0,
  };

  // 循环状态
  private roundRobinIndex = 0;

  constructor(config: AdvancedRouterConfig, hiveConfig: HiveConfig) {
    this.config = {
      priorityConfig: config.priorityConfig || {
        defaultPriority: 'normal',
        priorityWeights: {
          critical: 10,
          high: 5,
          normal: 1,
          low: 0.5,
        },
        ageBonus: 0.1, // 每秒 +0.1
      },
      loadBalancing: config.loadBalancing || 'least-loaded',
      enableTaskDeps: config.enableTaskDeps !== false,
      maxQueueSize: config.maxQueueSize || 1000,
      priorityQueueSize: config.priorityQueueSize || 100,
      ...config,
    };

    this.hiveConfig = hiveConfig;

    // 初始化优先级队列
    this.priorityQueue.set('critical', []);
    this.priorityQueue.set('high', []);
    this.priorityQueue.set('normal', []);
    this.priorityQueue.set('low', []);
  }

  /**
   * 添加任务到队列
   */
  async enqueue(task: Task, priority?: TaskPriority): Promise<{ queued: boolean; taskId: string }> {
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 检查队列大小
    if (this.taskQueue.size >= this.config.maxQueueSize) {
      console.log(`[Router] Queue full (${this.config.maxQueueSize}), rejecting task`);
      this.stats.failed++;
      return { queued: false, taskId };
    }

    const priorityTask: PriorityTask = {
      ...task,
      id: taskId,
      priority: priority || this.config.priorityConfig.defaultPriority,
      createdAt: Date.now(),
      queuePosition: this.taskQueue.size + 1,
    };

    // 添加到队列
    this.taskQueue.set(taskId, priorityTask);

    // 添加到优先级队列
    const priorityQueue = this.priorityQueue.get(priorityTask.priority);
    if (priorityQueue && priorityQueue.length < this.config.priorityQueueSize) {
      priorityQueue.push(priorityTask);
    } else {
      console.log(`[Router] Priority queue full for ${priorityTask.priority}`);
      this.stats.failed++;
      return { queued: false, taskId };
    }

    // 如果有任务依赖，注册
    if (this.config.enableTaskDeps && priorityTask.dependentTask && priorityTask.dependentTask.length > 0) {
      this.registerDependency(taskId, priorityTask.dependentTask);
    }

    this.stats.queued++;

    console.log(`[Router] Task enqueued: ${taskId} (${priorityTask.priority})`);

    return { queued: true, taskId };
  }

  /**
   * 路由任务到 Agent
   */
  async route(agentPool: BaseAgent[]): Promise<{ taskId: string; agentId: string } | null> {
    const startTime = Date.now();

    // 获取下一个任务
    const task = this.getNextTask();
    if (!task) {
      return null;
    }

    // 选择最佳 Agent
    const targetAgent = await this.selectBestAgent(task, agentPool);
    if (!targetAgent) {
      console.log(`[Router] No available agent for task: ${task.id}`);
      this.stats.failed++;
      return null;
    }

    // 更新负载
    this.updateAgentLoad(targetAgent.id, 1, 0, 0);

    // 移除任务
    this.taskQueue.delete(task.id);
    const queue = this.priorityQueue.get(task.priority);
    if (queue) {
      const index = queue.findIndex(t => t.id === task.id);
      if (index > -1) {
        queue.splice(index, 1);
      }
    }

    this.stats.routed++;

    // 更新平均路由时间
    const routingTime = Date.now() - startTime;
    this.stats.avgRoutingTime = (this.stats.avgRoutingTime * (this.stats.routed - 1) + routingTime) / this.stats.routed;

    console.log(`[Router] Task routed: ${task.id} → ${targetAgent.id} (${task.priority})`);

    return {
      taskId: task.id,
      agentId: targetAgent.id,
    };
  }

  /**
   * 获取下一个任务（优先级队列）
   */
  private getNextTask(): PriorityTask | null {
    // 按优先级顺序检查队列
    const priorities: TaskPriority[] = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.priorityQueue.get(priority);
      if (queue && queue.length > 0) {
        // 按年龄排序（年龄 + 权重）
        const now = Date.now();
        const ageBonusWeight = this.config.priorityConfig.ageBonus;

        queue.sort((a, b) => {
          const weightA = this.config.priorityConfig.priorityWeights[a.priority];
          const weightB = this.config.priorityConfig.priorityWeights[b.priority];

          const ageA = (now - a.createdAt) / 1000; // 秒
          const ageB = (now - b.createdAt) / 1000;

          const scoreA = weightA + (ageA * ageBonusWeight);
          const scoreB = weightB + (ageB * ageBonusWeight);

          return scoreB - scoreA; // 降序
        });

        // 检查任务依赖
        const task = queue[0];
        if (this.config.enableTaskDeps && this.taskDependencies.has(task.id)) {
          const dep = this.taskDependencies.get(task.id)!;
          const isReady = this.checkDependencyReady(dep);

          if (!isReady) {
            // 任务依赖未满足，跳过
            console.log(`[Router] Task ${task.id} dependencies not ready`);
            return null;
          }
        }

        return task;
      }
    }

    return null;
  }

  /**
   * 选择最佳 Agent
   */
  private async selectBestAgent(task: PriorityTask, agents: BaseAgent[]): Promise<BaseAgent | null> {
    const availableAgents = agents.filter(a => a.isRunning);

    if (availableAgents.length === 0) {
      return null;
    }

    switch (this.config.loadBalancing) {
      case 'round-robin':
        return this.roundRobinSelect(task, availableAgents);

      case 'least-loaded':
        return this.leastLoadedSelect(task, availableAgents);

      case 'random':
        return this.randomSelect(task, availableAgents);

      case 'specialized':
        return this.specializedSelect(task, availableAgents);

      default:
        return availableAgents[0];
    }
  }

  /**
   * 轮询选择
   */
  private roundRobinSelect(task: PriorityTask, agents: BaseAgent[]): BaseAgent {
    const index = this.roundRobinIndex % agents.length;
    this.roundRobinIndex++;
    return agents[index];
  }

  /**
   * 负载最低选择
   */
  private leastLoadedSelect(task: PriorityTask, agents: BaseAgent[]): BaseAgent {
    let bestAgent = agents[0];
    let minLoad = Number.MAX_VALUE;

    for (const agent of agents) {
      const load = this.agentLoads.get(agent.id);
      const currentTasks = load?.currentTasks || 0;

      if (currentTasks < minLoad) {
        minLoad = currentTasks;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * 随机选择
   */
  private randomSelect(task: PriorityTask, agents: BaseAgent[]): BaseAgent {
    const index = Math.floor(Math.random() * agents.length);
    return agents[index];
  }

  /**
   * 专业化选择
   */
  private specializedSelect(task: PriorityTask, agents: BaseAgent[]): BaseAgent {
    // 根据任务类型选择最专业的 Agent
    const taskType = this.inferTaskType(task);
    let bestAgent = agents[0];
    let bestScore = 0;

    for (const agent of agents) {
      const load = this.agentLoads.get(agent.id);
      const specializations = load?.specializations || [];

      // 计算匹配度
      let score = 0;
      for (const spec of specializations) {
        if (taskType.includes(spec)) {
          score += 1;
        }
        if (task.content.includes(spec)) {
          score += 0.5;
        }
      }

      // 考虑负载
      const currentTasks = load?.currentTasks || 0;
      const loadPenalty = currentTasks * 0.5;

      score -= loadPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent || agents[0];
  }

  /**
   * 推断任务类型
   */
  private inferTaskType(task: PriorityTask): string[] {
    const types: string[] = [];
    const content = task.content.toLowerCase();

    if (content.includes('write') || content.includes('create') || content.includes('compose')) {
      types.push('content_writing');
    }
    if (content.includes('search') || content.includes('find') || content.includes('lookup')) {
      types.push('search');
    }
    if (content.includes('analyze') || content.includes('understand') || content.includes('explain')) {
      types.push('analysis');
    }
    if (content.includes('schedule') || content.includes('calendar') || content.includes('appointment')) {
      types.push('scheduling');
    }
    if (content.includes('email') || content.includes('message') || content.includes('send')) {
      types.push('messaging');
    }

    return types;
  }

  /**
   * 注册 Agent 负载
   */
  registerAgentLoad(agentId: string, specializations: string[]): void {
    this.agentLoads.set(agentId, {
      agentId,
      currentTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgProcessingTime: 0,
      lastActive: Date.now(),
      specializations,
    });

    console.log(`[Router] Agent load registered: ${agentId} (${specializations.join(', ')})`);
  }

  /**
   * 更新 Agent 负载
   */
  updateAgentLoad(agentId: string, currentDelta: number, completedDelta: number, failedDelta: number): void {
    const load = this.agentLoads.get(agentId);

    if (!load) {
      return;
    }

    load.currentTasks += currentDelta;
    load.completedTasks += completedDelta;
    load.failedTasks += failedDelta;
    load.lastActive = Date.now();

    this.agentLoads.set(agentId, load);
  }

  /**
   * 记录任务完成时间
   */
  recordTaskCompletion(agentId: string, processingTime: number): void {
    const load = this.agentLoads.get(agentId);

    if (!load) {
      return;
    }

    const completedTasks = load.completedTasks;
    const avgTime = load.avgProcessingTime;

    load.avgProcessingTime = (avgTime * completedTasks + processingTime) / (completedTasks + 1);
    load.lastActive = Date.now();

    this.agentLoads.set(agentId, load);
  }

  /**
   * 注册任务依赖
   */
  registerDependency(taskId: string, dependsOn: string[]): void {
    this.taskDependencies.set(taskId, {
      taskId,
      dependsOn,
      completed: [],
      failed: [],
    });

    console.log(`[Router] Dependency registered: ${taskId} depends on [${dependsOn.join(', ')}]`);
  }

  /**
   * 检查依赖是否就绪
   */
  private checkDependencyReady(dep: TaskDependency): boolean {
    // 所有依赖任务必须完成
    const allCompleted = dep.dependsOn.every(depId => dep.completed.includes(depId));

    // 如果有依赖任务失败，则任务无法完成
    if (dep.failed.length > 0) {
      return false;
    }

    return allCompleted;
  }

  /**
   * 标记任务完成（用于依赖跟踪）
   */
  markTaskCompleted(taskId: string): void {
    // 检查是否有其他任务依赖此任务
    for (const [depTaskId, dep] of this.taskDependencies.entries()) {
      if (dep.dependsOn.includes(taskId)) {
        dep.completed.push(taskId);
        this.taskDependencies.set(depTaskId, dep);

        console.log(`[Router] Dependency satisfied: ${depTaskId} ← ${taskId}`);
      }
    }
  }

  /**
   * 标记任务失败
   */
  markTaskFailed(taskId: string): void {
    // 检查是否有其他任务依赖此任务
    for (const [depTaskId, dep] of this.taskDependencies.entries()) {
      if (dep.dependsOn.includes(taskId)) {
        dep.failed.push(taskId);
        this.taskDependencies.set(depTaskId, dep);

        console.log(`[Router] Dependency failed: ${depTaskId} ← ${taskId}`);
      }
    }
  }

  /**
   * 获取队列统计
   */
  getQueueStats(): {
    total: number;
    byPriority: Record<TaskPriority, number>;
    avgWaitTime: number;
  } {
    const now = Date.now();
    let totalWaitTime = 0;

    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const [taskId, task] of this.taskQueue.entries()) {
      byPriority[task.priority]++;
      totalWaitTime += (now - task.createdAt);
    }

    const avgWaitTime = this.taskQueue.size > 0 ? totalWaitTime / this.taskQueue.size : 0;

    return {
      total: this.taskQueue.size,
      byPriority,
      avgWaitTime,
    };
  }

  /**
   * 获取路由统计
   */
  getRoutingStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 获取 Agent 负载统计
   */
  getAgentStats(): AgentLoad[] {
    return Array.from(this.agentLoads.values());
  }

  /**
   * 重置优先级队列
   */
  reset() {
    this.taskQueue.clear();
    this.priorityQueue.forEach(queue => queue.length = 0);
    this.taskDependencies.clear();
    this.roundRobinIndex = 0;

    console.log('[Router] Reset');
  }
}
