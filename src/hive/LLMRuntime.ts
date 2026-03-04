/**
 * LLM Runtime - LLM 统一调用接口
 *
 * 支持 OpenClaw 的 ModelProvider，提供统一的 LLM 调用能力
 */

import { randomUUID } from "node:crypto";
import type { ModelUsage } from "../utils/ModelConfig.js";
import type { HiveConfig } from "./HiveConfig.js";

/**
 * LLM 提供者类型
 */
export type LLMProvider = "anthropic" | "openai" | "openrouter" | "custom" | "unknown";

/**
 * LLM 请求参数
 */
export interface LLMRequestParams {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: LLMToolDefinition[];
}

/**
 * LLM 消息
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | Array<{
        type: "text" | "image_url";
        text?: string;
        image_url?: { url: string };
      }>;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

/**
 * LLM 工具定义
 */
export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * LLM 工具调用
 */
export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "unknown";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: LLMToolCall[];
  cost?: number;
  latency?: number;
}

/**
 * LLM 调用选项
 */
export interface LLMOpts {
  agentId: string;
  modelUsage?: ModelUsage;
  timeout?: number; // 毫秒
  retryAttempts?: number;
  retryDelay?: number; // 毫秒
  enableCostTracking?: boolean;
  enableTokenCounting?: boolean;
}

/**
 * LLM Runtime - 统一 LLM 调用接口
 */
export class LLMRuntime {
  private hiveConfig: HiveConfig;
  private callsCount = 0;
  private totalTokens = 0;
  private totalCost = 0;
  private totalLatency = 0;

  constructor(hiveConfig: HiveConfig) {
    this.hiveConfig = hiveConfig;
  }

  /**
   * 调用 LLM
   */
  async call(params: LLMRequestParams, opts: LLMOpts): Promise<LLMResponse> {
    const startTime = Date.now();

    // 设置默认值
    const modelUsage = opts.modelUsage || {
      tier: "standard",
      modelName: "llama-13b",
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60,
      estimatedCostPer1K: 0.0002,
      estimatedLatency: 150,
    };

    const maxTokens = params.maxTokens || modelUsage.maxTokens;
    const temperature = params.temperature ?? modelUsage.temperature;
    const timeout = opts.timeout || modelUsage.timeout * 1000;

    console.log(`[LLMRuntime] Calling LLM: ${modelUsage.modelName}`);
    console.log(`  Agent: ${opts.agentId}`);
    console.log(`  Messages: ${params.messages.length}`);
    console.log(`  Temperature: ${temperature}`);
    console.log(`  Max Tokens: ${maxTokens}`);

    const response = await this.callGatewayOpenAiCompat(params, modelUsage, timeout);

    // 计算成本
    if (opts.enableCostTracking !== false) {
      const cost = this.calculateCost(response.usage, modelUsage);
      response.cost = cost;
      this.totalCost += cost;
    }

    // 计算延迟
    const latency = Date.now() - startTime;
    response.latency = latency;

    // 更新统计
    this.callsCount++;
    this.totalTokens += response.usage.totalTokens;
    this.totalLatency += latency;

    console.log(`[LLMRuntime] Response received:`);
    console.log(
      `  Tokens: ${response.usage.totalTokens} (${response.usage.promptTokens} + ${response.usage.completionTokens})`,
    );
    console.log(`  Cost: $${(response.cost || 0).toFixed(6)}`);
    console.log(`  Latency: ${latency}ms`);

    return response;
  }

  /**
   * 调用 Gateway 提供的 OpenAI 兼容接口
   */
  private async callGatewayOpenAiCompat(
    params: LLMRequestParams,
    modelUsage: ModelUsage,
    timeoutMs: number,
  ): Promise<LLMResponse> {
    const model = params.model || modelUsage.modelName;
    const gatewayBase = this.resolveGatewayHttpBase();
    const endpoint = `${gatewayBase}/v1/chat/completions`;
    const token =
      process.env.OPENCLAW_GATEWAY_TOKEN ||
      process.env.CLAWDBOT_GATEWAY_TOKEN ||
      process.env.OPENCLAW_TOKEN;

    const body = {
      model,
      stream: false,
      temperature: params.temperature ?? modelUsage.temperature,
      max_tokens: params.maxTokens ?? modelUsage.maxTokens,
      messages: params.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: params.tools?.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gateway LLM request failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      model?: string;
      choices?: Array<{
        finish_reason?: string;
        message?: {
          content?: string;
          tool_calls?: Array<{
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const choice = payload.choices?.[0];
    const content = choice?.message?.content ?? "";
    const promptTokens = payload.usage?.prompt_tokens ?? this.estimateTokens(params.messages);
    const completionTokens = payload.usage?.completion_tokens ?? this.estimateTokens(content);
    const totalTokens = payload.usage?.total_tokens ?? promptTokens + completionTokens;

    const toolCalls: LLMToolCall[] | undefined = choice?.message?.tool_calls?.map((entry) => ({
      id: entry.id || `tool_${randomUUID().replaceAll("-", "").slice(0, 9)}`,
      type: "function",
      function: {
        name: entry.function?.name || "unknown",
        arguments: entry.function?.arguments || "{}",
      },
    }));

    return {
      id: payload.id || `llm_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 9)}`,
      model: payload.model || model,
      content,
      finishReason: this.normalizeFinishReason(choice?.finish_reason),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    };
  }

  private resolveGatewayHttpBase(): string {
    const raw =
      process.env.OPENCLAW_GATEWAY_HTTP_URL ||
      process.env.OPENCLAW_GATEWAY_URL ||
      process.env.CLAWDBOT_GATEWAY_URL ||
      "http://127.0.0.1:18789";

    if (raw.startsWith("ws://")) {
      return raw.replace(/^ws:\/\//, "http://");
    }
    if (raw.startsWith("wss://")) {
      return raw.replace(/^wss:\/\//, "https://");
    }
    return raw;
  }

  private estimateTokens(input: unknown): number {
    if (typeof input === "string") {
      return Math.ceil(input.length / 4);
    }
    return Math.ceil(JSON.stringify(input).length / 4);
  }

  private normalizeFinishReason(reason: string | undefined): LLMResponse["finishReason"] {
    if (
      reason === "stop" ||
      reason === "length" ||
      reason === "tool_calls" ||
      reason === "content_filter"
    ) {
      return reason;
    }
    return "unknown";
  }

  /**
   * 计算成本
   */
  private calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    modelUsage: ModelUsage,
  ): number {
    const inputCostPer1K = modelUsage.estimatedCostPer1K * 0.5; // 输入成本通常是 50%
    const outputCostPer1K = modelUsage.estimatedCostPer1K;

    const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
    const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;

    return inputCost + outputCost;
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    callsCount: number;
    totalTokens: number;
    totalCost: number;
    avgTokensPerCall: number;
    avgLatency: number;
  } {
    const avgTokensPerCall = this.callsCount > 0 ? this.totalTokens / this.callsCount : 0;
    const avgLatency = this.callsCount > 0 ? this.totalLatency / this.callsCount : 0;

    return {
      callsCount: this.callsCount,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      avgTokensPerCall,
      avgLatency,
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.callsCount = 0;
    this.totalTokens = 0;
    this.totalCost = 0;
    this.totalLatency = 0;
  }
}
