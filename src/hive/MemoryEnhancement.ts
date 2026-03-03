/**
 * Memory Enhancement
 *
 * 记忆增强：语义搜索、向量嵌入、压缩、清理
 */

import { getGlobalEventBus } from '../events/EventBus.js';
import type { Event } from '../events/Event.js';
import { EventType } from '../events/Event.js';
import type { HiveConfig } from './HiveConfig.js';

/**
 * 记忆嵌入向量
 */
export interface MemoryEmbedding {
  memoryId: string;
  embedding: number[];  // 向量表示 (dim=384, 768, etc.)
  chunkIndex: number;  // 分块索引
  timestamp: number;
}

/**
 * 记忆分块
 */
export interface MemoryChunk {
  chunkId: string;
  memoryId: string;
  content: string;
  embedding?: number[];
  importance: number;  // 0-1
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

/**
 * 语义搜索结果
 */
export interface SemanticSearchResult {
  memoryId: string;
  chunkId: string;
  content: string;
  similarity: number;  // 0-1
  relevanceScore: number;  // 结合相似性和重要性
}

/**
 * 记忆压缩配置
 */
export interface CompressionConfig {
  maxChunkSize: number;  // chars
  minChunkOverlap: number;  // chars
  compressionRatio: number;  // 0-1, 目标压缩比
}

/**
 * 记忆清理配置
 */
export interface CleanupConfig {
  cleanupInterval: number;  // ms
  maxAge: number;  // ms
  minImportance: number;  // 0-1
  minAccessCount: number;
}

/**
 * 向量嵌入模型
 */
export type EmbeddingModel = 'minilm' | 'bge-small' | 'bge-base' | 'openai-embeddings';

/**
 * Memory Enhancement
 */
export class MemoryEnhancement {
  private hiveConfig: HiveConfig;
  private eventBus = getGlobalEventBus();

  // 记忆嵌入
  private embeddings: Map<string, MemoryEmbedding> = new Map();

  // 记忆分块
  private chunks: Map<string, MemoryChunk> = new Map();

  // 内存到分块映射
  private memoryToChunks: Map<string, string[]> = new Map();

  // 配置
  private compressionConfig: CompressionConfig;
  private cleanupConfig: CleanupConfig;

  // 清理定时器
  private cleanupTimer?: NodeJS.Timeout;

  // 向量维度（默认 384，对应 MiniLM）
  private embeddingDim = 384;

  // 统计
  private stats = {
    totalChunks: 0,
    totalEmbeddings: 0,
    compressionSaved: 0,
    cleanedMemories: 0,
  };

  constructor(config: {
    hiveConfig: HiveConfig;
    compressionConfig?: Partial<CompressionConfig>;
    cleanupConfig?: Partial<CleanupConfig>;
    embeddingDim?: number;
  }) {
    this.hiveConfig = config.hiveConfig;

    this.compressionConfig = {
      maxChunkSize: config.compressionConfig?.maxChunkSize || 500,
      minChunkOverlap: config.compressionConfig?.minChunkOverlap || 50,
      compressionRatio: config.compressionConfig?.compressionRatio || 0.7,
    };

    this.cleanupConfig = {
      cleanupInterval: config.cleanupConfig?.cleanupInterval || 3600000,  // 1 小时
      maxAge: config.cleanupConfig?.maxAge || 2592000000,  // 30 天
      minImportance: config.cleanupConfig?.minImportance || 0.3,
      minAccessCount: config.cleanupConfig?.minAccessCount || 1,
    };

    this.embeddingDim = config.embeddingDim || 384;
  }

  /**
   * 启动记忆增强
   */
  async start(): Promise<void> {
    console.log('[MemEnh] Memory Enhancement started');

    // 启动定期清理
    this.cleanupTimer = setInterval(
      () => this.runCleanup(),
      this.cleanupConfig.cleanupInterval,
    );

    console.log('[MemEnh] Cleanup schedule started');
  }

  /**
   * 停止记忆增强
   */
  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('[MemEnh] Memory Enhancement stopped');
  }

