/**
 * NegotiationRouter - Dynamic Task Negotiation Router
 *
 * Tasks are assigned through a bidding process:
 * 1. Orchestrator announces: "Who can handle task X?"
 * 2. Agents respond: "I can, here's my bid"
 * 3. Orchestrator selects based on bids
 *
 * This achieves true coordination, not command.
 */

import type { Event } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";

export interface Bid {
  taskId: string;
  agentId: string;
  capabilities: string[];
  estimatedTimeMs: number;
  currentLoad: number; // 0-1
  bidScore: number; // Calculated score
  timestamp: number;
}

export interface TaskAnnouncement {
  taskId: string;
  taskType: string;
  requiredCapabilities: string[];
  priority: "urgent" | "normal" | "low";
  description: string;
  timestamp: number;
  deadline?: number;
}

export interface TaskAssignment {
  taskId: string;
  assignedTo: string;
  bidScore: number;
  timestamp: number;
}

export class NegotiationRouter {
  protected eventBus: EventBus;
  public config: HiveConfig;
  protected negotiationTimeout: number;

  // Current negotiations
  protected pendingNegotiations: Map<
    string,
    {
      announcement: TaskAnnouncement;
      bids: Map<string, Bid>;
      deadline: number;
      timer?: NodeJS.Timeout;
    }
  > = new Map();

  constructor(config: HiveConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus || new EventBus();
    this.negotiationTimeout = config.orchestrator?.negotiationTimeout || 5000;

    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Listen for task announcements
    this.eventBus.subscribe("TASK_ANNOUNCEMENT", (event) => {
      this.handleTaskAnnouncement(event);
    });

    // Listen for bids
    this.eventBus.subscribe("TASK_BID", (event) => {
      this.handleTaskBid(event);
    });
  }

  private handleTaskAnnouncement(_event: Event): void {
    // Announcements are initiated via `announceTask`; no action needed on fanout.
  }

  /**
   * Announce a task for bidding
   */
  announceTask(task: TaskAnnouncement): void {
    // Check if already negotiating
    if (this.pendingNegotiations.has(task.taskId)) {
      console.warn(`[NegotiationRouter] Task ${task.taskId} already in negotiation`);
      return;
    }

    // Create negotiation state
    const negotiation = {
      announcement: task,
      bids: new Map<string, Bid>(),
      deadline: Date.now() + this.negotiationTimeout,
      timer: undefined as NodeJS.Timeout | undefined,
    };

    this.pendingNegotiations.set(task.taskId, negotiation);

    // Announce to all agents
    void this.eventBus
      .publish({
        type: "TASK_ANNOUNCEMENT",
        sourceAgent: "NegotiationRouter",
        payload: task,
      })
      .catch((error: unknown) => {
        console.error("[NegotiationRouter] Failed to publish TASK_ANNOUNCEMENT:", error);
      });

    console.log(`[NegotiationRouter] Task announced: ${task.taskId} (${task.taskType})`);

    // Set timeout to select winner
    negotiation.timer = setTimeout(() => {
      this.selectWinner(task.taskId);
    }, this.negotiationTimeout);
  }

  /**
   * Handle incoming bid
   */
  private handleTaskBid(event: Event): void {
    const bid = event.payload as Bid;

    const negotiation = this.pendingNegotiations.get(bid.taskId);
    if (!negotiation) {
      console.warn(`[NegotiationRouter] Bid for unknown task: ${bid.taskId}`);
      return;
    }

    // Check if task still accepts bids
    if (Date.now() > negotiation.deadline) {
      console.warn(`[NegotiationRouter] Bid received after deadline: ${bid.taskId}`);
      return;
    }

    // Check if agent has required capabilities
    const required = negotiation.announcement.requiredCapabilities;
    const hasCapabilities = required.every((cap) => bid.capabilities.includes(cap));

    if (!hasCapabilities) {
      console.warn(`[NegotiationRouter] Agent ${bid.agentId} missing required capabilities`);
      return;
    }

    // Calculate bid score (lower is better)
    const loadWeight = 0.5; // 50% weight on load
    const timeWeight = 0.3; // 30% weight on estimated time
    const randomWeight = 0.2; // 20% randomness

    const loadScore = bid.currentLoad * loadWeight;
    const timeScore = (bid.estimatedTimeMs / 10000) * timeWeight; // Normalize to 0-1
    const randomScore = Math.random() * randomWeight;

    bid.bidScore = loadScore + timeScore + randomScore;

    // Store bid
    negotiation.bids.set(bid.agentId, bid);

    console.log(
      `[NegotiationRouter] Bid received: ${bid.agentId} (score: ${bid.bidScore.toFixed(3)})`,
    );
  }

