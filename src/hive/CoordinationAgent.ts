/**
 * CoordinationAgent - Base Agent with Negotiation Capabilities
 *
 * Extends BaseAgent with task bidding and peer-to-peer communication.
 * Enabled for true coordination architecture.
 */

import { BaseAgent } from './BaseAgent.js';
import type { Event } from '../events/Event.js';
import type { TaskAnnouncement, Bid } from './NegotiationRouter.js';

export interface AgentCapabilities {
  taskTypes: string[];
  skills: string[];
  maxConcurrentTasks?: number;
  avgTaskTimeMs?: number;
}

export class CoordinationAgent extends BaseAgent {
  protected capabilities: AgentCapabilities;
  protected currentLoad: number = 0;  // 0-1

  constructor(
    config: {
      id: string;
      role: string;
      type: 'system' | 'functional';
      description?: string;
    },
    capabilities: AgentCapabilities,
    eventBus?: any,
  ) {
    super(config, eventBus);
    this.capabilities = capabilities;

    this.initializeNegotiationHandlers();
  }

  private initializeNegotiationHandlers(): void {
    // Subscribe to task announcements
    this.subscribeTo('TASK_ANNOUNCEMENT');
    this.subscribeTo('TASK_ASSIGNED');
  }

  /**
   * Calculate current load (0-1)
   */
  protected getCurrentLoad(): number {
    // Load based on active tasks
    const activeTasks = this.getState().activeTasks as number || 0;
    const maxTasks = this.capabilities.maxConcurrentTasks || 5;

    return Math.min(1, activeTasks / maxTasks);
  }

  /**
   * Estimate time to complete task
   */
  protected estimateTaskTime(taskType: string, taskData: unknown): number {
    // Default: use avg task time or default 5000ms
    return this.capabilities.avgTaskTimeMs || 5000;
  }

  /**
   * Check if agent can handle the task
   */
  protected canHandleTask(task: TaskAnnouncement): boolean {
    // Check if task type is supported
    if (!this.capabilities.taskTypes.includes(task.taskType)) {
      return false;
    }

    // Check for required capabilities
    if (task.requiredCapabilities.length > 0) {
      const hasCapabilities = task.requiredCapabilities.every(cap =>
        this.capabilities.skills.includes(cap)
      );
      if (!hasCapabilities) {
        return false;
      }
    }

    // Check load (optional - still can bid if high load)
    return true;
  }

  /**
   * Place bid for task
   */
  protected placeBid(task: TaskAnnouncement): Bid | null {
    if (!this.canHandleTask(task)) {
      return null;
    }

    const bid: Bid = {
      agentId: this.id,
      capabilities: this.capabilities.skils || this.capabilities.taskTypes || [],
      estimatedTimeMs: this.estimateTaskTime(task.taskType, null),
      currentLoad: this.getCurrentLoad(),
      bidScore: 0,  // Will be calculated by NegotiationRouter
      timestamp: Date.now(),
    };

    return bid;
  }

  /**
   * Send peer-to-peer message
   */
  async sendPeerMessage(toAgentId: string, content: string, data?: Record<string, unknown>): Promise<unknown> {
    const message = {
      type: 'direct' as const,
      from: this.id,
      to: toAgentId,
      content,
      data,
      timestamp: Date.now(),
    };

    await this.eventBus?.publish({
      type: 'AGENT_MESSAGE',
      sourceAgent: this.id,
      payload: message,
    });

    console.log(`[${this.id}] Sent message to ${toAgentId}: ${content}`);
  }

  /**
   * Request help from peer
   */
  async requestHelp(
    toAgentId: string,
    request: string,
    data?: Record<string, unknown>
  ): Promise<unknown> {
    const requestMsg = {
      type: 'request' as const,
      from: this.id,
      to: toAgentId,
      content: request,
      data,
      timestamp: Date.now(),
    };

    await this.eventBus?.publish({
      type: 'AGENT_REQUEST',
      sourceAgent: this.id,
      payload: requestMsg,
    });

    console.log(`[${this.id}] Requested help from ${toAgentId}: ${request}`);

    // In a real implementation, this would await a response
    return { status: 'sent' };
  }

  /**
   * Handle task announcement (base implementation)
   */
  protected async handleTaskAnnouncement(event: Event): Promise<void> {
    const task = event.payload as TaskAnnouncement;

    // Decide whether to bid
    const bid = this.placeBid(task);

    if (bid) {
      await this.eventBus?.publish({
        type: 'TASK_BID',
        sourceAgent: this.id,
        payload: bid,
      });

      console.log(`[${this.id}] Placed bid for task: ${task.taskId} (score: ${bid.bidScore.toFixed(3)})`);
    }
  }

  /**
   * Handle task assignment
   */
  protected async handleTaskAssignment(event: Event): Promise<void> {
    const assignment = event.payload as { taskId: string; assignedTo: string };

    if (assignment.assignedTo === this.id) {
      console.log(`[${this.id}] Task assigned: ${assignment.taskId}`);

      // Increment task count
      const state = this.getState();
      state.activeTasks = (state.activeTasks as number || 0) + 1;
      this.setState(state);

      // Start processing task
      await this.processTask(assignment.taskId);
    }
  }

  /**
   * Process assigned task (override in subclasses)
   */
  protected async processTask(taskId: string): Promise<void> {
    // Default implementation: just log
    console.log(`[${this.id}] Processing task: ${taskId}`);

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Decrement task count
    const state = this.getState();
    state.activeTasks = Math.max(0, (state.activeTasks as number || 1) - 1);
    state.tasksCompleted = (state.tasksCompleted as number || 0) + 1;
    this.setState(state);

    // Publish completion
    await this.eventBus?.publish({
      type: 'TASK_COMPLETED',
      sourceAgent: this.id,
      payload: { taskId },
    });

    console.log(`[${this.id}] Task completed: ${taskId}`);
  }

  /**
   * Handle incoming events (extend base implementation)
   */
  async handle(event: Event): Promise<void> {
    switch (event.type) {
      case 'TASK_ANNOUNCEMENT':
        await this.handleTaskAnnouncement(event);
        break;

      case 'TASK_ASSIGNED':
        await this.handleTaskAssignment(event);
        break;

      default:
        await super.handle(event);
    }
  }
}
