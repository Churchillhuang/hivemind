# HiveMind 修复审计报告

## 📋 总结

### 已提交的修复
1. `7127b38` - TypeScript lib ES2023
2. `817bbdf` - postbuild 脚本
3. `93928b7` - 移除 Symbol.toStringTag
4. `0ee9f3f` - 修复 __exportAll 正则表达式

### 已回滚的修复
- `da14603` - Bug #1 被回滚（导致死循环）
- Bug #2 保留

---

## 🐛 Bug #1 (已回滚) - API Key 持久化

### 问题
- 函数：`applyCustomApiConfig` (src/commands/onboard-custom.ts)
- 现状：Custom API 配置不会保存到 `auth-profiles.json`

### 根本原因
1. `applyCustomApiConfig` 不是 async 函数
2. `upsertAuthProfile` 是 async 函数
3. 缺少 `agentDir` 参数

### 修复方案（未实施）
需要重构以下内容：
1. 将 `applyCustomApiConfig` 改为 async
2. 添加 `agentDir` 参数到函数签名
3. 在返回前调用 `await upsertAuthProfile(...)`
4. 更新所有调用者

---

## 🐛 Bug #2 (已修复) - Models List UX

### 修复内容
- 文件：src/commands/models/list.list-command.ts, list.registry.ts
- 添加 `hasAuthForProvider` 检查过滤未配置的模型

### 潜在问题
- `hasAuthForProvider` 函数依赖于 `getCustomProviderApiKey`
- `getCustomProviderApiKey` 从 `models.providers` 读取 API key（不是从 auth-profiles.json）
- 对于通过 environment variables 或 auth-store 配置的 provider 可以工作
- 不适用于需要 Bug #1 修复的持久化方案

---

## ⚠️ Node.js 22 兼容性修复

### 问题1: external: [] 配置
- 文件：tsdown.config.ts
- 修改：所有 entry points 添加 `external: []`
- 影响：强制内联所有 runtime helpers
- 风险：可能增加 bundle 大小

### 问题2: postbuild 脚本
- 文件：scripts/fix-export-all-node22.js
- 问题：
  1. `fixRuntimeFile` 正则表达式不完整，可能导致破坏性替换
  2. inline 的 `__exportAll` 实现有 bug：`get: all[name]` 应该是 `get: () => all[name]`
  3. 正则替换可能不正确处理所有情况

### 问题3: Symbol.toStringTag 移除
- 状态：尝试移除但可能不完整
- 风险：可能破坏其他需要 Symbol.toStringTag 的功能

---

## 🚨 当前部署状态

### 远程服务器错误
- `No API provider registered for api: undefined`
- 原因：pi-ai 无法识别自定义 provider 模型

### 根本原因
1. Bug #1 被回滚，auth-profiles.json 不会自动更新
2. 自定义 provider 需要 pi-ai 注册（目前没有自动注册机制）
3. API Key 认证失败（401 Unauthorized）

---

## 📊 风险评估

| 风险 | 严重性 | 建议 |
|------|--------|------|
| `__exportAll` inline 实现错误 | 高 | 需要正确实现 getter |
| Bug #1 回滚导致配置丢失 | 中 | 需要正确实现 async 版本 |
| Symbol.toStringTag 移除不完整 | 低 | 需要完整测试 |
| postbuild 脚本破坏性替换 | 中 | 需要更安全的正则表达式 |
| 类型声明缺失 | 低 | 需要添加 @types 包 |

---

## 🔧 推荐的下一步

### 立即修复（高优先级）
1. 检查 API key 是否有效
2. 重新设计 Bug #1 修复方案
3. 修复 `__exportAll` inline 实现

### 中期修复（中优先级）
1. 安全地完善 postbuild 脚本
2. 添加类型声明
3. 测试 Node.js 22 兼容性

### 长期修复（低优先级）
1. 重构 pi-ai 集成，支持自定义 provider 自动注册
2. 改进错误提示和日志

---

## 📝 相关文件

- BUGS.md - 原始 bug 报告
- BUILD_FIXES.md - 构建错误修复记录
- scripts/fix-export-all-node22.js - Node.js 22 兼容性修复脚本
- src/commands/onboard-custom.ts - Bug #1 相关
- src/commands/models/list.list-command.ts - Bug #2 相关
- src/commands/models/list.registry.ts - Bug #2 相关

---

## 🆕 深入审计结果

### 发现1: Bug #1 可以安全修复

#### 新发现
- `upsertAuthProfile` 是**同步函数**（不是 async）
- `agentDir` 参数是可选的
- 不提供 `agentDir` 时使用默认路径

#### 修复方案
可以在 `applyCustomApiConfig` 中添加 Bug #1 修复，**无需**：
- 修改函数签名
- 将函数改为 async
- 传递 `agentDir` 参数

#### 修复代码（安全版本）
```typescript
// 在 applyCustomApiConfig 函数返回前添加
if (
  typeof normalizedApiKey === "string" &&
  normalizedApiKey.trim() !== "" &&
  !isSecretRef(normalizedApiKey) &&
  providerId
) {
  try {
    const profileId = `${providerId}:default`;
    upsertAuthProfile({
      profileId,
      credential: {
        type: "api_key",
        provider: providerId,
        key: normalizedApiKey.trim(),
      },
    });
  } catch (e) {
    // 静默失败，不影响主要功能
    console.warn(`Failed to save auth profile for ${providerId}:`, e);
  }
}
```

---

### 发现2: postbuild 脚本的实现错误已修复

#### 原问题
`get: all[name]` 立即求值

#### 修复
`get: () => all[name]` 懒加载

#### 修复后的脚本
`scripts/fix-export-all-node22-fixed.js`（新创建，未替换原脚本）

---

### 发现3: 死循环原因分析

#### 可能原因
1. `upsertAuthProfile` 可能触发配置重新加载
2. 配置重新加载可能再次调用 `applyCustomApiConfig`
3. 无限循环

#### 验证方法
1. 在 Bug #1 修复前后添加日志
2. 监控调用栈深度
3. 检查配置监听器

---

## 📋 下一步行动计划

### 立即执行
- [ ] 回滚所有 postbuild 脚本修改（恢复到 `b627da8` 之前的状态）
- [ ] 恢复原始 `tsdown.config.ts`（移除 `external: []`）
- [ ] 重新设计 Bug #1 修复方案（避免循环）
- [ ] 测试 API key 有效性

### 短期执行（1-2天）
- [ ] 安全地添加 Bug #1 修复
- [ ] 完善 Node.js 22 兼容性修复
- [ ] 添加详细日志以调试循环问题

### 长期执行（1-2周）
- [ ] 重构 pi-ai 集成
- [ ] 改进错误处理和提示
- [ ] 添加单元测试

---

## 🎯 优先级调整

| 任务 | 原优先级 | 新优先级 | 理由 |
|------|----------|----------|------|
| 验证 API key 有效性 | 高 | **最高** | 阻塞所有配置 |
| 设计 Bug #1 修复 | 高 | 高 | 解决核心问题 |
| 回滚 postbuild 脚本 | 中 | **高** | 可能引入新问题 |
| 修复 __exportAll inline | 中 | 中 | 后续优化 |

