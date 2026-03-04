/**
 * Dynamic Agent Evolution
 *
 * 基于 feedback 的角色适应、自演化能力和性能监控
 */

import { getGlobalEventBus } from '../events/EventBus.js';
import { randomUUID } from 'node:crypto';
import type { Event } from '../events/Event.js';
import { EventType } from '../events/Event.js';
import type { HiveConfig } from './HiveConfig.js';

/**
 * 技能评估
 */
export interface SkillEvaluation {
  skillId: string;
  name: string;
  proficiency: number;  // 0-1
  usageCount: number;
  successRate: number;  // 0-1
  avgResponseTime: number;  // ms
  lastUsed: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Agent 性能指标
 */
export interface AgentPerformance {
  agentId: string;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;  // 0-1
  avgResponseTime: number;  // ms
  avgTaskTime: number;  // ms
  skills: Map<string, SkillEvaluation>;
  score: number;  // 综合得分 0-100
  lastUpdated: number;
}

/**
 * 角色适应记录
 */
export interface RoleAdaptation {
  adaptationId: string;
  agentId: string;
  fromRole: string;
  toRole: string;
  reason: string;
  trigger: 'performance' | 'feedback' | 'manual';
  timestamp: number;
  impact: 'positive' | 'neutral' | 'negative';
}

/**
 * 演化建议
 */
export interface EvolutionSuggestion {
  suggestionId: string;
  agentId: string;
  suggestion: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'role_change' | 'skill_development' | 'resource_allocation' | 'config_tuning';
  estimatedImpact: number;  // 0-100
  confidence: number;  // 0-1
  timestamp: number;
}

/**
 * 性能监控配置
 */
export interface PerformanceMonitoringConfig {
  monitoringInterval: number;  // ms
  evaluationWindow: number;  // time window for skill evaluation (ms)
  performanceThreshold: number;  // performance score threshold 0-100
  skillProficiencyThreshold: number;  // skill proficiency threshold 0-1
}

/**
 * Dynamic Agent Evolution
 */
export class DynamicAgentEvolution {
  private hiveConfig: HiveConfig;
  private eventBus = getGlobalEventBus();

  // Agent 性能跟踪
  private agentPerformance: Map<string, AgentPerformance> = new Map();

  // 技能评估
  private skillEvaluations: Map<string, SkillEvaluation> = new Map();

  // 角色适应历史
  private roleAdaptations: RoleAdaptation[] = [];

  // 演化建议
  private evolutionSuggestions: EvolutionSuggestion[] = [];

  // 配置
  private config: PerformanceMonitoringConfig;

  // 监控定时器
  private monitoringTimer?: NodeJS.Timeout;

  // 参考数据（用于性能对比）
  private baselineScores: Map<string, number> = new Map();

  constructor(config: PerformanceMonitoringConfig & { hiveConfig: HiveConfig }) {
    this.hiveConfig = config.hiveConfig;
    this.config = {
      monitoringInterval: config.monitoringInterval || 60000,  // 1 分钟
      evaluationWindow: config.evaluationWindow || 3600000,  // 1 小时
      performanceThreshold: config.performanceThreshold || 60,
      skillProficiencyThreshold: config.skillProficiencyThreshold || 0.7,
    };

    // 订阅事件
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.eventBus.subscribe('TASK_COMPLETED', this.handleTaskCompleted.bind(this));
    this.eventBus.subscribe(EventType.TASK_FAILED, this.handleTaskFailed.bind(this));
    this.eventBus.subscribe(EventType.AGENT_STARTED, this.handleAgentStarted.bind(this));
  }

  /**
   * 启动演化引擎
   */
  async start(): Promise<void> {
    console.log('[Evol] Dynamic Agent Evolution started');

    // 启动定期监控
    this.monitoringTimer = setInterval(
      () => this.runPerformanceEvaluation(),
      this.config.monitoringInterval,
    );

    // 初始评估
    await this.runPerformanceEvaluation();
  }

  /**
   * 停止演化引擎
   */
  async stop(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log('[Evol] Dynamic Agent Evolution stopped');
  }

