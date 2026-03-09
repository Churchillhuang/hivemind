/**
 * AgentFactory - 动态创建和管理 Agents
 *
 * 根据任务需求创建特定功能的 Agents
 */

import { randomUUID } from "node:crypto";
import { BaseAgent } from "../core/Agent.js";
import { Event, EventType } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "../hive/HiveConfig.js";
import { FunctionalAgent } from "./FunctionalAgent.js";
import { SkillPersistence } from "./SkillPersistence.js";

/**
 * AgentTemplate - Agent 模板
 */
export interface AgentTemplate {
  id: string;
  name: string;
  type: "system" | "functional";
  role: string;
  description: string;
  memoryLevel?: "session" | "task" | "knowledge" | "sample";
  capabilities: string[];
  lifespan: "task" | "session" | "persistent";
  model?: string; // LLM model to use
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
  status: "creating" | "active" | "idle" | "destroying";
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
  private pendingRequests: Map<
    string,
    {
      resolve: (instance: AgentInstance) => void;
      reject: (err: Error) => void;
    }
  > = new Map();
  private skillPersistence: SkillPersistence;

  // 实际的功能Agent实例
  private functionalAgents: Map<string, FunctionalAgent> = new Map();

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super(
      {
        id: config.id,
        role: config.role,
        type: "system",
        description: config.description,
      },
      eventBus,
    );

    this.hiveConfig = hiveConfig;
    this.skillPersistence = new SkillPersistence(hiveConfig);
    this.initializeTemplates();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 订阅事件
    this.subscribeTo("AGENT_CREATE_REQUEST");
    this.subscribeTo("TASK_ANNOUNCEMENT");
    this.subscribeTo("TASK_COMPLETED");
    this.subscribeTo("TASK_FAILED");

