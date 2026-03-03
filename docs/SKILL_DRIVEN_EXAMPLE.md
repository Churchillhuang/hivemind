# Skill-Driven Agent System - 完整示例

## 演化过程示例

### 初始化阶段（第 0 轮）

所有 agents 都是"白板"（空技能库）：

```typescript
import { EventBus } from '../events/EventBus.js';
import { SkillBasedNegotiationRouter } from '../hive/SkillBasedNegotiationRouter.js';
import { SkillDrivenAgent } from '../hive/SkillDrivenAgent.js';

// 创建事件总线
const eventBus = new EventBus({ maxHistorySize: 1000 });

// 创建协商路由器
const router = new SkillBasedNegotiationRouter(config, eventBus);
router.start();

// 创建 3 个 SkillDrivenAgents（初始时都没有技能）
const agents = [
  new SkillDrivenAgent(
    {
      id: 'agent_001',
      role: 'General Worker',
      type: 'functional',
    },
    {
      taskTypes: ['generic'],
      skills: [],
      maxConcurrentTasks: 5,
    },
    eventBus,
    0.1,  // 10% 探索概率
  ),
  new SkillDrivenAgent(
    {
      id: 'agent_002',
      role: 'General Worker',
      type: 'functional',
    },
    {
      taskTypes: ['generic'],
      skills: [],
      maxConcurrentTasks: 5,
    },
    eventBus,
    0.1,
  ),
  new SkillDrivenAgent(
    {
      id: 'agent_003',
      role: 'General Worker',
      type: 'functional',
    },
    {
      taskTypes: ['generic'],
      skills: [],
      maxConcurrentTasks: 5,
    },
    eventBus,
    0.1,
  ),
];

// 启动 agents
for (const agent of agents) {
  await agent.start();
}
```

---

### 第 1 轮任务：探索阶段

系统发布了 10 个不同类型的任务：

```typescript
// 任务 1-3: 哲学讨论
router.announceTask({
  taskId: 'task_001',
  taskType: 'philosophy_discussion',
  requiredSkills: {
    'philosophy_analysis': 0.6,
    'chinese_writing': 0.8,
  },
  priority: 'normal',
  description: '讨论 AI 意识问题',
  timestamp: Date.now(),
});

// 任务 4-5: 文件分析
router.announceTask({
  taskId: 'task_004',
  taskType: 'file_analysis',
  requiredSkills: {
    'code_analysis': 0.7,
    'language_detection': 0.6,
  },
  priority: 'normal',
  description: '分析 Python 文件',
  timestamp: Date.now(),
});

// 任务 6-8: 数据处理
router.announceTask({
  taskId: 'task_006',
  taskType: 'data_processing',
  requiredSkills: {
    'python': 0.7,
    'data_analysis': 0.7,
  },
  priority: 'normal',
  description: '处理 CSV 数据',
  timestamp: Date.now(),
});

// 任务 9-10: 写作
router.announceTask({
  taskId: 'task_009',
  taskType: 'writing',
  requiredSkills: {
    'chinese_writing': 0.7,
    'writing_structure': 0.6,
  },
  priority: 'normal',
  description: '写一篇关于技术哲学的文章',
  timestamp: Date.now(),
});
```

**探索阶段结果：**
- 所有 agents 都没有任何技能经验
- 但 10% 的探索概率 + 主动技能（如果有的话）会让它们尝试
- 假设每个 agent 成功完成了 3-4 个不同的任务

**技能演化（第 1 轮后）：**

```
Agent 001 技能库：
- philosophy_analysis: {score: 0.33, count: 3}  // 1/3 成功
- chinese_writing: {score: 0.50, count: 2}      // 1/2 成功

Agent 002 技能库：
- code_analysis: {score: 0.50, count: 2}        // 1/2 成功
- python: {score: 0.67, count: 3}              // 2/3 成功

Agent 003 技能库：
- data_analysis: {score: 0.75, count: 4}        // 3/4 成功
- writing_structure: {score: 0.60, count: 5}   // 3/5 成功
```

---

### 第 2 轮任务：开始分化

系统发布第二批任务（10 个），类型相同：

**报价情况：**

