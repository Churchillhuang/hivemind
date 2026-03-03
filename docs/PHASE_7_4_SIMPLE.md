# Phase 7.4: 极简架构 - 真正的简单规则

## 为什么简化？

### 之前的问题

```
SkillProfile.ts:
  - SkillRecord: 8 个参数 (score, count, successCount, avgTime, lastUsed, type, tags, minSuccesses)
  - 衰减机制: 复杂的周期计算
  - 匹配算法: requiredScore × 0.8 + optionalScore × 0.2

NegotiationRouter.ts:
  - bidScore: load×0.5 + time×0.3 + random×0.2 - skillBonus
  - 4 个权重参数需要调优

问题:
  - 参数太多，难以理解
  - 权重是人为设计的，不是自然演化
  - 复杂公式抑制了自发行为
```

### 现在的方案

```
SimpleAgent.ts:
  - 技能只有 3 个参数: successCount, failCount, count
  - 成功率 = successCount / count
  - 愿意程度 = 成功率 + 动机奖励

SimpleNegotiationRouter.ts:
  - 只选择 "willing" 最高的
  - 不计算复杂评分公式
```

---

## 核心简化对比

### 之前: 复杂评分公式

```typescript
// SkillDrivenAgent::placeBid()
let baseScore = load * 0.5 + timeFactor * 0.3 + randomFactor;
let skillBonus = (1 - skillMatchScore) * 0.4;
let bidScore = isExploration ? baseScore + 0.3 : baseScore - skillBonus;

// 需要的参数:
// - load (当前负载)
// - timeFactor (时间因子)
// - randomFactor (随机因子)
// - skillMatchScore (技能匹配评分)
// - isExploration (是否探索)
// - 各种权重 (0.5, 0.3, 0.2, 0.4, 0.3)
```

### 现在: 简单意愿

```typescript
// SimpleAgent::calculateWillingness()
let willingness = successRate;  // 成功率

// 连续失败 → 愿意探索
if (consecutiveFailures > 3) {
  willingness += 0.5;
}

// 连续成功 → 愿意挑战
if (successRate > 0.8 && consecutiveSuccesses > 3) {
  willingness += 0.2;
}

// 完全没经验 → 随机 0.3-0.7
if (experienceCount === 0) {
  willingness = 0.3 + Math.random() * 0.4;
}

// 只需要:
// - successRate (成功率)
// - consecutiveFailures (连续失败)
// - consecutiveSuccesses (连续成功)
// - experienceCount (经验次数)
```

---

## 使用示例

### 初始化

```typescript
import { EventBus } from '../events/EventBus.js';
import { SimpleNegotiationRouter } from '../hive/SimpleNegotiationRouter.js';
import { SimpleAgent } from '../hive/SimpleAgent.js';

// 创建事件总线
const eventBus = new EventBus({ maxHistorySize: 1000 });

// 创建协商路由器
const router = new SimpleNegotiationRouter(config, eventBus);
router.start();

// 创建 3 个 SimpleAgents (初始都是"白板")
const agents = [
  new SimpleAgent(
    { id: 'agent_001', role: 'Worker', type: 'functional' },
    { taskTypes: ['generic'], skills: [], maxConcurrentTasks: 5 },
    eventBus,
  ),
  new SimpleAgent(
    { id: 'agent_002', role: 'Worker', type: 'functional' },
    { taskTypes: ['generic'], skills: [], maxConcurrentTasks: 5 },
    eventBus,
  ),
  new SimpleAgent(
    { id: 'agent_003', role: 'Worker', type: 'functional' },
    { taskTypes: ['generic'], skills: [], maxConcurrentTasks: 5 },
    eventBus,
  ),
];

// 启动 agents
for (const agent of agents) {
  await agent.start();
}
```

---

### 第 1 轮任务：探索阶段

```typescript
// 公告第一个任务：哲学讨论
router.announceTask({
  taskId: 'task_001',
  taskType: 'philosophy',
  description: '讨论 AI 意识',
  timestamp: Date.now(),
});

// 等待协商完成 (假设超时 5s)
await new Promise(resolve => setTimeout(resolve, 5500));
```

