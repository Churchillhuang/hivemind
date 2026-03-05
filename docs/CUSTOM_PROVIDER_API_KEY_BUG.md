# Custom Provider API Key 配置问题审计报告

## 问题描述

配置了 custom provider 的 API key，但运行时不生效。

---

## 核心问题分析

### 1. API Key 存储路径分析

#### 配置保存位置

Custom provider API key 保存在 `models.json` 中：

```json
{
  "models": {
    "providers": {
      "custom-provider-id": {
        "baseUrl": "https://api.example.com/v1",
        "apiKey": "sk-xxx",  // 直接存储
        "api": "openai-completions",
        "models": [...]
      }
    }
  }
}
```

#### API Key 解析流程

`src/agents/model-auth.ts:50-56`

```typescript
export function getCustomProviderApiKey(
  cfg: OpenClawConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  return normalizeOptionalSecretInput(entry?.apiKey);
}
```

---

### 2. 问题根源：SecretRef vs Plaintext

#### SecretInput 类型定义

`src/config/types.secrets.ts:16`

```typescript
export type SecretInput = string | SecretRef;
```

#### SecretRef 结构

```typescript
export type SecretRef = {
  source: "env" | "file" | "exec";
  id: string;
  provider?: string;
};
```

#### 关键发现

**问题 1: SecretRef 未被正确解析**

在 `getCustomProviderApiKey()` 中：

```typescript
return normalizeOptionalSecretInput(entry?.apiKey);
```

`normalizeOptionalSecretInput()` 只处理字符串：

```typescript
export function normalizeSecretInput(value: unknown): string {
  if (typeof value !== "string") {
    return ""; // ❌ SecretRef 对象返回空字符串！
  }
  return value.replace(/[\r\n\u2028\u2029]+/g, "").trim();
}
```

**这是一个严重 Bug！**

如果 `apiKey` 是 `SecretRef` 对象（如 `{source: "env", id: "CUSTOM_API_KEY"}`），则：

- `normalizeSecretInput()` 返回空字符串
- `normalizeOptionalSecretInput()` 返回 `undefined`
- **API key 丢失！**

---

### 3. 配置流程分析

#### 配置保存流程（正常）

`src/commands/onboard-custom.ts:555-670`

**两种模式：**

1. **Plaintext 模式** (--secret-input-mode plaintext)

```typescript
apiKey: "sk-xxx"; // 直接存储字符串
```

2. **Ref 模式** (--secret-input-mode ref)

```typescript
apiKey: {
  source: "env",
  id: "CUSTOM_API_KEY",
  provider: "custom-provider-id"
}
```

#### 问题出在 Ref 模式

如果用户使用 `--secret-input-mode ref` 配置：

```bash
openclaw onboard \
  --auth-choice custom-api-key \
  --custom-base-url https://api.example.com/v1 \
  --custom-model-id llama3 \
  --secret-input-mode ref
```

配置保存为：

```json
{
  "apiKey": {
    "source": "env",
    "id": "CUSTOM_API_KEY"
  }
}
```

但运行时调用 `getCustomProviderApiKey()` 时：

- `normalizeOptionalSecretInput({source: "env", id: "CUSTOM_API_KEY"})`
- 返回 `undefined` ❌
- API key 丢失！

---

### 4. 其他 Provider 的处理方式

对比其他 provider 的 API key 解析：

#### Anthropic/OpenAI (标准 provider)

```typescript
// src/agents/model-auth.ts:196-208
const envResolved = resolveEnvApiKey(provider);  // 从 env 解析
if (envResolved) {
  return { apiKey: envResolved.apiKey, ... };
}

const customKey = getCustomProviderApiKey(cfg, provider);  // 从 models.json 解析
if (customKey) {
  return { apiKey: customKey, source: "models.json", ... };
}
```

#### Auth Profiles (推荐方式)

```typescript
// src/agents/model-auth.ts:170-194
const order = resolveAuthProfileOrder({ cfg, store, provider, preferredProfile });
for (const candidate of order) {
  const resolved = await resolveApiKeyForProfile({ cfg, store, profileId: candidate });
  if (resolved) {
    return { apiKey: resolved.apiKey, profileId: candidate, ... };
  }
}
```

---

## Bug 确认

### Bug #1: normalizeOptionalSecretInput 不支持 SecretRef

**位置：** `src/utils/normalize-secret-input.ts:17-20`

**问题：**

```typescript
export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  const normalized = normalizeSecretInput(value); // SecretRef 返回 ""
  return normalized ? normalized : undefined; // "" -> undefined
}
```

**影响：**

- Custom provider 使用 SecretRef 存储 API key 时失效
- 所有使用 `normalizeOptionalSecretInput()` 的地方都会受影响

### Bug #2: getCustomProviderApiKey 未处理 SecretRef

**位置：** `src/agents/model-auth.ts:50-56`

**问题：**

```typescript
export function getCustomProviderApiKey(
  cfg: OpenClawConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  return normalizeOptionalSecretInput(entry?.apiKey); // ❌ SecretRef 丢失
}
```

**应改为：**

