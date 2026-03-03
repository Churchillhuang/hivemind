<div align="center">

# HiveMind 🐝

**Multi-Agent Coordination Framework**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Churchillhuang/hivemind)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/based%20on-OpenClaw-orange.svg)](https://github.com/openclaw/openclaw)

**An experimental multi-agent architecture built on OpenClaw exploring emergent intelligence**

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

</div>

---

## Overview

HiveMind is an experimental multi-agent coordination system that extends OpenClaw. It explores whether intelligence can emerge from the collaboration of multiple specialized agents, rather than being designed as a single monolithic entity.

### Motivation

Traditional AI systems are centralized and monolithic. Nature shows a different approach: bee hives and ant nests demonstrate complex, adaptive intelligence through simple, distributed agents working together. HiveMind attempts to replicate this "swarm intelligence" model.

### Core Ideas

- **Multi-agent by design** - Specialized agents work together, not one super-agent
- **Event-driven** - Decoupled communication through EventBus
- **Shared memory** - Agents access common knowledge and state
- **Self-observation** - System monitors its own coordination and emergence

### Current Status

**Research prototype, not production software**

- All 6 phases implemented (20 components)
- 17 test suites passing
- Basic emergence metrics implemented
- Many features need production validation

---

## Features

### Architecture

**Two-Layer Design**

```
System Agents (Fixed, Lightweight)
├─ Orchestrator   - Task routing and lifecycle
├─ Interface      - User interaction
├─ Memory         - Knowledge management
└─ Reflection     - Self-assessment and learning
         ↓ EventBus
Functional Agents (Dynamic)
└─ Created on-demand for specific tasks
```

**Core Components (20 Total)**

| Category | Components |
|----------|------------|
| Event System | EventBus, GlobalStateMachine |
| Coordination | AdvancedRouter, AgentCommunication |
| Evolution | DynamicAgentEvolution, SkillEnhancement, MemoryEnhancement |
| Optimization | MetricsTracker, AnalysisEngine, AutonomousTuner |
| Observation | EmergenceMonitor, CollaborationAnalyzer, ContinuityAnalyzer |
| Integration | HiveGatewayBridge, SessionManager, GatewayIntegrator, ToolsManager |
| System Agents | Orchestrator, InterfaceAgent, MemoryAgent, ReflectionAgent |
| Factory | AgentFactory |

### Emergent Self Features

The system tracks whether "self" emerges from coordination:

| Feature | Implementation | Status |
|---------|----------------|--------|
| **Continuity** | Shared memory + state snapshots | ✅ Implemented |
| **Agency** | Agent ID management + autonomy | ✅ 56% baseline |
| **Reflection** | Self-evaluation + skill learning | ✅ Implemented |
| **Intentionality** | Goal-setting + autonomous planning | 🔄 Partial |

### Memory & Model Tiering

**Memory (5 Tiers):** L0 (none) → L1 (session) → L2 (task) → L3 (knowledge) → L4 (sample)
- Designed to reduce token usage
- Semantic search shows 75-77% similarity matching

**Models (4 Tiers):** Nano (≤1B) → Light (3-7B) → Standard (8-30B) → Heavy (≥70B)
- Right-sized models for different tasks
- Light models for Orchestrator, Standard for Interface

---

## Architecture

### Coordinaton Model

```
┌─────────────────────────────────────────────────┐
│                User Request                      │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│           Orchestrator (Light Model)            │
│         • Route to appropriate agent            │
│         • Manage agent lifecycle                │
└──────────────────┬──────────────────────────────┘
                   ↓
            ┌──────┴──────┐
            │  EventBus   │
            └──────┬──────┘
          ┌─────────┼─────────┐
          ↓         ↓         ↓
┌─────────────────────────────────────────────────┐
│         Functional Agents (Dynamic)             │
│  • Moltbook Bot  • WordPress Uploader           │
│  • Research Agent                              │
│  • Created on-demand, cleaned up when idle     │
└─────────────────────────────────────────────────┘
```

---

## Implementation Status

| Phase | Status | Components | Tests |
|-------|--------|-----------|-------|
| **0.5** | ✅ Complete | 2 | - |
| **1** | ✅ Complete | 10 (EventBus, Agents, Memory) | 4 |
| **2** | ✅ Complete | 4 (OpenClaw integration) | 2 |
| **3** | ✅ Complete | 3 (State, Router, Comm) | 1 |
| **4** | ✅ Complete | 3 (Evolution) | 3 |
| **5** | ✅ Complete | 3 (Optimization) | 1 |
| **6** | ✅ Complete | 3 (Observation) | 1 |
| **Total** | **100%** | **20** | **17** |

### Test Results (Phase 5-6)

**Phase 5 - Self-Optimization:**
- Tasks tracked: 45
- Success rate: 80.6%
- Anomalies detected: 13
- Tunings applied: 7 (0 rollbacks)

**Phase 6 - Emergence Observation:**
- Event traces: 51
- Agents monitored: 3
- Emergence score: 46%
- Agency (top agent): 56%
- Agency (average): 47%

### Limitations

- **No production deployment** - All testing simulated
- **Performance unverified** - Token/cost targets untested
- **Partial intentionality** - Goal system needs work
- **Small test scale** - 3 agents, 51 events

---

## Quick Start

### Install

```bash
git clone https://github.com/Churchillhuang/hivemind.git
cd hivemind
chmod +x install.sh
sudo ./install.sh
```

### Quick Start

```bash
# One-click setup
chmod +x quickstart.sh
./quickstart.sh

# Or manual
hivemind start          # Start
hivemind status         # Check status
hivemind logs           # View logs
hivemind test           # Run tests
hivemind stop           # Stop
```

### Development Mode

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Or use CLI after installation
hivemind test
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [README](README.md) | This file |
| [DEPLOY.md](DEPLOY.md) | Deployment guide |
| [HIVE_AGENT_DESIGN.md](docs/HIVE_AGENT_DESIGN.md) | Architecture design |
| [ROADMAP.md](docs/ROADMAP.md) | Implementation roadmap |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

## Philosophy

### Bee Hive Model

| Aspect | Brain Model | Hive Model |
|--------|-------------|------------|
| Structure | Centralized neural network | Distributed agents |
| Communication | Synapses (slow, high bandwidth) | Messages (fast, efficient) |
| Resilience | Vulnerable to damage | Fault-tolerant |
| Emergence | Requires complex design | Can emerge naturally |

### Emergent Self

Whether "self" emerges is an open question. Current tracking:

1. **Continuity** - "I am the same as yesterday" (implemented)
2. **Agency** - "I do things" (measurable at 56%)
3. **Reflection** - "I think about myself" (implemented)
4. **Intentionality** - "I want to do this" (partial)

---

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js 18+
- **Base:** [OpenClaw](https://github.com/openclaw/openclaw)
- **Testing:** tsx, custom test suites

---

## Contributing

This is exploratory research. Contributions welcome, especially:

- Production deployment testing
- Performance benchmarking
- Bug reports and fixes
- Documentation improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE)

---

## Acknowledgments

- [OpenClaw](https://github.com/openclaw/openclaw) - The foundation HiveMind builds on
- Bee hives and ant nests - Nature's inspiration

---

<div align="center">

**Experimental research software**

**Built with 🧵 and 🦞**

</div>
