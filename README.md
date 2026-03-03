# HiveMind 🐝

> Multi-agent architecture with emergent consciousness through swarm intelligence

**Version:** 0.1.0 (Experimental)
**Author:** Churchill Huang

---

## Vision

HiveMind is an agent architecture where individual agents coordinate through an event bus, shared memory, and a global state machine to create a unified, persistent "self" that emerges from the system's interactions.

Unlike traditional single-agent systems, HiveMind is:
- **Multi-agent by design** - Specialized agents work together
- **Persistent** - State and memory survive across sessions
- **Self-evolving** - Agents learn from experience and adapt
- **Skill-based** - Experience is captured as reusable skills

**Core Philosophy:** Intelligence is not a property of a single entity but emerges from the coordination of multiple specialized components.

---

## Architecture

### Two-Layer Architecture

```
┌─────────────────────────────────────────┐
│   System Agents (Permanent, Lightweight) │
│  ├─ Orchestrator  (调度/路由)           │
│  ├─ Interface     (对话/路由)           │
│  ├─ Memory        (记忆管理)           │
│  └─ Reflection    (自我评估/演进)      │
└─────────────────────────────────────────┘
            ↓协调 via Event Bus
┌─────────────────────────────────────────┐
│   Functional Agents (Dynamic, Adaptive) │
│  Generated on-demand for specific tasks │
│  └─ Self-evolving roles
└─────────────────────────────────────────┘
```

### Key Components

- **Event Bus** - Decoupled communication layer
- **Global State Machine** - Tracks hive-level state and transitions
- **Shared Memory** - Persistent knowledge and identity
- **Skill Learning** - Extracts patterns from experience as reusable skills
- **Orchestrator** - Lightweight scheduling and agent lifecycle management

---

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Documentation

- [Architecture Design](./docs/HIVE_AGENT_DESIGN.md)
- [Implementation Roadmap](./docs/ROADMAP.md)
- [API Reference](./docs/API.md)

---

## Status

⚠️ **This project is in early experimental stages.**

- v0.1.0: Initial framework setup
- Event bus core implementation
- Agent lifecycle management

---

## License

MIT
