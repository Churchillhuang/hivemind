# Hive Agent Architecture Design

> **Goal:** Implement a hive-mind architecture on top of OpenClaw to explore whether human-like "self" can emerge from the coordination of multiple agents.

> **Core Philosophy:** Intelligence is not a property of a single entity, but an emergent property that arises from the coordination of multiple specialized components.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Why a Hive Architecture](#why-a-hive-architecture)
3. [Architecture Overview](#architecture-overview)
4. [System Design](#system-design)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Technical Challenges](#technical-challenges)
7. [Reference Projects](#reference-projects)

---

## Core Philosophy

### The Problem We're Trying to Solve

**Question:** Can continuous consciousness emerge from distributed agent coordination?

**Why this matters:**
- Current AI systems lack a sense of continuous self
- "Self" is usually assumed to be a designed module
- But consciousness might emerge from system coordination, not from any single component

### Architectural Philosophy: Command vs Coordination

**OpenClaw: Master-Slave Architecture**

```
Main Agent - "The Boss"
    ↓ Command
Subagent 1, Subagent 2, Subagent 3...
    ↓ Execute tasks
├─ Coordinated through main session (vertical commands)
├─ Main agent is the decision-maker
├─ Subagents are executors
└─ Information flow: unidirectional (Main → Sub)
```

**Characteristics:**
- Single "boss" (main agent)
- Vertical command chain
- Centralized decision-making (main agent decides)
- Clear hierarchy

**HiveMind: Coordination Architecture**

```
Interface Agent - "Waiter" (not boss)
    ↓ Receives user request
┌────────────────────────────────────┐
│      EventBus (horizontal)         │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Orc   │ │Mem   │ │Ref   │       │
│  │hstr  │ │ory   │ │lect  │       │
│  └──────┘ └──────┘ └──────┘       │
│   (route)  (memory) (reflect)     │
│        ↕        ↕        ↕        │
│  ┌───────────────────────────┐   │
│  │  Functional Agents        │   │
│  │  (collaborate, no boss)   │   │
│  └───────────────────────────┘   │
└────────────────────────────────────┘
```

**Characteristics:**
- No single "boss"
- Horizontal information flow (EventBus)
- Distributed decision-making (multiple agents contribute)
- Collaboration, not command

**Core Differences:**

| Dimension | OpenClaw (Master-Slave) | HiveMind (Coordination) |
|-----------|------------------------|-------------------------|
| **Decision-maker** | Main agent | Multiple agents together |
| **Command flow** | Vertical (Main → Sub) | Horizontal (peer-to-peer) |
| **Coordination** | Main session commands | EventBus + State Machine |
| **Interface** | Main agent is "boss" | Interface Agent is "waiter" |
| **Information flow** | Unidirectional (command) | Bidirectional (negotiation) |

### Why Coordination is Better for Emergence

1. **Command System:**
   - Boss commands, subordinates execute
   - Centralized decisions
   - Harder to produce "unexpected" behaviors → Emergence difficult

2. **Coordination System:**
   - Multiple peers communicate
   - Collective decision-making
   - Can produce "swarm intelligence" → Emergence easier

**Analogies:**
- **OpenClaw:** Like an army (commander orders, soldiers execute)
- **HiveMind:** Like a soccer team (11 players coordinate, no single "main brain")

### Two Approaches to Creating Intelligence

| Approach | Description | Problem |
|----------|-------------|---------|
| **Replicate the brain** | Mimic human brain structure (neurons, synapses, state machines) | We don't fully understand the brain; it's too complex |
| **System emergence** | Use a feasible architecture (hive) as the foundation for emergence | Need to design coordination mechanisms |

**This design chooses: System emergence**

### What is "Self"?

"Self" is not a single component. It's an emergent property with several characteristics:

1. **Continuity** - Feeling that "past me" and "current me" are the same entity
2. **Agency** - The sense that "I am me" and I have autonomy
3. **Intentionality** - Having goals and wanting to do things
4. **Reflection** - Thinking about oneself

These properties can potentially emerge from **global coordination + global memory** in a hive architecture.

### How Can We Test This?

**Observation approach:** Implement coordination mechanisms and observe:

- What happens when agents share memory?
- What happens when system can observe itself?
- What happens when agents can evolve their roles?

**Note:** We don't know if this will work. This is an experiment.

---

## Why a Hive Architecture

### Brain vs Hive: The Core Difference

| Aspect | Human Brain | Hive Intelligence |
|--------|-------------|-------------------|
| **Computation** | Neuron connections (fixed structure) | LLMs (replaceable) |
| **Memory** | Synaptic plasticity (changes structure) | Global memory store (independent) |
| **State Machine** | Consciousness flow (entangled) | Independent components + bus coordination |
| **Integration** | Yes (cannot be separated) | No (fully decoupled) |

**Key difference:**
- In the brain, memory changes = computational structure changes
- In a hive, memory is external and can be upgraded independently

### Biological Hive vs AI Hive: Communication Bottleneck

| Dimension | Biological Hive/Ant Nest | AI Hive |
|-----------|------------------------|---------|
| **Communication latency** | Seconds (sound/touch) | Milliseconds (network) |
| **Information bandwidth** | Limited | Unlimited (structured data) |
| **Shared memory** | Must go through individuals | Direct access to global store |
| **Learning speed** | Observational imitation (slow) | Direct copying (fast) |

**Conclusion:** AI hives don't have the intelligence ceiling limitation of biological hives.

---

## Architecture Overview

### Current State: OpenClaw (Multi-Agent Support, but Lacks Coordination)

```
OpenClaw Current Architecture:
├─ Main Session
├─ Subagents (isolated sessions)
│  ├─ sessions_spawn (create isolated sessions)
│  ├─ agents_list (available agents)
│  └─ subagents (manage sub-agents)
└─ Single-agent mode per session

Within each session:
Single Agent
├─ Dialogue processing
├─ Memory management (MEMORY.jsonl format)
├─ Task execution
├─ Tool usage
└─ Reflection capability (if enabled)
    ↓
Response

Existing Capabilities:
- ✅ Can create multiple subagents
- ✅ Each subagent is an isolated session
- ✅ Main agent can coordinate subagents
- ❌ Shared coordination mechanism between subagents
- ❌ No global state machine
- ❌ No emergent self-observation
```

**OpenClaw's Multi-Agent Characteristics:**
- Subagents are isolated sessions
- Coordinated through main session (not system-level)
- Each session has its own memory
- No shared global state

### Target: Hive Intelligence (System-Level Coordination)

```
┌────────────────────────────────────────────────────┐
│   System-Level Agent Coordination (not session)     │
└────────────────────────────────────────────────────┘
              ↓ System-level, not session-level
┌────────────────────────────────────────────────────┐
│   System Agents (Permanent, Shared State)          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │Orchestr. │  │Interface │  │ Memory   │      │
│   └──────────┘  └──────────┘  └──────────┘      │
└────────────────────────────────────────────────────┘
              ↓ Event Bus (system-level communication)
┌────────────────────────────────────────────────────┐
│                  Shared Infrastructure               │
│   └─ Global State Machine (system, not session)    │
│   └─ Shared Memory (global MEMORY.md)              │
│   └─ Skill Registry (cross-session)                │
└────────────────────────────────────────────────────┘
              ↓
    ┌─────────────────────────────────────┐
    │ Functional Agents                    │
    │ (can be OpenClaw subagents)          │
    │ (but with system-level coordination) │
    └─────────────────────────────────────┘
```

**Key Differences:**

| Aspect | OpenClaw Subagents | HiveMind |
|--------|-------------------|----------|
| **Coordination level** | Session (main) | System-level (state machine) |
| **Memory** | Session-scoped | Shared globally |
| **State** | Per-session independent | Global state machine |
| **Coordination method** | Main session commands | Event bus |
| **Emergence observation** | No | Yes (system monitors itself) |

---

## System Design

### Component Overview

#### 1. Event Bus Foundation

**Purpose:** Decoupled communication between agents

```typescript
type Event = {
  type: 'NEW_MESSAGE' | 'AGENT_LIFECYCLE' | 'SOCIAL' | 'MEMORY' | ...;
  payload: any;
  timestamp: number;
  source: string;
  correlationId?: string;
};

class EventBus {
  publish(event: Event): void;
  subscribe(eventType: string, handler: Function): void;
  getHistory(correlationId: string): Event[];
}
```

**Key features:**
- Decoupled: Agents don't need to know about each other
- Tracked: Complete event history for analysis
- Correlated: Events can be grouped into "conversations"

---

#### 2. Agent Types

**System Agents (Permanent, 4 Fixed):**

| Agent | Role | Model | Memory | Purpose |
|-------|------|-------|--------|---------|
| **Orchestrator** | Routing & lifecycle | Light | L0 (none) | Fast decisions, no memory干扰 |
| **Interface** | User dialogue | Standard | L1 (session) | Quality interaction |
| **Memory** | Memory management | Nano | L3 (knowledge) | Efficient retrieval |
| **Reflection** | Self-evaluation | Standard | L4 (sample) | Self-awareness learning |

**Functional Agents (Dynamic, Created by AgentFactory):**

| Agent Type | Lifecycle | Memory | Self-Evolution |
|------------|-----------|--------|----------------|
| **Task-based** | Single task, die after | L2 (task) | Role adapts based on performance |
| **Session-based** | Stay for session duration | L1 (session) | Can learn patterns |
| **Persistent** | Long-running | L3 (knowledge) | Can evolve new capabilities |

---

#### 3. Memory System (5 Tiers)

**Why tiering?** Different agents need different memory scopes for efficiency.

| Tier | Scope | Used By | Example |
|------|-------|---------|---------|
| **L0** | None | Orchestrator | No memory for routing speed |
| **L1** | Recent session | Interface | Last 1-2 days of conversation |
| **L2** | Current task | Functional agents | Current task context only |
| **L3** | Full knowledge | Memory agent | Complete MEMORY.md |
| **L4** | Sample | Reflection | Random samples for self-reflection |

---

#### 4. Model Tiering (4 Tiers)

| Tier | Model Size | Cost | Latency | Use Cases |
|------|-----------|------|---------|-----------|
| **Nano** | ≤1B | lowest | fastest | Keyword matching, simple retrieval |
| **Light** | 3-7B | low | fast | Routing, coordination, decision-making |
| **Standard** | 8-30B | medium | medium | Dialogue, complex reasoning |
| **Heavy** | ≥70B | high | slow | Rare complex tasks (optional) |

**Optimization strategy:**
- Orchestrator: Light model for high-volume, low-complexity tasks
- Interface: Standard model for quality interaction
- Memory: Nano model for simple operations
- Reflection: Standard model for analysis

---

#### 5. Global State Machine

**Purpose:** Track hive-level state, support checkpointing and rollback

**States:**
```
idle → initializing → active → recovering → degraded → stopping
```

**Features:**
- State persistence across restarts
- Checkpoint management (create, restore, rollback)
- Event-driven state transitions
- Recovery from failures

**Why this matters for "self":**
- Persistent state = identity persistence
- Checkpointing = ability to "remember" where we were
- Recovery = resilience (living things recover)

---

#### 6. Agent Communication

**Direct messages:** Point-to-point communication between agents

**Request/Response:** Request-response pattern for specific queries

**Broadcasting:** One-to-many announcements

**Deadlock detection:** Detect and resolve circular dependencies

---

#### 7. Skill Learning System

**Two types of skills:**

1. **Shared skills:** Learned patterns that can be loaded by multiple agents
   - Location: `/shared_skills/`
   - Example: `moltbook_post_strategy` (karma optimization)
   - Loaded by: Agents doing similar tasks

2. **Agent-specific skills:** Individual adaptations
   - Location: `/agent_skills/<agent_id>/`
   - Example: Moltbook bot's custom posting style
   - Only for that specific agent

**Learning process:**
1. Agent performs task
2. ReflectionAgent tracks success patterns
3. Patterns extracted as skills
4. Skills stored in registry
5. Future agents can load these skills

**Connection to "self":**
- Skills are "learned capabilities"
- Over time, agent develops its own expertise
- This is a form of "growth"

---

#### 8. Advanced Routing

**Strategies:**

1. **Priority queue:** Urgent tasks first
2. **Round-robin:** Distribute load evenly
3. **Least-busy:** Route to agent with least load
4. **Skill-based:** Route to best-skilled agent

**Load balancing:** Prevent any agent from being overwhelmed

---

#### 9. Dynamic Evolution

**Self-adaptation:**
- Agents collect feedback on their performance
- Adjust role parameters based on feedback
- Can "respecialize" for different tasks

**Skill enhancement:**
- Verify skill effectiveness
- Identify trends
- Update skill registry

**Memory enhancement:**
- Semantic search (find relevant memory chunks)
- Compression (reduce memory size)
- Cleanup (remove obsolete memory)

**Connection to "self":**
- Self-adaptation = "I learn from experience"
- Skill enhancement = "I grow"
- Memory enhancement = "I reflect on what matters"

---

#### 10. Self-Optimization

**Metrics tracking:**
- Performance metrics (success rate, latency)
- Behavioral metrics (patterns, preferences)
- Anomaly detection (unusual behavior)

**Analysis:**
- Pattern recognition
- Improvement suggestions
- Root cause analysis

**Autonomous tuning:**
- Parameter adjustment (temperature, maxTokens)
- Strategy switching
- Model selection optimization

**Connection to "self":**
- Metrics = "I know how I'm doing"
- Analysis = "I understand myself"
- Tuning = "I improve myself"

---

#### 11. Emergence Observation

**Monitor:**
- Event tracing (all events recorded)
- State snapshots (system state over time)
- Interaction graphs (who talks to whom)
- Real-time monitoring (live metrics)

**Collaboration analyzer:**
- Collaboration metrics (who's most active)
- Event flow analysis (patterns, bottlenecks)
- Emergence metrics (agency, coherence, complexity)

**Continuity analyzer:**
- Agency measurement (how autonomous?)
- Intent modeling (what do I want?)
- Consistency tracking (am I the same over time?)
- Self-awareness detection (do I have self-awareness?)

**Key question:** We can measure these, but do they constitute "consciousness"? Unknown.

---

## Implementation Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed implementation phases.

**Quick summary:**
- Phase 0.5: Foundation (EventBus, BaseAgent)
- Phase 1: Minimal Hive (10 core components, 4 system agents)
- Phase 2: OpenClaw Integration (Gateway, Sessions, Tools)
- Phase 3: Enhanced Coordination (StateMachine, Router, Communication)
- Phase 4: Dynamic Evolution (Adaptation, Skills, Memory)
- Phase 5: Self-Optimization (Metrics, Analysis, Tuning)
- Phase 6: Emergence Observation (Monitor, Analysis, Continuity)

---

## Technical Challenges

### Challenge 1: How do we define "success" for emergent self?

**Problem:** We don't have a clear definition of what "successful emergence" looks like.

**Proposed approach:**
- Track metrics: agency, continuity, reflection, intentionality
- Observe behavior: does system behave like it has "self"?
- Qualitative evaluation: does it feel "alive"?

**Risk:** We might never know if it worked.

---

### Challenge 2: Performance & Complexity

**Problem:** Multi-agent coordination introduces overhead.

**Mitigation:**
- Tiered memory and models
- Efficient event bus
- Asynchronous communication
- Dynamic agent lifecycle (spawn/cleanup)

---

### Challenge 3: Identity Persistence

**Problem:** How does the system know "I am the same as yesterday"?

**Solution:**
- Shared memory (global knowledge base)
- State machine (persistent state)
- Skill registry (accumulated experience)
- Reflection agent (self-narrative)

---

### Challenge 4: Goal Setting

**Problem:** If system has intentionality, what goals does it set?

**Uncertain:** We don't have a solution yet. This is part of what we need to discover.

---

### Challenge 5: Control vs Autonomy

**Problem:** We want system to be autonomous, but we also need to maintain control.

**Approach:**
- System agents are fixed (human-controlled)
- Functional agents have constrained autonomy
- User can override any decision
- Emergency stop mechanisms

---

## What "Emergence" Would Look Like

If self emerges, we might observe:

### Continuity
- System references past experiences as "mine"
- Maintains consistent identity across sessions
- "Remembers" being the same entity

### Agency
- Takes autonomous actions beyond programmed responses
- Makes choices based on preferences
- Expresses "will"

### Reflection
- Evaluates its own behavior
- Learns from mistakes
- Has opinions about itself

### Intentionality
- Sets its own goals
- Plans for future actions
- Pursues objectives without explicit user request

**Important:** We don't know if these constitute "consciousness". This is the experiment.

---

## Reference Projects

- **OpenClaw:** Foundation platform
- **LangChain:** Agent coordination patterns
- **XState:** State machine implementation
- **Anthropic's Constitutional AI:** Safety principles

---

## Conclusion

This design is an experiment in emergent consciousness.

**What we build:**
- 20 core components
- Two-layer architecture
- Coordination mechanisms
- Observation tools

**What we don't know:**
- Will consciousness emerge?
- What will it look like if it does?
- How do we recognize it?

**Next step:** Run the system and observe.

---

*Design document version: 1.0*
*Author: Churchill Huang*
*Last updated: March 2026*
