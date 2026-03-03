/**
 * ToolsManager - Agent 工具权限和管理
 *
 * 管理不同 agent 的工具访问权限和调用统计
 */

import type { HiveConfig } from './HiveConfig.js';

/**
 * 工具类型
 */
export type ToolAction = 'read' | 'write' | 'execute' | 'admin';

/**
 * 工具定义
 */
export interface Tool {
  id: string;
  group: string;
  description: string;
  actions: ToolAction[];
  defaultPermissions: 'all' | 'system' | 'functional' | 'none';
}

/**
 * Agent 工具权限
 */
export interface AgentToolPermissions {
  allowed: string[];    // 允许的工具 ID
  denied: string[];     // 拒绝的工具 ID
  groups: string[];     // 允许的工具组
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  toolId: string;
  agentId: string;
  timestamp: number;
  duration: number;
  success: boolean;
  parameters?: Record<string, unknown>;
  result?: unknown;
}

/**
 * 工具统计
 */
export interface ToolStatistics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  lastCalled: number;
}

/**
 * Tools Manager - 管理工具和权限
 */
export class ToolsManager {
  private hiveConfig: HiveConfig;
  private tools: Map<string, Tool> = new Map();
  private groups: Map<string, string[]> = new Map();
  private agentPermissions: Map<string, AgentToolPermissions> = new Map();
  private callHistory: Map<string, ToolCallRecord[]> = new Map();
  private statistics: Map<string, ToolStatistics> = new Map();

  constructor(hiveConfig: HiveConfig) {
    this.hiveConfig = hiveConfig;
    this.initializeTools();
    this.initializeDefaultPermissions();
  }