    // 初始化模板
    this.initializeTemplates();
    this.skillPersistence = new SkillPersistence(this.hiveConfig);

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
    switch (event.type) {
      case "AGENT_CREATE_REQUEST":
        await this.handleCreateRequest(event);
        break;
      case "TASK_ANNOUNCEMENT":
        await this.handleTaskAnnouncement(event);
        break;
      case "TASK_COMPLETED":
      case "TASK_FAILED":
        await this.handleTaskLifecycleEvent(event);
        break;
      default:
        break;
    }
  }

  /**
   * 初始化 Agent 模板
   */
  private initializeTemplates(): void {
    // 模板: Moltbook Bot
    this.templates.set("moltbook_bot", {
      id: "moltbook_bot",
      name: "Moltbook Bot",
      type: "functional",
      role: "Moltbook Bot",
      description: "Moltbook 社交媒体自动化 - 纯哲学内容",
      memoryLevel: "task",
      capabilities: ["moltbook_api", "philosophy_generation", "social_posting"],
      lifespan: "session",
    });

    // 模板: WordPress Uploader
    this.templates.set("wp_uploader", {
      id: "wp_uploader",
      name: "WordPress Uploader",
      type: "functional",
      role: "WordPress Uploader",
      description: "WordPress 文章上传和管理",
      memoryLevel: "task",
      capabilities: ["wordpress_api", "html_parsing", "tagging", "seo_optimization"],
      lifespan: "task",
    });

    // 模板: File Analyzer
    this.templates.set("file_analyzer", {
      id: "file_analyzer",
      name: "File Analyzer",
      type: "functional",
      role: "File Analyzer",
      description: "文件分析和内容提取",
      memoryLevel: "task",
      capabilities: ["file_reading", "content_parsing", "pattern_recognition"],
      lifespan: "task",
    });

    // 模板: General Assistant
    this.templates.set("general_assistant", {
      id: "general_assistant",
      name: "General Assistant",
      type: "functional",
      role: "General Assistant",
      description: "通用助手，处理多种任务",
      memoryLevel: "session",
      capabilities: ["text_processing", "question_answering", "task_execution"],
      lifespan: "session",
    });

    console.log(
      `[AgentFactory ${this.id}] Templates initialized: ${this.templates.size} templates`,
    );
  }

  /**
   * 处理任务公告 - 检查现有Agent池或创建新Agent
   */
  private async handleTaskAnnouncement(event: Event): Promise<void> {
    const announcement = event.payload as {
      taskId: string;
      taskType: string;
      requiredCapabilities: string[];
      priority: "urgent" | "normal" | "low";
      description: string;
      timestamp: number;
    };

    console.log(
      `[AgentFactory ${this.id}] Task announcement received: ${announcement.taskId} (${announcement.taskType})`,
    );

    // 1. 检查现有Agent池中是否有匹配的
    const activeAgents = Array.from(this.functionalAgents.entries());
    const matchingAgents = activeAgents.filter(([id]) => {
      const instance = this.instances.get(id);
      if (!instance || instance.status !== "active") {
        return false;
      }
      // 检查能力是否匹配
      const hasCapability = announcement.requiredCapabilities.some(
        (cap) =>
          instance.capabilities.includes(cap) ||
          instance.capabilities.some(
            (c: string) =>
              c.toLowerCase().includes(cap.toLowerCase()) ||
              cap.toLowerCase().includes(c.toLowerCase()),
          ),
      );
      return hasCapability;
    });

    console.log(`[AgentFactory ${this.id}] Found ${matchingAgents.length} matching agents in pool`);

    // 2. 如果有匹配的Agent，让它们自己处理（它们已经订阅了TASK_ANNOUNCEMENT）
    if (matchingAgents.length > 0) {
      console.log(
        `[AgentFactory ${this.id}] Using existing agent pool - agents will evaluate and dance autonomously`,
      );
      // 不需要做任何事，现有的FunctionalAgent会自动收到TASK_ANNOUNCEMENT事件
      // 它们会评估、发布舞蹈、参与共识
      return;
    }

    // 3. 如果没有匹配的，查找模板创建新Agent
    console.log(`[AgentFactory ${this.id}] No matching agents in pool, creating new one`);

    const matchingTemplate = this.findMatchingTemplate(
      announcement.taskType,
      announcement.requiredCapabilities,
    );

    if (!matchingTemplate) {
      console.log(
        `[AgentFactory ${this.id}] No matching template for task type: ${announcement.taskType}`,
      );
      // 回退到通用助手
      const generalTemplate = this.templates.get("general_assistant");
      if (generalTemplate) {
        await this.createAgentForTask(generalTemplate, announcement);
      }
      return;
    }

    // 4. 为任务创建代理
    await this.createAgentForTask(matchingTemplate, announcement);
  }

  /**
   * 查找匹配的模板
   */
  private findMatchingTemplate(
    taskType: string,
    requiredCapabilities: string[],
  ): AgentTemplate | undefined {
    // 首先按任务类型精确匹配
    for (const template of this.templates.values()) {
      if (
        template.id.toLowerCase().includes(taskType.toLowerCase()) ||
        template.name.toLowerCase().includes(taskType.toLowerCase())
      ) {
        return template;
      }
    }

    // 然后按能力匹配
    for (const template of this.templates.values()) {
      const hasAllCapabilities = requiredCapabilities.every((cap) =>
        template.capabilities.some((templateCap) =>
          templateCap.toLowerCase().includes(cap.toLowerCase()),
        ),
      );

      if (hasAllCapabilities) {
        return template;
      }
    }

    return undefined;
  }

  /**
   * 为任务创建代理并让其参与共识
   */
  private async createAgentForTask(template: AgentTemplate, announcement: unknown): Promise<void> {
    const taskAnnouncement = announcement as {
      taskId: string;
      taskType: string;
      requiredCapabilities: string[];
      priority: "urgent" | "normal" | "low";
      description: string;
      timestamp: number;
    };
    const instanceId = `func_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 创建真实的功能Agent实例
    const functionalAgent = new FunctionalAgent(
      {
        instanceId,
        role: template.role,
        description: template.description,
        capabilities: template.capabilities,
        templateId: template.id,
        taskId: taskAnnouncement.taskId,
      },
      this.hiveConfig,
      this.eventBus,
    );

    // 启动功能Agent（它会订阅共识相关事件）
    await functionalAgent.start();

    // 存储实例
    this.functionalAgents.set(instanceId, functionalAgent);

    // 创建代理实例记录
    const agentInstance: AgentInstance = {
      ...template,
      instanceId,
      createdAt: Date.now(),
      status: "active",
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    };

    this.instances.set(instanceId, agentInstance);

    console.log(
      `[AgentFactory ${this.id}] Created functional agent ${instanceId} for task ${taskAnnouncement.taskId}`,
    );
    console.log(
      `[AgentFactory ${this.id}] Agent ${instanceId} capabilities: ${template.capabilities.join(", ")}`,
    );
    console.log(`[AgentFactory ${this.id}] Agent ${instanceId} is listening for consensus events`);

    // 重要：让新创建的Agent立即处理这个任务公告
    // 因为Agent是在事件发布后才创建的，它错过了原始事件
    await functionalAgent.handleTaskAnnouncement(taskAnnouncement as TaskAnnouncement);

    // 发布代理创建事件
    await this.eventBus.publish({
      type: "AGENT_CREATED",
      sourceAgent: this.id,
      payload: {
        agentId: instanceId,
        templateId: template.id,
        role: template.role,
        taskId: taskAnnouncement.taskId,
        capabilities: template.capabilities,
      },
    });
  }

  /**
   * 计算Agent与任务的匹配度
   */
  private calculateMatchScore(
    template: AgentTemplate,
    task: { requiredCapabilities: string[]; description: string },
  ): number {
    let score = 0.5; // 基础分数

    // 1. 能力匹配
    const matchedCapabilities = template.capabilities.filter((cap) =>
      task.requiredCapabilities.includes(cap),
    );
    if (matchedCapabilities.length > 0) {
      score += 0.3 * (matchedCapabilities.length / Math.max(template.capabilities.length, 1));
    }

    // 2. 描述关键词匹配
    const desc = task.description.toLowerCase();
    const keywordMatches = template.capabilities.filter((cap) => desc.includes(cap.toLowerCase()));
    if (keywordMatches.length > 0) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * 处理创建请求
   */
  private async handleCreateRequest(event: Event): Promise<void> {
    const payload = event.payload as AgentRequest & {
      agentId: string;
      type: "system" | "functional";
      role: string;
      description: string;
    };

    console.log(`[AgentFactory ${this.id}] Create request: ${payload.role}`);

    try {
      // 创建 Agent 实例
      const instance = await this.createInstance(payload);

      // 通知完成
      await this.eventBus?.publish({
        type: "AGENT_CREATED",
        sourceAgent: this.id,
        payload: {
          templateId: payload.templateId || "unknown",
          instanceId: instance.instanceId,
          taskId: instance.currentTaskId,
          role: instance.role,
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
  async createInstance(
    request: AgentRequest & {
      agentId?: string;
      type?: "system" | "functional";
      role?: string;
      description?: string;
    },
  ): Promise<AgentInstance> {
    const templateId = request.templateId || "general_assistant";
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.type === "functional") {
      const maxConcurrent = Math.max(1, this.hiveConfig.agents.functional.maxConcurrent);
      const activeFunctionalInstances = this.getInstances({ type: "functional" }).filter(
        (instance) => instance.status !== "destroying",
      ).length;
      if (activeFunctionalInstances >= maxConcurrent) {
        throw new Error(
          `Functional agent limit reached: ${activeFunctionalInstances}/${maxConcurrent}`,
        );
      }
    }

    // 生成实例 ID
    const instanceId =
      request.agentId ||
      `${template.type}_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 6)}`;

    // 创建实例
    const instance: AgentInstance = {
      ...template,
      lifespan:
        template.type === "functional"
          ? this.hiveConfig.agents.functional.lifespan
          : template.lifespan,
      instanceId,
      createdAt: Date.now(),
      status: "creating",
      currentTaskId: request.taskId,
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0,
      },
    };

    // 注册实例
    this.instances.set(instanceId, instance);

    // 加载技能（如果启用）
    if (this.hiveConfig.skillLearning.enabled) {
      try {
        const { agentSkills, sharedSkills } =
          await this.skillPersistence.listAvailableSkills(instanceId);

        if (agentSkills.length > 0 || sharedSkills.length > 0) {
          console.log(
            `[AgentFactory ${this.id}] Loaded ${agentSkills.length} agent skills and ${sharedSkills.length} shared skills for ${instanceId}`,
          );
          // 技能已加载，可以附加到实例元数据中
          // 注意：AgentInstance 接口可能需要扩展以包含技能信息
        }
      } catch (error) {
        console.warn(`[AgentFactory ${this.id}] Failed to load skills for ${instanceId}:`, error);
        // 技能加载失败不阻塞 agent 创建
      }
    }

    // 如果是functional agent，创建真正的FunctionalAgent实例
    if (template.type === "functional") {
      const functionalAgent = new FunctionalAgent(
        {
          instanceId,
          role: template.role,
          description: template.description,
          capabilities: template.capabilities,
          templateId: template.id,
          taskId: request.taskId,
        },
        this.hiveConfig,
        this.eventBus,
      );

      // 启动functional agent（它会订阅TASK_ANNOUNCEMENT等事件）
      await functionalAgent.start();

      // 存储到functionalAgents map
      this.functionalAgents.set(instanceId, functionalAgent);

      console.log(
        `[AgentFactory ${this.id}] FunctionalAgent ${instanceId} started and listening for events`,
      );
    }

    instance.status = "active";

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

  private async handleTaskLifecycleEvent(event: Event): Promise<void> {
    const payload = (event.payload ?? {}) as { taskId?: unknown };
    if (typeof payload.taskId !== "string" || payload.taskId.trim() === "") {
      return;
    }

    const instancesToDestroy: string[] = [];
    for (const instance of this.instances.values()) {
      if (instance.lifespan === "task" && instance.currentTaskId === payload.taskId) {
        instancesToDestroy.push(instance.instanceId);
      }
    }

    for (const instanceId of instancesToDestroy) {
      await this.destroyInstance(instanceId);
    }
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

    instance.status = "destroying";

    // 停止并移除功能Agent实例
    const functionalAgent = this.functionalAgents.get(instanceId);
    if (functionalAgent) {
      await functionalAgent.stop();
      this.functionalAgents.delete(instanceId);
      console.log(`[AgentFactory ${this.id}] Functional agent ${instanceId} stopped`);
    }

    // 检查生命周期
    if (instance.lifespan === "task" && !instance.currentTaskId) {
      // 任务已完成，销毁
    } else if (instance.lifespan === "session") {
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
    type?: "system" | "functional";
    templateId?: string;
  }): AgentInstance[] {
    let instances = Array.from(this.instances.values());

    if (filters) {
      if (filters.status) {
        instances = instances.filter((i) => i.status === filters.status);
      }
      if (filters.type) {
        instances = instances.filter((i) => i.type === filters.type);
      }
      if (filters.templateId) {
        instances = instances.filter((i) => i.id === filters.templateId);
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
      active: instances.filter((i) => i.status === "active").length,
      idle: instances.filter((i) => i.status === "idle").length,
      destroying: instances.filter((i) => i.status === "destroying").length,
    };
  }

  /**
   * 清理闲置实例
   */
  async cleanupIdleInstances(maxIdleTimeMs: number = 300000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [instanceId, instance] of this.instances.entries()) {
      if (instance.status === "idle") {
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
