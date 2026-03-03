# OpenClaw Integration Design

> HiveMind 如何扩展 OpenClaw：集成点、数据流、生命周期

---

## 核心理念

**不改变 OpenClaw 的核心，而是在其外部添加"协调层"。**

```
OpenClaw
├── Gateway (WebSocket Server)
├── Channels (Telegram, Discord, etc.)
├── Tools (Browser, Canvas, etc.)
└── Session Management

HiveMind 扩展层
├── HiveGatewayBridge (桥接 Gateway 和 EventBus)
├── HiveInterfaceAgent (处理用户消息)
├── Orchestrator (Agent 调度)
├── System Agents (Memory, Reflection, etc.)
└── Functional Agents (动态生成)
```

---

## 集成拓扑

```
用户 → Channel (Telegram/Discord/etc.)
    ↓ (WebSocket)
Gateway (OpenClaw)
    ↓
    ├─ 传统模式：直接调用 Agent Runtime → 响应
    └─ HiveMind 模式：
        ↓
        HiveGatewayBridge (拦截消息)
        ↓
        EventBus.publish(NEW_MESSAGE)
        ↓
        Orchestrator (决定路由)
        ↓
        ┌──────────┬──────────┬──────────┐
        ↓          ↓          ↓          ↓
        Interface  Memory     Reflection  Others
        Agent      Agent      Agent       Agents
        └──────────┴──────────┴──────────┘
        ↓ EventBus.publish(MESSAGE_PROCESSED)
        ↓
        HiveInterfaceAgent (收集响应)
        ↓
        返回给 Gateway → Channel → 用户
```

---

## 集成点详解

### 集成点 1：Gateway Bridge

**位置：** 在 Gateway 的消息处理和 Agent 调用之间

**职责：**
- 如果是 HiveMind 模式，拦截消息
- 发布到 EventBus
- 等待 EventBus 上的 MESSAGE_PROCESSED
- 返回结果给 Gateway

**接口：**

```typescript
interface HiveGatewayBridge {
  // 初始化
  init(gateway: Gateway, eventBus: EventBus): void;

  // 拦截消息
  interceptMessage(inboundMessage: InboundMessage): Promise<OutboundMessage>;

  // 检查是否启用了 HiveMind
  isHiveEnabled(): boolean;

  // 切换模式 (single ↔ multi)
  setMode(mode: 'single' | 'multi'): void;
}
```

**实现策略：**

```typescript
class HiveGatewayBridge {
  private mode: 'single' | 'multi' = 'single';

  async interceptMessage(msg: InboundMessage): Promise<OutboundMessage> {
    if (this.mode === 'single' || !config.hive.enabled) {
      // 传统模式：直接让 OpenClaw 处理
      return gateway.originalAgentHandler(msg);
    }

    // HiveMind 模式：
    await eventBus.publish({
      type: 'NEW_MESSAGE',
      payload: msg,
      sourceAgent: 'GatewayBridge',
    });

    // 等待消息被处理
    const response = await this.waitforMessageProcessed(msg.id);

    return response;
  }
}
```

---

### 集成点 2：Interface Agent

**继承自：** OpenClaw 的 Agent 运行时

**新增能力：**
- 负责与用户对话
- 可以调用其他 Agents（通过 EventBus）
- 可以请求 Memory、Reflection 等

**接口：**

```typescript
class InterfaceAgent extends OpenClawAgent {
  // 覆盖：处理消息时，先发布到 EventBus
  async handle(message: Message): Promise<Response> {
    // 发布到 EventBus
    await eventBus.publish({
      type: 'NEW_MESSAGE',
      payload: message,
      sourceAgent: this.id,
    });

    // 决定是否需要其他 Agent
    const context = await this.analyzeNeed(message);

    if (context.needsMemory) {
      // 请求 Memory Agent
      const memory = await this.requestMemory(context.query);
      message = this.augmentWithMemory(message, memory);
    }

    // 用 LLM 生成响应
    const response = await originalAgentHandler(message);

    // 发布响应到 EventBus
    await eventBus.publish({
      type: 'MESSAGE_PROCESSED',
      payload: response,
      sourceAgent: this.id,
    });

    return response;
  }
}
```

