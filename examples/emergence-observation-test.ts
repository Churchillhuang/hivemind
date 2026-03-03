/**
 * Emergence Observation Test
 *
 * 演示涌现观察功能：日志与可视化、分析工具、连续性检测
 */

import { EmergenceMonitor } from '../src/hive/EmergenceMonitor.js';
import { CollaborationAnalyzer } from '../src/hive/CollaborationAnalyzer.js';
import { ContinuityAnalyzer } from '../src/hive/ContinuityAnalyzer.js';

async function main() {
  console.log('👁️ Emergence Observation Test\n');

  // 创建 Emergence Monitor
  console.log('1️⃣  Creating Emergence Monitor...\n');

  const monitor = new EmergenceMonitor();

  console.log('✅ Emergence Monitor created\n');

  // 创建 Collaboration Analyzer
  console.log('2️⃣  Creating Collaboration Analyzer...\n');

  const collabAnalyzer = new CollaborationAnalyzer(monitor);

  console.log('✅ Collaboration Analyzer created\n');

  // 创建 Continuity Analyzer
  console.log('3️⃣  Creating Continuity Analyzer...\n');

  const continuityAnalyzer = new ContinuityAnalyzer(monitor);

  console.log('✅ Continuity Analyzer created\n');

  // ========== Test 1: Event Tracing ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Event Tracing');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📝 Simulating agent events...\n');

  // 模拟 agent 事件
  const simulateEvents = async () => {
    for (let i = 0; i < 20; i++) {
      // Agent A 事件
      await monitor['handleEvent']({
        id: `event_${i}_a`,
        timestamp: Date.now(),
        agentId: 'agent_A',
        type: i % 3 === 0 ? 'task_assigned' : 'message_sent',
        payload: {
          targetAgentId: i % 2 === 0 ? 'agent_B' : 'agent_C',
          taskId: `task_${i}`,
        },
      });

      // Agent B 事件
      await monitor['handleEvent']({
        id: `event_${i}_b`,
        timestamp: Date.now() + 100,
        agentId: 'agent_B',
        type: i % 3 === 0 ? 'task_completed' : 'message_received',
        payload: {
          sourceAgentId: 'agent_A',
          taskId: `task_${i}`,
        },
      });

      // Agent C 事件
      if (i % 2 === 0) {
        await monitor['handleEvent']({
          id: `event_${i}_c`,
          timestamp: Date.now() + 200,
          agentId: 'agent_C',
          type: 'notification',
          payload: {
            targetAgentId: 'agent_A',
            message: `Update on task ${i}`,
          },
        });
      }

      // 记录状态快照
      if (i % 5 === 0) {
        monitor.recordStateSnapshot('agent_A', 'idle', { lastActive: Date.now() });
        monitor.recordStateSnapshot('agent_B', 'processing', { currentTask: `task_${i}` });
        monitor.recordStateSnapshot('agent_C', 'listening', { notifications: i });
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 自我引用事件
    await monitor['handleEvent']({
      id: 'event_self_reflection_A',
      timestamp: Date.now() + 1000,
      agentId: 'agent_A',
      type: 'self_reflection',
      payload: {
        targetAgentId: 'agent_A',
        reason: 'Performance evaluation',
      },
    });
  };

  await simulateEvents();

  console.log('✅ Events simulated\n');

  const eventTraces = monitor.getEventTraces();
  console.log(`📊 Total Events: ${eventTraces.length}`);
  console.log(`📊 Recent Events (last 5):`);
  for (const trace of eventTraces.slice(0, 5)) {
    console.log(`   [${trace.type}] ${trace.sourceAgentId} → ${trace.targetAgentId || 'N/A'}`);
  }
  console.log('');

  // ========== Test 2: Interaction Graph ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Interaction Graph');
  console.log('─'.repeat(60));
  console.log('');

  const graph = monitor.getInteractionGraph();
  console.log('🔗 Interaction Graph:');
  console.log(`   Nodes: ${graph.nodes.join(', ')}`);
  console.log(`   Edges: ${graph.edges.length}`);
  console.log('');

  for (const edge of graph.edges.slice(0, 5)) {
    console.log(`   ${edge.from} → ${edge.to} (${edge.type}): weight ${edge.weight}`);
  }
  console.log('');

  // ========== Test 3: Visualization Generation ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Visualization Generation');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📈 Event Flow Visualization...\n');

  const eventFlow = monitor.generateEventFlowVisualization();
  console.log(`   Nodes: ${eventFlow.nodes.length}`);
  console.log(`   Edges: ${eventFlow.edges.length}`);
  console.log(`   Timeline Events: ${eventFlow.timeline.length}`);
  console.log('');

  console.log('📊 State Transition Diagram...\n');

  const stateDiagram = monitor.generateStateTransitionDiagram('agent_A');
  console.log(`   States: ${stateDiagram.nodes.map(n => n.id).join(', ')}`);
  console.log(`   Transitions: ${stateDiagram.edges.length}`);
  for (const edge of stateDiagram.edges) {
    console.log(`   ${edge.from} → ${edge.to} (weight: ${edge.weight})`);
  }
  console.log('');

  console.log('🔥 Collaboration Heatmap...\n');

  const heatmap = monitor.generateCollaborationHeatmap();
  console.log(`   Agents: ${heatmap.agents.join(', ')}`);
  console.log(`   Matrix (${heatmap.agents.length}x${heatmap.agents.length}):`);
  const matrixStr = heatmap.matrix.map(row =>
    '[' + row.map(v => v.toString().padStart(3)).join(', ') + ']',
  ).join('\n   ');
  console.log(`   ${matrixStr}`);
  console.log('');

  // ========== Test 4: Real-time Monitoring ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Real-time Monitoring');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📡 Starting real-time monitoring...\n');

  monitor.startMonitoring();

  await new Promise(resolve => setTimeout(resolve, 11000));  // 11 秒（2 个监控周期）

  const monitoringData = monitor.getMonitoringData();
  console.log(`📊 Monitoring Data Points: ${monitoringData.length}`);

  if (monitoringData.length > 0) {
    const latest = monitoringData[monitoringData.length - 1];
    console.log('Latest:');
    console.log(`   Active Agents: ${latest.activeAgents}`);
    console.log(`   Pending Tasks: ${latest.pendingTasks}`);
    console.log(`   System Load: ${(latest.systemLoad * 100).toFixed(0)}%`);
    console.log(`   Event Rate: ${latest.eventRate.toFixed(2)} events/sec`);
  }
  console.log('');

  monitor.stopMonitoring();

  // ========== Test 5: Collaboration Analysis ==========
  console.log('─'.repeat(60));
  console.log('Test 5: Collaboration Analysis');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🤝 Collaboration Metrics:\n');

  const collabMetrics = collabAnalyzer.analyzeCollaboration();
  console.log(`   Total Interactions: ${collabMetrics.totalInteractions}`);
  console.log(`   Avg Interactions/Agent: ${collabMetrics.avgInteractionsPerAgent.toFixed(2)}`);
  console.log(`   Most Active Agent: ${collabMetrics.mostActiveAgent}`);
  console.log(`   Most Collaborative Agent: ${collabMetrics.mostCollaborativeAgent}`);
  console.log(`   Collaboration Strength: ${(collabMetrics.collaborationStrength * 100).toFixed(0)}%`);
  console.log('');

  console.log('🔍 Event Flow Analysis:\n');

  const flowAnalysis = collabAnalyzer.analyzeEventFlow();
  console.log(`   Patterns: ${flowAnalysis.patterns.length}`);
  for (const pattern of flowAnalysis.patterns) {
    console.log(`     ${pattern}`);
  }
  console.log(`   Bottlenecks: ${flowAnalysis.bottlenecks.length}`);
  for (const bottleneck of flowAnalysis.bottlenecks) {
    console.log(`     ${bottleneck}`);
  }
  console.log(`   Dead Ends: ${flowAnalysis.deadEnds.length}`);
  console.log(`   Loops: ${flowAnalysis.loops.length}`);
  console.log(`   Emergence Score: ${(flowAnalysis.emergenceScore * 100).toFixed(0)}%`);
  console.log('');

  console.log('⚡ Emergence Metrics:\n');

  const emergenceMetrics = collabAnalyzer.calculateEmergenceMetrics();
  console.log(`   Agency: ${(emergenceMetrics.agency * 100).toFixed(0)}%`);
  console.log(`   Coherence: ${(emergenceMetrics.coherence * 100).toFixed(0)}%`);
  console.log(`   Complexity: ${(emergenceMetrics.complexity * 100).toFixed(0)}%`);
  console.log(`   Autonomy: ${(emergenceMetrics.autonomy * 100).toFixed(0)}%`);
  console.log(`   Self-Awareness: ${(emergenceMetrics.selfAwareness * 100).toFixed(0)}%`);
  console.log('');

  // ========== Test 6: Continuity Analysis ==========
  console.log('─'.repeat(60));
  console.log('Test 6: Continuity Analysis');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🎯 Agency Scores:\n');

  const agencyScores = continuityAnalyzer.measureAgency();
  for (const score of agencyScores) {
    console.log(`   ${score.agentId}: ${(score.score * 100).toFixed(0)}%`);
    console.log(`     Factors:`);
    for (const factor of score.factors) {
      console.log(`       ${factor.factor}: ${(factor.value * 100).toFixed(0)}% (weight: ${(factor.weight * 100).toFixed(0)}%)`);
    }
    if (score.evidence.length > 0) {
      console.log(`     Evidence: ${score.evidence.join(', ')}`);
    }
  }
  console.log('');

  console.log('🧠 Intent Modeling:\n');

  for (const agentId of ['agent_A', 'agent_B']) {
    const intentModel = continuityAnalyzer.modelIntents(agentId);
    console.log(`   ${agentId}:`);
    console.log(`     Current Intents: ${intentModel.currentIntents.join(', ') || 'none'}`);
    console.log(`     Intent Strength: ${(intentModel.intentStrength * 100).toFixed(0)}%`);
    console.log(`     Intent History: ${intentModel.intentHistory.length} entries`);
  }
  console.log('');

  console.log('📊 Consistency Tracking:\n');

  for (const agentId of ['agent_A', 'agent_B']) {
    const tracking = continuityAnalyzer.trackConsistency(agentId);
    console.log(`   ${agentId}:`);
    console.log(`     Consistency Score: ${(tracking.consistencyScore * 100).toFixed(0)}%`);
    console.log(`     Coherence: ${(tracking.coherence * 100).toFixed(0)}%`);
    console.log(`     Behavior Patterns: ${tracking.behaviorPatterns.length}`);
    if (tracking.behaviorPatterns.length > 0) {
      console.log(`       ${tracking.behaviorPatterns.join(', ')}`);
    }
    console.log(`     Deviations: ${tracking.deviations.length}`);
    if (tracking.deviations.length > 0) {
      for (const dev of tracking.deviations.slice(0, 2)) {
        console.log(`       Expected: ${dev.expected}, Actual: ${dev.actual}`);
      }
    }
  }
  console.log('');

  console.log('🪞 Self-Awareness Detection:\n');

  const awarenessIndicators = continuityAnalyzer.getAllSelfAwarenessIndicators();
  for (const indicator of awarenessIndicators) {
    console.log(`   ${indicator.agentId}: ${(indicator.overallScore * 100).toFixed(0)}%`);
    console.log(`     Self-Reference: ${(indicator.selfReference * 100).toFixed(0)}%`);
    console.log(`     Reflective Behavior: ${(indicator.reflectiveBehavior * 100).toFixed(0)}%`);
    console.log(`     Self-Preservation: ${(indicator.selfPreservation * 100).toFixed(0)}%`);
    console.log(`     Self-Improvement: ${(indicator.selfImprovement * 100).toFixed(0)}%`);
  }
  console.log('');

  // ========== Final Statistics ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  const totalTraces = monitor.getEventTraces();
  const totalSnapshots = monitor.getStateSnapshots();
  const activeAgents = monitor.getActiveAgents();

  console.log('📊 Emergence Monitor Statistics:');
  console.log(`   Total Event Traces: ${totalTraces.length}`);
  console.log(`   Total Snapshots: ${totalSnapshots.length}`);
  console.log(`   Active Agents: ${activeAgents.length}`);
  console.log(`   Monitoring Data Points: ${monitor.getMonitoringData().length}`);
  console.log('');

  console.log('🔍 Collaboration Statistics:');
  console.log(`   Most Active: ${collabMetrics.mostActiveAgent}`);
  console.log(`   Most Collaborative: ${collabMetrics.mostCollaborativeAgent}`);
  console.log(`   Collaboration Strength: ${(collabMetrics.collaborationStrength * 100).toFixed(0)}%`);
  console.log(`   Emergence Score: ${(flowAnalysis.emergenceScore * 100).toFixed(0)}%`);
  console.log('');

  console.log('🎯 Continuity Statistics:');
  console.log(`   Top Agency: ${agencyScores[0]?.agentId || 'none'} (${(agencyScores[0]?.score * 100 || 0).toFixed(0)}%)`);
  const totalAgency = agencyScores.reduce((sum, s) => sum + s.score, 0);
  const avgAgency = agencyScores.length > 0 ? totalAgency / agencyScores.length : 0;
  console.log(`   Avg Agency: ${(avgAgency * 100).toFixed(0)}%`);
  console.log('');

  console.log('┄'.repeat(60));
  console.log('✅ Emergence Observation Test Completed');
  console.log('┄'.repeat(60));
}

main().catch(console.error);
