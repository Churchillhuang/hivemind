/**
 * Orchestrator - 任务路由和 Agent 生命周期管理
 *
 * 使用 L0 记忆（零记忆），专注于路由决策
 */

import { BaseAgent } from '../core/Agent.js';
import { Event, EventType } from '../events/Event.js';
import { EventBus } from '../events/EventBus.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

/**
 * Task - 待处理任务
 */
export interface Task {
  id: string;
  type: 'message' | 'action' | 'query';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sourceAgent: string;
  payload: {
    [key: string]: any;
  };
  createdAt: number;
  status: 'pending' | 'Processing' | 'completed' | 'failed';
  assignedAgent?: string;
  result?: any;
  error?: string;
}

/**
 * AgentInfo - Agent 状态信息
 */
export interface AgentInfo {
  id: string;
  type: 'system' | 'functional';
  role: string;
  capabilities: string[];
  isRunning: boolean;
  currentTasks: string[];
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    avgProcessingTime: number;
  };
}

/**
 * RoutingDecision - 路由决策
 */
export interface RoutingDecision {
  taskId: string;
  targetAgent: string;
  reasoning: string;
  newAgent?: {
    type: 'system' | 'functional';
    role: string;
    description: string;
  };
}

export class Orchestrator extends BaseAgent {
  private hiveConfig: HiveConfig;
  private taskQueue: Map<string, Task> = new Map();
  private agents: Map<string, AgentInfo> = new Map();
  private routingRules: Map<string, string[]> = new Map(); // 规则 -> agent IDs

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super({
      id: config.id,
      role: config.role,
      type: 'system',
      description: config.description,
    }, eventBus);

