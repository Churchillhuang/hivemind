/**
 * SkillBasedNegotiationRouter - 基于技能评分的协商路由器
 *
 * 扩展 NegotiationRouter，支持：
 * - 技能评分权重
 * - 探索机制
 * - 可视化协商过程
 */

import { NegotiationRouter, type Bid, type TaskAnnouncement, type TaskAssignment } from './NegotiationRouter.js';
import type { BidWithSkills } from './SkillProfile.js';

export class SkillBasedNegotiationRouter extends NegotiationRouter {
  /**
   * 覆盖父类的 selectWinner 方法，添加技能评分权重
   */
  protected selectWinner(taskId: string, bids: Bid[]): string | null {
    if (bids.length === 0) {
      return null;
    }

    // 按评分排序（评分越低越好）
    const sortedBids = [...bids].sort((a, b) => a.bidScore - b.bidScore);

    const bestBid = sortedBids[0];
    const bestBidSkills = (bestBid as BidWithSkills).skillScores;

    console.log(`[NegotiationRouter] Selected winner for task ${taskId}:`)
    console.log(`  Agent: ${bestBid.agentId}`)
    console.log(`  Score: ${bestBid.bidScore.toFixed(3)}`)
    console.log(`  Load: ${bestBid.currentLoad.toFixed(2)}`)
    console.log(`  Time: ${bestBid.estimatedTimeMs}ms`)

    if (bestBidSkills && bestBidSkills.size > 0) {
      console.log(`  Skills:`)
      for (const [skill, score] of bestBidSkills.entries()) {
        console.log(`    - ${skill}: ${score.toFixed(3)}`)
      }
    }

    if ((bestBid as BidWithSkills).isExploration) {
      console.log(`  Mode: EXPLORATION (agent has no experience)`)
    }

    return bestBid.agentId;
  }

  /**
   * 统计投标中的探索比例
   * 用于监控系统的探索 vs 利用平衡
   */
  getExplorationStats(taskId: string): {
    totalBids: number;
    explorationBids: number;
    explorationRatio: number;
  } {
    const status = this.getNegotiationStatus(taskId);
    if (!status) {
      return {
        totalBids: 0,
        explorationBids: 0,
        explorationRatio: 0,
      };
    }

    const bids = status.bids as BidWithSkills[];
    const totalBids = bids.length;
    const explorationBids = bids.filter(bid => bid.isExploration).length;

    return {
      totalBids,
      explorationBids,
      explorationRatio: totalBids > 0 ? explorationBids / totalBids : 0,
    };
  }
}
