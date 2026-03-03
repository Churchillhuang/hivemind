/**
 * ReflectionAgent - 自我反思和技能学习 Agent
 *
 * 使用 L4 记忆（抽样 1-2 周），定期自我评估
 */

import { BaseAgent } from '../core/Agent.js';
import { Event, EventType } from '../events/Event.js';
import { EventBus } from '../events/EventBus.js';
import type { HiveConfig } from '../hive/HiveConfig.js';
import type { AgentInfo } from './Orchestrator.js';

/**
 * Reflection - 反思记录
 */
export interface Reflection {
  id: string;
  timestamp: number;
  type: 'self' | 'agent' | 'system';
  subject: string;  // 被评估的 agent 或系统
  findings: ReflectionFinding[];
  recommendations: ReflectionRecommendation[];
  summary: string;
}

/**
 * ReflectionFinding - 发现的问题或模式
 */
export interface ReflectionFinding {
  type: 'strength' | 'weakness' | 'pattern' | 'anomaly';
  description: string;
  evidence: string[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * ReflectionRecommendation - 基于反思的建议
 */
export interface ReflectionRecommendation {
  type: 'improvement' | 'optimization' | 'investigation';
  description: string;
  priority: 'low' | 'medium' | 'high';
  relatedFindings: string[];
}

/**
 * SkillState - 技能状态
 */
export interface SkillState {
  name: string;
  learned: boolean;
  successRate: number;
  lastUsed: number;
  usageCount: number;
}

export class ReflectionAgent extends BaseAgent {
  private hiveConfig: HiveConfig;
  private reflections: Map<string, Reflection> = new Map();
  private skillStore: Map<string, SkillState> = new Map();
  private reflectionInterval: NodeJS.Timeout | null = null;
  private agentStats: Map<string, AgentInfo> = new Map();

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
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 订阅事件
    this.subscribeTo(EventType.MESSAGE_PROCESSED);
    this.subscribeTo(EventType.TASK_COMPLETED);
    this.subscribeTo(EventType.AGENT_ERROR);
    this.subscribeTo(EventType.SKILL_LEARNED);
    this.subscribeTo('REFLECTION_REQUESTED'); // 手动触发

    // 启动定期反思
    this.startReflectionSchedule();

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        schedule: 'reflection_interval_ms',
        interval: 60000, // 1 分钟（MVP）
      },
    });

    console.log(`[ReflectionAgent ${this.id}] Started`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // 停止定期反思
    if (this.reflectionInterval) {
      clearInterval(this.reflectionInterval);
      this.reflectionInterval = null;
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

    console.log(`[ReflectionAgent ${this.id}] Stopped`);
  }

  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case EventType.MESSAGE_PROCESSED:
        await this.trackMessageProcessing(event);
        break;

      case EventType.TASK_COMPLETED:
        await this.onTaskCompleted(event);
        break;

      case EventType.AGENT_ERROR:
        await this.onAgentError(event);
        break;

      case EventType.SKILL_LEARNED:
        await this.onSkillLearned(event);
        break;

      case 'REFLECTION_REQUESTED':
        await this.performReflection();
        break;
    }
  }

  /**
   * 启动定期反思
   */
  private startReflectionSchedule(): void {
    // MVP: 每 60 秒反思一次
    // 实际使用: 每 1-10 分钟，取决于系统负载
    this.reflectionInterval = setInterval(async () => {
      await this.performReflection();
    }, 60000); // 1 分钟

    console.log(`[ReflectionAgent ${this.id}] Reflection schedule started (interval: 60s)`);
  }

  /**
   * 执行自我反思
   */
  private async performReflection(): Promise<void> {
    console.log(`[ReflectionAgent ${this.id}] Performing self-reflection...`);

    // 收集系统状态
    const systemState = await this.collectSystemState();

    // 分析模式
    const findings = this.analyzePatterns(systemState);

    // 生成建议
    const recommendations = this.generateRecommendations(findings);

    // 创建反思记录
    const reflection: Reflection = {
      id: `ref_${Date.now()}`,
      timestamp: Date.now(),
      type: 'self',
      subject: 'System',
      findings,
      recommendations,
      summary: this.generateSummary(findings, recommendations),
    };

    // 存储反思
    this.reflections.set(reflection.id, reflection);

    // 发布反思事件
    await this.eventBus?.publish({
      type: 'SELF_REFLECTION',
      sourceAgent: this.id,
      payload: reflection,
    });

    console.log(`[ReflectionAgent ${this.id}] Reflection completed: ${reflection.summary}`);
  }

  /**
   * 收集系统状态
   */
  private async collectSystemState(): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    agentStats: AgentInfo[];
    recentErrors: number;
  }> {
    let totalTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    let recentErrors = 0;

    // 统计任务
    for (const agent of this.agentStats.values()) {
      totalTasks += agent.stats.tasksCompleted + agent.stats.tasksFailed;
      completedTasks += agent.stats.tasksCompleted;
      failedTasks += agent.stats.tasksFailed;
    }

    // 统计最近的错误（假设有记录）
    // MVP: 简化处理，从反思历史中提取
    const recentReflections = Array.from(this.reflections.values()).slice(-5);
    recentReflections.forEach(ref => {
      const errorFindings = ref.findings.filter(f => f.type === 'weakness');
      recentErrors += errorFindings.length;
    });

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      agentStats: Array.from(this.agentStats.values()),
      recentErrors,
    };
  }

  /**
   * 分析模式
   */
  private analyzePatterns(state: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    agentStats: AgentInfo[];
    recentErrors: number;
  }): ReflectionFinding[] {
    const findings: ReflectionFinding[] = [];

    // 1. 任务完成率
    if (state.totalTasks > 0) {
      const successRate = state.completedTasks / state.totalTasks;
      if (successRate >= 0.9) {
        findings.push({
          type: 'strength',
          description: `High task success rate (${(successRate * 100).toFixed(1)}%)`,
          evidence: [
            `Completed: ${state.completedTasks}/${state.totalTasks}`,
          ],
          severity: 'low',
        });
      } else if (successRate < 0.7) {
        findings.push({
          type: 'weakness',
          description: `Low task success rate (${(successRate * 100).toFixed(1)}%)`,
          evidence: [
            `Completed: ${state.completedTasks}/${state.totalTasks}`,
            `Failed: ${state.failedTasks}`,
          ],
          severity: 'high',
        });
      }
    }

    // 2. Agent 不平衡问题
    const activeAgents = state.agentStats.filter(a => a.isRunning).length;
    if (activeAgents === 0) {
      findings.push({
        type: 'anomaly',
        description: 'No active agents detected',
        evidence: [],
        severity: 'high',
      });
    } else if (activeAgents === 1) {
      findings.push({
        type: 'pattern',
        description: 'Single agent handling all tasks - consider adding more agents',
        evidence: [`Active agents: ${activeAgents}`],
        severity: 'medium',
      });
    }

    // 3. 错误模式
    if (state.recentErrors > 5) {
      findings.push({
        type: 'weakness',
        description: `High error frequency detected (${state.recentErrors} errors in recent reflections)`,
        evidence: [`Recent errors: ${state.recentErrors}`],
        severity: 'high',
      });
    }

    // 4. 技能使用模式
    const unusedSkills = Array.from(this.skillStore.values())
      .filter(s => s.usageCount === 0 && s.learned)
      .length;
    if (unusedSkills > 0) {
      findings.push({
        type: 'pattern',
        description: `${unusedSkills} learned skills not being used`,
        evidence: [],
        severity: 'low',
      });
    }

    return findings;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(findings: ReflectionFinding[]): ReflectionRecommendation[] {
    const recommendations: ReflectionRecommendation[] = [];

    // 基于发现生成建议
    const hasLowSuccessRate = findings.some(f =>
      f.type === 'weakness' && f.description.includes('Low task success rate'),
    );
    if (hasLowSuccessRate) {
      recommendations.push({
        type: 'improvement',
        description: 'Review error patterns and improve error handling in agents',
        priority: 'high',
        relatedFindings: findings.filter(f => f.type === 'weakness').map(f => f.description),
      });
    }

    const hasSingleAgent = findings.some(f =>
      f.type === 'pattern' && f.description.includes('Single agent handling all tasks'),
    );
    if (hasSingleAgent) {
      recommendations.push({
        type: 'optimization',
        description: 'Consider adding specialized agents for better load distribution',
        priority: 'medium',
        relatedFindings: findings.filter(f => f.type === 'pattern').map(f => f.description),
      });
    }

    const hasHighErrors = findings.some(f =>
      f.type === 'weakness' && f.description.includes('High error frequency'),
    );
    if (hasHighErrors) {
      recommendations.push({
        type: 'investigation',
        description: 'Investigate root cause of frequent errors',
        priority: 'high',
        relatedFindings: findings.filter(f => f.type === 'weakness').map(f => f.description),
      });
    }

    return recommendations;
  }

  /**
   * 生成总结
   */
  private generateSummary(
    findings: ReflectionFinding[],
    recommendations: ReflectionRecommendation[],
  ): string {
    const strengths = findings.filter(f => f.type === 'strength').length;
    const weaknesses = findings.filter(f => f.type === 'weakness').length;
    const patterns = findings.filter(f => f.type === 'pattern').length;
    const anomalies = findings.filter(f => f.type === 'anomaly').length;

    let summary = `Reflection: ${strengths} strengths, ${weaknesses} weaknesses, ${patterns} patterns, ${anomalies} anomalies`;

    if (recommendations.length > 0) {
      summary += `. ${recommendations.length} recommendations generated.`;
    }

    return summary;
  }

  /**
   * 跟踪消息处理
   */
  private async trackMessageProcessing(event: Event): Promise<void> {
    const payload = event.payload as {
      messageId: string;
      agentId: string;
    };

    // 更新 Agent 统计（如果有）
    const agent = this.agentStats.get(payload.agentId);
    if (agent) {
      agent.stats.tasksCompleted++;
    }
  }

  /**
   * 任务完成
   */
  private async onTaskCompleted(event: Event): Promise<void> {
    console.log(`[ReflectionAgent ${this.id}] Task completed`);
    // 可以在这里收集更详细的信息
  }

  /**
   * Agent 错误
   */
  private async onAgentError(event: Event): Promise<void> {
    console.log(`[ReflectionAgent ${this.id}] Agent error detected`);
    // 收集错误信息用于反思
  }

  /**
   * 技能学习
   */
  private async onSkillLearned(event: Event): Promise<void> {
    const payload = event.payload as {
      skillName: string;
      successRate: number;
    };

    const skill: SkillState = {
      name: payload.skillName,
      learned: true,
      successRate: payload.successRate,
      lastUsed: Date.now(),
      usageCount: 0,
    };

    this.skillStore.set(payload.skillName, skill);
    console.log(`[ReflectionAgent ${this.id}] Skill learned: ${payload.skillName}`);
  }

  /**
   * 记录 Agent 状态
   */
  recordAgentStats(agent: AgentInfo): void {
    this.agentStats.set(agent.id, agent);
  }

  /**
   * 获取反思记录
   */
  getReflections(limit?: number): Reflection[] {
    const reflections = Array.from(this.reflections.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    if (limit) {
      return reflections.slice(0, limit);
    }
    return reflections;
  }

  /**
   * 获取技能状态
   */
  getSkills(): SkillState[] {
    return Array.from(this.skillStore.values());
  }

  /**
   * 获取状态
   */
  getStatus(): {
    reflectionCount: number;
    skillCount: number;
    agentCount: number;
    latestReflection?: string;
  } {
    const reflections = this.getReflections(1);
    return {
      reflectionCount: this.reflections.size,
      skillCount: this.skillStore.size,
      agentCount: this.agentStats.size,
      latestReflection: reflections[0]?.summary,
    };
  }
}
