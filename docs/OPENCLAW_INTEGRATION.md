# OpenClaw Integration Strategy

> 如何基于 OpenClaw 构建 HiveMind 扩展

---

## 核心原则

**不重新发明，而是扩展。**

| 方面 | 策略 |
|------|------|
| 文件格式 | ✅ 完全继承（IDENTITY, SOUL, MEMORY, USER, TOOLS, WORKSPACE） |
| Gateway | ✅ 直接复用（WebSocket 服务、多平台支持） |
| Tools | ✅ 直接复用（Browser, Canvas, File 等） |
| Sessions | ✅ 借鉴设计（JSONL 存储，但扩展为多 agent） |
| Skills | ✅ 借鉴 + 扩展（现有技能 + Skill Learning 系统） |
| Agent Runtime | ✅ 基础保留，添加 Swarm 扩展 |

---

## 分支结构

```
main
└── OpenClaw 原始代码（保持同步上游）

swarm-architecture
└── OpenClaw + HiveMind 扩展
    ├── src/core/       ← 扩展：Agent 基础接口
    ├── src/events/     ← 扩展：EventBus
    ├── src/hive/       ← 扩展：SwarmOrchestrator, SharedMemory
    └── docs/
        └── HIVE_AGENT_DESIGN.md
```

---

## 兼容性矩阵

| 功能 | OpenClaw | HiveMind | 兼容性 |
|------|---------|----------|--------|
| **Workspace** | `~/.openclaw/workspace/` | 同目录 | ✅ 完全兼容 |
| **IDENTITY.md** | ✓ | ✓ | ✅ 完全兼容 |
| **SOUL.md** | ✓ | ✓ | ✅ 完全兼容 |
| **MEMORY.md** | ✓ 长期记忆 | ✓ 增强：共享记忆 | ✅ 文件格式兼容 |
| **USER.md** | ✓ | ✓ | ✅ 完全兼容 |
| **TOOLS.md** | ✓ | ✓ | ✅ 完全兼容 |
| **Skills** | `skills/` | `skills/` + 动态技能学习 | ✅ 格式兼容 |
| **Agent** | 单一 Agent | 多 Agent | ⚠️ 模式切换 |
| **Channels** | 多平台直接接入 | 通过 Gateway 接入 | ✅ 完全兼容 |
| **Tools** | 直接调用 | 通过 EventBus 调用 | ✅ 完全兼容 |

---

## 架构集成

```
┌─────────────────────────────────────────┐
│   用户/外部系统                        │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   Gateway (OpenClaw - 直接复用)         │
│   - WebSocket Server                    │
│   - 多平台 Channels                     │
│   - 会话管理                            │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   Hive 扩展层 (新增)                    │
│   ┌──────────┐  ┌──────────┐           │
│   │EventBus  │  │StateMach │           │
│   │ (Agent间通讯)  │ (系统状态)      │            │
│   └──────────┘  └──────────┘           │
│   ┌──────────┐  ┌──────────┐           │
│   │Orchestr. │  │SharedMem │           │
│   │ (Agent调度)  │ (共享记忆)    │            │
│   └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   Agents (扩展版)                       │
│   ├── Original Agent      (OpenClaw)    │
│   └── Hive Agents         (扩展)        │
│       ├── SwarmOrchestrator             │
│       ├── MemoryAgent                  │
│       └── ReflectionAgent               │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   Tools (OpenClaw - 直接复用)           │
│   ├── Browser Control                   │
│   ├── Canvas                            │
│   ├── File Operations                   │
│   └── others...                         │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│   Workspace (OpenClaw 格式完全兼容)     │
│   ├── IDENTITY.md                       │
│   ├── SOUL.md                           │
│   ├── MEMORY.md                         │
│   ├── USER.md                           │
│   └── TOOLS.md                          │
└─────────────────────────────────────────┘
```

---

## 代码组织

### OpenClaw 原始代码（保持不变）

```
src/
├── agents/              ← OpenClaw Agent 系统
├── gateway/             ← Gateway 服务
├── channels/            ← 多平台连接
├── hooks/               ← 生命周期钩子
├── tools/               ← 工具系统
├── skills/              ← 技能系统
├── browser/             ← 浏览器控制
├── canvas-host/         ← Canvas 服务
└── sessions/            ← 会话管理
```

### HiveMind 扩展代码（新增）