  /**
   * Select winning agent
   */
  protected selectWinner(taskId: string): void {
    const negotiation = this.pendingNegotiations.get(taskId);
    if (!negotiation) {
      return;
    }

    // Clear timer
    if (negotiation.timer) {
      clearTimeout(negotiation.timer);
    }

    // Select best bid (lowest score)
    let bestBid: Bid | null = null;
    for (const bid of negotiation.bids.values()) {
      if (!bestBid || bid.bidScore < bestBid.bidScore) {
        bestBid = bid;
      }
    }

    // If no bids, escalate
    if (!bestBid) {
      console.error(`[NegotiationRouter] No bids for task: ${taskId}`);

      void this.eventBus
        .publish({
          type: "TASK_NEGOTIATION_FAILED",
          sourceAgent: "NegotiationRouter",
          payload: {
            taskId,
            reason: "no_bids",
            announcement: negotiation.announcement,
          },
        })
        .catch((error: unknown) => {
          console.error("[NegotiationRouter] Failed to publish TASK_NEGOTIATION_FAILED:", error);
        });

      this.pendingNegotiations.delete(taskId);
      return;
    }

    // Announce winner
    const assignment: TaskAssignment = {
      taskId,
      assignedTo: bestBid.agentId,
      bidScore: bestBid.bidScore,
      timestamp: Date.now(),
    };

    void this.eventBus
      .publish({
        type: "TASK_ASSIGNED",
        sourceAgent: "NegotiationRouter",
        payload: assignment,
      })
      .catch((error: unknown) => {
        console.error("[NegotiationRouter] Failed to publish TASK_ASSIGNED:", error);
      });

    console.log(
      `[NegotiationRouter] Task ${taskId} assigned to ${bestBid.agentId} (score: ${bestBid.bidScore.toFixed(3)})`,
    );

    // Remove from pending
    this.pendingNegotiations.delete(taskId);
  }

  /**
   * Get negotiation status
   */
  getNegotiationStatus(taskId: string) {
    const negotiation = this.pendingNegotiations.get(taskId);
    if (!negotiation) {
      return null;
    }

    return {
      task: negotiation.announcement,
      bids: Array.from(negotiation.bids.values()),
      timeRemaining: Math.max(0, negotiation.deadline - Date.now()),
    };
  }

  /**
   * Cancel negotiation
   */
  cancelNegotiation(taskId: string): void {
    const negotiation = this.pendingNegotiations.get(taskId);
    if (!negotiation) {
      return;
    }

    if (negotiation.timer) {
      clearTimeout(negotiation.timer);
    }

    this.pendingNegotiations.delete(taskId);

    void this.eventBus
      .publish({
        type: "TASK_NEGOTIATION_CANCELLED",
        sourceAgent: "NegotiationRouter",
        payload: { taskId },
      })
      .catch((error: unknown) => {
        console.error("[NegotiationRouter] Failed to publish TASK_NEGOTIATION_CANCELLED:", error);
      });

    console.log(`[NegotiationRouter] Negotiation cancelled: ${taskId}`);
  }

  /**
   * Start negotiation router
   */
  start(): void {
    console.log("[NegotiationRouter] Started");
  }

  /**
   * Stop negotiation router
   */
  stop(): void {
    // Cancel all pending negotiations
    for (const taskId of this.pendingNegotiations.keys()) {
      this.cancelNegotiation(taskId);
    }

    console.log("[NegotiationRouter] Stopped");
  }
}
