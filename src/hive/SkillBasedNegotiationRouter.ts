/**
 * SkillBasedNegotiationRouter - 基于技能评分的协商路由器
 *
 * 扩展 NegotiationRouter，支持：
 * - 技能评分权重
 * - 探索机制
 * - 可视化协商过程
 */

import { NegotiationRouter } from "./NegotiationRouter.js";

export class SkillBasedNegotiationRouter extends NegotiationRouter {
  /**
   * 覆盖父类的 selectWinner 方法，添加技能评分权重
   */
  protected selectWinner(taskId: string): void {
    const negotiation = this.pendingNegotiations.get(taskId);
    if (!negotiation) {
      return;
    }

    // 从父类获取 bids
    const bids = Array.from(negotiation.bids.values());

    if (bids.length === 0) {
      // 调用父类的失败处理
      super.selectWinner(taskId);
      return;
    }

    // 按评分排序（评分越低越好）
    const sortedBids = [...bids].toSorted((a, b) => a.bidScore - b.bidScore);

    const bestBid = sortedBids[0];

    console.log(`[NegotiationRouter] Selected winner for task ${taskId}:`);
    console.log(`  Agent: ${bestBid.agentId}`);
    console.log(`  Score: ${bestBid.bidScore.toFixed(3)}`);
    console.log(`  Load: ${bestBid.currentLoad.toFixed(2)}`);
    console.log(`  Time: ${bestBid.estimatedTimeMs}ms`);

    // 发布任务分配事件
    void this.eventBus
      .publish({
        type: "TASK_ASSIGNED",
        sourceAgent: "NegotiationRouter",
        payload: {
          taskId,
          assignedTo: bestBid.agentId,
          bidScore: bestBid.bidScore,
          taskData: negotiation.announcement,
        },
      })
      .catch((error: unknown) => {
        console.error("[NegotiationRouter] Failed to publish TASK_ASSIGNED:", error);
      });

    // 清理谈判状态
    this.pendingNegotiations.delete(taskId);
  }
}
