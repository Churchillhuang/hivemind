# Distributed Consensus Decision-Making Implementation

## Overview

This document describes the implementation of distributed consensus decision-making for the HiveMind multi-agent collaboration system, inspired by the honeybee "waggle dance" mechanism.

## Architecture

### Brain vs. Spinal Cord Analogy

- **Architecture Agents (Brainstem)**: InterfaceAgent, MemoryAgent, ReflectionAgent, Orchestrator - provide infrastructure and do NOT participate in consensus
- **Functional Agents (Cortex)**: Dynamically created by AgentFactory - participate in consensus and actually execute tasks

### Communication Protocol

The consensus mechanism uses the following event types (defined in `src/hive/consensus-types.ts`):

1. **TASK_ANNOUNCEMENT**: Task broadcast to all agents
2. **DANCE**: Agent declares it can handle the task with confidence score
3. **SUPPORT**: Agent supports another agent's proposal
4. **WITHDRAW**: Agent withdraws its own proposal
5. **DISCUSSION**: Inter-agent discussion
6. **CONSENSUS_REACHED**: Final consensus result

## Implementation Components

### Core Files

1. **consensus-types.ts**: Communication protocol and type definitions
   - Task announcement structure
   - Dance, Support, Withdraw, Discussion events
   - Consensus state tracking
   - Configuration defaults

2. **ConsensusAgent.ts**: Base class for agents participating in consensus
   - Subscribes to all consensus events
   - Evaluates tasks based on skills
   - Publishes DANCE events
   - Supports/withdraws based on confidence
   - Monitors consensus progress
   - Finalizes consensus when threshold reached

3. **FunctionalAgent.ts**: Actual functional agent that can execute tasks
   - Extends ConsensusAgent
   - Implements task evaluation logic
   - Executes tasks when selected via consensus
   - Calls LLM for task processing
   - Publishes results

4. **ConsensusParticipant.ts**: Helper class for existing agents to participate without changing inheritance

5. **InterfaceAgent.ts**: Modified to act as brainstem
   - Broadcasts TASK_ANNOUNCEMENT
   - Waits for consensus
   - Does NOT participate in consensus itself
   - Falls back to direct execution if no consensus

6. **AgentFactory.ts**: Modified to create real FunctionalAgent instances
   - Creates FunctionalAgent with capabilities
   - Manages agent lifecycle
   - Agents automatically subscribe to events

## Flow Diagram

```
User Input
    ↓
InterfaceAgent (Brainstem)
    ↓
Broadcast TASK_ANNOUNCEMENT
    ↓
    ├─→ func_agent_001 evaluates → DANCE (confidence: 0.7)
    └─→ func_agent_002 evaluates → DANCE (confidence: 0.5)
    ↓
func_agent_001 receives supports
    ↓
CONSENSUS_REACHED (agent: func_agent_001)
    ↓
func_agent_001 executes task
    ↓
Result published (MESSAGE_PROCESSED)
    ↓
InterfaceAgent receives result
    ↓
Response to user
```

## What's Implemented

✅ Consensus communication protocol
✅ ConsensusAgent base class with full logic
✅ FunctionalAgent that can execute tasks
✅ ConsensusParticipant helper
✅ InterfaceAgent broadcasts and waits
✅ AgentFactory creates real FunctionalAgent instances
✅ Task evaluation and confidence scoring
✅ Support and withdraw mechanisms
✅ Consensus monitoring and finalization
✅ Task execution with LLM integration
✅ Result publishing

## What's Next

### Immediate Next Steps

1. **Test the complete flow**: Create integration tests for the consensus flow
2. **Handle edge cases**: What happens when no agents participate? What about timeouts?
3. **Optimize performance**: Reduce latency in consensus formation

### Future Enhancements

1. **Task Decomposition**: When task is complex, decompose into subtasks
2. **Multi-agent Collaboration**: Multiple agents working together on decomposed tasks
3. **Result Aggregation**: Combine results from multiple agents
4. **Skill Learning**: Update agent skills based on task success/failure
5. **Negotiation Strategies**: More sophisticated support/withdraw logic
6. **Discussion Protocol**: Implement inter-agent discussion for complex decisions

## Configuration

### ConsensusConfig

```typescript
{
  danceCollectionTime: 3000,    // 3 seconds
  supportCollectionTime: 2000,  // 2 seconds
  consensusThreshold: 0.6,      // 60% support ratio
  minParticipants: 1,           // Minimum agents
  maxWaitTime: 10000,           // 10 seconds
}
```

### Agent Templates

Agents are created from templates with specific capabilities:

- `moltbook_bot`: Philosophy content generation
- `wp_uploader`: WordPress article management
- `file_analyzer`: File analysis and content extraction
- `general_assistant`: General purpose handler

## Testing

Run tests with:

```bash
pnpm test
```

## Future Architecture Evolution

### Current State

- Centralized task announcement via InterfaceAgent
- Decentralized consensus among functional agents
- Simple direct execution model

### Target State

- Fully distributed task discovery
- Peer-to-peer agent communication
- Complex task decomposition and collaboration
- Emergent behavior through agent interactions
