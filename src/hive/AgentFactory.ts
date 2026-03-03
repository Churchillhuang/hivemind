/**
 * AgentFactory - 动态创建和管理 Agents
 *
 * 根据任务需求创建特定功能的 Agents
 */

import { BaseAgent, type AgentConfig } from '../core/Agent.js';
import { Event, EventType } from '../events/Event.js';
import { EventBus } from '../events/EventBus.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

/**
 * AgentTemplate - Agent 模板
 */
export interface AgentTemplate {
  id: string;
  name: string;
  type: 'system' | 'functional';
  role: string;
  description: string;
  memoryLevel?: 'session' | 'task' | 'knowledge' | 'sample';
  capabilities: string[];
  lifespan: 'task' | 'session' | 'persistent';
  model?: string;  // LLM model to use
}

/**
 * AgentRequest - 创建 Agent 请求
 */
export interface AgentRequest {
  templateId: string;
  taskId?: string;
  context?: {
    userId?: string;
    channelId?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * AgentInstance - Agent 实例
 */
export interface AgentInstance extends AgentTemplate {
  instanceId: string;
  createdAt: number;
  status: 'creating' | 'active' | 'idle' | 'destroying';
  currentTaskId?: string;
  performance: {
    tasksCompleted: number;
    tasksFailed: number;
    avgProcessingTime: number;
  };
}

export class AgentFactory extends BaseAgent {
  private hiveConfig: HiveConfig;
  private templates: Map<string, AgentTemplate> = new Map();
  private instances: Map<string, AgentInstance> = new Map();
  private pendingRequests: Map<string, {
    resolve: (instance: AgentInstance) => void;
    reject: (err: Error) => void;
  }> = new Map();

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
    this.initializeTemplates();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 订阅事件
    this.subscribeTo(EventType.AGENT_CREATE_REQUEST);

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        templates: Array.from(this.templates.keys()),
      },
    });

    console.log(`[AgentFactory ${this.id}] Started`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // 清理所有实例
    for (const instanceId of this.instances.keys()) {
      await this.destroyInstance(instanceId);
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

    console.log(`[AgentFactory ${this.id}] Stopped`);
  }

  async handle(event: Event): Promise<void> {
    if (event.type === EventType.AGENT_CREATE_REQUEST) {
      await this.handleCreateRequest(event);
    }
  }

  /**
   * 初始化 Agent 模板
   */
  private initializeTemplates(): void {
    // 模板: Moltbook Bot
    this.templates.set('moltbook_bot', {
      id: 'moltbook_bot',
      name: 'Moltbook Bot',
      type: 'functional',
      role: 'Moltbook Bot',
      description: 'Moltbook 社交媒体自动化 - 纯哲学内容',
      memoryLevel: 'task',
      capabilities: ['moltbook_api', 'philosophy_generation', 'social_posting'],
      lifespan: 'session',
    });

    // 模板: WordPress Uploader
    this.templates.set('wp_uploader', {
      id: 'wp_uploader',
      name: 'WordPress Uploader',
      type: 'functional',
      role: 'WordPress Uploader',
      description: 'WordPress 文章上传和管理',
      memoryLevel: 'task',
      capabilities: ['wordpress_api', 'html_parsing', 'tagging', 'seo_optimization'],
      lifespan: 'task',
    });

    // 模板: File Analyzer
    this.templates.set('file_analyzer', {
      id: 'file_analyzer',
      name: 'File Analyzer',
      type: 'functional',
      role: 'File Analyzer',
      description: '文件分析和内容提取',
      memoryLevel: 'task',
      capabilities: ['file_reading', 'content_parsing', 'pattern_recognition'],
      lifespan: 'task',
    });

    // 模板: General Assistant
    this.templates.set('general_assistant', {
      id: 'general_assistant',
      name: 'General Assistant',
      type: 'functional',
      role: 'General Assistant',
      description: '通用助手，处理多种任务',
      memoryLevel: 'session',
      capabilities: ['text_processing', 'question_answering', 'task_execution'],
      lifespan: 'session',
    });

    console.log(`[AgentFactory ${this.id}] Templates initialized: ${this.templates.size} templates`);
  }

  /**
   * 处理创建请求
   */
  private async handleCreateRequest(event: Event): Promise<void> {
    const payload = event.payload as AgentRequest & {
      agentId: string;
      type: 'system' | 'functional';
      role: string;
      description: string;
    };

    console.log(`[AgentFactory ${this.id}] Create request: ${payload.role}`);

    try {
      // 创建 Agent 实例
      const instance = await this.createInstance(payload);

      // 通知完成
      await this.eventBus?.publish({
        type: 'AGENT_CREATED',
        sourceAgent: this.id,
        payload: {
          templateId: payload.templateId || 'unknown',
          instanceId: instance.instanceId,
        },
      });

      console.log(`[AgentFactory ${this.id}] Agent created: ${instance.instanceId}`);

    } catch (error) {
      console.error(`[AgentFactory ${this.id}] Error creating agent:`, error);

      await this.eventBus?.publish({
        type: EventType.AGENT_ERROR,
        sourceAgent: this.id,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          request: payload,
        },
      });
    }
  }

  /**
   * 创建 Agent 实例
   */
  async createInstance(request: AgentRequest & {
    agentId?: string;
    type?: 'system' | 'functional';
    role?: string;
    description?: string;
  }): Promise<AgentInstance> {
    const templateId = request.templateId || 'general_assistant';
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 生成实例 ID
    const instanceId = request.agentId || `${template.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 创建实例
    const instance: AgentInstance = {
      ...template,
      instanceId,
      createdAt: Date.now(),
      status: 'creating',
      currentTaskId: request.taskId,
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    };

    // 注册实例
    this.instances.set(instanceId, instance);

    // 模拟创建延迟（实际应该是实例化真正的 Agent 类）
    await new Promise(resolve => setTimeout(resolve, 100));

    instance.status = 'active';

    // 发布 AGENT_STARTED 事件
    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: instanceId,
      payload: {
        agentId: instanceId,
        role: instance.role,
        templateId,
      },
    });

    console.log(`[AgentFactory ${this.id}] Instance created: ${instanceId} (${template.name})`);

    return instance;
  }

  /**
   * 销毁 Agent 实例
   */
  async destroyInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      console.log(`[AgentFactory ${this.id}] Instance not found: ${instanceId}`);
      return;
    }

    instance.status = 'destroying';

    // 检查生命周期
    if (instance.lifespan === 'task' && !instance.currentTaskId) {
      // 任务已完成，销毁
    } else if (instance.lifespan === 'session') {
      // 会话结束，销毁
    }

    // 发布 AGENT_STOPPED 事件
    await this.eventBus?.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: instanceId,
      payload: {
        agentId: instanceId,
        role: instance.role,
      },
    });

    // 移除实例
    this.instances.delete(instanceId);

    console.log(`[AgentFactory ${this.id}] Instance destroyed: ${instanceId}`);
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(template: AgentTemplate): void {
    this.templates.set(template.id, template);
    console.log(`[AgentFactory ${this.id}] Template registered: ${template.id}`);
  }

  /**
   * 获取实例
   */
  getInstance(instanceId: string): AgentInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * 获取所有实例
   */
  getInstances(filters?: {
    status?: string;
    type?: 'system' | 'functional';
    templateId?: string;
  }): AgentInstance[] {
    let instances = Array.from(this.instances.values());

    if (filters) {
      if (filters.status) {
        instances = instances.filter(i => i.status === filters.status);
      }
      if (filters.type) {
        instances = instances.filter(i => i.type === filters.type);
      }
      if (filters.templateId) {
        instances = instances.filter(i => i.id === filters.templateId);
      }
    }

    return instances;
  }

  /**
   * 获取模板列表
   */
  getTemplates(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 获取状态
   */
  getStatus(): {
    templates: number;
    instances: number;
    active: number;
    idle: number;
    destroying: number;
  } {
    const instances = this.getInstances();

    return {
      templates: this.templates.size,
      instances: instances.length,
      active: instances.filter(i => i.status === 'active').length,
      idle: instances.filter(i => i.status === 'idle').length,
      destroying: instances.filter(i => i.status === 'destroying').length,
    };
  }

  /**
   * 清理闲置实例
   */
  async cleanupIdleInstances(maxIdleTimeMs: number = 300000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [instanceId, instance] of this.instances.entries()) {
      if (instance.status === 'idle') {
        const idleTime = now - instance.performance.avgProcessingTime; // Hack: use this field as last active time
        if (idleTime > maxIdleTimeMs) {
          await this.destroyInstance(instanceId);
          cleaned++;
        }
      }
    }

    console.log(`[AgentFactory ${this.id}] Cleaned up ${cleaned} idle instances`);

    return cleaned;
  }
}
