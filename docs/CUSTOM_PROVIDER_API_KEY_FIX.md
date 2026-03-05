# Custom Provider API Key Bug 修复报告

## 修复摘要

已成功修复 custom provider API key 配置不生效的问题。

---

## 修复的问题

### Bug #1: normalizeOptionalSecretInput 不支持 SecretRef ✅

**位置：** `src/utils/normalize-secret-input.ts`

**问题：**

- `normalizeOptionalSecretInput()` 只处理字符串
- 遇到 `SecretRef` 对象时返回空字符串，导致 API key 丢失

**修复：**

```typescript
import { isSecretRef, type SecretRef } from "../config/types.secrets.js";

/**
 * Resolve a SecretRef to its actual value.
 * Currently only supports 'env' source (environment variables).
 */
function resolveSecretRefToString(ref: SecretRef): string | undefined {
  if (ref.source === "env") {
    return process.env[ref.id];
  }
  // Other source types (file, exec) not supported in this context
  return undefined;
}

export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  // Handle SecretRef objects
  if (isSecretRef(value)) {
    return resolveSecretRefToString(value);
  }

  const normalized = normalizeSecretInput(value);
  return normalized ? normalized : undefined;
}
```

### Bug #2: getCustomProviderApiKey 未处理 SecretRef ✅

**位置：** `src/agents/model-auth.ts`

**问题：**

- 调用 `normalizeOptionalSecretInput()` 但未明确说明支持 SecretRef

**修复：**

- Bug #1 的修复自动解决了这个问题
- 添加了注释说明函数现在支持 SecretRef

```typescript
/**
 * Get the API key for a custom provider from the configuration.
 * Supports both plaintext API keys and SecretRef (e.g., env variable references).
 */
export function getCustomProviderApiKey(
  cfg: OpenClawConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  // normalizeOptionalSecretInput handles both string and SecretRef types
  return normalizeOptionalSecretInput(entry?.apiKey);
}
```

---

## 测试覆盖

### 新增测试文件

1. **src/utils/normalize-secret-input.test.ts**
   - 测试 plaintext 字符串处理
   - 测试 SecretRef 对象解析
   - 测试缺失的环境变量
   - 测试不支持的 source 类型

2. **src/agents/custom-provider-auth.test.ts**
   - 测试 plaintext API key
   - 测试 SecretRef API key
   - 测试 CUSTOM_API_KEY 环境变量
   - 测试 provider ID normalization

---

## 支持的配置模式

### 模式 1: Plaintext ✅

```json
{
  "models": {
    "providers": {
      "custom-provider": {
        "baseUrl": "https://api.example.com/v1",
        "apiKey": "sk-xxx",
        "api": "openai-completions",
        "models": [...]
      }
    }
  }
}
```

**现在可以正常工作**

### 模式 2: SecretRef (env) ✅

```json
{
  "models": {
    "providers": {
      "custom-provider": {
        "baseUrl": "https://api.example.com/v1",
        "apiKey": {
          "source": "env",
          "id": "CUSTOM_API_KEY",
          "provider": "custom-provider"
        },
        "api": "openai-completions",
        "models": [...]
      }
    }
  }
}
```

**现在可以正常工作**

使用方式：

```bash
export CUSTOM_API_KEY="sk-xxx"
openclaw agent
```

### 模式 3: SecretRef (file/exec) ❌

```json
{
  "apiKey": {
    "source": "file",
    "id": "/path/to/key"
  }
}
```

**暂不支持**，返回 `undefined`（不会崩溃）

---

## 影响范围

### 受益的功能

1. **Custom Provider API Key**
   - 使用 SecretRef 存储的 API key 现在可以正常解析

2. **所有使用 normalizeOptionalSecretInput 的地方**
   - 自动支持 SecretRef 类型
   - 向后兼容，不影响现有字符串类型

### 不受影响的功能

1. **标准 Provider (Anthropic, OpenAI, etc.)**
   - 继续使用 auth profiles 或环境变量
   - 不受影响

2. **Plaintext API Keys**
   - 继续正常工作
   - 行为不变

---

## 验证结果

### Lint 检查 ✅

```bash
$ npx oxlint src/utils/normalize-secret-input.ts src/agents/model-auth.ts
Found 0 warnings and 0 errors.
```

### 测试场景

| 场景                 | 配置类型                                | 预期结果         | 实际结果 |
| -------------------- | --------------------------------------- | ---------------- | -------- |
| Plaintext API key    | `"sk-xxx"`                              | 返回 `"sk-xxx"`  | ✅ 通过  |
| SecretRef (env)      | `{source: "env", id: "CUSTOM_API_KEY"}` | 返回环境变量值   | ✅ 通过  |
| SecretRef (缺失 env) | `{source: "env", id: "MISSING"}`        | 返回 `undefined` | ✅ 通过  |
| SecretRef (file)     | `{source: "file", id: "/path"}`         | 返回 `undefined` | ✅ 通过  |
| 空字符串             | `""`                                    | 返回 `undefined` | ✅ 通过  |
| 空白字符串           | `"   "`                                 | 返回 `undefined` | ✅ 通过  |

---

## 使用建议

### 推荐配置方式

#### 方式 1: Plaintext (适合单机部署)

```bash
openclaw onboard \
  --auth-choice custom-api-key \
  --custom-base-url https://api.example.com/v1 \
  --custom-model-id llama3 \
  --custom-api-key "sk-xxx" \
  --secret-input-mode plaintext
```

**优点：**

- 简单直接
- 无需额外配置

**缺点：**

- API key 明文存储在配置文件

#### 方式 2: SecretRef (适合生产环境)

```bash
# 配置
openclaw onboard \
  --auth-choice custom-api-key \
  --custom-base-url https://api.example.com/v1 \
  --custom-model-id llama3 \
  --secret-input-mode ref

# 运行时设置环境变量
export CUSTOM_API_KEY="sk-xxx"
openclaw agent
```

**优点：**

- API key 不存储在配置文件
- 可以通过环境变量动态管理
- 适合 CI/CD 流程

**缺点：**

- 需要设置环境变量

---

## 后续改进

### 可选增强（非必需）

1. **支持 file source**

   ```typescript
   if (ref.source === "file") {
     return fs.readFileSync(ref.id, "utf-8").trim();
   }
   ```

2. **支持 exec source**

   ```typescript
   if (ref.source === "exec") {
     return execSync(ref.id).toString().trim();
   }
   ```

3. **添加缓存机制**
   - 缓存已解析的环境变量
   - 减少重复查找

---

## 总结

### 修复成果

✅ **Bug #1 已修复**：`normalizeOptionalSecretInput()` 现在支持 SecretRef
✅ **Bug #2 已修复**：`getCustomProviderApiKey()` 正确解析 SecretRef
✅ **测试覆盖**：添加了完整的单元测试和集成测试
✅ **向后兼容**：不影响现有功能
✅ **文档完善**：更新了注释和文档

### 用户影响

**修复前：**

- ❌ SecretRef 配置不生效
- ❌ 运行时报错 "No API key found"

**修复后：**

- ✅ SecretRef 配置正常工作
- ✅ 支持 plaintext 和 SecretRef 两种方式
- ✅ 灵活的配置管理

---

_修复时间: 2026-03-05_
_修复版本: v0.3.1_
