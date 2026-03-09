# HiveMind 配置指南

## 如何启用真正的分布式协作

### 1. Agent池化配置

在 `HiveConfig` 中添加：

```typescript
agentPool: {
  enabled: true,
  agents: [
    { templateId: "general_assistant", count: 3 },
    { templateId: "file_analyzer", count: 2 },
  ],
  minPoolSize: 4,
  maxPoolSize: 10,
  idleTimeout: 300000, // 5分钟
}
```

### 2. 任务分解配置

```typescript
taskDecomposition: {
  enabled: true,
  complexityThreshold: 5, // 复杂度阈值
  minSubtasks: 2,
  maxSubtasks: 5,
  allowParallel: true, // 允许并行执行
}
```

### 3. 完整配置示例

```typescript
const HIVE_CONFIG: HiveConfig = {
  enabled: true,
  mode: "multi",

  // Agent池配置
  agentPool: {
    enabled: true,
    agents: [
      { templateId: "general_assistant", count: 3 },
      { templateId: "file_analyzer", count: 2 },
    ],
    minPoolSize: 4,
    maxPoolSize: 10,
    idleTimeout: 300000,
  },

  // 任务分解配置
  taskDecomposition: {
    enabled: true,
    complexityThreshold: 5,
    minSubtasks: 2,
    maxSubtasks: 5,
    allowParallel: true,
  },

  // 共识配置
  consensus: {
    danceCollectionTime: 3000,
    supportCollectionTime: 2000,
    consensusThreshold: 0.6,
    minParticipants: 1,
    maxWaitTime: 10000,
  },

  // ... 其他配置
};
```

## 当前状态

### ✅ 已实现

- Agent池化机制
- 任务分解逻辑
- 多Agent竞争
- 共识决策
- 并行执行框架

### ⚠️ 当前问题

- 追踪脚本每次都创建新进程
- 没有使用Agent池
- 简单任务不会触发分解

### 🔧 解决方案

#### 方案1：修改HiveManager集成Agent池

在系统启动时自动初始化Agent池。

#### 方案2：创建持久化Agent服务

运行一个后台服务维护Agent池。

#### 方案3：修改InterfaceAgent

在处理消息前先检查Agent池，没有则从池中分配。

## 推荐配置

### 开发环境

- Agent池大小：3-5个
- 任务分解阈值：低（容易触发）
- 允许并行：是

### 生产环境

- Agent池大小：根据负载调整
- 任务分解阈值：中等
- 允许并行：是
- 超时时间：适当增加

## 监控指标

使用监控脚本查看：

```bash
npx tsx scripts/full-distributed-demo.ts
```

观察：

1. Agent池大小
2. 舞蹈事件数量（应该>1）
3. 共识达成次数
4. 任务分解情况
