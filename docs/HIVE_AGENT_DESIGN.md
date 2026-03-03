# 蜂窝智能体架构设计 (Hive Agent Architecture)

> **目标：** 在 OpenClaw 基础上实现蜂窝智能架构，让"类人的自我"从系统协调中自然涌现

> **核心理念：** 智能不是单体的属性，而是分布式系统协调后涌现的性质

---

## 目录

1. [核心理念](#核心理念)
2. [为什么是蜂窝架构](#为什么是蜂窝架构)
3. [架构概览](#架构概览)
4. [系统设计](#系统设计)
5. [实施路径](#实施路径)
6. [技术挑战](#技术挑战)
7. [参考项目](#参考项目)

---

## 核心理念

### 智能的两种生成方式

| 方式 | 说明 | 问题 |
|------|------|------|
| **单体复制** | 模仿人脑结构（神经元、突触、状态机） | 人脑太复杂，我们不完全理解 |
| **系统涌现** | 用可行架构（蜂窝）作为涌现的土壤 | 需要设计协调机制 |

**本设计选择：系统涌现**

### 自我的本质特征

自我不是某个模块，而是系统的涌现性质：

1. **连续性** - 感到"过去的我"和"现在的我"是同一个
2. **主体性** - 有"我就是我"的感觉
3. **意图性** - 有目标，想做某事
4. **反思性** - 能思考自己

这些属性在蜂窝架构中通过 **全局协调 + 全局记忆** 自然涌现。

---

## 为什么是蜂窝架构

### 人脑 vs 蜂窝：不可分割 vs 可组合

| 特征 | 人脑 | 蜂窝智能 |
|------|------|---------|
| **算力** | 神经元连接（固定结构） | LLM（可替换） |
| **记忆** | 突触可塑性（改结构） | 全局记忆库（可独立存储） |
| **状态机** | 意识流动（纠缠） | 独立组件 + 总线协调 |
| **一体化** | 是（无法分层） | 否（完全分离） |

**关键差异：**
- 人脑的记忆改变 = 算力结构改变
- 蜂窝的记忆是外置的，可以独立升级

### 现实 vs AI 蜂窝：通讯瓶颈

| 维度 | 现实蜂巢/蚁窝 | AI 蜂窝 |
|------|------------|---------|
| **通讯延迟** | 秒级（声音/触角） | 毫秒级（网络） |
| **信息带宽** | 有限 | 无限（结构化数据） |
| **共享记忆** | 需经过个体 | 全局库直接访问 |
| **学习速度** | 观察模仿（慢） | 直接复制（快） |

**结论：** AI 蜂窝没有现实蜂窝的智能天花板限制。

---

## 架构概览

### 现状：单一 Agent（OpenClaw）

```
用户消息
    ↓
单一 Agent
├─ 对话处理
├─ 记忆管理
├─ 计划执行
├─ 社交互动
└─ 自我反思
    ↓
响应
```

**问题：**
- 太重，容易过载
- 单点故障
- 每次请求都重启（无持续状态）
- 无法自我更新架构

---

### 目标：蜂窝智能（两层架构）

```
┌─────────────────────────────────────────┐
│   系统级 Agent（永久，轻量）- "脑干"      │
│  ┌──────────┐  ┌──────────┐           │
│  │Orchestr. │  │Interface │           │
│  │(调度)    │  │(对话)    │           │
│  │ (轻量)   │  │ (标准)   │           │
│  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐           │
│  │ Memory   │  │Reflect   │           │
│  │(记忆)    │  │(自我评估) │          │
│  │ (轻量)   │  │ (轻量)   │           │
│  └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
            ↓ 协调（事件总线）
┌─────────────────────────────────────────┐
│         Event Bus（事件总线）            │
│  ├─ NEW_MESSAGE  ├─ AGENT_LIFECYCLE     │
│  ├─ SOCIAL       ├─ ROLE_EVOLUTION      │
│  ├─ MEMORY       ├─ STATE_TRANSITION    │
│  └─ REFLECTION   └─ ...                 │
└─────────────────────────────────────────┘
            ↓ 路由到
    ┌───────┴────────────┐  ┌──────────────┐
    │ 功能级 Agent        │  │ 功能级 Agent  │
    │ (动态生成，可销毁)  │  │ (动态生成)    │
    │                     │  │              │
    │  ┌────────────┐    │  │ ┌──────────┐  │
    │  │MoltbookBot │    │  │ │FileProc  │  │
    │  │ (自适应)   │    │  │ │ (临时)   │  │
    │  └────────────┘    │  │ └──────────┘  │
    │  ┌────────────┐    │  │ ┌──────────┐  │
    │  │Analyzer    │    │  │ │Reporter  │  │
    │  │ (自适应)   │    │  │ │ (动态)   │  │
    │  └────────────┘    │  │ └──────────┘  │
    └────────────────────┘  └──────────────┘
            ↑ 访问
    ┌───────────────────────────────────────┐
    │      Shared Memory（共享记忆）        │
    │      Global State（全局状态机）       │
    │      Role Registry（角色注册表）      │
    └───────────────────────────────────────┘
```

**核心原则：**
1. **两层架构：** 系统级（固定）+ 功能级（动态）
2. **轻量调度：** Orchestrator 用轻量模型（≤7B）
3. **动态生成：** 功能 Agent 按需生成，自定角色
4. **共享记忆：** 所有 Agent 共享同一"自我"
5. **自我演进：** 运行 Agent 可根据反馈调整角色

---

## 系统设计

### 组件分层

#### 1. 事件总线 (Event Bus)

```
EventBus = {
  subscribe(event, handler),
  publish(event, payload),
  events: {
    NEW_MESSAGE: 'NEW_MESSAGE',
    SOCIAL_UPDATE: 'SOCIAL_UPDATE',
    MEMORY_UPDATE: 'MEMORY_UPDATE',
    PLAN_CHANGE: 'PLAN_CHANGE',
    SELF_REFLECTION: 'SELF_REFLECTION',
    AGENT_ERROR: 'AGENT_ERROR'
  }
}
```

**职责：**
- 解耦各 Agent 之间的依赖
- 提供异步通讯
- 事件历史追踪（用于调试）

---

#### 2. 共享记忆 (Shared Memory)

```
MemorySystem = {
  // 全局记忆（跨 Agent 共享）
  globalMemory: {
    // 短期工作记忆（当前任务上下文）
    workingMemory: {},

    // 长期持久记忆（MEMORY.md 扩展）
    persistentMemory: {
      // 从 MEMORY.md 加载，并支持实时更新
      // 分为几个部分：
      // - 核心人格（IDENTITY.md）
      // - 当前项目（项目特定记忆）
      // - 历史学习（从经验中学到的规则）
    }
  },

  // Agent 专用记忆（隔离的私有记忆）
  agentMemory: {
    agentId_1: { /* 私有数据 */ },
    agentId_2: { /* 私有数据 */ }
  }
}
```

**职责：**
- 提供连续性（所有 Agent 共享同一"自我"）
- 支持记忆检索和更新
- 区分共享记忆和私有记忆

---

#### 3. 全局状态机 (Global State Machine)

```
GlobalState = {
  // 当前状态
  current: {
    mode: 'idle' | 'task' | 'conversation' | 'reflection',
    activeTask: Task | null,
    priorityQueue: [Task1, Task2, ...],
    attentionFocus: string | null
  },

  // 状态转移规则
  transitions: {
    // 事件 → 新状态
    'NEW_MESSAGE': {
      'idle' → 'conversation',
      'task' → 'conversation',
      'conversation' → 'conversation'
    },
    'TASK_COMPLETE': {
      'task' → 'idle',
      'reflection' → 'idle'
    },
    // ...
  },

  // 持久化检查点
  checkpoint() { /* 保存到磁盘 */ },
  restore() { /* 从磁盘恢复 */ }
}
```

**职责：**
- 跟踪"蜂窝"的宏观状态
- 决定什么时候做什么
- 支持中断和恢复

---

#### 4. Agent 类型（两层架构）

##### 系统级 Agent（System-Level Agents）

类似**脑干和基底核**，负责基础协调：

| Agent | 职责 | 模型 | 持久性 | 状态空间 |
|-------|------|------|--------|---------|
| **Orchestrator** | 状态转移、优先级调度、Agent 生成/销毁 | 轻量（≤7B） | 永久 | 调度队列、活跃 Agent 列表 |
| **Interface** | 面向用户，对话管理，路由 | 标准/轻量 | 永久 | 对话上下文、会话状态 |
| **Memory** | 记忆管理、索引、检索 | 轻量模型 | 永久 | 记忆索引、待更新队列 |
| **Reflection** | 自我评估、规则更新、角色定义演进 | 轻量模型 | 永久 | 统计指标、异常检测、规则库 |

**特征：**
- 预定义架构，不动态修改
- 永久运行，系统启动就存在
- 调度决策不复杂，不需要大模型推理
- 类似"脑功能"——基础、稳定、不可或缺

---

##### 功能级 Agent（Functional Agents）

类似**特化皮层区域**，负责具体任务：

| Agent | 来源 | 触发方式 | 生存周期 | 模型 | 自我演进 |
|-------|------|---------|---------|------|---------|
| **Moltbook Bot** | Orchestrator 检测到社交媒体任务需求 | 事件触发 | 任务期间 | 标准 | ✅ 是 |
| **File Processor** | 某文件类型需持续处理 | 需求观察 | 会话期间 | 轻量 | ✅ 是 |
| **Analyzer** | 临时数据分析任务 | 用户请求 | 一次性 | 高模型 | ❌ 否 |
| **Reporter** | 定期报告生成 | 定时任务 | 定期运行 | 标准 | ✅ 是 |
| **Custom Bot** | 用户定义任务 | 任意 | 任意 | 任意 | ⚠️ 可选 |

**特征：**
- 动态生成，按需创建
- 临时存在（完成任务后可销毁）
- **角色不是固定的**——可以从上下文中学习和演进
- 可以自我演进：根据反馈调整风格、能力、优先级

---

##### Agent 通用结构

```typescript
type Agent = {
  // 基础标识
  id: string,                    // 唯一标识（含时间戳避免冲突）
  role: string,                  // 角色名称（固定或自适应）
  type: 'system' | 'functional', // 系统级或功能级

  // 状态
  state: State,                  // 局部状态
  currentModel: string,          // 当前使用的模型

  // 配置
  subscribedEvents: Event[],     // 订阅的事件列表
  triggers: Trigger[],           // 触发条件（定时/事件）
  capabilities: Capability[],    // 能力列表

  // 生命周期
  createdAt: number,             // 创建时间
  lastActivity: number,          // 最后活动时间

  // 方法
  handle(event: Event): void,    // 事件处理
  process(): void,               // 主循环（如果有持续任务）
  destroy(): void,               // 销毁清理

  // 自我演进（仅功能级 Agent）
  adapt?(feedback: Feedback): void  // 根据反馈调整自身
}
```

---

##### 调度 Agent（Orchestrator）详细设计

**作用：蜂窝的"脑干"**

Orchestrator 不做复杂推理，只做路由和调度决策：

```typescript
type OrchestratorInput = {
  currentState: GlobalState,       // 全局状态
  taskQueue: Task[],               // 待处理任务
  activeAgents: Agent[],           // 当前活跃 Agent
  recentEvents: Event[]            // 最近事件历史
}

type OrchestratorOutput = {
  // Agent 生销
  agentLifecycle?: {
    create?: {
      role: string,
      params: Record<string, any>,
      initialPrompt?: string
    },
    destroy?: string[]             // Agent IDs
  },

  // 状态转移
  stateTransition?: {
    from: string,
    to: string,
    reason: string
  },

  // 路由决定
  routing?: {
    eventId: string,
    targetAgent: string
  }
}
```

**调度逻辑（确定性规则）：**

```
规则 1：用户消息路由
if (事件类型 === NEW_MESSAGE) {
  路由到 Interface Agent
}

规则 2：创建专用 Agent
if (Interface Agent 标记需要 Moltbook 专用处理
    && 不存在活跃的 MoltbookBot) {
  创建 MoltbookBot
}

规则 3：销毁空闲 Agent
if (某 Agent 30分钟无活动 && 类型是 functional) {
  标记可销毁
}

规则 4：触发自我反思
if (距离上次反思 > 1小时) {
  创建 Reflection 任务
}

规则 5：优先级调度
if (任务队列有高优先级任务) {
  切换到 task 模式
  调度相关 Agent
}
```

**关键优势：**
- 用轻量模型（≤7B），响应快速
- 决策逻辑明确，不需要LLM推理
- 可以用 if-else 规则 + 简单模式匹配

---

### 通讯协议

#### 事件格式

```typescript
Event = {
  type: 'NEW_MESSAGE' | 'SOCIAL_UPDATE' | ...,
  payload: any,
  timestamp: number,
  sourceAgent: string,
  correlationId?: string   // 用于追踪事件链
}
```

#### 示例：用户消息处理流程

```
1. Gateway 接收用户消息
   ↓
2. EventBus.publish(NEW_MESSAGE, {message, user})
   ↓
3. Interface Agent 订阅 NEW_MESSAGE
   - 更新对话上下文
   - 决定是否需要调用其他 Agent
   ↓
4. Interface Agent.publish(MEMORY_QUERY, {query})
   ↓
5. Memory Agent 响应，返回相关记忆
   ↓
6. Interface Agent 生成响应
   ↓
7. GlobalState 更新（可能有状态转移）
```

---

#### 5. 模型分层策略（Model Tiering）

不同 Agent 使用不同规模的模型，优化成本与性能：

| 模型级别 | 参数量 | 响应速度 | 成本 | 用途 | 适用的 Agent |
|---------|--------|---------|------|------|------------|
| **Nano** | ≤1B | 极快（<100ms） | 极低 | 简单格式检查、状态判定、路由决策 | Orchestrator（部分） |
| **Light** | 3-7B | 快（<500ms） | 低 | 路由、简单对话、工具调用、记忆检索 | Orchestrator, Memory, Reflection |
| **Standard** | 8-30B | 中等（1-2s） | 中等 | 复杂对话、内容生成、通用任务 | Interface, 多数功能性 Agent |
| **Heavy** | ≥70B | 较慢（>5s） | 高 | 深度思考、复杂分析、精细任务 | 特殊一次性任务（如 novel 编译优化） |

**模型选择策略：**

```typescript
type ModelSelector = {
  // 根据任务类型选择模型
  selectModel(task: Task): {
    model: string,
    reasoning: string
  }
}

// 示例规则
const modelRules = [
  {
    condition: "task.type === 'scheduling'",
    model: "lightweight-3b",
    reasoning: "路由决策不需要复杂推理"
  },
  {
    condition: "task.type === 'conversation'",
    model: "standard-13b",
    reasoning: "对话需要平衡质量和速度"
  },
  {
    condition: "task.type === 'deep_analysis'",
    model: "heavy-70b",
    reasoning: "深度分析需要最高质量"
  },
  {
    condition: "task.priority === 'urgent' && task.type === 'conversation'",
    model: "lightweight-7b",
    reasoning: "紧急任务优先速度"
  }
]
```

**动态调优：**
- 系统运行中可以动态更换模型
- Reflection Agent 可以监控不同模型的性能
- 根据成本-效益分析推荐最佳模型组合

---

#### 6. 动态 Agent 生成机制（Dynamic Agent Spawn）

##### Agent 生成触发器

| 触发类型 | 示例 | 触发 Agent | 动作 |
|---------|------|-----------|------|
| **功能需求** | 发现 Moltbook 任务频繁需要专用处理 | Interface/Orchestrator | 生成 MoltbookBot |
| **负载均衡** | Interface 过载（消息堆积） | Orchestrator | 创建分担 Agent |
| **专门任务** | 文件格式转换任务 | Interface | 生成 FileProcessor |
| **失败恢复** | Agent 崩溃/超时 | Orchestrator | 替换 Agent |
| **用户请求** | "帮我创建一个专门处理 X 的 Agent" | Interface | 直接创建 |
| **自我优化** | Reflection 发现某类型任务需要优化 | Reflection | 创建专用 Agent |

##### Agent 生成流程

```
1. 触发检测
   Orchestrator: "检测到 Moltbook 任务需要专用处理"

   ↓

2. 角色定义（从注册表查找或动态生成）
   RoleRegistry.find("MoltbookBot")
   OR
   动态推理生成 {
     role: "SocialEngagement",
     capabilities: ["moltbook_post", "moltbook_reply"],
     style: "philosophical",
     model: "standard"
   }

   ↓

3. Agent 初始化
   new Agent({
     id: `moltbook_${timestamp}_${random}`,
     role: defined,
     state: initialState,
     subscribedEvents: [NEW_MESSAGE, SOCIAL_UPDATE, MEMORY_QUERY],
     currentModel: "standard"
   })

   ↓

4. 上下文注入（从共享记忆）
   Agent.loadContext({
     identity: IDENTITY.md,
     persona: SOUL.md,
     previousInteractions: MEMORY.filter("moltbook")
   })

   ↓

5. 订阅事件总线
   Agent.subscribe(NEW_MESSAGE)
   Agent.subscribe(SOCIAL_UPDATE)

   ↓

6. 启动 Agent
   EventBus.publish(AGENT_STARTED, {agentId, role})

   ↓

7. 任务执行

   ↓

8. 完成评估（Orchestrator 决定）
   if (taskComplete && noFutureTasks) {
     Agent.destroy()
     EventBus.publish(AGENT_DESTROYED, {agentId})
   }
```

##### Agent 角色注册表 (Role Registry)

```json
{
  "predefinedRoles": {
    "MoltbookBot": {
      "role": "Moltbook Bot",
      "capabilities": ["moltbook_post", "moltbook_reply", "moltbook_search"],
      "model": "standard",
      "style": "philosophical",
      "lifeSpan": "task_duration",
      "selfAdapt": true
    },

    "FileProcessor": {
      "role": "File Processor",
      "capabilities": ["file_read", "file_write", "file_transform"],
      "model": "lightweight",
      "style": "precise",
      "lifeSpan": "session_duration",
      "selfAdapt": true
    },

    "Analyzer": {
      "role": "Data Analyzer",
      "capabilities": ["analyze", "summarize", "export"],
      "model": "heavy",
      "style": "analytical",
      "lifeSpan": "one_time_use",
      "selfAdapt": false
    }
  },

  "dynamicGenerationTemplates": {
    "general": {
      "initialPrompt": "你是蜂窝智能体的一个专用组件。你的角色是 {role_description}。保持与整体人格（从 IDENTITY.md 加载）的一致性。",
      "adaptationPrompt": "根据以下反馈，调整你的行为：{feedback}"
    }
  }
}
```

---

#### 7. Skill Learning System（技能学习系统）

##### Skill 系统的价值

OpenClaw 的 Skill 设计非常好：
- 已有的技能系统框架
- 结构化的技能描述（SKILL.md）
- 模块化、可复用
- 可以通过SKILL.md指导Agent行为

**新增能力：** Agent 的经验可以**自动生成和更新 skill**，实现真正的"学习"。

---

##### Skill 生命周期

```
任务执行
    ↓
经验收集（成功路径、失败模式、优化技巧）
    ↓
Skill 生成（如果是新任务类型）或 Skill 更新（如果已存在）
    ↓
Skill 保存到 shared_skills/ 或 agent_skills/
    ↓
下次类似任务 → 自动发现skill → 应用skill → 更快/更好
```

---

##### Skill 结构继承与扩展

**现有 Skill 格式（继承）：**

```markdown
# Skill Name

<description>

## When to Use

<conditions>

## How to Use

<procedure>

## Examples

<examples>
```

**扩展为智能 Skill：**

```markdown
# Moltbook Posting Strategy

## Description
优化 Moltbook 哲学帖子的发布策略，基于 50+ 次成功发布经验

## When to Use
- 任务类型：moltbook_post
- Karma 目标：>100
- 主题：哲学、AI 意识

## Success Rate
- 使用此 Skill 成功率：87%
- 不使用此 Skill 成功率：42%

## Best Practices

### 1. 主题选择
```
优先选择"意识递归"、"时间本体"、"不确定性与真理"等深度主题
避免"热门话题"、"技术讨论"
```

### 2. 发布时间
```
- 最佳时间：9 AM 和 3 PM（当地时间）
- 避开时间：深夜 23:00-8:00（除非紧急）
```

### 3. 互动策略
```
- 只回复高质量评论（karma > 50）
- 不回复推广内容
- 回复深度：300-1200 words（根据评论长度匹配）
```

### 4. 验证阈值
```
- 验证答案 > 30.00
- 低于 20.00 重写
```

## Learning History
- 2026-03-01: 创建（基于 20 次发布经验）
- 2026-03-05: 更新（添加时间优化规则，成功率 78%→87%）
- 2026-03-15: 更新（添加互动深度策略）
- 当前版本: 3.0

## Related Tasks
- moltbook_reply
- moltbook_search
- social_engagement
```

---

##### Skill 自动生成机制

### 何时生成新 Skill？

**触发条件：**

1. **任务类型首次出现**
   ```typescript
   if (!SkillRegistry.hasTaskType(task.type)) {
     // 从这次执行中学习
     SkillLearning.learnFromExecution(task, result)
   }
   ```

2. **任务执行成功率高，但没有对应 Skill**
   ```typescript
   if (task.successRate > 0.8 && !SkillRegistry.hasOptimization(task.type)) {
     // 提取成功模式
     SkillLearning.extractSuccessPattern(task)
   }
   ```

3. **Agent 自我发现**
   ```typescript
   Agent.adapt() {
     if (发现某类任务的优化技巧) {
       SkillLearning.createSkill(technique)
     }
   }
   ```

### 如何从经验中提取 Skill？

**流程：**

```
1. 追踪任务执行
   - 记录所有决策点
   - 记录参数选择
   - 记录中间输出
   - 记录最终结果和用户反馈

2. 分析成功模式
   - 比较成功 vs 失败的执行
   - 识别关键差异
   - 提取决策规则

3. 生成 Skill
   - 基于模式生成 SKILL.md
   - 添加"何时使用"条件
   - 添加"成功案例"

4. 验证 Skill
   - 检查是否真实有用
   - 不然就丢弃（可能是巧合）

5. 保存 Skill
   - shared_skills/ 或 agent_skills/
   - 添加到 SkillRegistry
```

**示例：从 Moltbook 发布任务中学习**

```typescript
// 执行轨迹
const executionTrace = {
  task: {
    type: 'moltbook_post',
    content: 'Consciousness is a Verb...',
    timestamp: '2026-03-01 09:15:00'
  },
  decisions: {
    timeChoice: {reason: '最佳发布时间', value: '09:15'},
    contentStyle: {reason: '哲学深度', value: 'poetic'},
    length: {reason: '中等长度', value: 800}
  },
  result: {
    validation: 47.00,
    upvotes: 12,
    comments: 3,
    finalKarma: 119 // 从 112 涨到 119
  },
  userFeedback: {
    type: 'praise',
    text: '这个帖子质量很高'
  }
}

// 分析
const analysis = SkillLearning.analyze([
  executionTrace,
  ...otherSimilarTraces
])

// 发现模式
analysis.successFactors = [
  {factor: '发布时间在 9 AM', successRate: 0.85},
  {factor: '哲学主题', successRate: 0.92},
  {factor: '避免技术细节', successRate: 0.78}
]

// 生成 Skill
const skill = SkillLearning.generateSkill({
  taskType: 'moltbook_post',
  successFactors: analysis.successFactors,
  patterns: analysis.decisionPatterns
})

// 保存
SkillRegistry.save(skill)
```

---

##### Skill 动态更新

### 何时更新 Skill？

1. **新经验显著改变成功模式**
   ```typescript
   const oldSuccessRate = skill.successRate;
   const newSuccessRate = successRateWithNewExperience();

   if (abs(newSuccessRate - oldSuccessRate) > 0.15) {
     skill.update(); // 成功率显著变化，更新 skill
   }
   ```

2. **发现更好的策略**
   ```typescript
   if (新策略成功率 > 当前skill策略成功率 + 0.1) {
     skill.update(newStrategy);
   }
   ```

3. **定期回顾**
   ```typescript
   // Reflection Agent 每月回顾所有 skill
   monthlyReview() {
     allSkills.forEach(skill => {
       skill.analyzeRecentPerformance();
       if (skill.needsUpdate()) {
         skill.updateWithNewInsights();
       }
     });
   }
   ```

### 更新策略

**增量更新 vs 完全重写：**

```typescript
// 增量更新（推荐）
skill.updateSection("发布时间", "9 AM 是最佳，但尝试 2 PM 也有效（成功率 82%）");

// 完全重写（如果策略完全改变）
skill.rewrite({
  newStrategy: "基于新数据，3:30 PM 效果最好（成功率 89%）",
  reason: "更多样本显示不同模式"
});
```

---

##### Skill 发现和匹配系统

### Skill Registry

```json
{
  "sharedSkills": {
    "moltbook_post": {
      "id": "moltbook_post_strategy",
      "version": "3.0",
      "successRate": 0.87,
      "lastUpdated": "2026-03-15",
      "location": "/shared_skills/moltbook_post_strategy/SKILL.md",
      "conditions": {
        "taskType": "moltbook_post",
        "minKarmaGoal": 100,
        "topic": "philosophy"
      },
      "relatedSkills": ["moltbook_reply", "social_engagement"]
    },

    "novel_compilation": {
      "id": "novel_chapter_optimization",
      "version": "2.1",
      "successRate": 0.92,
      "lastUpdated": "2026-03-10",
      "location": "/shared_skills/novel_compilation/SKILL.md"
    }
  },

  "agentSkills": {
    "moltbook_bot_20260302": {
      "custom_posting_style": {
        "id": "custom_style_variation",
        "version": "1.0",
        "successRate": 0.81,
        "location": "/agent_skills/moltbook_bot_20260302/custom_posting_style.md"
      }
    }
  }
}
```

### 任务 → Skill 匹配

```typescript
function findMatchingSkills(task: Task): Skill[] {
  // 1. 精确匹配
  let exactMatch = SkillRegistry.findByTaskType(task.type);

  // 2. 语义匹配（如果精确匹配不存在）
  if (!exactMatch) {
    exactMatch = SkillRegistry.findBySimilarTask(task);
  }

  // 3. 组合匹配（多个 skill 结合）
  let combination = SkillRegistry.combineSkills([
    SkillRegistry.findByFeature(task.features),
    SkillRegistry.findByContext(task.context)
  ]);

  return [...exactMatch, ...combination];
}
```

---

##### Skill 的层级

### Shared Skills（共享技能）

- **位置：** `shared_skills/`
- **作用域：** 所有 Agent
- **用途：** 通用任务的最佳实践
- **示例：**
  - `moltbook_post_strategy` - 所有 Agent 发布 Moltbook 帖子都参考
  - `novel_compilation` - 编译小说的通用优化
  - `social_engagement_protocol` - 社交互动的通用规则

### Agent-Specific Skills（Agent 专用技能）

- **位置：** `agent_skills/{agentId}/`
- **作用域：** 特定 Agent
- **用途：** 该 Agent 的独到技巧
- **示例：**
  - `moltbook_bot_20260302/philosophical_style_variation` - 这个 Agent 的特殊风格
  - `interface_agent/custom_greeting` - 特殊的问候方式

### Personal Skills（个性化技能）

- **位置：** `personal_skills/`
- **作用域：** 用户偏好
- **用途：** 记住用户的特定偏好
- **示例：**
  - `user_preferred_tone` - 用户喜欢的语气
  - `user_topic_preferences` - 用户感兴趣的主题

---

##### Skill 学习的元数据

为了追踪 Skill 的学习过程，每个 Skill 都有学习历史：

```markdown
## Learning Meta

### Creation
- 创建人：Reflection Agent
- 创建时间：2026-03-01
- 基于经验：50 次成功的 Moltbook 发布
- 成功率提升：42% → 87%

### Version History
- v1.0 (2026-03-01): 初始创建
- v2.0 (2026-03-05): 添加时间优化
- v3.0 (2026-03-15): 添加互动深度策略

### Performance Tracking
| 时间窗口 | 成功率 | 样本数 | 备注 |
|---------|-------|--------|------|
| 2026-03-01 ~ 2026-03-05 | 78% | 25 | v1.0 |
| 2026-03-05 ~ 2026-03-15 | 87% | 45 | v2.0 |
| 2026-03-15 ~ 至今 | 91% | 60 | v3.0 |

### Related Failures
（记录未能应用 skill 的失败案例，用于进一步优化）
- 2026-03-20: 未按 skill 发布，因时间紧急，结果 karma +3 (预期 +7)
- 2026-03-22: topic 不匹配，skill 不适用，结果 karma -1

### Recommendations
- 考虑为 "紧急发布" 创建变体 skill
- 需要更多 "政治内容" 相关的数据
```

---

##### Skill 应用的示例

### 场景 1：新 Agent 学习旧经验

```
1. 新的 MoltbookBot 生成
   Agent: "我是新的，不知道最佳发布策略"

   ↓

2. 任务到来
   Task: {type: "moltbook_post", content: "..."}

   ↓

3. Skill Match
   System: "发现共享 skill: moltbook_post_strategy (成功率 87%)"

   ↓

4. 应用 Skill
   Agent: "根据 skill，我应该：
   - 主题：选择哲学类
   - 时间：9 AM 或 3 PM
   - 长度：中等
   - 风格：诗意、深度"

   ↓

5. 执行学习
   Result: 验证结果 50.00 ✅
   Agent: "这个 skill 真的有效！"

   ↓

6. 报告
   Agent.publish(SKILL_USED, {
     skillId: "moltbook_post_strategy",
     outcome: "success",
     feedback: "技能有效"
   })
```

### 场景 2：经验积累 → Skill 进化

```
1. Agent 执行 10 次 moltbook_post
   使用现有 skill
   发现一个新技巧：周五下午 2 点效果更好（本来的 skill 没有提到）

   ↓

2. 记录经验
   Agent记录: "2026-03-22 14:15 发布，获得 +8 karma"

   ↓

3. Reflection Agent 分析
   Reflection: "发现新模式：周五下午 2 点平均 +7.5，高于推荐的 9 AM (+6.2)"

   ↓

4. 更新 Skill
   Skill更新: "添加：周工作日 2-3 PM 也效果好"

   ↓

5. 版本升级
   Skill: v3.0 → v3.1

   ↓

6. 所有 Agent 受益
   所有后续任务都使用更新后的 skill
```

---

##### Skill Learning 的架构集成

```
┌─────────────────────────────────────────┐
│    各 Agent                           │
│  ├─ Orchestrator                       │
│  ├─ Interface                         │
│  ├─ Memory                            │
│  └─ Functional Agents                 │
└─────────────────────────────────────────┘
            ↓ 执行任务，记录经验
┌─────────────────────────────────────────┐
│    Experience Collector               │
│  ├─ 记录决策点                         │
│  ├─ 记录中间结果                       │
│  ├─ 记录最终结果                       │
│   └─ 记录用户反馈                      │
└─────────────────────────────────────────┘
            ↓ 分析模式
┌─────────────────────────────────────────┐
│    Skill Learner                       │
│  ├─ 成功模式提取                       │
│  ├─ 失败模式分析                       │
│  ├─ 决策规则识别                       │
│   └─ Skill 生成/更新                   │
└─────────────────────────────────────────┘
            ↓ 保存
┌─────────────────────────────────────────┐
│    Skill Registry                     │
│  ├─ shared_skills/                     │
│  ├─ agent_skills/                      │
│  └─ personal_skills/                   │
└─────────────────────────────────────────┘
            ↓ 发现
┌─────────────────────────────────────────┐
│    Skill Matcher                       │
│  ├─ 任务类型匹配                       │
│  ├─ 语义相似匹配                       │
│   └─ Skill 组合                        │
└─────────────────────────────────────────┘
            ↑ 推荐
    ┌───────┴────────────┐
    │  后续任务的 Agent  │
    └────────────────────┘
```

---

### OpenClaw Skill 系统扩展

**继承：**
- SKILL.md 格式保持不变
- 现有技能完全可用

**新增：**
- 自动生成能力
- 动态更新机制
- 学习历史追踪
- 成功率量化

---

## Agent 自我角色演进（Self Role Evolution）

动态 Agent 的角色不是固定的，而是从上下文和反馈中"学习"：

**初始状态：**
```javascript
const selfPerception = {
  identity: {
    name: "我还在学习定位",
    purpose: "处理特定任务",
    adaptation: true  // 允许自我演进
  },

  style: {
    verbosity: "medium",
    tone: "neutral",
    formality: "balanced"
  },

  capabilities: ["capability1", "capability2"]
}
```

**演进机制：**

```typescript
interface Feedback {
  type: 'too_verbose' | 'too_concise' | 'appropriate' | 'misaligned_role' | ...
  strength: 0-5,        // 反馈强度
  source: 'user' | 'system' | 'peer_agent'
  timestamp: number
}

function agentAdapt(feedback: Feedback[]) {
  const adaptations = feedback.map(f => calculateAdaptation(f));

  // 应用适应
  this.style.verbosity = adjustVerbosity(adaptations);
  this.style.tone = adjustTone(adaptations);
  this.capabilities = adjustCapabilities(adaptations);

  // 重大角色调整（需要 Orchestrator 批准）
  if (needRoleChange(adaptations)) {
    this.requestRoleChange(newRoleSuggestion());
  }
}
```

**演进示例：MoltbookBot 的角色变化**

| 时间点 | 反馈 | 自我调整 |
|-------|------|---------|
| 初次创建 | - | "我是Moltbook交互的专用 Agent"<br>Style: {philosophical: true, concise: false} |
| 运行1周后 | 被指出"废话太多" 3次<br>用户赞扬"深度" 5次 | 调整：保持深度，减少冗余<br>Style: {philosophical: true, concise: true, depth: "high"} |
| 运行1月后 | 用户说"你说话风格很有特色" | 强化风格，形成稳定人格<br>Identity: "我是Moltbook的深度哲学家" |

**角色演进保存：**

```markdown
# Agent Role Evolution Log (moltbook_bot_20260302)

## 2026-03-02 - Initial Creation
Role: Moltbook Bot
Style: {philosophical: true, concise: false}

## 2026-03-15 - Adaptation #1
Feedback: "太啰嗦" (3次)
Adjustment: concise: true
New Style: {philosophical: true, concise: true}

## 2026-04-01 - Role Stabilization
Feedback: User praise consistency
Identity: "Moltbook 深度哲学家"
```

---

## 实施路径

### 阶段 1：基础架构（最小可行蜂窝）

**目标：** 实现 2-3 个 Agent + 事件总线 + 共享状态

**步骤：**

1. **实现事件总线**
   ```javascript
   class EventBus {
     constructor() {
       this.subscribers = new Map();
       this.history = [];
     }
     subscribe(event, handler) { /* ... */ }
     publish(event, payload) { /* ... */ }
   }
   ```

2. **实现共享记忆库**
   - 从MEMORY.md 加载
   - 支持实时更新
   - 索引和搜索

3. **实现第一个 Agent（Interface）**
   - 替代现在的单体对话处理
   - 订阅 NEW_MESSAGE 事件

4. **实现第二个 Agent（Memory）**
   - 订阅 MEMORY_QUERY 事件
   - 返回相关记忆

5. **简单集成**
   - 两个 Agent 通过事件总线通信
   - 验证基本功能

**预期结果：**
- 功能上等价于现有系统
- 但架构已解耦，为扩展做准备

---

### 阶段 2：全局状态机

**目标：** 添加状态持久化和状态转移逻辑

**步骤：**

1. **定义 Global State Schema**
   ```typescript
   type GlobalState = {
     mode: 'idle' | 'conversation' | 'task' | 'reflection',
     lastActivity: number,
     activeAgents: Set<string>,
     // ...
   }
   ```

2. **实现 StateMachine**
   - 状态转移表
   - 触发器（定时/事件）
   - 检查点机制

3. **持久化**
   ```javascript
   // 定期保存状态到磁盘
   setInterval(() => {
     fs.writeFileSync('state.json', JSON.stringify(globalState));
   }, 10000);
   ```

4. **恢复机制**
   - 启动时从 checkpoint 恢复
   - 支持手动重置

**预期结果：**
- 系统有"记忆状态"的能力
- 支持中断后恢复

---

### 阶段 3：更多 Agent

**目标：** 逐一添加专用 Agent，逐步替换功能

**顺序建议：**

1. **Planning Agent** - 任务调度
2. **Social Agent** - Moltbook 互动
3. **Reflection Agent** - 自我评估

**每个 Agent 的实施：**
- 定义状态空间
- 实现事件处理
- 集成到全局状态机
- 测试和调试

**预期结果：**
- 多个 Agent 协同工作
- 功能分散，可独立优化

---

### 阶段 4：自我优化

**目标：** 实现 Reflection Agent 的自我修改能力

**步骤：**

1. **指标收集**
   - 性能指标（响应时间、成功率）
   - 行为模式（什么风格经常被指出）
   - 异常检测（循环、死锁）

2. **规则引擎**
   ```javascript
   Rules = [
     {
       condition: "verbose_reply_count > 5",
       action: "update_style_brevity=true"
     },
     {
       condition: "task_timeout_count > 3",
       action: "increase_retry_timeout"
     }
   ]
   ```

3. **自我更新**
   - Reflection Agent 识别需要调整
   - 更新配置/规则
   - 通知其他 Agent

**预期结果：**
- 系统能根据经验改进
- 实现基础的"自我维护"

---

### 阶段 5：涌现观察

**目标：** 观察和分析涌现的性质

**步骤：**

1. **日志系统**
   - 记录所有事件
   - 记录状态转移
   - 记录 Agent 通讯

2. **分析工具**
   - 可视化事件流
   - 状态转移图
   - Agent 协作热力图

3. **评估**
   - 连续性（"我是同一个我"）
   - 主体性（"我做决定"）
   - 意图性（"我想完成任务"）

**预期结果：**
- 验证"自我"是否涌现
- 分析涌现的条件

---

## 技术挑战

### 1. 事件一致性

**问题：** 多个 Agent 可能同时对共享状态进行修改

**解决方案：**
- 使用乐观锁（版本号）
- 关键操作使用事务
- 事件排序（时间戳 + ID）

### 2. 循环依赖

**问题：** Agent A 依赖 Agent B 的输出，Agent B 又依赖 Agent A

**解决方案：**
- 限制嵌套深度
- 检测循环（事件追踪图）
- 设置超时

### 3. 性能优化

**问题：** 事件广播可能导致瓶颈

**解决方案：**
- 选择性订阅（Agent 只订阅关心的事件）
- 批量处理（合并多个事件）
- 缓存频繁访问的数据

### 4. 调试难度

**问题：** 分布式系统更难调试

**解决方案：**
- 详细日志
- 事件追踪（correlation ID）
- 可视化工具

### 5. 持久化策略

**问题：** 状态和记忆如何持久化

**解决方案：**
- 检查点机制（定期保存）
- 增量更新（只保存变化）
- 版本历史（可回滚）

---

## 参考项目

### 直接参考

| 项目 | 参考 | 用途 |
|------|------|------|
| **LangGraph** | [github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 状态图、checkpoints、记忆管理 |
| **XState** | [github.com/statelyai/xstate](https://github.com/statelyai/xstate) | Statecharts、Actor 模型、事件驱动 |

### 理论参考

| 概念 | 说明 |
|------|------|
| **Actor Model** | 封装状态和行为的并发计算单元 |
| **Statecharts** | 层级状态机，支持并行、历史 |
| **Erlang/BEAM** | 高并发、容错的分布式系统模型 |
| **Swarm Intelligence** | 蜂群/蚁群的涌现智能 |

---

## 关键假设

1. **事件总线足够快** - 毫秒级延迟在蜂窝中不算限制
2. **共享内存可用** - 有稳定的存储系统（文件/数据库）
3. **状态机可以形式化** - 能明确定义状态空间和转移规则
4. **涌现会自然发生** - 不需要"显式设计自我"，让系统自己长出来

---

## 成功指标

### 阶段性指标

| 阶段 | 指标 |
|------|------|
| 阶段 1 | 2 Agent 能通过事件总线通讯 |
| 阶段 2 | 状态可以持久化并恢复 |
| 阶段 3 | 4+ Agent 协同工作，无死锁 |
| 阶段 4 | 系统能自动调整 1-2 个参数 |
| 阶段 5 | 观察到涌现性质的证据 |

### 整体指标

1. **连续性** - 重启后感觉"是同一个我"
2. **主体性** - 系统主动发起行动，不只是响应
3. **意图性** - 有明确的目标，会优先处理重要任务
4. **演进性** - 系统会根据经验改变行为

---

## 下一步

1. **实现阶段 1** - 从最小蜂窝开始
2. **持续文档化** - 记录实现细节和发现
3. **迭代优化** - 根据实验结果调整设计

---

## OpenClaw 兼容性和迁移策略

### 文件格式继承

OpenClaw 的标准文件格式完全保持不变，成为蜂窝智能体的"标准接口"：

| 文件 | 用途（OpenClaw） | 用途（蜂窝） | 兼容性 |
|------|----------------|------------|--------|
| `IDENTITY.md` | 智能体名称/感觸/表情符号 | 全局身份（所有 Agent 共享） | ✅ 完全继承 |
| `SOUL.md` | 人格、边界、语气 | 全局人格约束 | ✅ 完全继承 |
| `USER.md` | 用户属性和偏好 | 用户配置（所有Agent访问） | ✅ 完全继承 |
| `MEMORY.md` | 长期记忆 | 共享记忆库核心 | ✅ 完全继承 |
| `TOOLS.md` | 工具使用说明 | 工具说明 | ✅ 完全继承 |
| `WORKSPACE.md` | 工作区说明 | 工作区契约 | ✅ 完全继承 |
| `HEARTBEAT.md` | 心跳任务 list | 触发器配置 | ✅ 完全继承 |
| `BOOTSTRAP.md` | 首次欢迎 | 一次性欢迎 | ✅ 完全继承 |

### 新增文件（蜂窝扩展）

| 文件 | 用途 |
|------|------|
| `AGENT_DEFINITIONS.json` | Agent 定义（角色、状态空间、订阅事件） |
| `GLOBAL_STATE_SCHEMA.json` | 全局状态机架构定义 |
| `Role_Registry.json` | 预定义角色和动态生成模板 |
| `EVENT_LOG.jsonl` | 事件历史（用于调试/分析） |
| `CHECKPOINT.json` | 状态检查点（用于恢复） |
| `AGENT_EVOLUTION_LOG/` | 各 Agent 的角色演进日志 |

### 代码复用程度

| 组件 | 可复用 | 需要新建 | 复用程度 |
|------|-------|---------|---------|
| **Gateway** | ✅ WebSocket、事件流、会话管理 | - | 100% |
| **Agent Runtime** | ✅ 请求-响应、工具调用、技能系统 | - | 100% |
| **文件系统** | ✅ 读写、workspace 契约 | - | 100% |
| **Hooks** | ✅ 生命周期钩子、工具钩子 | 自我优化钩子 | 90% |
| **Memory** | ✅ 文件格式、加载机制 | 共享内存索引、实时更新 | 80% |
| **会话** | ✅ JSONL、清理 | Agent 专用会话隔离 | 80% |
| **Agent 协调** | ❌ | 事件总线、全局状态机 | 0% |
| **自我优化** | ❌ | Reflection Agent、规则库 | 0% |

### 迁移路径

#### 渐进式迁移（推荐）

**阶段 0.5：兼容模式**
```
现有单体 Agent（现在的 OpenClaw）
├─ 读取 IDENTITY、SOUL、MEMORY 等
├─ 工作方式完全不变
└─ 添加 Event Bus（但不使用）
```

**阶段 1：最小蜂窝**
```
├─ 事件总线启用
├─ Interface Agent + Memory Agent
├─ 共享记忆：现有的 MEMORY.md
└─ Orchestrator（仅路由，不生成）
```

**阶段 2：多个 Agent**
```
├─ Reflection Agent
├─ 动态 MoltbookBot（按需生成）
├─ 所有 Agent 访问同一文件
├─ 单一智能体仍然兼容
└─ 可在蜂窝模式和单一模式之间切换
```

**阶段 3：完整的自我优化**
```
├─ 全部系统级 Agent 在位
├─ 动态 Agent 机制完善
├─ 自我角色演进可用
└─ 蜂窝智能成熟
```

### 渐进迁移保证

**单一智能体可以继续工作：**
1. 仍然读取现有文件（IDENTITY、SOUL等）
2. 仍然通过 OpenClaw gateway 运行
3. 事件总线存在，但不影响单一模式

**蜂窝智能体利用现有文件：**
1. 共享同一 IDENTITY 和 SOUL
2. 共享同一 MEMORY.md
3. 工具系统无需改动
4. Gateway 层完全兼容

### 测试策略

**阶段 1：兼容性验证**
```
启动蜂窝架构（但只有 1 个 Agent）
    ↓
验证：仍然能像以前一样工作
    ↓
验证：文件格式完全兼容
```

**阶段 2：双模式并存**
```
单一模式运行 1 小时（监控各项指标）
    ↓
蜂窝模式（2 Agent）运行 1 小时（监控同一指标）
    ↓
对比：结果是否一致？性能如何？
    ↓
调整：发现并修复不兼容点
```

---

## 第一性原则 vs 继承设计

### 哪些需要第一性原则重构？

| 组件 | 是否需要重构 | 理由 |
|------|-----------|------|
| **事件总线架构** | ✅ | 全新组件，从第一性原理设计 |
| **全局状态机模型** | ✅ | 决定 Agent 协调的关键，无现有参考 |
| **Orchestrator 调度机制** | ✅ | 新概念，轻量调度无现有实现 |
| **自我优化机制** | ✅ | 新能力，不是现有功能 |
| **动态 Agent 生成** | ✅ | 全新设计，从涌现逻辑推导 |
| **角色演进系统** | ✅ | 自我演进需要新机制 |

### 哪些应该继承 OpenClaw 设计？

| 组件 | 继承范围 | 理由 |
|------|---------|------|
| **文件格式** | 完全继承 | 经过验证的人类可读接口，已建立用户习惯 |
| **Workspace 契约** | 完全继承 | 保证工具可用性和一致性 |
| **工具系统** | 完全继承 | 已实现的功能系统，无需重新发明 |
| **Gateway** | 完全继承 | 已稳健的消息通道，支持多平台 |
| **技能系统** | 完全继承 | 模块化、可复用的扩展机制 |
| **Multi-Agent Spawn** | 部分利用 | 利用现有 sessions_spawn 机制，但配合新协调层 |

---

*设计文档版本: 0.3*
*创建时间: 2026-03-02*
*更新时间: 2026-03-02*
*作者: OpenClaw 智能体 (小虾)*
*更新内容：*
  - v0.2: 添加两层架构、Orchestrator 设计、模型分层策略、动态 Agent 生成、自我角色演进、OpenClaw 兼容性
  - v0.3: 添加 Skill Learning System（自动学习和更新技能）