  /**
   * 初始化工具
   */
  private initializeTools(): void {
    // 文件系统工具
    this.registerTool({
      id: 'read',
      group: 'fs',
      description: 'Read file contents',
      actions: ['read'],
      defaultPermissions: 'all',
    });

    this.registerTool({
      id: 'write',
      group: 'fs',
      description: 'Write file contents',
      actions: ['write'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'edit',
      group: 'fs',
      description: 'Edit file contents',
      actions: ['write'],
      defaultPermissions: 'system',
    });

    // 终端工具
    this.registerTool({
      id: 'exec',
      group: 'runtime',
      description: 'Execute shell commands',
      actions: ['execute'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'process',
      group: 'runtime',
      description: 'Manage background processes',
      actions: ['execute', 'admin'],
      defaultPermissions: 'system',
    });

    // 记忆工具
    this.registerTool({
      id: 'memory_search',
      group: 'memory',
      description: 'Search memory',
      actions: ['read'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'memory_get',
      group: 'memory',
      description: 'Get memory content',
      actions: ['read'],
      defaultPermissions: 'system',
    });

    // Web 工具
    this.registerTool({
      id: 'web_search',
      group: 'web',
      description: 'Search the web',
      actions: ['read'],
      defaultPermissions: 'functional',
    });

    this.registerTool({
      id: 'web_fetch',
      group: 'web',
      description: 'Fetch URL content',
      actions: ['read'],
      defaultPermissions: 'functional',
    });

    // 浏览器工具
    this.registerTool({
      id: 'browser',
      group: 'ui',
      description: 'Control web browser',
      actions: ['read', 'execute'],
      defaultPermissions: 'functional',
    });

    this.registerTool({
      id: 'canvas',
      group: 'ui',
      description: 'Control node canvas',
      actions: ['read', 'execute'],
      defaultPermissions: 'functional',
    });

    // 消息工具
    this.registerTool({
      id: 'message',
      group: 'messaging',
      description: 'Send messages',
      actions: ['execute'],
      defaultPermissions: 'system',
    });

    // Session 工具
    this.registerTool({
      id: 'sessions_list',
      group: 'sessions',
      description: 'List sessions',
      actions: ['read'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'sessions_history',
      group: 'sessions',
      description: 'Get session history',
      actions: ['read'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'sessions_send',
      group: 'sessions',
      description: 'Send to session',
      actions: ['execute'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'sessions_spawn',
      group: 'sessions',
      description: 'Spawn sub-agent',
      actions: ['execute', 'admin'],
      defaultPermissions: 'system',
    });

    this.registerTool({
      id: 'session_status',
      group: 'sessions',
      description: 'Get session status',
      actions: ['read'],
      defaultPermissions: 'all',
    });

    // Cron 工具
    this.registerTool({
      id: 'cron',
      group: 'automation',
      description: 'Manage cron jobs',
      actions: ['execute', 'admin'],
      defaultPermissions: 'system',
    });

    // Gateway 工具
    this.registerTool({
      id: 'gateway',
      group: 'automation',
      description: 'Gateway management',
      actions: ['execute', 'admin'],
      defaultPermissions: 'system',
    });

    // Node 工具
    this.registerTool({
      id: 'nodes',
      group: 'nodes',
      description: 'Node control',
      actions: ['read', 'execute'],
      defaultPermissions: 'functional',
    });

    // Image 工具
    this.registerTool({
      id: 'image',
      group: 'ui',
      description: 'Image analysis',
      actions: ['read'],
      defaultPermissions: 'functional',
    });

    console.log(`[ToolsManager] Initialized ${this.tools.size} tools`);
  }

  /**
   * 初始化默认 agent 权限
   */
  private initializeDefaultPermissions(): void {
    // Orchestrator: 无工具（只路由）
    this.setAgentPermissions('orchestrator_001', {
      allowed: ['session_status'],
      denied: [],
      groups: [],
    });

    // InterfaceAgent: 记忆和消息工具
    this.setAgentPermissions('interface_agent_001', {
      allowed: ['memory_search', 'memory_get', 'message'],
      denied: [],
      groups: [],
    });

    // MemoryAgent: 文件系统工具
    this.setAgentPermissions('memory_agent_001', {
      allowed: ['read', 'write', 'edit'],
      denied: [],
      groups: ['fs'],
    });

    // ReflectionAgent: 文件系统工具
    this.setAgentPermissions('reflection_agent_001', {
      allowed: ['read', 'write', 'edit'],
      denied: [],
      groups: ['fs'],
    });

    // Functional Agents: 默认工具
    this.setAgentPermissions('default_functional', {
      allowed: [],
      denied: [],
      groups: ['fs', 'web'],
    });
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);

    // 添加到工具组
    if (!this.groups.has(tool.group)) {
      this.groups.set(tool.group, []);
    }
    this.groups.get(tool.group)!.push(tool.id);
  }

  /**
   * 设置 agent 权限
   */
  setAgentPermissions(agentId: string, permissions: AgentToolPermissions): void {
    this.agentPermissions.set(agentId, permissions);
  }

  /**
   * 获取 agent 权限
   */
  getAgentPermissions(agentId: string): AgentToolPermissions {
    return (
      this.agentPermissions.get(agentId) || {
        allowed: [],
        denied: [],
        groups: [],
      }
    );
  }

  /**
   * 检查 agent 是否有权限使用工具
   */
  hasPermission(agentId: string, toolId: string): boolean {
    const agentPerm = this.getAgentPermissions(agentId);

    // 检查明确拒绝
    if (agentPerm.denied.includes(toolId)) {
      return false;
    }

    // 检查明确允许
    if (agentPerm.allowed.includes(toolId)) {
      return true;
    }

    // 检查工具组
    const tool = this.tools.get(toolId);
    if (tool && agentPerm.groups.includes(tool.group)) {
      return true;
    }

    // 检查工具默认权限
    const defaultPerm = tool?.defaultPermissions || 'none';
    if (defaultPerm === 'all') {
      return true;
    }

    // 根据代理类型判断
    const agentType = this.getAgentType(agentId);
    if (defaultPerm === 'system' && agentType === 'system') {
      return true;
    }
    if (defaultPerm === 'functional' && agentType === 'functional') {
      return true;
    }

    return false;
  }

  /**
   * 获取 agent 类型
   */
  private getAgentType(agentId: string): 'system' | 'functional' {
    if (agentId.includes('orchestrator') ||
        agentId.includes('interface') ||
        agentId.includes('memory') ||
        agentId.includes('reflection')) {
      return 'system';
    }
    return 'functional';
  }

  /**
   * 获取 agent 允许的工具列表
   */
  getAllowedTools(agentId: string): Tool[] {
    const allowedTools: Tool[] = [];

    for (const [toolId, tool] of this.tools.entries()) {
      if (this.hasPermission(agentId, toolId)) {
        allowedTools.push(tool);
      }
    }

    return allowedTools;
  }

  /**
   * 获取工具定义
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取所有工具
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 记录工具调用
   */
  recordCall(record: ToolCallRecord): void {
    // 添加到历史
    if (!this.callHistory.has(record.agentId)) {
      this.callHistory.set(record.agentId, []);
    }
    this.callHistory.get(record.agentId)!.push(record);

    // 更新统计
    if (!this.statistics.has(record.toolId)) {
      this.statistics.set(record.toolId, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        avgDuration: 0,
        lastCalled: 0,
      });
    }

    const stats = this.statistics.get(record.toolId)!;
    stats.totalCalls++;
    stats.lastCalled = record.timestamp;

    if (record.success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    // 更新平均持续时间
    stats.avgDuration = (stats.avgDuration * (stats.totalCalls - 1) + record.duration) / stats.totalCalls;
  }

  /**
   * 获取工具统计
   */
  getToolStatistics(toolId: string): ToolStatistics | undefined {
    return this.statistics.get(toolId);
  }

  /**
   * 获取 agent 的工具使用历史
   */
  getAgentHistory(agentId: string, limit?: number): ToolCallRecord[] {
    const history = this.callHistory.get(agentId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * 获取状态
   */
  getStatus(): {
    toolsCount: number;
    groupsCount: number;
    agentsCount: number;
    totalCalls: number;
  } {
    let totalCalls = 0;
    for (const stats of this.statistics.values()) {
      totalCalls += stats.totalCalls;
    }

    return {
      toolsCount: this.tools.size,
      groupsCount: this.groups.size,
      agentsCount: this.agentPermissions.size,
      totalCalls,
    };
  }
}
