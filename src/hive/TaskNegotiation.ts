/**
 * TaskNegotiation - 任务协商机制
 *
 * 当多个Agent决定协作时，它们需要协商：
 * 1. 谁负责哪个子任务？
 * 2. 如何分配工作？
 * 3. 如何协调执行？
 *
 * 这是真正的分布式协商，不是中央分配！
 */

import { EventBus } from "../events/EventBus.js";
import type { TaskAnnouncement, Dance } from "./consensus-types.js";

/**
 * 协商提案
 */
export interface NegotiationProposal {
  id: string;
  taskId: string;
  proposerId: string;
  type: "claim_subtask" | "offer_help" | "request_help" | "coordinate";

  // 子任务认领
  subtaskId?: string;
  subtaskDescription?: string;

  // 提供帮助
  offeredCapabilities?: string[];

  // 请求帮助
  neededCapabilities?: string[];

  // 协调建议
  coordination?: {
    agents: string[]; // 建议参与的Agent
    assignments: Array<{
      agentId: string;
      subtaskId: string;
    }>;
  };

  timestamp: number;
}

/**
 * 协商状态
 */
export interface NegotiationState {
  taskId: string;
  status: "open" | "negotiating" | "resolved" | "failed";

  // 参与者
  participants: Set<string>;

  // 已认领的子任务
  claimedSubtasks: Map<string, string>; // subtaskId -> agentId

  // 缺失的能力
  missingCapabilities: string[];

  // 已提供的能力
  offeredCapabilities: Map<string, string[]>; // agentId -> capabilities[]

  // 协商开始时间
  startTime: number;

  // 超时
  timeout: number;
}

/**
 * 任务协商器
 */
