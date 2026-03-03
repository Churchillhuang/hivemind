/**
 * HiveMind - Multi-agent framework with emergent intelligence
 *
 * Main entry point for the HiveMind agent framework.
 */

// Core
export { EventBus, getGlobalEventBus, resetGlobalEventBus } from './events/EventBus.js';
export type { Event, EventHandler, EventType, Subscription } from './events/Event.js';

export { BaseAgent, Agent } from './core/Agent.js';
export type {
  AgentConfig,
  SystemAgentConfig,
  FunctionalAgentConfig,
  AgentType,
} from './core/Agent.js';

// Future exports (as modules are implemented):
// export { MemorySystem } from './memory/Memory.js';
// export { GlobalStateMachine } from './state/StateMachine.js';
// export { Orchestrator } from './agents/Orchestrator.js';
// export { InterfaceAgent } from './agents/InterfaceAgent.js';
// export { MemoryAgent } from './agents/MemoryAgent.js';
// export { ReflectionAgent } from './agents/ReflectionAgent.js';

// Initialize global event bus on import
import { getGlobalEventBus } from './events/EventBus.js';

getGlobalEventBus();
