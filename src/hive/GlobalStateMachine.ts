/**
 * Global State Machine - HiveMind 系统全局状态管理
 *
 * 支持状态模式、检查点、持久化、回滚
 */

import { promises as fs } from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'path';
import type { HiveConfig } from './HiveConfig.js';

/**
 * 状态类型
 */
export type StateMachineState =
  | 'idle'
  | 'processing'
  | 'blocked'
  | 'recovery'
  | 'shutdown'
  | 'error';

/**
 * 状态转换
 */
export interface StateTransition {
  from: StateMachineState;
  to: StateMachineState;
  timestamp: number;
  reason: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 检查点
 */
export interface Checkpoint {
  id: string;
  timestamp: number;
  state: StateMachineState;
  stateHash: string;  // 状态数据的哈希
  checksum: string;   // 校验和
  metadata: {
    activeAgents: string[];
    pendingTasks: number;
    completedTasks: number;
    eventHistorySize: number;
    generation: number;  // 状态代数（用于回滚）
  };
  snapshots: {
    agents: string;
    tasks: string;
    events: string;
  };
}

/**
 * 全局状态数据
 */
export interface GlobalState {
  version: string;
  generation: number;
  currentState: StateMachineState;
  lastTransition?: StateTransition;
  metadata: {
    activeAgents: string[];
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    startTime: number;
    lastActivity: number;
  };
  config: {
    maxCheckpoints: number;
    checkpointInterval: number;
    enableRollback: boolean;
    enablePersistence: boolean;
  };
}

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  enablePersistence?: boolean;
  checkpointPath?: string;
  maxCheckpoints?: number;
  checkpointInterval?: number;
  enableRollback?: boolean;
  stateVersion?: string;
}

/**
 * Global State Machine
 */
export class GlobalStateMachine {
  private config: StateMachineConfig;
  private state: GlobalState;
  private transitions: StateTransition[] = [];
  private checkpoints: Map<string, Checkpoint> = new Map();
  private checkpointTimer?: NodeJS.Timeout;
  private hiveConfig: HiveConfig;

  constructor(config: StateMachineConfig, hiveConfig: HiveConfig) {
    this.config = {
      enablePersistence: true,
      checkpointPath: '/root/.openclaw/.hivemind/state',
      maxCheckpoints: 10,
      checkpointInterval: 60000, // 1 分钟
      enableRollback: true,
      stateVersion: '1.0.0',
      ...config,
    };

    this.hiveConfig = hiveConfig;
    this.state = this.initializeState();
  }

  /**
   * 初始化状态
   */
  private initializeState(): GlobalState {
    return {
      version: this.config.stateVersion || '1.0.0',
      generation: 0,
      currentState: 'idle',
      metadata: {
        activeAgents: [],
        pendingTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        startTime: Date.now(),
        lastActivity: Date.now(),
      },
      config: {
        maxCheckpoints: this.config.maxCheckpoints || 10,
        checkpointInterval: this.config.checkpointInterval || 60000,
        enableRollback: this.config.enableRollback !== false,
        enablePersistence: this.config.enablePersistence !== false,
      },
    };
  }

  /**
   * 启动状态机
   */
  async start(): Promise<void> {
    // 尝试加载持久化状态
    if (this.config.enablePersistence) {
      await this.loadState();
    }

    // 启动检查点定时器
    this.startCheckpointSchedule();

    console.log(`[GSM] Started (state: ${this.state.currentState}, generation: ${this.state.generation})`);
  }

  /**
   * 停止状态机
   */
  async stop(): Promise<void> {
    // 停止检查点定时器
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }

    // 保存最终状态
    if (this.config.enablePersistence) {
      await this.saveState(true);  // final save
    }