```
Task: philosophy_discussion（需要 philosophy_analysis 0.6 + chinese_writing 0.8）

Agent 001 报价：
  - skillMatchScore: 0.33 + 0.5 = 0.83 (平均)
  - bidScore: 0.3 (load) + 0.1 (time) - 0.17 (skillBonus) = 0.23

Agent 002 报价：
  - skillMatchScore: 0 (没有经验)
  - 但 10% 探索概率 → 尝试
  - bidScore: 0.5 (load) + 0.2 (time) + 0.3 (探索成本) = 1.0

Agent 003 报价：
  - skillMatchScore: 0 (没有经验)
  - bidScore: 0.4 (load) + 0.2 (time) = 0.6

→ Agent 001 胜出（虽然成绩一般，但比其他人好）
```

**第 2 轮后的技能库：**

```
Agent 001 技能库：
- philosophy_analysis: {score: 0.50, count: 4}  // 2/4 成功
- chinese_writing: {score: 0.67, count: 3}      // 2/3 成功
  → 开始形成"哲学"倾向

Agent 002 技能库：
- code_analysis: {score: 0.63, count: 8}        // 5/8 成功
- python: {score: 0.75, count: 4}              // 3/4 成功
  → 开始形成"编程"倾向

Agent 003 技能库：
- data_analysis: {score: 0.80, count: 10}       // 8/10 成功
- writing_structure: {score: 0.67, count: 9}    // 6/9 成功
  → 开始形成"数据分析 + 写作"倾向
```

---

### 第 5 轮任务：形成专长

系统持续发布任务，agents 逐渐形成专长：

```
Agent 001:
- philosophy_analysis: 0.92 (15/16)  ← 强项
- chinese_writing: 0.87 (13/15)      ← 强项
- data_analysis: 0.40 (2/5)          ← 弱项

Agent 002:
- python: 0.95 (19/20)              ← 强项
- code_analysis: 0.88 (15/17)       ← 强项
- philosophy_analysis: 0.20 (1/5)   ← 弱项

Agent 003:
- data_analysis: 0.92 (23/25)       ← 强项
- writing_structure: 0.90 (18/20)   ← 强项
- python: 0.35 (2/6)                ← 弱项
```

**报价情况现在变得清晰：**

```
Task: philosophy_discussion
- Agent 001: score=0.4 (有专长)  ← 胜出
- Agent 002: score=1.2 (无经验)
- Agent 003: score=0.9 (有经验的写作技能)

Task: python_data_processing
- Agent 001: score=1.3 (弱项)
- Agent 002: score=0.3 (专长)      ← 胜出
- Agent 003: score=0.8 (中等)

Task: technical_writing
- Agent 001: score=0.6 (有写作技能)
- Agent 002: score=1.1 (无写作)
- Agent 003: score=0.4 (强项写作)  ← 胜出
```

---

### 第 10 轮任务：探索新任务

系统突然发布一个新任务类型：

```typescript
router.announceTask({
  taskId: 'task_new_001',
  taskType: 'translation_task',
  requiredSkills: {
    'translation': 0.7,
    'bilingual': 0.6,
  },
  priority: 'normal',
  description: '翻译技术文档',
  timestamp: Date.now(),
});
```

**所有 agents 都没有这个技能：**

```
Agent 001: skillMatchScore = 0
Agent 002: skillMatchScore = 0
Agent 003: skillMatchScore = 0
```

**探索机制触发：**
- Agent 001: 10% 探索概率 → 尝试
  - bidScore = 0.3 (load) + 0.3 (探索成本) + 0.2 (随机) = 0.8
- Agent 002: 探索概率未触发 → 不投标
- Agent 003: 10% 探索概率 → 尝试
  - bidScore = 0.4 (load) + 0.3 (探索成本) + 0.1 (随机) = 0.8

**结果：**
- Agent 001 或 Agent 003 会随机接到这个新任务
- 假设 Agent 001 接了并成功完成
  → 技能库新增：`translation: {score: 1.0, count: 1}`

**第 11 轮后：**
- Agent 001 会开始更多地接翻译任务（探索 + 新技能加分）

---

### 第 20 轮任务：技能衰减

假设 30 天后，某些技能长期不使用：

