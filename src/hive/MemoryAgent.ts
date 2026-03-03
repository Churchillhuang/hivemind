/**
 * MemoryAgent - 记忆管理 Agent
 *
 * 负责按需检索和分发记忆，实现分层记忆系统
 */

import { BaseAgent } from '../core/Agent.js';
import { Event, EventType } from '../events/Event.js';
import { EventBus } from '../events/EventBus.js';
import type { HiveConfig, MemoryLevel } from '../hive/HiveConfig.js';
import { promises as fs } from 'fs';
import path from 'path';

export interface MemoryQuery {
  query: string;
  requestId: string;
  options?: {
    level?: MemoryLevel;
    limit?: number;
    context?: string;
    agentId?: string;
  };
}

export interface MemoryResult {
  requestId: string;
  data: {
    level: MemoryLevel;
    content: string;
    source: string;
    timestamp?: number;
  }[];
}

export interface MemoryIndexEntry {
  path: string;
  lastModified: number;
  size: number;
  summary?: string;          // 简短摘要（可选）
  level?: MemoryLevel;       // 记忆层级
}

export class MemoryAgent extends BaseAgent {
  private hiveConfig: HiveConfig;
  private memoryIndex: Map<string, MemoryIndexEntry> = new Map();
  private lastIndexUpdate: number = 0;
  private readonly INDEX_UPDATE_INTERVAL = 60000; // 1 分钟更新一次索引

  constructor(
    config: { id: string; role: string; description?: string },
    hiveConfig: HiveConfig,
    eventBus?: EventBus,
  ) {
    super({
      id: config.id,
      role: config.role,
      type: 'system',
      description: config.description,
    }, eventBus);

    this.hiveConfig = hiveConfig;

    // 订阅事件
    this.subscribeTo(EventType.MEMORY_QUERY);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 初始化记忆索引
    await this.buildMemoryIndex();

    await this.eventBus?.publish({
      type: EventType.AGENT_STARTED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
        indexSize: this.memoryIndex.size,
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    await this.eventBus?.publish({
      type: EventType.AGENT_STOPPED,
      sourceAgent: this.id,
      payload: {
        agentId: this.id,
        role: this.role,
      },
    });
  }

  async handle(event: Event): Promise<void> {
    if (event.type === EventType.MEMORY_QUERY) {
      await this.handleMemoryQuery(event);
    }
  }

  /**
   * 构建记忆索引
   */
  private async buildMemoryIndex(): Promise<void> {
    console.log(`[MemoryAgent ${this.id}] Building memory index...`);

    const memoryPath = this.hiveConfig.memory?.indexing.memoryPath || '';
    const workspacePath = this.hiveConfig.memory?.indexing.workspacePath || '';

    try {
      // 索引 MEMORY.md
      const memoryPathFull = path.join(workspacePath, 'MEMORY.md');
      if (await this.fileExists(memoryPathFull)) {
        const stats = await fs.stat(memoryPathFull);
        this.memoryIndex.set('MEMORY.md', {
          path: memoryPathFull,
          lastModified: stats.mtime.getTime(),
          size: stats.size,
          level: 'knowledge',
          summary: 'Long-term memory',
        });
      }

      // 索引 daily memory files
      if (await this.directoryExists(memoryPath)) {
        const files = await fs.readdir(memoryPath);
        const memoryFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));

        for (const file of memoryFiles) {
          const filePath = path.join(memoryPath, file);
          const stats = await fs.stat(filePath);

          // 判断记忆层级
          const level = this.determineMemoryLevel(file, stats.mtime.getTime());

          this.memoryIndex.set(file, {
            path: filePath,
            lastModified: stats.mtime.getTime(),
            size: stats.size,
            level,
            summary: `Daily memory: ${file}`,
          });
        }
      }

      console.log(`[MemoryAgent ${this.id}] Index built: ${this.memoryIndex.size} entries`);
      this.lastIndexUpdate = Date.now();

    } catch (error) {
      console.error(`[MemoryAgent ${this.id}] Error building memory index:`, error);
    }
  }

  /**
   * 根据文件名和时间戳确定记忆层级
   */
  private determineMemoryLevel(filename: string, timestamp: number): MemoryLevel {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const daysOld = Math.floor((now - timestamp) / dayMs);
    const retention = this.hiveConfig.memory?.retention;

    // 判断层级
    if (retention && daysOld <= retention.sessionDays) {
      return 'session';
    } else if (retention && daysOld <= retention.sampleDays) {
      return 'sample';
    } else {
      return 'knowledge';
    }
  }

