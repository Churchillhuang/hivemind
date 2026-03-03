/**
 * Self-Optimization Test
 *
 * 演示自我优化功能：指标收集、分析引擎、自主调优
 */

import { MetricsTracker } from '../src/hive/MetricsTracker.js';
import { AnalysisEngine } from '../src/hive/AnalysisEngine.js';
import { AutonomousTuner } from '../src/hive/AutonomousTuner.js';

async function main() {
  console.log('🔧 Self-Optimization Test\n');

  // 创建 Metrics Tracker
  console.log('1️⃣  Creating Metrics Tracker...\n');

  const metricsTracker = new MetricsTracker();

  console.log('✅ Metrics Tracker created\n');

  // 创建 Analysis Engine
  console.log('2️⃣  Creating Analysis Engine...\n');

  const analysisEngine = new AnalysisEngine(metricsTracker);

  console.log('✅ Analysis Engine created\n');

  // 创建 Autonomous Tuner
  console.log('3️⃣  Creating Autonomous Tuner...\n');

  const tuner = new AutonomousTuner(metricsTracker, analysisEngine);

  console.log('✅ Autonomous Tuner created\n');

  // ========== Test 1: Performance Metrics ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Performance Metrics');
  console.log('─'.repeat(60));
  console.log('');

  console.log('📊 Recording task completions...\n');

  // 模拟 agent A（高性能）
  for (let i = 0; i < 20; i++) {
    metricsTracker.recordTaskCompletion(
      'agent_A',
      800 + Math.random() * 400,  // latency: 800-1200ms
      Math.random() > 0.05,  // 95% success rate
      1000,  // tokens
      0.0002,  // cost ($0.0002 per 1K tokens)
      'standard',
    );
  }

  // 模拟 agent B（低性能，高延迟）
  for (let i = 0; i < 15; i++) {
    metricsTracker.recordTaskCompletion(
      'agent_B',
      4000 + Math.random() * 2000,  // latency: 4000-6000ms
      Math.random() > 0.2,  // 80% success rate
      1500,  // tokens
      0.0003,  // cost
      'standard',
    );
  }

  // 模拟 agent C（低成功率）
  for (let i = 0; i < 10; i++) {
    metricsTracker.recordTaskCompletion(
      'agent_C',
      1500 + Math.random() * 500,  // latency: 1500-2000ms
      Math.random() > 0.4,  // 60% success rate
      800,  // tokens
      0.00015,  // cost
      'light',
    );
  }

  console.log('✅ Tasks recorded\n');

  const metrics = metricsTracker.getPerformanceMetrics();
  console.log('📊 Performance Metrics:');
  for (const [agentId, agentMetrics] of metrics.entries()) {
    console.log(`   ${agentId}:`);
    console.log(`     Completed: ${agentMetrics.tasksCompleted} | Failed: ${agentMetrics.tasksFailed}`);
    console.log(`     Success Rate: ${(agentMetrics.successRate * 100).toFixed(1)}%`);
    console.log(`     Avg Latency: ${agentMetrics.averageLatency.toFixed(0)}ms | P99: ${agentMetrics.p99Latency.toFixed(0)}ms`);
    console.log(`     Throughput: ${agentMetrics.throughput.toFixed(2)} tasks/min`);
  }
  console.log('');

  // ========== Test 2: Cost Metrics ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Cost Metrics');
  console.log('─'.repeat(60));
  console.log('');

  const costMetrics = metricsTracker.getCostMetrics();
  console.log('💰 Cost Metrics:');
  console.log(`   Total Tokens: ${costMetrics.totalTokens}`);
  console.log(`   Total Cost: $${costMetrics.totalCost.toFixed(4)}`);
  console.log('');

  console.log('💰 Cost by Agent:');
  for (const [agentId, agentCost] of costMetrics.byAgent.entries()) {
    console.log(`   ${agentId}:`);
    console.log(`     Tokens: ${agentCost.tokens}`);
    console.log(`     Cost: $${agentCost.cost.toFixed(4)}`);
  }
  console.log('');

  console.log('💰 Cost by Model:');
  for (const [model, modelCost] of costMetrics.byModel.entries()) {
    console.log(`   ${model}:`);
    console.log(`     Tokens: ${modelCost.tokens}`);
    console.log(`     Cost: $${modelCost.cost.toFixed(4)}`);
  }
  console.log('');

  // ========== Test 3: Anomaly Detection ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Anomaly Detection');
  console.log('─'.repeat(60));
  console.log('');

  const anomalies = metricsTracker.getAnomalies();
  console.log(`🚨 Detected ${anomalies.length} anomalies:\n`);

  for (const anomaly of anomalies) {
    console.log(`   ${anomaly.id}:`);
    console.log(`     Agent: ${anomaly.agentId}`);
    console.log(`     Type: ${anomaly.type}`);
    console.log(`     Severity: ${anomaly.severity}`);
    console.log(`     Description: ${anomaly.description}`);
    console.log(`     Resolved: ${anomaly.resolved}`);
    console.log('');
  }

  // ========== Test 4: Behavior Pattern Analysis ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Behavior Pattern Analysis');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🔍 Analyzing behavior patterns...\n');

  const patternA = metricsTracker.analyzeBehaviorPatterns('agent_A');
  const patternB = metricsTracker.analyzeBehaviorPatterns('agent_B');

  if (patternA) {
    console.log(`📊 Agent A Pattern:`);
    console.log(`   Type: ${patternA.patternType}`);
    console.log(`   Frequency: ${patternA.frequency.toFixed(2)} events/min`);
    console.log(`   Confidence: ${(patternA.confidence * 100).toFixed(1)}%`);
    console.log('');
  }

  if (patternB) {
    console.log(`📊 Agent B Pattern:`);
    console.log(`   Type: ${patternB.patternType}`);
    console.log(`   Frequency: ${patternB.frequency.toFixed(2)} events/min`);
    console.log(`   Confidence: ${(patternB.confidence * 100).toFixed(1)}%`);
    console.log('');
  }

  // ========== Test 5: Analysis Engine ==========
  console.log('─'.repeat(60));
  console.log('Test 5: Analysis Engine');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🔬 Running analysis...\n');

  const analysis = await analysisEngine.analyze();

  console.log(`💡 Improvement Suggestions (${analysis.suggestions.length}):\n`);

  for (const suggestion of analysis.suggestions.slice(0, 5)) {
    console.log(`   ${suggestion.id}:`);
    console.log(`     Type: ${suggestion.type}`);
    console.log(`     Priority: ${suggestion.priority}`);
    console.log(`     Target: ${suggestion.targetId}`);
    console.log(`     Description: ${suggestion.description}`);
    console.log(`     Action: ${suggestion.action}`);
    console.log('');
  }

  console.log(`📜 Discovered Rules (${analysis.rules.length}):\n`);

  for (const rule of analysis.rules) {
    console.log(`   ${rule.id}:`);
    console.log(`     Pattern: ${rule.pattern}`);
    console.log(`     Description: ${rule.description}`);
    console.log(`     Confidence: ${(rule.confidence * 100).toFixed(1)}%`);
    console.log(`     Support: ${rule.support}`);
    console.log('');
  }

  console.log(`📊 Pattern Analysis (${analysis.patterns.length}):\n`);

  for (const pattern of analysis.patterns) {
    console.log(`   ${pattern.pattern}:`);
    console.log(`     Description: ${pattern.description}`);
    console.log(`     Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log('');
  }

  // ========== Test 6: Autonomous Tuning ==========
  console.log('─'.repeat(60));
  console.log('Test 6: Autonomous Tuning');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🎛️  Running autonomous tuning...\n');

  const tuning = await tuner.tune();

  console.log('🔧 Tuning Results:');
  for (const result of tuning.tuningResults) {
    console.log(`   ${result.parameterName}:`);
    console.log(`     ${result.oldValue} → ${result.newValue}`);
    console.log(`     Reason: ${result.reason}`);
    console.log(`     Expected Impact: ${(result.expectedImpact * 100).toFixed(1)}%`);
    console.log('');
  }

  console.log('🤖 Model Selection Optimizations:');
  for (const selection of tuning.modelSelections) {
    console.log(`   ${selection.agentId}:`);
    console.log(`     Recommended: ${selection.recommendedModel}`);
    console.log(`     Reason: ${selection.reason}`);
    console.log(`     Expected Savings: $${selection.cost.toFixed(4)}`);
    console.log(`     Expected Latency: ${selection.expectedLatency.toFixed(0)}ms`);
    console.log('');
  }

  // ========== Test 7: Root Cause Analysis ==========
  console.log('─'.repeat(60));
  console.log('Test 7: Root Cause Analysis');
  console.log('─'.repeat(60));
  console.log('');

  const activeAnomalies = metricsTracker.getAnomalies(undefined, false);
  if (activeAnomalies.length > 0) {
    for (const anomaly of activeAnomalies.slice(0, 2)) {
      console.log(`🔍 Root Cause Analysis for ${anomaly.id}:\n`);

      const rootCause = await analysisEngine.analyzeRootCause(anomaly.id);

      console.log('   Root Causes:');
      for (const cause of rootCause.rootCauses) {
        console.log(`     - ${cause}`);
      }
      console.log('');

      console.log('   Factors:');
      for (const factor of rootCause.factors) {
        console.log(`     - ${factor.factor} (impact: ${(factor.impact * 100).toFixed(1)}%, confidence: ${(factor.confidence * 100).toFixed(1)}%)`);
      }
      console.log('');

      console.log('   Recommended Actions:');
      for (const action of rootCause.recommendedActions) {
        console.log(`     - ${action}`);
      }
      console.log('');
    }
  }

  // ========== Final Statistics ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  const summary = metricsTracker.getSummary();
  console.log('📊 Metrics Summary:');
  console.log(`   Total Agents: ${summary.totalAgents}`);
  console.log(`   Total Tasks: ${summary.totalTasks}`);
  console.log(`   Average Success Rate: ${(summary.averageSuccessRate * 100).toFixed(1)}%`);
  console.log(`   Average Latency: ${summary.averageLatency.toFixed(0)}ms`);
  console.log(`   Total Cost: $${summary.totalCost.toFixed(4)}`);
  console.log(`   Active Anomalies: ${summary.activeAnomalies}`);
  console.log('');

  const tunerStats = tuner.getStats();
  console.log('🎛️  Tuner Statistics:');
  console.log(`   Total Tunings: ${tunerStats.totalTunings}`);
  console.log(`   Total Applies: ${tunerStats.totalApplies}`);
  console.log(`   Total Rollbacks: ${tunerStats.totalRollbacks}`);
  console.log(`   Total Model Selections: ${tunerStats.totalModelSelections}`);
  console.log('');

  console.log('📋 Tuning Parameters:');
  for (const [name, param] of tuner.getParameters().entries()) {
    console.log(`   ${name}: ${param.value} (${param.description})`);
  }
  console.log('');

  console.log('📋 Strategy Config:');
  const strategyConfig = tuner.getStrategyConfig();
  console.log(`   Routing Strategy: ${strategyConfig.routingStrategy}`);
  console.log(`   Load Balancing: ${strategyConfig.loadBalancingEnabled}`);
  console.log(`   Auto Scaling: ${strategyConfig.autoScalingEnabled}`);
  console.log(`   Cost Optimization: ${(strategyConfig.costOptimizationLevel * 100).toFixed(0)}%`);
  console.log(`   Performance Priority: ${(strategyConfig.performancePrioritizationLevel * 100).toFixed(0)}%`);
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Self-Optimization Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
