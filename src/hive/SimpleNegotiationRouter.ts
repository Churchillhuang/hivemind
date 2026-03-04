/**
 * SimpleNegotiationRouter - 极简协商路由器
 *
 * 简化原则：
 * - 不需要复杂的评分公式
 * - 只依赖 Agent 的"愿意程度" (0-1)
 * - Agent 自主决定自己的报价
 *
 * 对比之前：
 *   之前：bidScore = load×0.5 + time×0.3 + random×0.2 - skillBonus
 *   现在：Agent 直接返回愿意程度 (0-1)
 */

import type { Event } from "../events/Event.js";
import { EventBus } from "../events/EventBus.js";
import type { HiveConfig } from "./HiveConfig.js";

export interface SimpleTaskAnnouncement {
  taskId: string;
  taskType: string;
  description: string;
  timestamp: number;
}

export interface SimpleBid {
  agentId: string;
  willing: number; // 愿意程度 (0-1)
  timestamp: number;
}

export class SimpleNegotiationRouter {
  private config: HiveConfig;
  private eventBus: EventBus;
  private activeNegotiations: Map<
    string,
    {
      announcement: SimpleTaskAnnouncement;
      bids: SimpleBid[];
      startTime: number;
      deadline: number;
    }
  >;
  private running: boolean = false;
  private unsubscribeBid?: () => void;
  private readonly bidHandler: (event: Event) => void;

  constructor(config: HiveConfig, eventBus: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.activeNegotiations = new Map();
    this.bidHandler = this.handleBid.bind(this);

    this.ensureBidSubscription();
  }

  private ensureBidSubscription(): void {
    if (!this.unsubscribeBid) {
      this.unsubscribeBid = this.eventBus.subscribe("SIMPLE_BID", this.bidHandler);
    }
  }

  /**
   * 公告任务
   * 与之前不同，这里只是简单广播
   */
  announceTask(task: SimpleTaskAnnouncement): void {
    if (this.activeNegotiations.has(task.taskId)) {
      console.log(`[SimpleRouter] Task already negotiating: ${task.taskId}`);
      return;
    }

    const negotiation = {
      announcement: task,
      bids: [],
      startTime: Date.now(),
      deadline: Date.now() + (this.config.orchestrator?.negotiationTimeout || 5000),
    };

    this.activeNegotiations.set(task.taskId, negotiation);

    // 广播任务公告
    void this.eventBus.publish({
      type: "SIMPLE_TASK_ANNOUNCEMENT",
      payload: task,
      timestamp: Date.now(),
    });

    console.log(`[SimpleRouter] Task announced: ${task.taskId} (${task.taskType})`);

    // 检查超时
    void this.checkDeadline(task.taskId);
  }

  /**
   * Agent 提交报价
   * 只需要提供 willing (0-1)
   */
  submitBid(taskId: string, bid: SimpleBid): void {
    const negotiation = this.activeNegotiations.get(taskId);
    if (!negotiation) {
      console.log(`[SimpleRouter] No active negotiation for: ${taskId}`);
      return;
    }

    // 检查是否超时
    if (Date.now() > negotiation.deadline) {
      console.log(`[SimpleRouter] Negotiation deadline passed: ${taskId}`);
      return;
    }

    // 添加报价
    negotiation.bids.push(bid);

    console.log(
      `[SimpleRouter] Received bid for ${taskId}: ${bid.agentId} (willing: ${bid.willing.toFixed(3)})`,
    );
  }

  /**
   * 处理 bid 事件
   */
  private handleBid(event: Event): void {
    const payload = event.payload as {
      taskId: string;
      agentId: string;
      willing: number;
      timestamp: number;
    };

    this.submitBid(payload.taskId, {
      agentId: payload.agentId,
      willing: payload.willing,
      timestamp: payload.timestamp,
    });
  }