```
src/
├── core/
│   └── Agent.ts                    ← Agent 接口扩展
├── events/
│   ├── Event.ts                    ← 事件定义
│   └── EventBus.ts                 ← 事件总线
├── hive/ (待实现)
│   ├── orchestrator/               ← 调度器
│   ├── state/                      ← 状态机
│   ├── memory/                     ← 共享记忆
│   └── skills/                     ← 技能学习
└── index.ts                        ← HiveMind 入口
```

---

## 配置兼容

### OpenClaw 现有配置（完全支持）

```json
// openclaw.json (现有)
{
  "agent": {
    "model": "anthropic/claude-opus-4-6"
  },
  "channels": {
    "telegram": {
      "botToken": "..."
    }
  }
}
```

### HiveMind 新增配置（可选）

```json
// 新增配置项 (在 openclaw.json 中扩展)
{
  "hive": {
    "enabled": true,
    "mode": "multi",              // "single" = 传统模式, "multi" = HiveMind 模式
    "orchestrator": {
      "maxAgents": 10,
      "idleTimeout": 30000
    },
    "stateMachine": {
      "persist": true,
      "checkpointInterval": 10000
    }
  }
}
```

---

## 运行模式切换

### 模式 1：Traditional (OpenClaw single-agent)

```bash
# 自动切换到 single-agent 模式
openclaw agent "Hello"
# 或
openclaw config set hive.enabled false
```

### 模式 2：HiveMind (Multi-agent)

```bash
# 启用 multi-agent 模式
openclaw config set hive.enabled true
openclaw config set hive.mode multi

# 启动（自动初始化 EventBus、Orchestrator 等）
openclaw start
```

**完全向后兼容** - 默认仍然是 single-agent 模式，用户可选择启用 HiveMind。

---

## 依赖关系

| HiveMind 组件 | 依赖 OpenClaw | 依赖其他 HiveMind 组件 |
|---------------|-------------|---------------------|
| EventBus | - | - |
| SharedMemory | Session | EventBus |
| GlobalStateMachine | - | EventBus |
| Orchestrator | Gateway, Sessions | EventBus, StateMachine |
| MemoryAgent | Memory | EventBus |
| ReflectionAgent | - | EventBus, SharedMemory |
| Other Agents | Tools | EventBus |

---

## 迁移路径

### Phase 0: 添加扩展层
```markdown
✅ EventBus 基础实现
✅ Agent 接口扩展
⏳ OpenClaw 集成点确认
```

### Phase 1: 集成现有组件
```markdown
[ ] 与 OpenClaw Sessions 集成
[ ] 与 OpenClaw Gateway 集成
[ ] 与 OpenClaw Tools 集成
```

### Phase 2: 完善 HiveMind
```markdown
[ ] 实现 Orchestrator
[ ] 实现 SharedMemory
[ ] 实现 GlobalStateMachine
```

### Phase 3: 兼容性测试
```markdown
[ ] 单-agent 模式测试
[ ] Multi-agent 模式测试
[ ] 向后兼容测试
```

---

## 与上游同步

当 OpenClaw 发布新版本时：

```bash
# 1. 在 main 分支同步上游
git checkout main
git fetch upstream
git merge upstream/main

# 2. 切换到 swarm-architecture
git checkout swarm-architecture

# 3. 合并 main 的新更新
git merge main

# 4. 解决冲突（如果有）
#    冲突主要可能发生在：
#    - 我们修改的文件被上游更新
#    - 我们需要调整我们的扩展以适配新的上游 API

# 5. 测试
npm test
```

---

## 关键决策点

| 决策 | 选择 | 理由 |
|------|------|------|
| **是否复用 Gateway** | ✅ 复用 | 稳定、已验证、多平台支持 |
| **是否复用 Tools** | ✅ 复用 | 功能完备、无需重写 |
| **是否复用 Sessions** | ⚠️ 借鉴设计 | OpenClaw 的 Sessions 很好，但我们需要多 agent 调度 |
| **是否复用 Skills** | ✅ 复用 + 扩展 | 现有 skills 保留，新增动态学习技能 |
| **是否支持单/多模式切换** | ✅ 支持 | 向后兼容、用户体验平滑 |
| **是否改动原始代码** | ❌ 最小化 | 保持上游同步简单 |

---

*文档版本: 0.1*
*更新时间: 2026-03-02*