```typescript
export function getCustomProviderApiKey(
  cfg: OpenClawConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  const apiKey = entry?.apiKey;

  // 处理 SecretRef
  if (isSecretRef(apiKey)) {
    return resolveSecretRef(apiKey); // 解析 SecretRef
  }

  return normalizeOptionalSecretInput(apiKey);
}
```

---

## 修复方案

### 方案 A: 修复 normalizeOptionalSecretInput（推荐）

**修改文件：** `src/utils/normalize-secret-input.ts`

```typescript
import { isSecretRef, type SecretRef } from "../config/types.secrets.js";

export function normalizeSecretInput(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\r\n\u2028\u2029]+/g, "").trim();
}

export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  // ✅ 支持 SecretRef
  if (isSecretRef(value)) {
    return resolveSecretRefToString(value);
  }

  const normalized = normalizeSecretInput(value);
  return normalized ? normalized : undefined;
}

function resolveSecretRefToString(ref: SecretRef): string | undefined {
  if (ref.source === "env") {
    return process.env[ref.id];
  }
  // 其他 source 类型暂不支持
  return undefined;
}
```

### 方案 B: 修复 getCustomProviderApiKey

**修改文件：** `src/agents/model-auth.ts`

```typescript
import { isSecretRef } from "../config/types.secrets.js";
import { normalizeOptionalSecretInput } from "../utils/normalize-secret-input.js";

export function getCustomProviderApiKey(
  cfg: OpenClawConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  const apiKey = entry?.apiKey;

  if (!apiKey) {
    return undefined;
  }

  // ✅ 处理 SecretRef
  if (isSecretRef(apiKey)) {
    if (apiKey.source === "env") {
      return process.env[apiKey.id];
    }
    return undefined;
  }

  return normalizeOptionalSecretInput(apiKey);
}
```

---

## 临时解决方案

### 1. 使用 Plaintext 模式（快速修复）

重新配置 custom provider，使用 plaintext 模式：

```bash
openclaw onboard \
  --auth-choice custom-api-key \
  --custom-base-url https://api.example.com/v1 \
  --custom-model-id llama3 \
  --custom-api-key "sk-xxx" \
  --secret-input-mode plaintext  # ✅ 直接存储字符串
```

或手动编辑 `~/.openclaw/agents/main/agent/models.json`：

```json
{
  "models": {
    "providers": {
      "custom-xxx": {
        "apiKey": "sk-xxx" // ✅ 字符串，而非 SecretRef
      }
    }
  }
}
```

### 2. 设置环境变量（推荐）

如果使用 SecretRef 模式：

```bash
# 在 models.json 中
{
  "apiKey": {
    "source": "env",
    "id": "CUSTOM_API_KEY"
  }
}

# 设置环境变量
export CUSTOM_API_KEY="sk-xxx"

# 运行
openclaw agent
```

---

## 相关代码位置

| 文件                                                        | 行号    | 说明                        |
| ----------------------------------------------------------- | ------- | --------------------------- |
| `src/utils/normalize-secret-input.ts`                       | 17-20   | ❌ Bug #1: 不支持 SecretRef |
| `src/agents/model-auth.ts`                                  | 50-56   | ❌ Bug #2: 未处理 SecretRef |
| `src/config/types.secrets.ts`                               | 16      | SecretInput 类型定义        |
| `src/commands/onboard-custom.ts`                            | 555-670 | Custom provider 配置保存    |
| `src/commands/onboard-non-interactive/local/auth-choice.ts` | 944     | CUSTOM_API_KEY env var      |

---

## 测试验证

### 测试用例 1: Plaintext 模式

```typescript
const config = {
  models: {
    providers: {
      "custom-test": {
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test-123",  // 字符串
        api: "openai-completions",
        models: [{ id: "test-model", ... }]
      }
    }
  }
};

const key = getCustomProviderApiKey(config, "custom-test");
expect(key).toBe("sk-test-123");  // ✅ 应该通过
```

### 测试用例 2: SecretRef 模式（当前失败）

```typescript
const config = {
  models: {
    providers: {
      "custom-test": {
        baseUrl: "https://api.example.com/v1",
        apiKey: { source: "env", id: "CUSTOM_API_KEY" },  // SecretRef
        api: "openai-completions",
        models: [{ id: "test-model", ... }]
      }
    }
  }
};

process.env.CUSTOM_API_KEY = "sk-test-456";

const key = getCustomProviderApiKey(config, "custom-test");
expect(key).toBe("sk-test-456");  // ❌ 当前返回 undefined
```

---

## 总结

### 问题根源

Custom provider API key 使用 `SecretRef` 存储时，`normalizeOptionalSecretInput()` 无法正确解析，导致运行时 API key 丢失。

### 影响范围

- 所有使用 `--secret-input-mode ref` 配置的 custom provider
- 所有使用 `normalizeOptionalSecretInput()` 解析 `SecretInput` 的地方

### 推荐修复

**方案 A**（修复 normalizeOptionalSecretInput）是最佳方案，因为它：

1. 修复根本问题
2. 影响范围可控
3. 不破坏现有功能

### 临时解决

使用 `--secret-input-mode plaintext` 或手动编辑 `models.json` 将 SecretRef 改为字符串。