  /**
   * 选择 winner
   * 极简算法：选择 willing 最高的
   */
  private selectWinner(taskId: string): string | null {
    const negotiation = this.activeNegotiations.get(taskId);
    if (!negotiation || negotiation.bids.length === 0) {
      console.log(`[SimpleRouter] No bids for task: ${taskId}`);
      return null;
    }

    // 按照 willing 降序排序
    const sortedBids = [...negotiation.bids].toSorted((a, b) => b.willing - a.willing);

    const bestBid = sortedBids[0];
    const bestWilling = bestBid.willing;

    console.log(`[SimpleRouter] Selected winner for ${taskId}:`);
    console.log(`  Agent: ${bestBid.agentId}`);
    console.log(`  Willing: ${bestWilling.toFixed(3)}`);
    console.log(`  Total bids: ${negotiation.bids.length}`);

    // 如果 willing 太低（例如 < 0.3），可能表示没人愿意
    if (bestWilling < 0.3) {
      console.log(`[SimpleRouter] Warning: Low willingness (${bestWilling.toFixed(3)})`);
    }

    return bestBid.agentId;
  }

  /**
   * 检查超时并分配任务
   */
  private async checkDeadline(taskId: string): Promise<void> {
    const negotiation = this.activeNegotiations.get(taskId);
    if (!negotiation) {
      return;
    }

    const timeToDeadline = negotiation.deadline - Date.now();
    const minWaitTime = 1000; // 至少等 1 秒，让 agents 反应

    const waitTime = Math.max(minWaitTime, timeToDeadline);

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 选择 winner
    const winner = this.selectWinner(taskId);

    if (winner) {
      // 分配任务
      void this.eventBus.publish({
        type: "TASK_ASSIGNED",
        payload: {
          taskId,
          assignedTo: winner,
          winningWilling: negotiation.bids.find((b) => b.agentId === winner)?.willing,
          totalBids: negotiation.bids.length,
        },
        timestamp: Date.now(),
      });
    } else {
      // 没有报价
      void this.eventBus.publish({
        type: "TASK_NEGOTIATION_FAILED",
        payload: {
          taskId,
          reason: "no_bids",
          announcement: negotiation.announcement,
        },
        timestamp: Date.now(),
      });
    }

    // 清除协商
    this.activeNegotiations.delete(taskId);
  }

  /**
   * 获取协商状态
   */
  getNegotiationStatus(taskId: string): {
    announcement: SimpleTaskAnnouncement | undefined;
    bids: SimpleBid[];
    hasWinner: boolean;
    winner: string | null;
  } {
    const negotiation = this.activeNegotiations.get(taskId);
    if (!negotiation) {
      return {
        announcement: undefined,
        bids: [],
        hasWinner: false,
        winner: null,
      };
    }

    // 如果超时了，计算 winner
    const isDeadlinePassed = Date.now() > negotiation.deadline;
    let winner = null;

    if (isDeadlinePassed && negotiation.bids.length > 0) {
      const sortedBids = [...negotiation.bids].toSorted((a, b) => b.willing - a.willing);
      winner = sortedBids[0].agentId;
    }

    return {
      announcement: negotiation.announcement,
      bids: negotiation.bids,
      hasWinner: isDeadlinePassed && winner !== null,
      winner,
    };
  }

  /**
   * 获取所有活动的协商
   */
  getActiveNegotiations(): Array<{ taskId: string; bids: number; timeElapsed: number }> {
    const now = Date.now();

    return Array.from(this.activeNegotiations.entries()).map(([taskId, negotiation]) => ({
      taskId,
      bids: negotiation.bids.length,
      timeElapsed: now - negotiation.startTime,
    }));
  }

  /**
   * 启动
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.ensureBidSubscription();
    this.running = true;
    console.log("[SimpleRouter] Started");
  }

  /**
   * 停止
   */
  stop(): void {
    if (!this.running && !this.unsubscribeBid) {
      return;
    }

    this.running = false;
    this.activeNegotiations.clear();
    if (this.unsubscribeBid) {
      this.unsubscribeBid();
      this.unsubscribeBid = undefined;
    }
    console.log("[SimpleRouter] Stopped");
  }

  /**
   * 获取状态
   */
  getStatus(): {
    running: boolean;
    activeNegotiations: number;
  } {
    return {
      running: this.running,
      activeNegotiations: this.activeNegotiations.size,
    };
  }
}