  /**
   * 处理记忆更新事件
   */
  async handleMemoryUpdate(event: Event): void {
    const payload = event.payload as { memoryId: string; content: string };

    // 创建记忆分块
    await this.createMemoryChunks(payload.memoryId, payload.content);
  }

  /**
   * 创建记忆分块
   */
  async createMemoryChunks(memoryId: string, content: string): Promise<void> {
    const chunkSize = this.compressionConfig.maxChunkSize;
    const overlap = this.compressionConfig.minChunkOverlap;

    // 简单分块策略（实际可以使用更智能的分段，如语义分段）
    const chunks: string[] = [];
    let index = 0;

    while (index < content.length) {
      const start = index;
      const end = Math.min(index + chunkSize, content.length);
      chunks.push(content.substring(start, end));
      
      // 移动到下一块，保留重叠部分
      index = end - overlap;
      
      // 确保_index前进，防止无限循环
      if (index <= start) {
        index = end;  // 跳过剩余内容
      }
    }

    // 创建分块对象
    const chunkIds: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `chunk_${memoryId}_${i}`;
      const chunk: MemoryChunk = {
        chunkId,
        memoryId,
        content: chunks[i],
        embedding: undefined,  // 稍后计算
        importance: this.calculateImportance(chunks[i]),  // 初始重要性
        accessCount: 0,
        lastAccessed: Date.now(),
        createdAt: Date.now(),
      };

      this.chunks.set(chunkId, chunk);
      chunkIds.push(chunkId);

      // 生成嵌入向量（模拟）
      const embedding = this.generateEmbedding(chunks[i]);
      this.embeddings.set(chunkId, {
        memoryId,
        embedding,
        chunkIndex: i,
        timestamp: Date.now(),
      });

      chunk.embedding = embedding;

      this.stats.totalChunks++;
      this.stats.totalEmbeddings++;
    }

    this.memoryToChunks.set(memoryId, chunkIds);

