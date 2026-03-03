/**
 * Coordination System Tests
 *
 * Tests for NegotiationRouter and CoordinationAgent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../events/EventBus.js';
import { NegotiationRouter } from '../hive/NegotiationRouter.js';
import { CoordinationAgent } from '../hive/CoordinationAgent.js';
import type { HiveConfig } from '../hive/HiveConfig.js';

describe('Coordination Architecture - Negotiation Routing', () => {
  let eventBus: EventBus;
  let config: HiveConfig;
  let router: NegotiationRouter;

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
          lifespan: 'task',
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
          memory: { tier: 'nano', temperature: 0, maxTokens: 100, timeout: 10 },
          reflection: { tier: 'standard', temperature: 0.3, maxTokens: 1500, timeout: 60 },
        },
        functional: {
          default: { tier: 'light', temperature: 0.5, maxTokens: 1000, timeout: 30 },
          overrides: {},
        },
      },
    };

    router = new NegotiationRouter(config, eventBus);
    router.start();
  });

  afterEach(() => {
    router.stop();
  });

  describe('Task Announcement', () => {
    it('should announce a task for bidding', async () => {
      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: ['python'],
        priority: 'normal' as const,
        description: 'Analyze Python file',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      // Wait for event to be published
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check event history
      const history = eventBus.getHistory();
      const announcement = history.find(
        (e) => e.type === 'TASK_ANNOUNCEMENT' && e.payload.taskId === 'task_001'
      );

      expect(announcement).toBeDefined();
      expect(announcement?.payload.taskType).toBe('file_analysis');
    });

    it('should reject duplicate task announcements', () => {
      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: ['python'],
        priority: 'normal' as const,
        description: 'Analyze Python file',
        timestamp: Date.now(),
      };

      router.announceTask(task);
      router.announceTask(task); // Duplicate

      const status = router.getNegotiationStatus('task_001');

      expect(status).toBeDefined();
      // Only one negotiation should be active
    });
  });

  describe('Agent Bidding', () => {
    it('should receive and process agent bids', async () => {
      const agent = new CoordinationAgent(
        {
          id: 'agent_001',
          role: 'File Analyzer',
          type: 'functional',
        },
        {
          taskTypes: ['file_analysis'],
          skills: ['python', 'javascript'],
          maxConcurrentTasks: 3,
          avgTaskTimeMs: 3000,
        },
        eventBus,
      );

      await agent.start();

      // Announce task
      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: [],
        priority: 'normal' as const,
        description: 'Analyze Python file',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      // Wait for agent to respond
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if bid was received
      const status = router.getNegotiationStatus('task_001');
      expect(status?.bids.length).toBeGreaterThanOrEqual(1);

      await agent.stop();
    });

    it('should reject bids from agents without required capabilities', async () => {
      const agent = new CoordinationAgent(
        {
          id: 'agent_001',
          role: 'Image Processor',
          type: 'functional',
        },
        {
          taskTypes: ['image_processing'],
          skills: ['python'],
          maxConcurrentTasks: 3,
        },
        eventBus,
      );

      await agent.start();

      // Announce task requiring different capability
      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: ['rust'],
        priority: 'normal' as const,
        description: 'Analyze Rust file',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      // Wait for agent to respond
      await new Promise(resolve => setTimeout(resolve, 200));

      // Agent should not bid (missing capabilities)
      const status = router.getNegotiationStatus('task_001');
      expect(status?.bids.length).toBe(0);

      await agent.stop();
    });

    it('should calculate bid scores correctly', async () => {
      const busyAgent = new CoordinationAgent(
        {
          id: 'agent_busy',
          role: 'Busy Agent',
          type: 'functional',
        },
        {
          taskTypes: ['file_analysis'],
          skills: ['python'],
          maxConcurrentTasks: 2,
          avgTaskTimeMs: 3000,
        },
        eventBus,
      );

      await busyAgent.start();

      // Simulate busy state
      busyAgent.setState({ activeTasks: 2 });

      const idleAgent = new CoordinationAgent(
        {
          id: 'agent_idle',
          role: 'Idle Agent',
          type: 'functional',
        },
        {
          taskTypes: ['file_analysis'],
          skills: ['python'],
          maxConcurrentTasks: 2,
          avgTaskTimeMs: 3000,
        },
        eventBus,
      );

      await idleAgent.start();

      // Announce task
      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: [],
        priority: 'normal' as const,
        description: 'Analyze Python file',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      await new Promise(resolve => setTimeout(resolve, 200));

      const status = router.getNegotiationStatus('task_001');
      const bids = status?.bids || [];

      // Idle agent should have better (lower) score
      expect(bids.length).toBe(2);

      const idleBid = bids.find(b => b.agentId === 'agent_idle');
      const busyBid = bids.find(b => b.agentId === 'agent_busy');

      expect(idleBid?.bidScore).toBeLessThan(busyBid?.bidScore || 999);

      await busyAgent.stop();
      await idleAgent.stop();
    });
  });

  describe('Task Assignment', () => {
    it('should assign task to best bidder', async () => {
      const agents = [
        new CoordinationAgent(
          { id: 'agent_001', role: 'Analyzer', type: 'functional' },
          { taskTypes: ['file_analysis'], skills: ['python'], maxConcurrentTasks: 5 },
          eventBus,
        ),
        new CoordinationAgent(
          { id: 'agent_002', role: 'Analyzer', type: 'functional' },
          { taskTypes: ['file_analysis'], skills: ['python'], maxConcurrentTasks: 5 },
          eventBus,
        ),
      ];

      for (const agent of agents) {
        await agent.start();
      }

      const task = {
        taskId: 'task_001',
        taskType: 'file_analysis',
        requiredCapabilities: [],
        priority: 'normal' as const,
        description: 'Analyze Python file',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      // Wait for negotiation to complete
      await new Promise(resolve => setTimeout(resolve, router.config.orchestrator?.negotiationTimeout || 6000));

      // Check assignment event
      const history = eventBus.getHistory();
      const assignment = history.find(
        (e) => e.type === 'TASK_ASSIGNED' && e.payload.taskId === 'task_001'
      );

      expect(assignment).toBeDefined();
      expect(assignment?.payload.assignedTo).toMatch(/^agent_\d+$/);

      for (const agent of agents) {
        await agent.stop();
      }
    });

    it('should publish TASK_NEGOTIATION_FAILED if no bids', async () => {
      const task = {
        taskId: 'task_001',
        taskType: 'unknown_task_type',
        requiredCapabilities: [],
        priority: 'normal' as const,
        description: 'Unknown task',
        timestamp: Date.now(),
      };

      router.announceTask(task);

      // Wait for negotiation to complete
      await new Promise(resolve => setTimeout(resolve, router.config.orchestrator?.negotiationTimeout || 6000));

      // Check failure event
      const history = eventBus.getHistory();
      const failure = history.find(
        (e) => e.type === 'TASK_NEGOTIATION_FAILED' && e.payload.taskId === 'task_001'
      );

      expect(failure).toBeDefined();
      expect(failure?.payload.reason).toBe('no_bids');
    });
  });

  describe('Peer-to-Peer Communication', () => {
    it('should send peer messages', async () => {
      const sender = new CoordinationAgent(
        { id: 'agent_001', role: 'Agent 1', type: 'functional' },
        { taskTypes: ['test'], skills: [], maxConcurrentTasks: 5 },
        eventBus,
      );

      await sender.start();

      await sender.sendPeerMessage('agent_002', 'Hello from 001', { key: 'value' });

      const history = eventBus.getHistory();
      const message = history.find(
        (e) => e.type === 'AGENT_MESSAGE' && e.payload.from === 'agent_001'
      );

      expect(message).toBeDefined();
      expect(message?.payload.content).toBe('Hello from 001');

      await sender.stop();
    });

    it('should make requests to peers', async () => {
      const requestor = new CoordinationAgent(
        { id: 'agent_001', role: 'Agent 1', type: 'functional' },
        { taskTypes: ['test'], skills: [], maxConcurrentTasks: 5 },
        eventBus,
      );

      await requestor.start();

      await requestor.requestHelp('agent_002', 'Please help me', { data: 123 });

      const history = eventBus.getHistory();
      const request = history.find(
        (e) => e.type === 'AGENT_REQUEST' && e.payload.from === 'agent_001'
      );

      expect(request).toBeDefined();
      expect(request?.payload.content).toBe('Please help me');

      await requestor.stop();
    });
  });
});
