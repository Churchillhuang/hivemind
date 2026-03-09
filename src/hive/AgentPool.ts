/**
 * AgentPool - Agent池化管理器
 *
 * 系统启动时预先创建多个不同能力的Agent，
 * 形成Agent池，任务来时它们可以竞争和协作
 */

import { EventBus } from "../events/EventBus.js";
import { AgentFactory } from "./AgentFactory.js";
import type { HiveConfig } from "./HiveConfig.js";

export interface PoolConfig {
  // 是否启用Agent池
  enabled: boolean;

  // 预创建的Agent配置
  agents: Array<{
    templateId: string;
    count: number;
  }>;

  // 最小保持的Agent数量
  minPoolSize: number;

  // 最大Agent数量
  maxPoolSize: number;

  // 空闲超时（毫秒），超时后销毁Agent
  idleTimeout: number;
}

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  enabled: true,
  agents: [
    { templateId: "general_assistant", count: 2 },
    { templateId: "file_analyzer", count: 1 },
    { templateId: "wp_uploader", count: 1 },
  ],
  minPoolSize: 3,
  maxPoolSize: 10,
  idleTimeout: 300000, // 5分钟
};

export class AgentPool {
  private eventBus: EventBus;
  private agentFactory: AgentFactory;
  private hiveConfig: HiveConfig;
  private poolConfig: PoolConfig;
  private running: boolean = false;

  constructor(
    eventBus: EventBus,
    agentFactory: AgentFactory,
    hiveConfig: HiveConfig,
    poolConfig?: Partial<PoolConfig>,
  ) {
    this.eventBus = eventBus;
    this.agentFactory = agentFactory;
    this.hiveConfig = hiveConfig;
    this.poolConfig = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
  }

  /**
   * 启动Agent池 - 预创建Agent
   */
  async start(): Promise<void> {
    if (!this.poolConfig.enabled || this.running) {
      return;
    }

    this.running = true;
    console.log("[AgentPool] Starting agent pool initialization...");

    // 预创建Agent
    for (const agentConfig of this.poolConfig.agents) {
      for (let i = 0; i < agentConfig.count; i++) {
        try {
          const instance = await this.agentFactory.createInstance({
            templateId: agentConfig.templateId,
          });
          console.log(`[AgentPool] Pre-created agent: ${instance.instanceId} (${instance.role})`);
        } catch (error) {
          console.error(
            `[AgentPool] Failed to create agent from template ${agentConfig.templateId}:`,
            error,
          );
        }
      }
    }

    const instances = this.agentFactory.getInstances({ type: "functional" });
    console.log(`[AgentPool] Pool initialized with ${instances.length} agents`);

    // 定期检查并维护Agent池
    this.startPoolMaintenance();
  }

  /**
   * 停止Agent池
   */
  async stop(): Promise<void> {
    this.running = false;
    console.log("[AgentPool] Stopped");
  }

  /**
   * 获取池中活跃的Agent数量
   */
  getActiveAgentCount(): number {
    return this.agentFactory.getInstances({ type: "functional", status: "active" }).length;
  }

  /**
   * 获取池中所有Agent
   */
  getPoolAgents(): ReturnType<typeof this.agentFactory.getInstances> {
    return this.agentFactory.getInstances({ type: "functional" });
  }

  /**
   * 维护Agent池
   */
  private startPoolMaintenance(): void {
    setInterval(() => {
      if (!this.running) {
        return;
      }

      const activeCount = this.getActiveAgentCount();

      // 如果Agent数量低于最小值，补充
      if (activeCount < this.poolConfig.minPoolSize) {
        console.log(
          `[AgentPool] Pool size ${activeCount} below minimum ${this.poolConfig.minPoolSize}, replenishing...`,
        );
        void this.replenishPool();
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 补充Agent池
   */
  private async replenishPool(): Promise<void> {
    const activeCount = this.getActiveAgentCount();
    const needed = this.poolConfig.minPoolSize - activeCount;

    for (let i = 0; i < needed; i++) {
      try {
        // 随机选择一个模板
        const templateId =
          this.poolConfig.agents[Math.floor(Math.random() * this.poolConfig.agents.length)]
            .templateId;

        await this.agentFactory.createInstance({ templateId });
        console.log(`[AgentPool] Replenished pool with ${templateId}`);
      } catch (error) {
        console.error("[AgentPool] Failed to replenish pool:", error);
      }
    }
  }
}
