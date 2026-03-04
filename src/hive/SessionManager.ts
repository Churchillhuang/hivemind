/**
 * SessionManager - OpenClaw Session 集成
 *
 * 管理 OpenClaw session 数据，支持多 agent 上下文
 */

import { promises as fs } from "fs";
import path from "path";
import type { HiveConfig } from "../hive/HiveConfig.js";

/**
 * OpenClaw Session Entry
 */
export interface SessionEntry {
  sessionId: string;
  updatedAt: number;
  displayName?: string;
  channel?: string;
  subject?: string;
  room?: string;
  space?: string;
  origin?: {
    label?: string;
    provider?: string;
    from?: string;
    to?: string;
    accountId?: string;
    threadId?: string;
  };
  // HiveMind 扩展字段
  hiveMind?: {
    agents: string[]; // 参与的 agents
    primaryAgent: string; // 主要 agent
    orchestratorId?: string; // Orchestrator ID
    mode: "single" | "multi"; // 运行模式
    createdAt?: number; // HiveMind 开始参与时间
  };
}

/**
 * Session Store
 */
export interface SessionStore {
  [sessionKey: string]: SessionEntry;
}

/**
 * Session Manager - 管理 OpenClaw session 数据
 */
export class SessionManager {
  private agentId: string;
  private sessionsPath: string;
  private transcriptsPath: string;
  private store?: SessionStore;
  private lastLoadTime = 0;
  private hiveConfig: HiveConfig;

  constructor(
    agentId: string,
    hiveConfig: HiveConfig,
    basePath: string = "/root/.openclaw/agents",
  ) {
    this.agentId = agentId;
    this.hiveConfig = hiveConfig;
    this.sessionsPath = path.join(basePath, agentId, "sessions", "sessions.json");
    this.transcriptsPath = path.join(basePath, agentId, "sessions");
  }