---

### 集成点 3：Session 扩展

**OpenClaw 原有：** 单 Agent 会话

**HiveMind 扩展：** 多 Agent 会话，共享全局状态

```typescript
interface HiveSession extends Session {
  // 新增：记录参与的 Agents
  participatingAgents: string[];

  // 新增：全局状态机 ID
  stateMachineId?: string;
  // 新增：全局记忆上下文
  sharedMemoryId?: string;

  // 继承原有的 Session 方法
  transcript(): Transcript;
  compact(): void;
  // ...
}
```

---

## 数据流：完整的消息处理过程

### 步骤 1：用户发送消息

```
用户："Hello, who are you?"
    ↓
Channel (Telegram)
    ↓
Gateway WebSocket 收到
    ↓
```

### 步骤 2：Gateway 路由

```typescript
// 在 Gateway 中
async handleInboundMessage(msg) {
  if (isHiveEnabled()) {
    // HiveMind 模式
    return hiveBridge.interceptMessage(msg);
  } else {
    // 传统单 Agent 模式
    return agentRuntime.run(msg);
  }
}
```

### 步骤 3：HiveMind 处理（如果启用）

```typescript
// HiveGatewayBridge
1. interceptMessage(msg) 被调用

2. 发布 NEW_MESSAGE 事件到 EventBus
   - 所有订阅者都会收到
   - Orchestrator、InterfaceAgent 等都收到

3. 等待 MESSAGE_PROCESSED 事件
   - 某个 Agent 处理完后会发布这个事件

4. 返回响应给 Gateway

```

### 步骤 4：Agent 协作（HiveMind 内部）

```
EventBus: NEW_MESSAGE 事件发出
    ↓
┌─────────────────────────────────────────┐
│ Orchestrator 收到事件                   │
│  检测到这是用户消息                      │
│  决定路由到 InterfaceAgent             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ InterfaceAgent 收到: NEW_MESSAGE       │
│  1. 分析消息需要什么                    │
│     - 需要访问记忆？ → 请求 Memory     │
│     - 需要调用工具？ → 通过 EventBus   │
│     - 需要社交互动？ → 创建 SocialAgent │
│                                        │
│  2. 决定：需要查询记忆                  │
│     发布 MEMORY_QUERY 事件             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ MemoryAgent 收到: MEMORY_QUERY         │
│  1. 查询 MEMORY.md                     │
│  2. 返回相关片段                       │
│  发布 MEMORY_RESULT 事件               │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ InterfaceAgent 收到: MEMORY_RESULT     │
│  1. 用 LLM 生成响应（包含记忆上下文）   │
│  2. 生成: "I'm Xiaolong (小虾)..."    │
│  3. 发布 MESSAGE_PROCESSED 事件         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ HiveGatewayBridge 收到:                 │
│  MESSAGE_PROCESSED                      │
│  停止等待，返回响应                      │
└─────────────────────────────────────────┘
```

### 步骤 5：响应返回给 Gateway

```
Gateway 收到响应
    ↓
发送回 Channel (Telegram)
    ↓
用户收到："I'm Xiaolong (小虾)..."
```

---

## 配置集成

### OpenClaw 配置文件扩展

```json
// openclaw.json
{
  // 现有的配置（保持不变）
  "agent": {
    "model": "anthropic/claude-opus-4-6"
  },
  "channels": {
    "telegram": {
      "botToken": "..."
    }
  },

  // 新增：HiveMind 配置
  "hive": {
    "enabled": true,
    "mode": "multi",

    // EventBus 配置
    "eventBus": {
      "maxHistorySize": 1000
    },

    // Orchestrator 配置
    "orchestrator": {
      "maxAgents": 10,
      "idleTimeout": 30000,
      "model": "lightweight"  // 轻量模型用于调度
    },

    // State Machine 配置
    "stateMachine": {
      "persist": true,
      "checkpointInterval": 10000,
      "checkpointPath": "/var/lib/hivemind/state.json"
    },

    // Agents 配置
    "agents": {
      "system": {
        "interface": {"enabled": true},
        "memory": {"enabled": true},
        "orchestrator": {"enabled": true},
        "reflection": {"enabled": true}
      },
      "functional": {
        "enabled": true,
        "maxConcurrent": 5,
        "lifespan": "task"
      }
    },

    // 技能学习配置
    "skillLearning": {
      "enabled": true,
      "sharedSkillsPath": "shared_skills/",
      "agentSkillsPath": "agent_skills/",
      "minSuccessThreshold": 0.8
    }
  }
}
```