    console.log(`[GSM] Stopped`);
  }

  /**
   * 状态转换
   */
  async transition(to: StateMachineState, reason: string, agentId?: string, metadata?: Record<string, unknown>): Promise<void> {
    const from = this.state.currentState;

    // 验证转换是否合法
    if (!this.isValidTransition(from, to)) {
      throw new Error(`Invalid state transition: ${from} -> ${to}`);
    }

    // 创建转换记录
    const transition: StateTransition = {
      from,
      to,
      timestamp: Date.now(),
      reason,
      agentId,
      metadata,
    };

    // 更新状态
    this.state.currentState = to;
    this.state.lastTransition = transition;
    this.state.metadata.lastActivity = Date.now();
    this.transitions.push(transition);

    console.log(`[GSM] State transition: ${from} -> ${to} (${reason})`);

    // 自动检查点（重要状态转换）
    if (to === 'processing' || to === 'error' || to === 'shutdown') {
      await this.createCheckpoint(`transition_${to}`);
    }
  }

  /**
   * 验证状态转换是否合法
   */
  private isValidTransition(from: StateMachineState, to: StateMachineState): boolean {
    // 基本规则
    if (from === to) {
      // 允许自转换（状态保持）
      return true;
    }

    // 状态转换矩阵
    const allowed: Record<StateMachineState, StateMachineState[]> = {
      idle: ['processing', 'shutdown', 'error'],
      processing: ['idle', 'blocked', 'error', 'shutdown'],
      blocked: ['idle', 'error', 'shutdown'],
      recovery: ['idle', 'processing', 'error', 'shutdown'],
      shutdown: ['idle', 'error'],
      error: ['recovery', 'shutdown', 'idle'],
    };

    return allowed[from]?.includes(to) || false;
  }

  /**
   * 更新元数据
   */
  updateMetadata(updates: Partial<GlobalState['metadata']>): void {
    this.state.metadata = {
      ...this.state.metadata,
      ...updates,
      lastActivity: Date.now(),
    };
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(_reason?: string): Promise<Checkpoint> {
    const checkpointId = `ckpt_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 9)}`;

    // 生成快照
    const stateString = JSON.stringify(this.state);
    const stateHash = this.generateHash(stateString);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp: Date.now(),
      state: this.state.currentState,
      stateHash,
      checksum: this.generateChecksum(stateString),
      metadata: {
        activeAgents: [...this.state.metadata.activeAgents],
        pendingTasks: this.state.metadata.pendingTasks,
        completedTasks: this.state.metadata.completedTasks,
        eventHistorySize: 0,  // TODO: 从 EventBus 获取
        generation: this.state.generation,
      },
      snapshots: {
        agents: JSON.stringify(this.state.metadata.activeAgents),
        tasks: JSON.stringify({
          pending: this.state.metadata.pendingTasks,
          completed: this.state.metadata.completedTasks,
          failed: this.state.metadata.failedTasks,
        }),
        events: '',  // TODO: 从 EventBus 获取
      },
    };

    // 添加到存储
    this.checkpoints.set(checkpointId, checkpoint);

    // 清理旧检查点
    this.cleanupOldCheckpoints();

    // 持久化
    if (this.config.enablePersistence) {
      await this.saveCheckpoint(checkpoint);
    }

    console.log(`[GSM] Checkpoint created: ${checkpointId} (${this.state.currentState})`);

    return checkpoint;
  }

  /**
   * 回滚到指定检查点
   */
  async rollback(checkpointId: string): Promise<void> {
    if (!this.config.enableRollback) {
      throw new Error('Rollback is disabled');
    }

    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    console.log(`[GSM] Rollback to checkpoint: ${checkpointId}`);

    // 更新状态
    this.state.currentState = checkpoint.state;
    this.state.generation = checkpoint.metadata.generation;

    // 恢复元数据
    this.state.metadata.activeAgents = checkpoint.metadata.activeAgents;
    this.state.metadata.pendingTasks = checkpoint.metadata.pendingTasks;
    this.state.metadata.completedTasks = checkpoint.metadata.completedTasks;

    // 增加代数标记为回滚
    const rollbackTransition: StateTransition = {
      from: this.state.lastTransition?.to || 'idle',
      to: checkpoint.state,
      timestamp: Date.now(),
      reason: `rollback to ${checkpointId}`,
      metadata: { rollback: true },
    };

    this.transitions.push(rollbackTransition);
    this.state.lastTransition = rollbackTransition;

    // 持久化
    if (this.config.enablePersistence) {
      await this.saveState(true);
    }

    console.log(`[GSM] Rollback completed (generation: ${checkpoint.metadata.generation})`);
  }

  /**
   * 获取当前状态
   */
  getState(): GlobalState {
    return { ...this.state };
  }

  /**
   * 获取转换历史
   */
  getTransitions(limit?: number): StateTransition[] {
    const transitions = this.transitions.slice().toReversed();
    if (limit) {
      return transitions.slice(0, limit);
    }
    return transitions;
  }

  /**
   * 获取检查点列表
   */
  getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).toSorted((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 生成哈希
   */
  private generateHash(data: string): string {
    // 简单的哈希函数（实际应该使用 crypto）
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 生成校验和
   */
  private generateChecksum(data: string): string {
    // 简单的校验和（实际应该使用更强的算法）
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum += data.charCodeAt(i);
    }
    return checksum.toString(36);
  }

  /**
   * 启动检查点定时器
   */
  private startCheckpointSchedule(): void {
    const interval = this.config.checkpointInterval || 60000;

    this.checkpointTimer = setInterval(async () => {
      await this.createCheckpoint('scheduled');
    }, interval);

    console.log(`[GSM] Checkpoint schedule started (interval: ${interval}ms)`);
  }

  /**
   * 清理旧检查点
   */
  private cleanupOldCheckpoints(): void {
    const maxCheckpoints = this.config.maxCheckpoints || 10;
    const checkpoints = this.getCheckpoints();

    if (checkpoints.length > maxCheckpoints) {
      // 删除最旧的检查点
      const toDelete = checkpoints.slice(maxCheckpoints);
      for (const checkpoint of toDelete) {
        this.checkpoints.delete(checkpoint.id);

        // 删除持久化文件
        if (this.config.enablePersistence && this.config.checkpointPath) {
          this.deleteCheckpointFile(checkpoint.id).catch(console.error);
        }
      }

      console.log(`[GSM] Cleaned up ${toDelete.length} old checkpoints`);
    }
  }

  /**
   * 保存状态
   */
  private async saveState(final: boolean = false): Promise<void> {
    if (!this.config.checkpointPath) {
      return;
    }

    const statePath = path.join(this.config.checkpointPath, final ? 'final_state.json' : 'current_state.json');

    await fs.mkdir(this.config.checkpointPath, { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(this.state, null, 2), 'utf-8');

    if (final) {
      console.log(`[GSM] Final state saved to: ${statePath}`);
    }
  }

  /**
   * 加载状态
   */
  private async loadState(): Promise<void> {
    if (!this.config.checkpointPath) {
      return;
    }

    const statePath = path.join(this.config.checkpointPath, 'current_state.json');

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      const loadedState = JSON.parse(content);

      // 验证版本兼容性
      if (loadedState.version !== this.config.stateVersion) {
        console.warn(`[GSM] State version mismatch: loaded=${loadedState.version}, current=${this.config.stateVersion}`);
      }

      this.state = loadedState;

      // 加载检查点
      await this.loadCheckpoints();

      console.log(`[GSM] State loaded from: ${statePath} (generation: ${this.state.generation})`);
    } catch (_error) {
      console.log(`[GSM] Failed to load state, using initial state`);
    }
  }

  /**
   * 保存检查点
   */
  private async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    if (!this.config.checkpointPath) {
      return;
    }

    const checkpointPath = path.join(this.config.checkpointPath, `checkpoint_${checkpoint.id}.json`);

    await fs.mkdir(this.config.checkpointPath, { recursive: true });
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  /**
   * 加载检查点
   */
  private async loadCheckpoints(): Promise<void> {
    if (!this.config.checkpointPath) {
      return;
    }

    try {
      const files = await fs.readdir(this.config.checkpointPath);
      const checkpointFiles = files.filter(f => f.startsWith('checkpoint_') && f.endsWith('.json'));

      for (const file of checkpointFiles) {
        const filePath = path.join(this.config.checkpointPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const checkpoint = JSON.parse(content);

        this.checkpoints.set(checkpoint.id, checkpoint);
      }

      console.log(`[GSM] Loaded ${this.checkpoints.size} checkpoints`);
    } catch (_error) {
      console.log(`[GSM] Failed to load checkpoints`);
    }
  }

  /**
   * 删除检查点文件
   */
  private async deleteCheckpointFile(checkpointId: string): Promise<void> {
    if (!this.config.checkpointPath) {
      return;
    }

    const checkpointPath = path.join(this.config.checkpointPath, `checkpoint_${checkpointId}.json`);

    try {
      await fs.unlink(checkpointPath);
    } catch (_error) {
      console.error(`[GSM] Failed to delete checkpoint file: ${checkpointPath}`);
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    currentState: StateMachineState;
    generation: number;
    checkpoints: number;
    transitions: number;
    uptime: number;
  } {
    return {
      currentState: this.state.currentState,
      generation: this.state.generation,
      checkpoints: this.checkpoints.size,
      transitions: this.transitions.length,
      uptime: Date.now() - this.state.metadata.startTime,
    };
  }
}