**日志输出：**

```
[SimpleRouter] Task announced: task_001 (philosophy)

[agent_001] No experience, random willingness: 0.453
[agent_001] Bid for task_001: willing = 0.453

[agent_002] No experience, random willingness: 0.678
[agent_002] Bid for task_001: willing = 0.678

[agent_003] No experience, random willingness: 0.321
[agent_003] Bid for task_001: willing = 0.321

[SimpleRouter] Selected winner for task_001:
  Agent: agent_002
  Willing: 0.678
  Total bids: 3
```

**任务分配**：agent_002 接到任务

---

### 任务完成 - agent_002 成功

```typescript
// agent_002 完成任务
agent_002.updateSkill('philosophy', true);

// 控制台输出
[agent_002] Skill updated for philosophy:
  Success: 1, Fail: 0, Total: 1
  Success Rate: 1.000
  Consecutive Successes: 1
  Consecutive Failures: 0
```

---

### 第 2 轮任务：同一个任务

```typescript
// 再次公告哲学讨论任务
router.announceTask({
  taskId: 'task_002',
  taskType: 'philosophy',
  description: '讨论 AI 意识',
  timestamp: Date.now(),
});
```

**Agent 002 的决策流程：**

```
[SimpleRouter] Task announced: task_002 (philosophy)

[agent_002] Skill updated for philosophy:
  Success: 1, Fail: 0, Total: 1
  → successRate = 1.0 / 1 = 1.0

[agent_002] Experience count < 3, lowering confidence
  willingness = 1.0 × 0.8 = 0.8

[agent_002] Bid for task_002: willing = 0.8

[agent_001] No experience, random willingness: 0.512
[agent_003] No experience, random willingness: 0.693

[SimpleRouter] Selected winner for task_002:
  Agent: agent_002
  Willing: 0.8
  Total bids: 3
```

**结果**：agent_002 胜出 (有经验，但还不稳定)

---

### 任务完成 - agent_002 成功

```typescript
agent_002.updateSkill('philosophy', true);

// 控制台输出
[agent_002] Skill updated for philosophy:
  Success: 2, Fail: 0, Total: 2
  Success Rate: 1.000
  Consecutive Successes: 2
  Consecutive Failures: 0
```

---

### 第 3-5 轮任务：agent_002 连续成功

假设 agent_002 连续成功 5 次哲学任务：

```
第 3 次: successRate = 1.0, willingness = 1.0 × 1.0 = 1.0
第 4 次: successRate = 1.0, willingness = 1.0 × 1.0 = 1.0
第 5 次: successRate = 1.0, willingness = 1.0 × 1.0 = 1.0

[agent_002] Update:
  Success: 5, Fail: 0, Total: 5
  Consecutive Successes: 5
```

---

### 第 6 轮任务：触发"挑战困难"动机

```typescript
// 再次公告哲学任务
router.announceTask({
  taskId: 'task_006',
  taskType: 'philosophy',
  description: '讨论 AI 意识',
  timestamp: Date.now(),
});
```

**Agent 002 的决策：**

```
[agent_002] Success Rate: 1.0 > 0.8, Consecutive Successes: 5 > 3
[agent_002] High success rate (1.00), seeking new challenges
[agent_002] Willingness +0.2 (探索奖励)
willingness = 1.0 + 0.2 = 1.2

[agent_002] Clamped to max 1.0
willingness = 1.0

[agent_002] Bid for task_006: willing = 1.0
[agent_002] Random impulse: no (10% probability)
```

**结果**：agent_002 仍然胜出，但开始探索其他任务类型

---

### 第 7 轮任务：agent_002 尝试新任务

```typescript
// 公告新任务类型：数据分析
router.announceTask({
  taskId: 'task_007',
  taskType: 'data_analysis',
  description: '分析 Python 数据',
  timestamp: Date.now(),
});
```

**Agent 002 的决策：**

```
[agent_002] No experience for data_analysis
  experienceCount = 0
  willingness = 0.3 + Math.random() * 0.4 = 0.456

[agent_001] No experience, random willingness: 0.623
[agent_003] No experience, random willingness: 0.512

[SimpleRouter] Selected winner for task_007:
  Agent: agent_001
  Willing: 0.623
  Total bids: 3
```