    this.hiveConfig = hiveConfig;
    this.initializeRoutingRules();
  }

  /**
   * 初始化路由规则
   */
  private initializeRoutingRules(): void {
    // 系统级 Agents 的固定路由
    this.routingRules.set('message', ['interface_agent_001']);
    this.routingRules.set('memory_query', ['memory_agent_001']);
    this.routingRules.set('reflection', ['reflection_agent_001']);

    // 功能级 Agents 的动态路由（示例）
    this.routingRules.set('moltbook_post', ['moltbook_bot']);
    this.routingRules.set('wordpress_upload', ['wp_uploader']);
    this.routingRules.set('file_analysis', ['file_analyzer']);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 注册已知的系统级 agents
    this.registerAgent({
      id: 'interface_agent_001',
      type: 'system',
      role: 'Interface Agent',
      capabilities: ['handle_user_message', '对话交互'],
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    this.registerAgent({
      id: 'memory_agent_001',
      type: 'system',
      role: 'Memory Agent',
      capabilities: ['memory_query', 'memory_retrieval', '记忆检索'],
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    // 订阅事件
    this.subscribeTo(EventType.NEW_MESSAGE);
    this.subscribeTo(EventType.TASK_REQUESTED);
    this.subscribeTo(EventType.AGENT_STARTED);
    this.subscribeTo(EventType.AGENT_STOPPED);
    this.subscribeTo(EventType.MESSAGE_PROCESSED);

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        rules: Array.from(this.routingRules.keys()),
      },
    });

    console.log(`[Orchestrator ${this.id}] Started`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    await this.eventBus?.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });

    console.log(`[Orchestrator ${this.id}] Stopped`);
  }

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case EventType.NEW_MESSAGE:
        await this.handleNewMessage(event);
        break;

      case EventType.TASK_REQUESTED:
        await this.handleTaskRequest(event);
        break;

      case EventType.AGENT_STARTED:
        await this.handleAgentStarted(event);
        break;

      case EventType.AGENT_STOPPED:
        await this.handleAgentStopped(event);
        break;

      case EventType.MESSAGE_PROCESSED:
        await this.handleMessageProcessed(event);
        break;
    }
  }

  /**
   * 处理新消息
   */
  private async handleNewMessage(event: Event): Promise<void> {
    const message = event.payload as {
      id: string;
      content: string;
      userId?: string;
      channelId?: string;
    };

    console.log(`[Orchestrator ${this.id}] Routing message: ${message.content}`);

    // 创建任务
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'message',
      priority: 'medium',
      sourceAgent: event.sourceAgent,
      payload: message,
      createdAt: Date.now(),
      status: 'pending',
    };

    // 添加到队列
    this.taskQueue.set(task.id, task);

    // 路由决策
    const decision = this.routeTask(task);

    console.log(`[Orchestrator ${this.id}] Routing decision:`, decision);

    // 执行路由
    if (decision.newAgent) {
      await this.createAgent(decision.newAgent);
    }

    // 分配任务
    task.assignedAgent = decision.targetAgent;
    task.status = 'Processing';

    // 发布任务分配事件
    await this.eventBus?.publish({
      type: 'TASK_ASSIGNED',
      sourceAgent: this.id,
      payload: {
        taskId: task.id,
        targetAgent: decision.targetAgent,
        task: task,
      },
    });
  }

  /**
   * 处理任务请求
   */
  private async handleTaskRequest(event: Event): Promise<void> {
    const task = event.payload as Task;

    console.log(`[Orchestrator ${this.id}] Task requested:`, task);

    // 路由决策
    const decision = this.routeTask(task);

    // 执行路由
    if (decision.newAgent) {
      await this.createAgent(decision.newAgent);
    }

    // 分配任务
    task.assignedAgent = decision.targetAgent;
    task.status = 'Processing';

    // 发布任务分配事件
    await this.eventBus?.publish({
      type: 'TASK_ASSIGNED',
      sourceAgent: this.id,
      payload: {
        taskId: task.id,
        targetAgent: decision.targetAgent,
        task: task,
      },
    });
  }

  /**
   * 路由决策 - 简单规则引擎
   */
  private routeTask(task: Task): RoutingDecision {
    // MVP: 基于规则的简单路由
    // 后期可以扩展为基于 ML 或启发式算法

    // 消息类型 -> interface_agent
    if (task.type === 'message') {
      const targetAgents = this.routingRules.get('message') || [];
      return {
        taskId: task.id,
        targetAgent: targetAgents[0] || 'interface_agent_001',
        reasoning: 'Message routing to InterfaceAgent',
      };
    }

    // 记忆查询 -> memory_agent
    if (task.payload.query && task.sourceAgent !== 'memory_agent_001') {
      const targetAgents = this.routingRules.get('memory_query') || [];
      return {
        taskId: task.id,
        targetAgent: targetAgents[0] || 'memory_agent_001',
        reasoning: 'Memory query routing to MemoryAgent',
      };
    }

    // 默认: interface_agent
    const targetAgents = this.routingRules.get('message') || [];
    return {
      taskId: task.id,
      targetAgent: targetAgents[0] || 'interface_agent_001',
      reasoning: 'Default routing to InterfaceAgent',
    };
  }

  /**
   * 创建新 Agent（动态）
   */
  private async createAgent(config: {
    type: 'system' | 'functional';
    role: string;
    description: string;
  }): Promise<void> {
    console.log(`[Orchestrator ${this.id}] Creating agent: ${config.role}`);

    const agentId = `${config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 注册 Agent（实际创建由 AgentFactory 负责，这里先注册）
    this.registerAgent({
      id: agentId,
      type: config.type,
      role: config.role,
      capabilities: [], // TODO: 根据 role 推断
      isRunning: false,
      currentTasks: [],
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    });

    // 发布 Agent 创建事件
    await this.eventBus?.publish({
      type: 'AGENT_CREATE_REQUEST',
      sourceAgent: this.id,
      payload: {
        agentId,
        ...config,
      },
    });
  }

  /**
   * Agent 已启动
   */
  private async handleAgentStarted(event: Event): Promise<void> {
    const payload = event.payload as {
      agentId: string;
      role?: string;
    };

    const agent = this.agents.get(payload.agentId);
    if (agent) {
      agent.isRunning = true;
      console.log(`[Orchestrator ${this.id}] Agent started: ${payload.agentId}`);
    }
  }

  /**
   * Agent 已停止
   */
  private async handleAgentStopped(event: Event): Promise<void> {
    const payload = event.payload as {
      agentId: string;
      role?: string;
    };

    const agent = this.agents.get(payload.agentId);
    if (agent) {
      agent.isRunning = false;
      console.log(`[Orchestrator ${this.id}] Agent stopped: ${payload.agentId}`);
    }
  }

  /**
   * 消息已处理
   */
  private async handleMessageProcessed(event: Event): Promise<void> {
    const response = event.payload as {
      messageId: string;
      agentId: string;
    };

    console.log(`[Orchestrator ${this.id}] Message processed by ${response.agentId}`);

    // 更新 Agent 统计
    const agent = this.agents.get(response.agentId);
    if (agent) {
      agent.stats.tasksCompleted++;
    }

    // 标记任务完成
    for (const [taskId, task] of this.taskQueue.entries()) {
      if (task.assignedAgent === response.agentId && task.status === 'Processing') {
        task.status = 'completed';
        task.result = response;
        console.log(`[Orchestrator ${this.id}] Task ${taskId} completed`);
        break;
      }
    }
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: AgentInfo): void {
    this.agents.set(agent.id, agent);
    console.log(`[Orchestrator ${this.id}] Agent registered: ${agent.id} (${agent.role})`);
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    console.log(`[Orchestrator ${this.id}] Agent unregistered: ${agentId}`);
  }

  /**
   * 获取 Agent 信息
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取所有 Agents
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    totalTasks: number;
    byStatus: Record<string, number>;
    byAgent: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const task of this.taskQueue.values()) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      if (task.assignedAgent) {
        byAgent[task.assignedAgent] = (byAgent[task.assignedAgent] || 0) + 1;
      }
    }

    return {
      totalTasks: this.taskQueue.size,
      byStatus,
      byAgent,
    };
  }

  /**
   * 获取 Orchestrator 状态
   */
  getStatus(): {
    agents: number;
    tasks: number;
    rules: string[];
  } {
    return {
      agents: this.agents.size,
      tasks: this.taskQueue.size,
      rules: Array.from(this.routingRules.keys()),
    };
  }
}