    console.log(`[MemEnh] Created ${chunkIds.length} chunks for memory ${memoryId}`);
  }

  /**
   * 计算重要性
   */
  private calculateImportance(content: string): number {
    // 简单的重要性计算（实际可以更复杂）
    let score = 0.5;

    // 长度加成
    score += Math.min(0.2, content.length / 1000);

    // 关键词加成
    const importantKeywords = ['important', 'critical', 'key', 'essential', '核心', '重要', '关键'];
    const keywordCount = importantKeywords.filter(kw => content.toLowerCase().includes(kw)).length;
    score += keywordCount * 0.1;

    // 问号加成（问题通常表示需要记住的疑问）
    const questionCount = (content.match(/\?/g) || []).length;
    score += Math.min(0.3, questionCount * 0.1);

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 生成嵌入向量（模拟）
   * 实际应该使用真实的嵌入模型（如 SentenceTransformers, OpenAI Embeddings）
   */
  private generateEmbedding(text: string): number[] {
    // 模拟向量生成（基于文本特征的简单哈希）
    const vector: number[] = [];
    const seed = this.hash(text);

    for (let i = 0; i < this.embeddingDim; i++) {
      // 使用伪随机生成器（确定性）
      const value = ((seed * (i + 1)) % 10000) / 10000;
      vector.push(value);
    }

    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / norm);
  }

  /**
   * 简单的字符串哈希
   */
  private hash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query: string, limit: number = 5): Promise<SemanticSearchResult[]> {
    // 生成查询嵌入
    const queryEmbedding = this.generateEmbedding(query);

    // 计算相似度
    const results: Array<{ chunk: MemoryChunk; similarity: number }> = [];

    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (!chunk.embedding) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      // 考虑重要性
      const relevanceScore = similarity * 0.7 + chunk.importance * 0.3;

      results.push({ chunk, similarity });
    }

    // 排序并取前 N
    const topResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // 更新访问统计
    for (const result of topResults) {
      result.chunk.accessCount++;
      result.chunk.lastAccessed = Date.now();
    }

    // 转换为语义搜索结果
    return topResults.map(r => ({
      memoryId: r.chunk.memoryId,
      chunkId: r.chunk.chunkId,
      content: r.chunk.content,
      similarity: r.similarity,
      relevanceScore: r.similarity * 0.7 + r.chunk.importance * 0.3,
    }));
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 记忆压缩
   */
  async compressMemory(memoryId: string, content: string): Promise<{ compressedContent: string; compressionRatio: number }> {
    // 创建分块
    await this.createMemoryChunks(memoryId, content);

    // 根据重要性筛选分块
    const chunkIds = this.memoryToChunks.get(memoryId) || [];
    const chunks = chunkIds.map(id => this.chunks.get(id)!).filter(Boolean);

    // 过滤低重要性分块
    const importantChunks = chunks.filter(c => c.importance >= 0.5);

    // 合并分块
    const compressedChunks = importantChunks.slice(0, Math.ceil(chunks.length * this.compressionConfig.compressionRatio));

    const compressedContent = compressedChunks.map(c => c.content).join('\n\n');
    const compressionRatio = content.length > 0 ? compressedContent.length / content.length : 1;

    this.stats.compressionSaved += content.length - compressedContent.length;

    console.log(`[MemEnh] Compressed memory ${memoryId}: ${(compressionRatio * 100).toFixed(1)}% retained`);

    return { compressedContent, compressionRatio };
  }

  /**
   * 运行清理
   */
  private async runCleanup(): Promise<void> {
    const now = Date.now();
    const chunksToDelete: string[] = [];

    for (const [chunkId, chunk] of this.chunks.entries()) {
      // 检查年龄
      const age = now - chunk.createdAt;
      if (age > this.cleanupConfig.maxAge) {
        chunksToDelete.push(chunkId);
        continue;
      }

      // 检查重要性
      if (chunk.importance < this.cleanupConfig.minImportance) {
        chunksToDelete.push(chunkId);
        continue;
      }

      // 检查访问次数
      if (chunk.accessCount < this.cleanupConfig.minAccessCount) {
        // 还要检查年龄（新记忆不应该被删除）
        if (age > this.cleanupConfig.maxAge / 2) {
          chunksToDelete.push(chunkId);
        }
      }
    }

    // 删除分块
    for (const chunkId of chunksToDelete) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        // 删除嵌入
        this.embeddings.delete(chunkId);

        // 删除分块
        this.chunks.delete(chunkId);

        // 从记忆映射中移除
        if (this.memoryToChunks.has(chunk.memoryId)) {
          const ids = this.memoryToChunks.get(chunk.memoryId)!;
          const idx = ids.indexOf(chunkId);
          if (idx > -1) {
            ids.splice(idx, 1);
          }
        }

        this.stats.cleanedMemories++;
      }
    }

    if (chunksToDelete.length > 0) {
      console.log(`[MemEnh] Cleaned up ${chunksToDelete.length} chunks`);
    }
  }

  /**
   * 手动清理
   */
  async cleanup(): Promise<number> {
    await this.runCleanup();
    return this.stats.cleanedMemories;
  }

  /**
   * 获取分块统计
   */
  getChunkStats(): { total: number; avgImportance: number; avgAccessCount: number } {
    const chunksArray = Array.from(this.chunks.values());

    const total = chunksArray.length;
    const avgImportance = total > 0
      ? chunksArray.reduce((sum, c) => sum + c.importance, 0) / total
      : 0;
    const avgAccessCount = total > 0
      ? chunksArray.reduce((sum, c) => sum + c.accessCount, 0) / total
      : 0;

    return { total, avgImportance, avgAccessCount };
  }

  /**
   * 获取记忆统计
   */
  getMemoryStats(): {
    totalMemories: number;
    totalChunks: number;
    totalEmbeddings: number;
    compressionSaved: number;
    cleanedMemories: number;
  } {
    return {
      totalMemories: this.memoryToChunks.size,
      totalChunks: this.stats.totalChunks,
      totalEmbeddings: this.stats.totalEmbeddings,
      compressionSaved: this.stats.compressionSaved,
      cleanedMemories: this.stats.cleanedMemories,
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.embeddings.clear();
    this.chunks.clear();
    this.memoryToChunks.clear();

    this.stats = {
      totalChunks: 0,
      totalEmbeddings: 0,
      compressionSaved: 0,
      cleanedMemories: 0,
    };

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    console.log('[MemEnh] Memory Enhancement reset');
  }
}