  /**
   * 运行性能评估
   */
  private async runPerformanceEvaluation(): Promise<void> {
    console.log('[Evol] Running performance evaluation...');

    const now = Date.now();
    const suggestions: EvolutionSuggestion[] = [];

    // 评估每个 Agent 的性能
    for (const [_agentId, perf] of this.agentPerformance.entries()) {
      // 计算综合得分
      const score = this.calculatePerformanceScore(perf);
      perf.score = score;
      perf.lastUpdated = now;

      // 检查是否需要角色适应
      if (score < this.config.performanceThreshold) {
        const suggestion = this.generateRoleAdaptationSuggestion(perf);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // 评估技能
      for (const skill of perf.skills.values()) {
        await this.evaluateSkill(skill);
      }

      // 生成技能发展建议
      const skillSuggestions = this.generateSkillDevelopmentSuggestions(perf);
      suggestions.push(...skillSuggestions);
    }

    // 更新建议列表
    this.evolutionSuggestions = suggestions;

    // 发布评估完成事件
    await this.eventBus.publish({
      type: 'PERFORMANCE_EVALUATION_COMPLETED',
      sourceAgent: 'DynamicAgentEvolution',
      payload: {
        timestamp: now,
        suggestionsCount: suggestions.length,
      },
    });

    console.log(`[Evol] Performance evaluation completed: ${this.agentPerformance.size} agents, ${suggestions.length} suggestions`);
  }

  /**
   * 计算 Agent 性能得分
   */
  private calculatePerformanceScore(perf: AgentPerformance): number {
    // 成功率权重 50%
    const successRateScore = perf.successRate * 50;

    // 响应时间权重 30%
    const responseTimeScore = Math.max(0, 100 - (perf.avgResponseTime / 1000) * 10) * 0.3;

    // 技能熟练度权重 20%
    let skillScore = 0;
    if (perf.skills.size > 0) {
      const avgSkillProficiency = Array.from(perf.skills.values())
        .reduce((sum, skill) => sum + skill.proficiency, 0) / perf.skills.size;

      skillScore = avgSkillProficiency * 20;
    }

    return Math.min(100, successRateScore + responseTimeScore + skillScore);
  }

  /**
   * 生成角色适应建议
   */
  private generateRoleAdaptationSuggestion(perf: AgentPerformance): EvolutionSuggestion | null {
    const agentId = perf.agentId;
    const score = perf.score;

    // 分析技能模式
    const { topSkills, weakSkills } = this.analyzeSkills(perf);

    // 根据技能模式推荐新角色
    let suggestedRole: string | null = null;
    let reason: string = '';

    if (topSkills.length > 0 && topSkills[0].proficiency > 0.8) {
      suggestedRole = this.inferRoleFromSkill(topSkills[0].skillId);
      reason = `High proficiency in ${topSkills[0].name} (${(topSkills[0].proficiency * 100).toFixed(1)}%) can maximize efficiency in specialized role`;
    } else if (weakSkills.length > 2) {
      suggestedRole = 'general_assistant';
      reason = `Multiple weak skills (${weakSkills.map(s => s.name).join(', ')}) suggest generalist role better`;
    }

    if (!suggestedRole) {
      return null;
    }

    return {
      suggestionId: `evol_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`,
      agentId,
      suggestion: `Consider changing role to "${suggestedRole}"`,
      reason,
      priority: score < 40 ? 'critical' : score < 60 ? 'high' : 'medium',
      type: 'role_change',
      estimatedImpact: 70 + (1 - perf.score / 100) * 30,
      confidence: topSkills[0]?.proficiency || 0.5,
      timestamp: Date.now(),
    };
  }

  /**
   * 从技能 ID 推断角色
   */
  private inferRoleFromSkill(skillId: string): string {
    const roleMap: Record<string, string> = {
      'content_writing': 'content_writer',
      'search': 'search_agent',
      'analysis': 'analysis_agent',
      'dialogue': 'interface_agent',
      'memory_management': 'memory_agent',
      'scheduling': 'task_agent',
      'messaging': 'communication_agent',
    };

    return roleMap[skillId] || 'general_assistant';
  }

  /**
   * 分析技能
   */
  private analyzeSkills(perf: AgentPerformance): {
    topSkills: SkillEvaluation[];
    weakSkills: SkillEvaluation[];
  } {
    const skills = Array.from(perf.skills.values());

    // 按熟练度排序
    skills.sort((a, b) => b.proficiency - a.proficiency);

    // 识别最强和最弱技能
    const topSkills = skills.slice(0, 2).filter(s => s.proficiency > this.config.skillProficiencyThreshold);
    const weakSkills = skills.filter(s => s.proficiency < this.config.skillProficiencyThreshold);

    return { topSkills, weakSkills };
  }

  /**
   * 生成技能发展建议
   */
  private generateSkillDevelopmentSuggestions(perf: AgentPerformance): EvolutionSuggestion[] {
    const suggestions: EvolutionSuggestion[] = [];
    const { weakSkills } = this.analyzeSkills(perf);

    for (const skill of weakSkills) {
      suggestions.push({
        suggestionId: `skill_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`,
        agentId: perf.agentId,
        suggestion: `Develop "${skill.name}" skill to improve performance`,
        reason: `Low proficiency (${(skill.proficiency * 100).toFixed(1)}%) and high usage (${skill.usageCount} times) suggest training needed`,
        priority: skill.usageCount > 10 ? 'high' : 'medium',
        type: 'skill_development',
        estimatedImpact: 30 + (1 - skill.proficiency) * 40,
        confidence: 0.6,
        timestamp: Date.now(),
      });
    }

    return suggestions;
  }

  /**
   * 应用角色适应
   */
  async applyRoleAdaptation(agentId: string, newRole: string, reason: string): Promise<void> {
    const perf = this.agentPerformance.get(agentId);

    if (!perf) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const adaptation: RoleAdaptation = {
      adaptationId: `adapt_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`,
      agentId,
      fromRole: this.inferCurrentRole(perf),
      toRole: newRole,
      reason,
      trigger: 'manual',
      timestamp: Date.now(),
      impact: 'neutral',  // 将在后续评估中确定
    };

    this.roleAdaptations.push(adaptation);

    // 发布角色适应事件
    await this.eventBus.publish({
      type: 'AGENT_ROLE_ADAPTED',
      sourceAgent: agentId,
      payload: { adaptation },
    });

    console.log(`[Evol] Role adapted: ${agentId} from ${adaptation.fromRole} to ${newRole}`);
  }

  /**
   * 评估技能
   */
  private async evaluateSkill(skill: SkillEvaluation): Promise<void> {
    const now = Date.now();

    // 计算趋势
    if (skill.usageCount >= 10) {
      const recentSuccess = skill.successRate;
      const avgResponseTime = skill.avgResponseTime;

      // 简单的趋势判定
      if (recentSuccess > 0.8 && avgResponseTime < 1000) {
        skill.trend = 'improving';
      } else if (recentSuccess < 0.6 || avgResponseTime > 3000) {
        skill.trend = 'declining';
      } else {
        skill.trend = 'stable';
      }
    }

    // 更新评估时间
    skill.lastUsed = now;
  }

  /**
   * 推断当前角色
   */
  private inferCurrentRole(perf: AgentPerformance): string {
    const skills = Array.from(perf.skills.values());
    const topSkill = skills.toSorted((a, b) => b.proficiency - a.proficiency)[0];

    if (topSkill) {
      return this.inferRoleFromSkill(topSkill.skillId);
    }

    return 'unknown';
  }

  /**
   * 处理任务完成
   */
  private handleTaskCompleted(event: Event): void {
    const payload = event.payload as { agentId: string; skillId?: string; responseTime?: number };

    const perf = this.agentPerformance.get(payload.agentId);

    if (!perf) {
      return;
    }

    // 更新任务统计
    perf.tasksCompleted++;
    if (payload.responseTime) {
      perf.avgTaskTime = (perf.avgTaskTime * (perf.tasksCompleted - 1) + payload.responseTime) / perf.tasksCompleted;
    }

    // 更新技能统计
    if (payload.skillId) {
      const skill = perf.skills.get(payload.skillId);
      if (skill) {
        skill.usageCount++;
        skill.lastUsed = Date.now();

        // 计算成功率
        skill.successRate = (skill.successRate * (skill.usageCount - 1) + 1) / skill.usageCount;

        if (payload.responseTime) {
          skill.avgResponseTime = (skill.avgResponseTime * (skill.usageCount - 1) + payload.responseTime) / skill.usageCount;
        }

        // 重新计算熟练度
        this.calculateSkillProficiency(skill);
      }
    }
  }

  /**
   * 处理任务失败
   */
  private handleTaskFailed(event: Event): void {
    const payload = event.payload as { agentId: string; skillId?: string };

    const perf = this.agentPerformance.get(payload.agentId);

    if (!perf) {
      return;
    }

    // 更新任务统计
    perf.tasksFailed++;

    // 更新成功率
    const totalTasks = perf.tasksCompleted + perf.tasksFailed;
    perf.successRate = Math.max(0, perf.tasksCompleted / totalTasks);

    // 更新技能统计
    if (payload.skillId) {
      const skill = perf.skills.get(payload.skillId);
      if (skill) {
        skill.usageCount++;

        // 更新成功率（减少）
        skill.successRate = Math.max(0, skill.successRate - 0.1);

        this.calculateSkillProficiency(skill);
      }
    }
  }

  /**
   * 处理 Agent 启动
   */
  private handleAgentStarted(event: Event): void {
    const payload = event.payload as { agentId: string; role?: string };

    const agentId = payload.agentId;

    // 创建 Agent 性能记录
    if (!this.agentPerformance.has(agentId)) {
      const perf: AgentPerformance = {
        agentId,
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        avgTaskTime: 0,
        skills: new Map(),
        score: 100,
        lastUpdated: Date.now(),
      };

      // 初始化技能（基于角色）
      const initialSkills = this.getInitialSkillsForRole(payload.role || 'unknown');
      for (const skill of initialSkills) {
        perf.skills.set(skill.skillId, skill);
      }

      this.agentPerformance.set(agentId, perf);
      this.baselineScores.set(agentId, 100);

      console.log(`[Evol] Agent performance initialized: ${agentId}`);
    }
  }

  /**
   * 获取角色初始技能
   */
  private getInitialSkillsForRole(role: string): SkillEvaluation[] {
    const roleSkills: Record<string, SkillEvaluation[]> = {
      'content_writer': [{
        skillId: 'content_writing',
        name: 'Content Writing',
        proficiency: 0.8,
        usageCount: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        lastUsed: Date.now(),
        trend: 'stable',
      }],
      'search_agent': [{
        skillId: 'search',
        name: 'Information Retrieval',
        proficiency: 0.9,
        usageCount: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        lastUsed: Date.now(),
        trend: 'stable',
      }],
      'interface_agent': [{
        skillId: 'dialogue',
        name: 'Dialogue',
        proficiency: 0.9,
        usageCount: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        lastUsed: Date.now(),
        trend: 'stable',
      }],
      'memory_agent': [{
        skillId: 'memory_management',
        name: 'Memory Management',
        proficiency: 0.85,
        usageCount: 0,
        successRate: 1.0,
        avgResponseTime: 0,
        lastUsed: Date.now(),
        trend: 'stable',
      }],
    };

    return roleSkills[role] || [];
  }

  /**
   * 计算技能熟练度
   */
  private calculateSkillProficiency(skill: SkillEvaluation): void {
    // 基于使用次数、成功率和响应时间计算熟练度
    if (skill.usageCount === 0) {
      return;
    }

    const usageFactor = Math.min(1, skill.usageCount / 100);  // 使用次数归一化
    const successFactor = skill.successRate;

    const responseFactor = Math.max(0, 1 - (skill.avgResponseTime / 2000));  // 响应时间越低越好

    skill.proficiency = usageFactor * 0.4 + successFactor * 0.4 + responseFactor * 0.2;
  }

  /**
   * 获取演化建议
   */
  getEvolutionSuggestions(): EvolutionSuggestion[] {
    return [...this.evolutionSuggestions];
  }

  /**
   * 获取 Agent 性能
   */
  getAgentPerformance(agentId: string): AgentPerformance | undefined {
    return this.agentPerformance.get(agentId);
  }

  /**
   * 获取所有 Agent 性能
   */
  getAllAgentPerformance(): AgentPerformance[] {
    return Array.from(this.agentPerformance.values());
  }

  /**
   * 获取角色适应历史
   */
  getRoleAdaptations(): RoleAdaptation[] {
    return [...this.roleAdaptations];
  }

  /**
   * 重置
   */
  reset(): void {
    this.agentPerformance.clear();
    this.skillEvaluations.clear();
    this.roleAdaptations = [];
    this.evolutionSuggestions = [];
    this.baselineScores.clear();

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.log('[Evol] Dynamic Agent Evolution reset');
  }
}
