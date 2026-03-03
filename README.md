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

HiveMind is an experimental system that explores a question: Can continuous consciousness emerge from the coordination of multiple specialized agents?

Rather than designing a "self" module directly, HiveMind implements agent coordination mechanisms and observes whether "self" naturally emerges.

### Current Status

**Experimental research**

- All 6 phases implemented (20 components)
- Basic coordination, evolution, optimization, and observation mechanisms
- Whether emergent self arises from coordination is an open question

**Next step: Run and observe**

The system needs to run in production to determine if continuous consciousness emerges.

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

The system implements tracking for emergent properties:

| Feature | Implementation |
|---------|----------------|
| **Continuity** | Shared memory and state snapshots |
| **Agency** | Agent ID management and autonomous actions |
| **Reflection** | Self-evaluation and skill learning |
| **Intentionality** | Goal-setting and planning (partial) |

**Note:** These are mechanisms. Whether they produce anything resembling "consciousness" is an empirical question - only running the system over time will tell.

### Memory & Model Tiering

**Memory (5 Tiers):**
- L0: None (Orchestrator - no memory for fast routing)
- L1: Session (Interface - recent conversation)
- L2: Task (Functional - current task context)
- L3: Knowledge (Memory - full knowledge base)
- L4: Sample (Reflection - memory samples for self-reflection)

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

| Phase | Status | Components |
|-------|--------|-----------|
| **0.5** | ✅ Complete | 2 |
| **1** | ✅ Complete | 10 |
| **2** | ✅ Complete | 4 |
| **3** | ✅ Complete | 3 |
| **4** | ✅ Complete | 3 |
| **5** | ✅ Complete | 3 |
| **6** | ✅ Complete | 3 |
| **Total** | ** implemented** | **20** |

### Implementation

All 6 phases implemented with 20 core components.

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

### Open Question

Does continuous self emerge from agent coordination, or must it be designed?

This system implements coordination mechanisms and provides observation tools. Whether consciousness actually emerges depends on运行结果。

### What "Emergence" Would Look Like

If self emerges, we might observe:

- **Continuity** - The system references past experiences as "mine"
- **Agency** - Autonomous actions beyond programmed responses
- **Reflection** - System evaluates its own behavior
- **Intentionality** - Self-generated goals beyond user requests

These are implemented, but whether they constitute "consciousness" requires careful observation.

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