export class TaskNegotiation {
  private eventBus: EventBus;
  private negotiations: Map<string, NegotiationState> = new Map();
  private proposals: Map<string, NegotiationProposal[]> = new Map();
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupListeners();
  }

  /**
   * 启动协商
   *
   * 当Agent决定协作时，启动协商流程
   */
  startNegotiation(task: TaskAnnouncement, initiatorId: string, dances: Dance[]): NegotiationState {
    const state: NegotiationState = {
      taskId: task.taskId,
      status: "negotiating",
      participants: new Set(dances.map((d) => d.agentId)),
      claimedSubtasks: new Map(),
      missingCapabilities: this.calculateMissingCapabilities(task, dances),
      offeredCapabilities: new Map(),
      startTime: Date.now(),
      timeout: 5000, // 5秒协商时间
    };

    this.negotiations.set(task.taskId, state);
    this.proposals.set(task.taskId, []);

    // 超时自动失败
    const timer = setTimeout(() => {
      const current = this.negotiations.get(task.taskId);
      if (current && current.status === "negotiating") {
        console.warn(`[TaskNegotiation] Negotiation for task ${task.taskId} timed out`);
        current.status = "failed";
        void this.eventBus.publish({
          type: "NEGOTIATION_TIMEOUT",
          sourceAgent: "negotiator",
          payload: { taskId: task.taskId },
        });
        this.timeouts.delete(task.taskId);
      }
    }, state.timeout);
    this.timeouts.set(task.taskId, timer);

    console.log(`[TaskNegotiation] Started negotiation for task ${task.taskId}`);
    console.log(`[TaskNegotiation] Participants: ${Array.from(state.participants).join(", ")}`);
    console.log(`[TaskNegotiation] Missing capabilities: ${state.missingCapabilities.join(", ")}`);

    // 发布协商邀请
    void this.eventBus.publish({
      type: "NEGOTIATION_START",
      sourceAgent: "negotiator",
      payload: {
        taskId: task.taskId,
        participants: Array.from(state.participants),
        missingCapabilities: state.missingCapabilities,
        task: task,
      },
    });

    return state;
  }

  /**
   * Agent提交提案
   */
  submitProposal(proposal: NegotiationProposal): void {
    const proposals = this.proposals.get(proposal.taskId);
    if (!proposals) {
      console.warn(`[TaskNegotiation] No negotiation for task ${proposal.taskId}`);
      return;
    }

    proposals.push(proposal);

    console.log(`[TaskNegotiation] Agent ${proposal.proposerId} submitted proposal:`);
    console.log(`  Type: ${proposal.type}`);

    if (proposal.subtaskId) {
      console.log(`  Subtask: ${proposal.subtaskId}`);
    }

    if (proposal.offeredCapabilities) {
      console.log(`  Offering: ${proposal.offeredCapabilities.join(", ")}`);
    }

    if (proposal.neededCapabilities) {
      console.log(`  Needs: ${proposal.neededCapabilities.join(", ")}`);
    }

    // 广播提案
    void this.eventBus.publish({
      type: "NEGOTIATION_PROPOSAL",
      sourceAgent: proposal.proposerId,
      payload: proposal,
    });

    // 处理提案
    this.processProposal(proposal);
  }

  /**
   * 处理提案
   */
  private processProposal(proposal: NegotiationProposal): void {
    const state = this.negotiations.get(proposal.taskId);
    if (!state || state.status !== "negotiating") {
      return;
    }

    switch (proposal.type) {
      case "claim_subtask":
        this.processClaimSubtask(state, proposal);
        break;

      case "offer_help":
        this.processOfferHelp(state, proposal);
        break;

      case "request_help":
        this.processRequestHelp(state, proposal);
        break;

      case "coordinate":
        this.processCoordinate(state, proposal);
        break;
    }

    // 检查是否可以达成共识
    this.checkNegotiationComplete(state);
  }

  /**
   * 处理子任务认领
   */
  private processClaimSubtask(state: NegotiationState, proposal: NegotiationProposal): void {
    if (!proposal.subtaskId) {
      return;
    }

    // 检查是否已被认领
    if (state.claimedSubtasks.has(proposal.subtaskId)) {
      console.log(`[TaskNegotiation] Subtask ${proposal.subtaskId} already claimed`);
      return;
    }

    // 认领子任务
    state.claimedSubtasks.set(proposal.subtaskId, proposal.proposerId);
    console.log(
      `[TaskNegotiation] Agent ${proposal.proposerId} claimed subtask ${proposal.subtaskId}`,
    );

    // 发布认领确认
    void this.eventBus.publish({
      type: "SUBTASK_CLAIMED",
      sourceAgent: "negotiator",
      payload: {
        taskId: proposal.taskId,
        subtaskId: proposal.subtaskId,
        agentId: proposal.proposerId,
      },
    });
  }

  /**
   * 处理提供帮助
   */
  private processOfferHelp(state: NegotiationState, proposal: NegotiationProposal): void {
    if (!proposal.offeredCapabilities) {
      return;
    }

    state.offeredCapabilities.set(proposal.proposerId, proposal.offeredCapabilities);
    console.log(
      `[TaskNegotiation] Agent ${proposal.proposerId} offers: ${proposal.offeredCapabilities.join(", ")}`,
    );

    // 检查是否覆盖了缺失能力
    for (const cap of state.missingCapabilities) {
      for (const [agentId, caps] of state.offeredCapabilities) {
        if (caps.includes(cap)) {
          console.log(`[TaskNegotiation] Missing capability ${cap} now covered by ${agentId}`);
        }
      }
    }
  }

  /**
   * 处理请求帮助
   */
  private processRequestHelp(state: NegotiationState, proposal: NegotiationProposal): void {
    if (!proposal.neededCapabilities) {
      return;
    }

    console.log(
      `[TaskNegotiation] Agent ${proposal.proposerId} needs help with: ${proposal.neededCapabilities.join(", ")}`,
    );

    // 更新缺失能力
    for (const cap of proposal.neededCapabilities) {
      if (!state.missingCapabilities.includes(cap)) {
        state.missingCapabilities.push(cap);
      }
    }
  }

  /**
   * 处理协调建议
   * 采纳提案中的分配方案，覆盖到claimedSubtasks（后提的协调提案优先）
   */
  private processCoordinate(state: NegotiationState, proposal: NegotiationProposal): void {
    if (!proposal.coordination) {
      return;
    }

    console.log(`[TaskNegotiation] Agent ${proposal.proposerId} suggests coordination:`);
    for (const assignment of proposal.coordination.assignments) {
      console.log(`  ${assignment.agentId} -> ${assignment.subtaskId}`);
      // 采纳协调方案中的分配，允许覆盖已有认领（协调提案具有更高权威）
      state.claimedSubtasks.set(assignment.subtaskId, assignment.agentId);
    }

    this.checkNegotiationComplete(state);
  }

  /**
   * 检查协商是否完成
   */
  private checkNegotiationComplete(state: NegotiationState): void {
    // 检查是否所有缺失能力都被覆盖
    const allOfferedCaps = new Set<string>();
    for (const caps of state.offeredCapabilities.values()) {
      for (const cap of caps) {
        allOfferedCaps.add(cap);
      }
    }

    const allCovered = state.missingCapabilities.every((cap) => allOfferedCaps.has(cap));

    if (allCovered && state.claimedSubtasks.size > 0) {
      console.log(`[TaskNegotiation] Negotiation complete!`);
      this.finalizeNegotiation(state);
    }
  }

  /**
   * 完成协商
   */
  private finalizeNegotiation(state: NegotiationState): void {
    state.status = "resolved";
    // 清理超时 timer
    const timer = this.timeouts.get(state.taskId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(state.taskId);
    }

    const assignments = Array.from(state.claimedSubtasks.entries()).map(([subtaskId, agentId]) => ({
      subtaskId,
      agentId,
    }));

    console.log(`[TaskNegotiation] Final assignments:`);
    for (const { subtaskId, agentId } of assignments) {
      console.log(`  ${agentId} -> ${subtaskId}`);
    }

    // 发布协商完成事件
    void this.eventBus.publish({
      type: "NEGOTIATION_RESOLVED",
      sourceAgent: "negotiator",
      payload: {
        taskId: state.taskId,
        assignments,
        participants: Array.from(state.participants),
      },
    });
  }

  /**
   * 计算缺失的能力
   */
  private calculateMissingCapabilities(task: TaskAnnouncement, dances: Dance[]): string[] {
    const availableCaps = new Set<string>();

    for (const dance of dances) {
      for (const skill of dance.matchedSkills) {
        availableCaps.add(skill);
      }
    }

    return task.requiredCapabilities.filter((cap) => !availableCaps.has(cap));
  }

  /**
   * 设置事件监听
   */
  private setupListeners(): void {
    this.eventBus.subscribe("NEGOTIATION_PROPOSAL", (_event) => {
      // 由其他逻辑处理
    });
  }

  /**
   * 获取协商状态
   */
  getNegotiationState(taskId: string): NegotiationState | undefined {
    return this.negotiations.get(taskId);
  }

  /**
   * 获取提案列表
   */
  getProposals(taskId: string): NegotiationProposal[] {
    return this.proposals.get(taskId) || [];
  }
}