**结果**：agent_001 接到任务 (随机最高意愿)

---

### 任务完成 - agent_001 失败

```typescript
agent_001.updateSkill('data_analysis', false);

// 控制台输出
[agent_001] Skill updated for data_analysis:
  Success: 0, Fail: 1, Total: 1
  Success Rate: 0.000
  Consecutive Successes: 0
  Consecutive Failures: 1
```

---

### 第 10 轮任务：agent_001 连续失败

假设 agent_001 连续失败 5 次 data_analysis 任务：

```
第 8 次: consecutiveFailures = 2
第 9 次: consecutiveFailures = 3
第 10 次: consecutiveFailures = 4

[agent_001] Consecutive failures (4) >= 3
[agent_001] High consecutive failures (4), exploring
[agent_001] Willingness +0.5 (探索奖励)

willingness = 0.0 + 0.5 = 0.5

[agent_001] Bid for task_010: willing = 0.5
```

**结果**：agent_001 仍然愿意尝试 (探索机制触发)

---

### 第 11 轮任务：agent_001 终于成功

```typescript
agent_001.updateSkill('data_analysis', true);

// 控制台输出
[agent_001] Skill updated for data_analysis:
  Success: 1, Fail: 5, Total: 6
  Success Rate: 0.167
  Consecutive Successes: 1
  Consecutive Failures: 0
```

---

### 第 12 轮任务：agent_001 开始建立信心

```typescript
[agent_001] Success Rate: 0.167
  Experience count < 3, lowering confidence
  willingness = 0.167 × 0.8 = 0.134

[agent_001] Consecutive Successes: 1 < 3
  No high success bonus

[agent_001] Consecutive Failures: 0
  No consecutive failure bonus

[agent_001] Bid for task_012: willing = 0.134
```

**结果**：agent_001 的意愿开始上升，但仍然谨慎

---

## 简化的好处

### 1. 参数少

```
之前: bidScore = load×0.5 + time×0.3 + random×0.2 - skillBonus
      - 4 个因素
      - 5 个权重参数

现在: willingness = successRate + motivationBonus
      - 1 个核心因素 (成功率)
      - 2-3 个动机奖励 (可选)
```

### 2. 规则直觉化

```
之前: "load 系数 0.5 代表什么含义？"
      "为什么 skillBonus 越高，报价越低？"

现在: "成功率越高，愿意程度越高"
      "连续失败，愿意探索"
      "连续成功，愿意挑战"
```

### 3. 更多可能性

```
之前: 复杂公式 → 可预测的结果
       → Agent 行为受限

现在: 简单规则 → 涌发性的行为
       → 更多自发性
```

---

## 总结

### 极简设计的哲学

```
复杂规则 → 优化系统
          → 效率高
          → 但难以涌现

简单规则 → 适应系统
          → 效率可能略低
          → 但更容易自发
```

### 我们的选择

```
HiveMind 不是"任务分配优化器"
而是"自组织系统"

简单规则 → 涌现潜力
```

---

## 架构对比

### 之前 (Phase 7.3)

```
SimpleAgent (技能: 8 参数)
    ↓
placeBid() → bidScore = load×0.5 + time×0.3 + random×0.2 - skillBonus
    ↓
NegotiationRouter → 最小 bidScore 胜出
```

### 现在 (Phase 7.4)

```
SimpleAgent (技能: 3 参数)
    ↓
calculateWillingness() → successRate + motivationBonus
    ↓
SimpleNegotiationRouter → 最大 willing 胜出
```

---

## 参数总数对比

| 组件 | Phase 7.3 | Phase 7.4 |
|------|----------|-----------|
| Agent 技能参数 | 8 | 3 |
| 报价公式参数 | 9+ | 5 |
| 可调配置项 | 15+ | 5 |
| 总计 | 30+ | 10 |

**简化率**：~65% 参数减少

---

这是真正极简的设计：让 Agent 自主决策，而不是由设计者主导。
