/**
 * LLM Runtime - LLM 统一调用接口
 *
 * 支持 OpenClaw 的 ModelProvider，提供统一的 LLM 调用能力
 */

import type { HiveConfig } from './HiveConfig.js';
import type {
  getAgentModelConfig,
  ModelUsage,
  estimateCost,
  estimateLatency,
} from '../utils/ModelConfig.js';

/**
 * LLM 提供者类型
 */
export type LLMProvider =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'custom'
  | 'unknown';

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
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{
    type: 'text' | 'image_url';
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
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * LLM 工具调用
 */
export interface LLMToolCall {
  id: string;
  type: 'function';
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
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';
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
  timeout?: number;  // 毫秒
  retryAttempts?: number;
  retryDelay?: number;  // 毫秒
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
      tier: 'standard',
      modelName: 'llama-13b',
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

    // 模拟 LLM 调用（实际应该调用 OpenClaw 的 ModelProvider）
    const response = await this.simulateLLMCall(params, modelUsage, startTime);

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

    console.log(`[LLMRuntime] Response received:`);
    console.log(`  Tokens: ${response.usage.totalTokens} (${response.usage.promptTokens} + ${response.usage.completionTokens})`);
    console.log(`  Cost: $${(response.cost || 0).toFixed(6)}`);
    console.log(`  Latency: ${latency}ms`);

    return response;
  }

  /**
   * 模拟 LLM 调用（实际应该调用 OpenClaw）
   */
  private async simulateLLMCall(
    params: LLMRequestParams,
    modelUsage: ModelUsage,
    startTime: number,
  ): Promise<LLMResponse> {
    // 模拟处理时间
    const processingTime = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // 估算 prompt tokens（简化）
    let promptTokens = 0;
    for (const msg of params.messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      promptTokens += Math.ceil(content.length / 4);  // 大约 4 字符 = 1 token
    }

    // 估算 completion tokens（生成一些文本）
    const lastUserMsg = params.messages.filter(m => m.role === 'user').pop();
    let content = '';
    if (lastUserMsg) {
      const userContent = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
      content = `[LLM Response to: "${userContent.substring(0, 50)}..."]`;
    } else {
      content = '[LLM Response]';
    }

    const completionTokens = Math.ceil(content.length / 4);

    // 确定模型
    const model = params.model || modelUsage.modelName;

    // 检测 provider
    const provider = this.detectProvider(model);

    return {
      id: `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      model,
      content,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      provider,
    } as LLMResponse & { provider: LLMProvider };
  }

  /**
   * 检测 LLM provider
   */
  private detectProvider(model: string): LLMProvider {
    if (model.includes('claude') || model.includes('anthropic')) {
      return 'anthropic';
    }
    if (model.includes('gpt') || model.includes('openai')) {
      return 'openai';
    }
    if (model.includes('openrouter')) {
      return 'openrouter';
    }
    if (model.includes('custom') || model.includes('integrate-api-nvidia')) {
      return 'custom';
    }
    return 'unknown';
  }

  /**
   * 计算成本
   */
  private calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    modelUsage: ModelUsage,
  ): number {
    const inputCostPer1K = modelUsage.estimatedCostPer1K * 0.5;  // 输入成本通常是 50%
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

    return {
      callsCount: this.callsCount,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      avgTokensPerCall,
      avgLatency: 0,  // TODO: 跟踪
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.callsCount = 0;
    this.totalTokens = 0;
    this.totalCost = 0;
  }
}
