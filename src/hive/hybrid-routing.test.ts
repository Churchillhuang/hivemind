/**
 * Hybrid Routing Tests - 直路由 vs 协商路由测试
 *
 * 测试混合路由架构：
 * - 直路由 (Direct Routing): 低级别核心功能，快速反射
 * - 协商路由 (Negotiated Routing): 高级别复杂任务，动态协商
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../events/EventBus.js';
import {
  Orchestrator,
  RoutingMode,
  type RoutingDecision,
  type Task,
} from '../hive/Orchestrator.js';
import { NegotiationRouter } from '../hive/NegotiationRouter.js';
import { CoordinationAgent } from '../hive/CoordinationAgent.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

type OrchestratorInternals = {
  makeRoutingDecision(task: Task): RoutingDecision;
  getRoutingMode(taskType: string): RoutingMode;
};

describe('Hybrid Routing - Direct vs Negotiated', () => {
  let eventBus: EventBus;
  let config: HiveConfig;
  let negotiationRouter: NegotiationRouter;
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    eventBus = new EventBus({ maxHistorySize: 1000 });

    config = {
      enabled: true,
      mode: 'multi',
      orchestrator: {
        maxAgents: 10,
        idleTimeout: 30000,
        negotiationTimeout: 5000,
      },
      stateMachine: {
        persist: false,
        checkpointInterval: 10000,
      },
      agents: {
        system: {
          interface: { enabled: false },
          memory: { enabled: false },
          memoryGateway: { enabled: false },
          orchestrator: { enabled: false },
          reflection: { enabled: false },
        },
        functional: {
          enabled: true,
          maxConcurrent: 5,
        },
      },
      skillLearning: {
        enabled: false,
      },
      agentModels: {
        tierMapping: {
          nano: 'test-nano',
          light: 'test-light',
          standard: 'test-standard',
        },
        system: {
          orchestrator: { tier: 'light', temperature: 0.1, maxTokens: 500, timeout: 30 },
          interface: { tier: 'standard', temperature: 0.7, maxTokens: 2000, timeout: 60 },
        },
        functional: {
          default: { tier: 'light', temperature: 0.5, maxTokens: 1000, timeout: 30 },
          overrides: {},
        },
      },
    };

    negotiationRouter = new NegotiationRouter(config, eventBus);
    negotiationRouter.start();

    orchestrator = new Orchestrator(
      {
        id: 'orchestrator_001',
        role: 'Orchestrator',
        description: 'Hybrid routing orchestrator',
      },
      config,
      eventBus,
      negotiationRouter,
    );

    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
    negotiationRouter.stop();
  });

  describe('Direct Routing (Brainstem Mode)', () => {
    it('should use direct routing for message tasks', async () => {
      // 发布用户消息
      await eventBus.publish({
        type: 'NEW_MESSAGE',
        sourceAgent: 'user',
        payload: {
          message: 'Hello',
        },
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // 检查路由决策
      const history = eventBus.getHistory();
      const assignments = history.filter(
        (e) => e.type === 'TASK_ASSIGNED' && e.payload.taskId
      );

      expect(assignments.length).toBeGreaterThan(0);

      const assignment = assignments[0];
      expect(assignment.payload.assignedTo).toBe('interface_agent_001');
      expect(assignment.routingMode).toBe('direct');
    });

    it('should use direct routing for memory_query tasks', async () => {
      // 发布记忆查询
      await eventBus.publish({
        type: 'TASK_REQUESTED',
        sourceAgent: 'some_agent',
        payload: {
          taskType: 'memory_query',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory();
      const assignment = history.find(
        (e) => e.type === 'TASK_ASSIGNED' && e.payload.assignedTo === 'memory_agent_001'
      );

      expect(assignment).toBeDefined();
    });

    it('should set direct routing mode in decision', async () => {
      let routingMode: string | undefined;

      // Subscribe to track routing mode
      const subscription = eventBus.subscribe('TASK_ASSIGNED', (event) => {
        routingMode = event.routingMode;
      });

      await eventBus.publish({
        type: 'NEW_MESSAGE',
        sourceAgent: 'user',
        payload: {
          message: 'Test',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      subscription();

      expect(routingMode).toBe('direct');
    });

    it('should use predefined routing rules correctly', () => {
      orchestrator.addRoutingRule('custom_task', ['custom_agent_001']);

      const decision = (orchestrator as unknown as OrchestratorInternals).makeRoutingDecision({
        id: 'test_task',
        type: 'action',
        priority: 'medium',
        sourceAgent: 'test',
        payload: {
          taskType: 'custom_task',
        },
        createdAt: Date.now(),
        status: 'pending',
      });

      expect(decision.targetAgent).toBe('custom_agent_001');
      expect(decision.routingMode).toBe('direct');
    });
  });

  describe('Negotiated Routing (Cortex Mode)', () => {
    it('should use negotiated routing for non-direct tasks', async () => {
      // Create coordination agents
      const agents = [
        new CoordinationAgent(
          { id: 'agent_101', role: 'Analyzer', type: 'functional' },
          { taskTypes: ['file_analysis'], skills: ['python'], maxConcurrentTasks: 5 },
          eventBus,
        ),
        new CoordinationAgent(
          { id: 'agent_102', role: 'Analyzer', type: 'functional' },
          { taskTypes: ['file_analysis'], skills: ['python'], maxConcurrentTasks: 5 },
          eventBus,
        ),
      ];

      for (const agent of agents) {
        await agent.start();
      }

      // 没有设置为直接路由的任务
      orchestrator.setDirectRoutingTask('file_analysis', false);

      // 发布任务
      await eventBus.publish({
        type: 'TASK_REQUESTED',
        sourceAgent: 'user',
        payload: {
          taskType: 'file_analysis',
          description: 'Analyze Python file',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 检查路由决策
      const decision = (orchestrator as unknown as OrchestratorInternals).makeRoutingDecision({
        id: 'test_task_2',
        type: 'action',
        priority: 'medium',
        sourceAgent: 'test',
        payload: {
          taskType: 'file_analysis',
        },
        createdAt: Date.now(),
        status: 'pending',
      });

      expect(decision.routingMode).toBe('negotiated');
      expect(decision.targetAgent).toBe('pending_negotiation');

      // Check negotiation announced
      const history = eventBus.getHistory();
      const announcement = history.find(
        (e) => e.type === 'TASK_ANNOUNCEMENT' && e.payload.taskType === 'file_analysis'
      );

      expect(announcement).toBeDefined();

      for (const agent of agents) {
        await agent.stop();
      }
    });

    it('should handle negotiation assignment events', async () => {
      await eventBus.publish({
        type: 'TASK_ASSIGNED',
        sourceAgent: 'NegotiationRouter',
        payload: {
          taskId: 'task_123',
          assignedTo: 'agent_101',
          bidScore: 0.4,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory();
      const assignment = history.find(
        (e) =>
          e.type === 'TASK_ASSIGNED' &&
          e.sourceAgent === 'Orchestrator' &&
          e.payload.assignedTo === 'agent_101'
      );

      expect(assignment).toBeDefined();
    });

    it('should subscribe to negotiation events when router is lazily initialized', async () => {
      const lazyOrchestrator = new Orchestrator(
        {
          id: 'orchestrator_lazy',
          role: 'Orchestrator',
          description: 'Lazy negotiation orchestrator',
        },
        config,
        eventBus,
      );

      await lazyOrchestrator.start();

      // Trigger lazy NegotiationRouter creation through the normal ingress path.
      await eventBus.publish({
        type: 'TASK_REQUESTED',
        sourceAgent: 'test',
        payload: { taskType: 'file_analysis' },
      });

      await eventBus.publish({
        type: 'TASK_ASSIGNED',
        sourceAgent: 'NegotiationRouter',
        payload: {
          taskId: 'task_lazy_1',
          assignedTo: 'agent_lazy',
          bidScore: 0.1,
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory();
      const assignment = history.find(
        (e) =>
          e.type === 'TASK_ASSIGNED' &&
          e.sourceAgent === 'Orchestrator' &&
          e.payload.assignedTo === 'agent_lazy'
      );

      expect(assignment).toBeDefined();
      await lazyOrchestrator.stop();
    });

    it('should handle negotiation failure gracefully', async () => {
      await eventBus.publish({
        type: 'TASK_NEGOTIATION_FAILED',
        sourceAgent: 'NegotiationRouter',
        payload: {
          taskId: 'task_fail_001',
          reason: 'no_bids',
          announcement: {},
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Task should be marked as failed
      const queueStatus = orchestrator.getQueueStatus();
      expect(queueStatus.totalTasks).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Routing Mode Selection', () => {
    it('should correctly identify direct routing tasks', () => {
      const internals = orchestrator as unknown as OrchestratorInternals;
      expect(internals.getRoutingMode('message')).toBe(RoutingMode.DIRECT);
      expect(internals.getRoutingMode('memory_query')).toBe(RoutingMode.DIRECT);
      expect(internals.getRoutingMode('reflection')).toBe(RoutingMode.DIRECT);
    });

    it('should correctly identify negotiated routing tasks', () => {
      const internals = orchestrator as unknown as OrchestratorInternals;
      expect(internals.getRoutingMode('file_analysis')).toBe(RoutingMode.NEGOTIATED);
      expect(internals.getRoutingMode('data_processing')).toBe(RoutingMode.NEGOTIATED);
      expect(internals.getRoutingMode('complex_task')).toBe(RoutingMode.NEGOTIATED);
    });

    it('should allow runtime modification of routing mode', () => {
      const internals = orchestrator as unknown as OrchestratorInternals;
      expect(internals.getRoutingMode('file_analysis')).toBe(RoutingMode.NEGOTIATED);

      // 设置为 direct
      orchestrator.setDirectRoutingTask('file_analysis', true);
      expect(internals.getRoutingMode('file_analysis')).toBe(RoutingMode.DIRECT);

      // 设置回 negotiated
      orchestrator.setDirectRoutingTask('file_analysis', false);
      expect(internals.getRoutingMode('file_analysis')).toBe(RoutingMode.NEGOTIATED);
    });
  });

  describe('Hybrid Routing Behavior', () => {
    it('should route system tasks directly', async () => {
      const tasks = [
        { type: 'message', expected: 'interface_agent_001' },
        { type: 'memory_query', expected: 'memory_agent_001' },
        { type: 'reflection', expected: 'reflection_agent_001' },
      ];

      for (const task of tasks) {
        await eventBus.publish({
          type: 'TASK_REQUESTED',
          sourceAgent: 'test',
          payload: {
            taskType: task.type,
          },
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const history = eventBus.getHistory();
      const assignments = history.filter(
        (e) => e.type === 'TASK_ASSIGNED' && e.routingMode === 'direct'
      );

      expect(assignments.length).toBeGreaterThan(0);
    });

    it('should route complex tasks via negotiation', async () => {
      const agent = new CoordinationAgent(
        { id: 'agent_001', role: 'Complex Worker', type: 'functional' },
        { taskTypes: ['complex_task'], skills: [], maxConcurrentTasks: 5 },
        eventBus,
      );

      await agent.start();

      await eventBus.publish({
        type: 'TASK_REQUESTED',
        sourceAgent: 'test',
        payload: {
          taskType: 'complex_task',
          description: 'Complex analysis',
        },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const history = eventBus.getHistory();
      const announcement = history.find(
        (e) => e.type === 'TASK_ANNOUNCEMENT' && e.payload.taskType === 'complex_task'
      );

      expect(announcement).toBeDefined();

      await agent.stop();
    });

    it('should maintain separate queue stats', async () => {
      const status = orchestrator.getQueueStatus();

      expect(status).toHaveProperty('totalTasks');
      expect(status).toHaveProperty('pendingTasks');
      expect(status).toHaveProperty('processingTasks');

      expect(typeof status.totalTasks).toBe('number');
    });
  });
});
