/**
 * EventBus - Event-driven communication layer for HiveMind
 *
 * Provides publish/subscribe mechanism for agent coordination.
 */

import { Event, EventHandler, EventType } from './Event.js';

export class EventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: Event[] = [];
  private correlationIdCounter = 0;

  constructor(private maxHistorySize = 1000) {}

  /**
   * Subscribe to an event type
   */
  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }

    this.subscribers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.unsubscribe(event, handler);
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.subscribers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(event);
      }
    }
  }

  /**
   * Publish an event to all subscribers
   */
  async publish<T = unknown>(event: Event | Omit<Event, 'id' | 'timestamp'>): Promise<void> {
    // Ensure event has required fields
    const fullEvent: Event = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...event,
    };

    // Add to history
    this.addToHistory(fullEvent);

    // Deliver to subscribers
    const handlers = this.subscribers.get(fullEvent.type);
    if (handlers) {
      const promises = Array.from(handlers).map(handler =>
        this.safelyExecuteHandler(handler, fullEvent)
      );
      await Promise.all(promises);
    }

    // Deliver to wildcard subscribers (if any)
    const wildcardHandlers = this.subscribers.get('*');
    if (wildcardHandlers) {
      const promises = Array.from(wildcardHandlers).map(handler =>
        this.safelyExecuteHandler(handler, fullEvent)
      );
      await Promise.all(promises);
    }
  }

  /**
   * Get event history
   */
  getHistory(eventType?: string, limit?: number): Event[] {
    let history = this.eventHistory;

    if (eventType) {
      history = history.filter(e => e.type === eventType);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get number of subscribers
   */
  getSubscriberCount(event: string): number {
    return this.subscribers.get(event)?.size || 0;
  }

  /**
   * Get all subscribed events
   */
  getSubscribedEvents(): string[] {
    return Array.from(this.subscribers.keys());
  }

  // Private methods

  private generateEventId(): string {
    return `evt_${Date.now()}_${this.correlationIdCounter++}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${this.correlationIdCounter++}`;
  }

  private addToHistory(event: Event): void {
    this.eventHistory.push(event);

    // Prune if exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private async safelyExecuteHandler(handler: EventHandler, event: Event): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      console.error(`[EventBus] Error in handler for event ${event.type}:`, error);

      // Publish error event
      await this.publish({
        type: 'AGENT_ERROR',
        sourceAgent: 'EventBus',
        payload: {
          originalEvent: event,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

// Global event bus instance (singleton)
let globalEventBus: EventBus | null = null;

export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetGlobalEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clearHistory();
  }
  globalEventBus = null;
}
