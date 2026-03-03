# 隐藏问题审计

## 发现的问题

### 1. 🔴 资源泄漏 - 订阅未清理

**问题：** Agent 的 `stop()` 方法没有调用 `destroy()`，导致订阅未被清理

**位置：**
- `HiveManager.shutdown()` → 调用 `agent.stop()`
- `BaseAgent.destroy()` → 真正清理订阅
- **缺失**：`stop()` 不调用 `destroy()`

**影响：**
- EventBus.subscribers 持续增长
- 重复启动/停止时泄漏内存

**修复：**
```typescript
// HiveManager.shutdown()
async shutdown(): Promise<void> {
  // ...
  if (this.reflectionAgent) {
    stopPromises.push(this.reflectionAgent.destroy());  // 改为 destroy()
  }
}
```

---

### 2. 🟡 潜在泄漏 - Map/Set 无上限

**问题：** 某些 Map/Set 没有大小限制

**例子：**

```typescript
// Orchestrator.ts
private taskQueue: Map<string, Task> = new Map();           // ❌ 无上限
private agents: Map<string, AgentInfo> = new Map();         // ❌ 无上限
private routingRules: Map<string, string[]> = new Map();    // ✅ 固定规则

// MemoryGateway.ts
private readCache: Map<string, { content: string; timestamp: number }> = new Map();
// ⚠️ 有 TTL 但无限增长

// ReflectionAgent.ts
private reflections: Map<string, Reflection> = new Map();  // ✅ 可以接受（有限历史）
private skillStore: Map<string, SkillState> = new Map();   // ✅ 可以接受

// AgentCommunication.ts
private activeConversations: Map<string, Conversation> = new Map();  // ❌ 需要清理
```

**影响：**
- 长期运行导致内存增长
- 潜在的内存泄漏

**修复：**
```typescript
// 添加定期清理
private async cleanupTask(): Promise<void> {
  setInterval(() => {
    // 清理过期缓存
    const now = Date.now();
    for (const [key, value] of this.readCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL * 2) {
        this.readCache.delete(key);
      }
    }
  }, 60000); // 每分钟清理
}
```

---

### 3. 🟡 定时器泄漏风险

**问题：** 有 31 处 `setInterval`/`setTimeout`，部分可能未清理

**已知已清理：**
- ✅ ReflectionAgent.reflectionInterval (stop() 时清理)
- ✅ EmergenceMonitor.monitoringTimer (stop() 时清理)

**需要检查：**
- ⚠️ 其他 agent 可能也有定时器
- ⚠️ Promise 捕获后的超时处理

---

### 4. 🟡 事件历史性能

**问题：** `EventBus.getHistory()` 扫描整个数组

```typescript
getHistory(eventType?: string): Event[] {
  let history = this.eventHistory;  // 扫描整个数组
  if (eventType) {
    history = history.filter(e => e.type === eventType);  // O(n) 过滤
  }
  return history;
}
```

**影响：**
- 当 maxHistorySize=1000 时，每次查询都是 O(n)
- 测试中大量使用 `getHistory()`（polling）

**修复：**
```typescript
// 按事件类型分桶存储
private eventHistory: Map<string, Event[]> = new Map();

getHistory(eventType?: string): Event[] {
  if (eventType) {
    return this.eventHistory.get(eventType) || [];
  }
  return this.eventHistory.values().flat();
}
```

---

### 5. 🟢 错误处理 - 单点故障

**问题：** 如果 MemoryGateway 崩了，所有文件 I/O 都失败

**影响：**
- 系统降级（可以写日志，但不能持久化）
- 没有自动恢复机制

**建议：**
```typescript
// 添加健康检查
if (!this.memoryGateway?.isRunning()) {
  console.warn('[MemoryGateway] Not running, attempting restart...');
  try {
    await this.memoryGateway.start();
  } catch (error) {
    console.error('[MemoryGateway] Restart failed:', error);
  }
}
```

---

### 6. 🟢 配置验证缺失

**问题：** `HiveConfig` 没有验证逻辑

**例子：**
```typescript
config = {
  memory: {
    indexing: {
      workspacePath: '/nonexistent',  // ❌ 不验证
    }
  }
}
```

**修复：**
```typescript
function validateConfig(config: HiveConfig): void {
  if (config.memory.indexing.workspacePath) {
    // 检查目录是否存在
  }
  if (config.agents.system.orchestrator.maxAgents < 1) {
    throw new Error('maxAgents must be >= 1');
  }
}
```

---

### 7. 🟢 状态一致性

**问题：** `GlobalStateMachine` 的状态可能和实际运行不同步

**例子：**
```typescript
// 可能发生：
stateMachine.transition('active');  // 发布事件
// 但 Orchestrator 还没启动
// → 状态不一致
```

**修复：**
- 添加状态转换回调
- 确保所有 agents 真正就绪后再改变状态

---

## 优先级

| 优先级 | 问题 | 修复难度 | 紧急程度 |
|--------|------|----------|----------|
| 🔴 高 | 资源泄漏 - 订阅未清理 | 低 | 高 |
| 🟡 中 | Map/Set 无上限 | 中 | 中 |
| 🟡 中 | 定时器泄漏风险 | 低 | 中 |
| 🟡 中 | 事件历史性能 | 中 | 低 |
| 🟢 低 | 单点故障 | 高 | 低 |
| 🟢 低 | 配置验证 | 低 | 低 |
| 🟢 低 | 状态一致性 | 中 | 低 |

---

## 总结

**必须立即修复（迁移前）：**
1. 🎯 `HiveManager.shutdown()` 调用 `destroy()` 而不是 `stop()`

**建议修复（迁移后）：**
2. 添加 Map/Set 上限或定期清理
3. 优化 EventBus.getHistory() 性能
4. 添加配置验证

**可以延后：**
5. 单点故障恢复
6. 状态一致性增强
