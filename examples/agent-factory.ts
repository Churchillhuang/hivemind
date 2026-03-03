/**
 * Example: AgentFactory Dynamic Agent Creation Test
 *
 * 演示 Agent Factory 动态创建和管理 Agents
 */

import { AgentFactory } from '../src/hive/AgentFactory.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🏭 AgentFactory Dynamic Agent Creation Test\n');

  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  const eventBus = getGlobalEventBus();
  console.log('✅ EventBus active\n');

  // 1. 创建并启动 AgentFactory
  console.log('🏭 Initializing AgentFactory...');
  const factory = new AgentFactory(
    {
      id: 'agent_factory_001',
      role: 'Agent Factory',
      description: '动态创建和管理 Agents',
    },
    hiveConfig,
    eventBus,
  );

  await factory.start();
  console.log('✅ AgentFactory started\n');

  // 显示 AgentFactory 状态
  console.log('📊 AgentFactory Status:');
  const status = factory.getStatus();
  console.log(`   Templates: ${status.templates}`);
  console.log(`   Instances: ${status.instances}`);
  console.log(`   Active: ${status.active}`);
  console.log(`   Idle: ${status.idle}`);
  console.log('');

  // 2. 显示可用模板
  console.log('📋 Available Templates:');
  const templates = factory.getTemplates();
  for (const template of templates) {
    console.log(`   - ${template.id}`);
    console.log(`     Type: ${template.type}`);
    console.log(`     Role: ${template.role}`);
    console.log(`     Lifespan: ${template.lifespan}`);
    console.log(`     Capabilities: ${template.capabilities.join(', ')}`);
  }
  console.log('');

  // 3. 订阅事件
  let createdCount = 0;
  let destroyedCount = 0;

  eventBus.subscribe('AGENT_CREATED', (event) => {
    const payload = event.payload as {
      templateId: string;
      instanceId: string;
    };
    createdCount++;
    console.log(`✅ [AGENT_CREATED] ${createdCount}. Template: ${payload.templateId}, Instance: ${payload.instanceId}`);
  });

  eventBus.subscribe(EventType.AGENT_STARTED, (event) => {
    const payload = event.payload as {
      agentId: string;
      role: string;
      templateId?: string;
    };
    console.log(`🟢 [AGENT_STARTED] ${payload.agentId} (${payload.role})`);
  });

  eventBus.subscribe(EventType.AGENT_STOPPED, (event) => {
    const payload = event.payload as {
      agentId: string;
      role: string;
    };
    destroyedCount++;
    console.log(`🔴 [AGENT_STOPPED] ${payload.agentId} (${payload.role})`);
  });

  // 4. 创建第一个实例 - Moltbook Bot
  console.log('=== Creating Moltbook Bot ===\n');

  await eventBus.publish({
    type: EventType.AGENT_CREATE_REQUEST,
    sourceAgent: 'test_script',
    payload: {
      templateId: 'moltbook_bot',
      taskId: 'task_moltbook_001',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // 显示实例状态
  const moltbookInstances = factory.getInstances({ templateId: 'moltbook_bot' });
  console.log(`   Moltbook instances: ${moltbookInstances.length}`);
  if (moltbookInstances.length > 0) {
    console.log(`   - ${moltbookInstances[0].instanceId}: ${moltbookInstances[0].status}`);
  }
  console.log('');

  // 5. 创建 WordPress Uploader
  console.log('=== Creating WordPress Uploader ===\n');

  await eventBus.publish({
    type: EventType.AGENT_CREATE_REQUEST,
    sourceAgent: 'test_script',
    payload: {
      templateId: 'wp_uploader',
      taskId: 'task_wp_001',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // 6. 创建 File Analyzer
  console.log('=== Creating File Analyzer ===\n');

  await eventBus.publish({
    type: EventType.AGENT_CREATE_REQUEST,
    sourceAgent: 'test_script',
    payload: {
      templateId: 'file_analyzer',
      taskId: 'task_file_001',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // 7. 显示所有实例
  console.log('👥 All Active Instances:');
  const allInstances = factory.getInstances({ status: 'active' });
  for (const instance of allInstances) {
    console.log(`   - ${instance.instanceId} (${instance.name})`);
    console.log(`     Status: ${instance.status}`);
    console.log(`     Current task: ${instance.currentTaskId || 'None'}`);
    console.log(`     Created: ${new Date(instance.createdAt).toLocaleTimeString()}`);
  }
  console.log('');

  // 8. 更新 AgentFactory 状态
  console.log('📊 Updated AgentFactory Status:');
  const updatedStatus = factory.getStatus();
  console.log(`   Templates: ${updatedStatus.templates}`);
  console.log(`   Instances: ${updatedStatus.instances}`);
  console.log(`   Active: ${updatedStatus.active}`);
  console.log(`   Idle: ${updatedStatus.idle}`);
  console.log('');

  // 9. 模拟任务完成，自动销毁
  console.log('=== Simulating task completion and auto-destroy ===\n');

  const wpInstance = factory.getInstances({ templateId: 'wp_uploader' })[0];
  if (wpInstance) {
    console.log(`Destroying WordPress instance: ${wpInstance.instanceId}`);
    await factory.destroyInstance(wpInstance.instanceId);
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  const fileInstance = factory.getInstances({ templateId: 'file_analyzer' })[0];
  if (fileInstance) {
    console.log(`Destroying File Analyzer instance: ${fileInstance.instanceId}`);
    await factory.destroyInstance(fileInstance.instanceId);
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // 10. 显示最终状态
  console.log('📊 Final AgentFactory Status:');
  const finalStatus = factory.getStatus();
  console.log(`   Templates: ${finalStatus.templates}`);
  console.log(`   Instances: ${finalStatus.instances}`);
  console.log(`   Active: ${finalStatus.active}`);
  console.log(`   Idle: ${finalStatus.idle}`);
  console.log('');

  // 11. 创建自定义模板
  console.log('=== Registering custom template ===\n');

  factory.registerTemplate({
    id: 'content_writer',
    name: 'Content Writer',
    type: 'functional',
    role: 'Content Writer',
    description: '专业内容写作',
    memoryLevel: 'session',
    capabilities: ['article_writing', 'blog_post', 'copywriting'],
    lifespan: 'task',
  });

  await eventBus.publish({
    type: EventType.AGENT_CREATE_REQUEST,
    sourceAgent: 'test_script',
    payload: {
      templateId: 'content_writer',
      taskId: 'task_writing_001',
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // 12. 清理
  console.log('\n🛑 Shutting down...');
  await factory.stop();
  console.log('✅ AgentFactory stopped\n');

  // 13. 统计
  console.log('📊 Summary:');
  console.log(`   Agents created: ${createdCount}`);
  console.log(`   Agents destroyed: ${destroyedCount}`);
  console.log(`   Final instances: ${finalStatus.instances}`);
}

main().catch(console.error);