```
Agent 001 当前技能：
- philosophy_analysis: 0.92 (lastUsed: 10 天前)
- chinese_writing: 0.87 (lastUsed: 8 天前)
- translation: 0.85 (lastUsed: 2 天前)
- data_analysis: 0.40 (lastUsed: 60 天前)  ← 长期不使用

技能衰减触发 (24 小时周期，每次 10%)：
- philosophy_analysis: 0.92 → 0.93 (保护期后)
- chinese_writing: 0.87 → 0.88
- translation: 0.85 (保护期)
- data_analysis: 0.40 × (0.9)^2 = 0.32 × 0.81 = 0.26  ← 衰减

Result:
  → agent 会逐渐"遗忘"不常用的技能
  → 但不会完全丢失 (不低于 0.3)
```

---

## 监控和调试

### 查看技能统计

```typescript
for (const agent of agents) {
  const stats = agent.getSkillStats();
  console.log(`[${agent.id}] Stats:`);
  console.log(`  Total Skills: ${stats.totalSkills}`);
  console.log(`  Average Score: ${stats.averageScore.toFixed(3)}`);

  if (stats.topSkills.length > 0) {
    console.log(`  Top Skills:`);
    for (const skill of stats.topSkills) {
      console.log(`    - ${skill.name}: ${skill.score.toFixed(3)} (${skill.count} attempts)`);
    }
  }
}
```

**输出示例：**

```
[agent_001] Stats:
  Total Skills: 7
  Average Score: 0.714
  Top Skills:
    - philosophy_analysis: 0.920 (16 attempts)
    - chinese_writing: 0.875 (15 attempts)
    - translation: 0.850 (3 attempts)

[agent_002] Stats:
  Total Skills: 5
  Average Score: 0.820
  Top Skills:
    - python: 0.950 (20 attempts)
    - code_analysis: 0.880 (17 attempts)

[agent_003] Stats:
  Total Skills: 6
  Average Score: 0.783
  Top Skills:
    - data_analysis: 0.920 (25 attempts)
    - writing_structure: 0.900 (20 attempts)
```

---

## 配置建议

### 探索概率调整

```typescript
const lowExplorationAgent = new SkillDrivenAgent(
  { id: 'agent_conservative', role: 'Conservative Worker', type: 'functional' },
  capabilities,
  eventBus,
  0.05,  // 仅 5% 探索（偏向利用）
);

const balancedAgent = new SkillDrivenAgent(
  { id: 'agent_balanced', role: 'Balanced Worker', type: 'functional' },
  capabilities,
  eventBus,
  0.10,  // 10% 探索（平衡）
);

const highExplorationAgent = new SkillDrivenAgent(
  { id: 'agent_explorer', role: 'Explorer', type: 'functional' },
  capabilities,
  eventBus,
  0.20,  // 20% 探索（偏向探索）
);
```

### 技能衰减配置

```typescript
agent.skillProfile.decay = {
  interval: 604800,    // 7 天（衰减周期）
  rate: 0.05,          // 每次衰减 5%（温和衰减）
  minScore: 0.5,       // 最低保留 0.5（高记忆留存）
  protectionPeriod: 5184000,  // 60 天保护期
};
```

---

## 与 SkillLearning 集成

假设有一个 SkillLearningAgent 提炼了技能：

```typescript
// SkillLearning 提炼出了一个"哲学写作"的技能
const extractedSkill = {
  name: 'philosophy_writing',
  confidence: 0.9,  // 90% 信心度
  extractedAt: Date.now(),
};

// 加载到 agents
for (const agent of agents) {
  if (agent.getSkillScore('philosophy_writing') === 0) {
    agent.loadSkillFromSkillLearning(
      extractedSkill.name,
      extractedSkill.confidence
    );
  }
}
```

**效果：**
- Agents 会优先选择它们有主动技能的任务
- 但技能评分会随着实际执行而调整（可能上升或下降）

---

## 总结：从"白板"到"专长"的演化

```
初始状态: 所有 agents 都是"白板"
    ↓
第 1 轮: 探索阶段，agents 尝试各种任务
    ↓
第 5 轮: 开始分化，某些技能评分上升
    ↓
第 10 轮: 形成专长（但保留探索能力）
    ↓
第 20 轮: 新任务出现 → 探索 → 快速学习
    ↓
长期: 技能衰减 + 继续演化
```

**关键特性：**
- ✅ 无预设角色，自然分化
- ✅ 专长 + 探索能力
- ✅ 新场景快速适应
- ✅ 老技能逐渐遗忘
- ✅ 与 SkillLearning 协作