  /**
   * 处理记忆查询
   */
  private async handleMemoryQuery(event: Event): Promise<void> {
    const query = event.payload as MemoryQuery;

    console.log(`[MemoryAgent ${this.id}] Processing query:`, query);

    try {
      // 确定查询层级
      const level: MemoryLevel = query.options?.level || 'knowledge';

      // 检索记忆
      const results = await this.retrieveMemory(query.query, level, query.options?.limit);

      // 发布结果
      await this.eventBus?.publish({
        type: EventType.MEMORY_RESULT,
        sourceAgent: this.id,
        payload: {
          requestId: query.requestId,
          data: results,
        },
      });

      console.log(`[MemoryAgent ${this.id}] Query completed: ${results.length} results`);

    } catch (error) {
      console.error(`[MemoryAgent ${this.id}] Error processing query:`, error);

      await this.eventBus?.publish({
        type: EventType.AGENT_ERROR,
        sourceAgent: this.id,
        payload: {
          requestId: query.requestId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * 检索记忆
   */
  private async retrieveMemory(
    query: string,
    level: MemoryLevel,
    limit?: number,
  ): Promise<MemoryResult['data']> {
    const maxResults = limit || 10;
    const results: MemoryResult['data'] = [];

    // 定期更新索引
    if (Date.now() - this.lastIndexUpdate > this.INDEX_UPDATE_INTERVAL) {
      await this.buildMemoryIndex();
    }

    // 筛选符合层级的记忆
    const filtered = Array.from(this.memoryIndex.values())
      .filter(entry => !entry.level || this.levelMatches(entry.level, level));

    // MVP: 简单的关键词匹配
    // 后期可以加入向量搜索或语义搜索
    const queryLower = query.toLowerCase();

    for (const entry of filtered) {
      if (results.length >= maxResults) {
        break;
      }

      try {
        const content = await fs.readFile(entry.path, 'utf-8');
        const lines = content.split('\n');

        // 简单的关键词匹配
        const matchingLines = lines.filter((line, index) => {
          return line.toLowerCase().includes(queryLower) ||
                 this.isHeadingLine(line, lines, index, query);
        });

        if (matchingLines.length > 0) {
          results.push({
            level: entry.level || 'knowledge',
            content: matchingLines.slice(0, 5).join('\n'),  // 最多 5 行
            source: entry.path,
            timestamp: entry.lastModified,
          });
        }

      } catch (error) {
        console.error(`[MemoryAgent ${this.id}] Error reading ${entry.path}:`, error);
      }
    }

    return results;
  }

  /**
   * 判断层级是否匹配
   */
  private levelMatches(entryLevel: MemoryLevel, queryLevel: MemoryLevel): boolean {
    // 层级包含关系：
    // knowledge 包含所有层级
    // sample 包含 session
    // task 只匹配 task
    // session 只匹配 session
    // none 不匹配任何东西

    if (queryLevel === 'knowledge') {
      return true;
    }

    if (queryLevel === 'sample') {
      return entryLevel === 'sample' || entryLevel === 'session';
    }

    return entryLevel === queryLevel;
  }

  /**
   * 判断是否是标题行或相关上下文
   */
  private isHeadingLine(
    line: string,
    lines: string[],
    index: number,
    query: string,
  ): boolean {
    // 简单的 Markdown 标题检测
    if (line.match(/^#{1,6}\s/)) {
      return line.toLowerCase().includes(query.toLowerCase());
    }

    // 检查前一行是否是包含关键词的标题
    if (index > 0 && lines[index - 1].match(/^#{1,6}\s/)) {
      return lines[index - 1].toLowerCase().includes(query.toLowerCase());
    }

    return false;
  }

  /**
   * 获取记忆索引状态
   */
  getIndexStatus(): {
    size: number;
    lastIndexUpdate: number;
    levels: Record<MemoryLevel, number>;
  } {
    const levels: Record<string, number> = {
      none: 0,
      session: 0,
      task: 0,
      knowledge: 0,
      sample: 0,
    };

    for (const entry of this.memoryIndex.values()) {
      if (entry.level) {
        levels[entry.level]++;
      }
    }

    return {
      size: this.memoryIndex.size,
      lastIndexUpdate: this.lastIndexUpdate,
      levels: levels as Record<MemoryLevel, number>,
    };
  }

  // Utility methods

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