  /**
   * 加载 session store
   */
  async loadStore(): Promise<SessionStore> {
    try {
      const content = await fs.readFile(this.sessionsPath, "utf-8");
      this.store = JSON.parse(content);
      this.lastLoadTime = Date.now();
      return this.store!;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // 文件不存在，创建新的
        this.store = {};
        return this.store;
      }
      throw error;
    }
  }

  /**
   * 保存 session store
   */
  async saveStore(): Promise<void> {
    if (!this.store) {
      return;
    }

    await fs.mkdir(path.dirname(this.sessionsPath), { recursive: true });
    await fs.writeFile(this.sessionsPath, JSON.stringify(this.store, null, 2), "utf-8");
    this.lastLoadTime = Date.now();
  }

  /**
   * 获取 session entry
   */
  async getEntry(sessionKey: string): Promise<SessionEntry | undefined> {
    const store = await this.loadStore();
    return store[sessionKey];
  }

  /**
   * 设置 session entry
   */
  async setEntry(sessionKey: string, entry: SessionEntry): Promise<void> {
    const store = await this.loadStore();
    store[sessionKey] = entry;
    this.store = store;
    await this.saveStore();
  }

  /**
   * 更新 session entry
   */
  async updateEntry(sessionKey: string, updates: Partial<SessionEntry>): Promise<void> {
    const entry = await this.getEntry(sessionKey);
    if (!entry) {
      throw new Error(`Session entry not found: ${sessionKey}`);
    }

    await this.setEntry(sessionKey, { ...entry, ...updates });
  }

  /**
   * 列出所有 sessions
   */
  async listSessions(activeMinutes?: number): Promise<SessionEntry[]> {
    const store = await this.loadStore();

    const entries = Object.values(store);

    if (activeMinutes !== undefined) {
      const cutoff = Date.now() - activeMinutes * 60 * 1000;
      return entries.filter((e) => e.updatedAt > cutoff);
    }

    return entries;
  }

  /**
   * 删除 session entry
   */
  async deleteEntry(sessionKey: string): Promise<void> {
    const store = await this.loadStore();
    delete store[sessionKey];
    this.store = store;
    await this.saveStore();
  }

  /**
   * 添加 HiveMind agent 到 session
   */
  async addAgentToSession(
    sessionKey: string,
    agentId: string,
    isPrimary: boolean = false,
  ): Promise<void> {
    const entry = await this.getEntry(sessionKey);
    if (!entry) {
      throw new Error(`Session entry not found: ${sessionKey}`);
    }

    if (!entry.hiveMind) {
      entry.hiveMind = {
        agents: [],
        primaryAgent: "",
        mode: this.hiveConfig.mode,
      };
    }

    // 添加 agent（去重）
    if (!entry.hiveMind.agents.includes(agentId)) {
      entry.hiveMind.agents.push(agentId);
    }

    // 设置主要 agent
    if (isPrimary) {
      entry.hiveMind.primaryAgent = agentId;
    }

    if (!entry.hiveMind.createdAt) {
      entry.hiveMind.createdAt = Date.now();
    }

    await this.updateEntry(sessionKey, { hiveMind: entry.hiveMind });
  }

  /**
   * 移除 HiveMind agent 从 session
   */
  async removeAgentFromSession(sessionKey: string, agentId: string): Promise<void> {
    const entry = await this.getEntry(sessionKey);
    if (!entry || !entry.hiveMind) {
      return;
    }

    entry.hiveMind.agents = entry.hiveMind.agents.filter((a) => a !== agentId);

    // 如果移除的 agent 是主要 agent，选择第一个作为新的主要
    if (entry.hiveMind.primaryAgent === agentId) {
      entry.hiveMind.primaryAgent = entry.hiveMind.agents[0] || "";
    }

    await this.updateEntry(sessionKey, { hiveMind: entry.hiveMind });
  }

  /**
   * 设置 Orchestrator ID
   */
  async setOrchestratorId(sessionKey: string, orchestratorId: string): Promise<void> {
    const entry = await this.getEntry(sessionKey);
    if (!entry) {
      throw new Error(`Session entry not found: ${sessionKey}`);
    }

    if (!entry.hiveMind) {
      entry.hiveMind = {
        agents: [],
        primaryAgent: "",
        mode: this.hiveConfig.mode,
      };
    }

    entry.hiveMind.orchestratorId = orchestratorId;
    await this.updateEntry(sessionKey, { hiveMind: entry.hiveMind });
  }

  /**
   * 获取 transcript 路径
   */
  getTranscriptPath(sessionId: string): string {
    return path.join(this.transcriptsPath, `${sessionId}.jsonl`);
  }

  /**
   * 读取 transcript
   */
  async readTranscript(sessionId: string): Promise<unknown[]> {
    const transcriptPath = this.getTranscriptPath(sessionId);
    try {
      const content = await fs.readFile(transcriptPath, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * 写入 transcript
   */
  async writeTranscript(sessionId: string, line: unknown): Promise<void> {
    const transcriptPath = this.getTranscriptPath(sessionId);
    await fs.mkdir(this.transcriptsPath, { recursive: true });
    await fs.appendFile(transcriptPath, JSON.stringify(line) + "\n", "utf-8");
  }

  /**
   * 统计 session 信息
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number; // 最近 1 小时
    hiveMindSessions: number; // 有 HiveMind 数据的 sessions
  }> {
    const allSessions = await this.listSessions();
    const activeSessions = await this.listSessions(60);
    const hiveMindSessions = allSessions.filter((s) => s.hiveMind).length;

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      hiveMindSessions,
    };
  }

  /**
   * 清理旧的 HiveMind session 数据
   */
  async cleanupHiveMindSessions(maxAgeMs: number): Promise<number> {
    const store = await this.loadStore();
    const sessions = Object.entries(store);
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionKey, session] of sessions) {
      if (session.hiveMind && session.hiveMind.createdAt) {
        if (now - session.hiveMind.createdAt > maxAgeMs) {
          // 移除 HiveMind 数据
          const updated = { ...session };
          delete updated.hiveMind;
          store[sessionKey] = updated;
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.store = store;
      await this.saveStore();
    }

    return cleaned;
  }
}
