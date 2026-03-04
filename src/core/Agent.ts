/**
 * Agent - Base interface for all agents in HiveMind
 *
 * All agents (system and functional) must implement this interface.
 */

import { Event } from '../events/Event.js';
import { EventBus, getGlobalEventBus } from '../events/EventBus.js';

export type AgentType = 'system' | 'functional';

export interface Agent {
  // Identity
  id: string;                    // Unique agent ID
  role: string;                  // Role name (e.g., "Orchestrator", "MoltbookBot")
  type: AgentType;               // System or functional

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;

  // Event handling
  subscribeTo(event: string): void;
  unsubscribeFrom(event: string): void;
  handle(event: Event): void | Promise<void>;

  // State
  getState(): Record<string, unknown>;
  setState(state: Record<string, unknown>): void;

  // Cleanup
  destroy(): Promise<void>;
}

export interface AgentConfig {
  id: string;
  role: string;
  type: AgentType;
  description?: string;
}

export interface SystemAgentConfig extends AgentConfig {
  type: 'system';
  // System agents have fixed roles and are persistent
}

export interface FunctionalAgentConfig extends AgentConfig {
  type: 'functional';
  // Functional agents can be created/destroyed dynamically
  lifespan?: 'task' | 'session' | 'persistent';
  tasks?: string[];  // Tasks this agent is specialized for
}

export abstract class BaseAgent implements Agent {
  protected eventBus: EventBus;
  protected state: Record<string, unknown>;
  protected running: boolean;
  protected subscriptions: Map<string, () => void>;

  constructor(protected config: AgentConfig, eventBus?: EventBus) {
    this.eventBus = eventBus || getGlobalEventBus();
    this.state = {};
    this.running = false;
    this.subscriptions = new Map();
  }

  // Identity
  get id(): string {
    return this.config.id;
  }

  get role(): string {
    return this.config.role;
  }

  get type(): AgentType {
    return this.config.type;
  }

  // Lifecycle
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  isRunning(): boolean {
    return this.running;
  }

  // Event handling
  subscribeTo(event: string): void {
    if (this.subscriptions.has(event)) {
      return; // Already subscribed
    }

    const unsubscribe = this.eventBus.subscribe(event, (e) => this.handle(e));
    this.subscriptions.set(event, unsubscribe);
  }

  unsubscribeFrom(event: string): void {
    const unsubscribe = this.subscriptions.get(event);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(event);
    }
  }

  abstract handle(event: Event): void | Promise<void>;

  // State
  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  setState(state: Record<string, unknown>): void {
    this.state = { ...this.state, ...state };
  }

  // Cleanup
  async destroy(): Promise<void> {
    // Unsubscribe from all events
    for (const unsub of this.subscriptions.values()) {
      unsub();
    }
    this.subscriptions.clear();

    // Stop if running
    if (this.running) {
      await this.stop();
    }
  }
}
