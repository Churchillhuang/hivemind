/**
 * Event Bus - Core Event System for HiveMind
 *
 * Decouples agents through an event-driven communication layer.
 * All inter-agent communication flows through the event bus.
 */

export enum EventType {
  // System Events
  SYSTEM_START = "SYSTEM_START",
  SYSTEM_STOP = "SYSTEM_STOP",
  AGENT_STARTED = "AGENT_STARTED",
  AGENT_STOPPED = "AGENT_STOPPED",
  AGENT_ERROR = "AGENT_ERROR",
  AGENT_CREATE_REQUEST = "AGENT_CREATE_REQUEST",

  // Message Events
  NEW_MESSAGE = "NEW_MESSAGE",
  MESSAGE_PROCESSED = "MESSAGE_PROCESSED",
  MEMORY_QUERY = "MEMORY_QUERY",
  MEMORY_UPDATE = "MEMORY_UPDATE",
  MEMORY_RESULT = "MEMORY_RESULT",

  // Social Events
  SOCIAL_UPDATE = "SOCIAL_UPDATE",
  SOCIAL_POST = "SOCIAL_POST",
  SOCIAL_REPLY = "SOCIAL_REPLY",

  // Task Events
  TASK_CREATED = "TASK_CREATED",
  TASK_REQUESTED = "TASK_REQUESTED",
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TASK_STARTED = "TASK_STARTED",
  TASK_COMPLETED = "TASK_COMPLETED",
  TASK_FAILED = "TASK_FAILED",

  // State Events
  STATE_TRANSITION = "STATE_TRANSITION",

  // Reflection Events
  SELF_REFLECTION = "SELF_REFLECTION",
  SKILL_LEARNED = "SKILL_LEARNED",
  SKILL_UPDATED = "SKILL_UPDATED",

  // Planning Events
  PLAN_CHANGE = "PLAN_CHANGE",
  PLAN_EXECUTED = "PLAN_EXECUTED",

  // Hive Events
  HIVE_BRIDGE_INITIALIZED = "HIVE_BRIDGE_INITIALIZED",
  HIVE_BRIDGE_SHUTDOWN = "HIVE_BRIDGE_SHUTDOWN",
}

export interface Event {
  type: EventType | string;
  payload: unknown;
  timestamp: number;
  sourceAgent: string;
  routingMode?: "direct" | "negotiated";
  correlationId?: string; // For tracking event chains
  id?: string; // Unique event ID
}

export type EventHandler = (event: Event) => void | Promise<void>;

export interface Subscription {
  event: string;
  handler: EventHandler;
  subscribedAt: number;
}