---

## 兼容性：传统模式 vs HiveMind 模式

### 模式切换机制

```typescript
// 在 Gateway 中
function handleInboundMessage(msg) {
  if (config.hive.enabled && config.hive.mode === 'multi') {
    return hiveMode(msg);          // 使用 HiveMind
  } else {
    return traditionalMode(msg);  // 使用原始单 Agent
  }
}
```

### 传统模式（单 Agent）

```
用户消息
    ↓
Gateway
    ↓
原始 Agent Runtime（单 LLM 调用）
    ↓
响应
    ↓
Gateway
    ↓
用户
```

**与现有 OpenClaw 100% 相同**，性能不会有显著差异。

### HiveMind 模式（Multi-Agent）

```
用户消息
    ↓
Gateway
    ↓
HiveGatewayBridge
    ↓
EventBus + 多 Agents 协作
    ↓
响应（可能更丰富，因为是协调的结果）
    ↓
Gateway
    ↓
用户
```

**功能增强**，但性能可能稍有下降（因为多个 Agents 之间的协调）。

---

## 实施优先级

### Phase 1.0: 最小集成（现在做）

- [ ] HiveGatewayBridge - 拦截 Gateway 消息
- [ ] InterfaceAgent - 最简单的 Agent 继承
- [ ] EventBus - 已完成
- [ ] 配置读取 - 读取 openclaw.json 中的 hive 配置

**MVP（最小可行产品）：**
```
用户消息 → HiveGatewayBridge → InterfaceAgent → EventBus → 响应
```

### Phase 1.1: 增强集成

- [ ] 与 OpenClaw Session 集成 - 记录 Agent 协作历史
- [ ] MemoryAgent - 基于 OpenClaw 的 memory 系统
- [ ] Orchestrator - 简单的路由逻辑

```
用户消息 → 发布 NEW_MESSAGE → Orchestrator 决定路由 → InterfaceAgent 获取 Memory → LLM 生成 → 响应
```

### Phase 1.2: 完整集成

- [ ] 与 OpenClaw Tools 集成 - Agents 可以调用工具
- [ ] ReflectionAgent - 自我评估
- [ ] 动态 Agent 生成
- [ ] 全局状态机

```
多个 Agents 协作完成复杂任务
```

---

## 与上游同步的策略

当 OpenClaw 更新时：

```
1. 在 main 分支同步
   git checkout main
   git merge upstream/main

2. 查看 diff，关注：
   - Agent 运行时 API 变化
   - Session API 变化
   - Protocol/Schema 变化

3. 在 swarm-architecture 分支合并
   git checkout swarm-architecture
   git merge main

4. 解决冲突（如果有）
   - 主要是我们的扩展和上游更新之间
   - 通常不需要太多修改，因为我们是扩展，不是覆盖

5. 测试
   - 单 Agent 模式（确保没有破坏）
   - HiveMind 模式（确保集成仍然有效）
```

---

## 测试策略

### 单元测试

```
[ ] test EventBus - 基础功能
[ ] test HiveGatewayBridge - 拦截和发布事件
[ ] test InterfaceAgent - 继承并扩展
[ ] test Integration - 与 OpenClaw 集成
```

### 集成测试

```
[ ] Traditional Mode - 确保 OpenClaw 仍然正常工作
[ ] HiveMind Mode - 确保多 Agent 协作有效
[ ] 模式切换 - 确保模式切换不破坏现有功能
```

---

*文档版本: 0.1*
*创建时间: 2026-03-02*
