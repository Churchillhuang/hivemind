/**
 * Example: Basic HiveMind Integration Test
 *
 * 演示如何使用 HiveGatewayBridge 和 InterfaceAgent
 */

import { HawkGatewayBridge } from '../src/hive/HiveGatewayBridge.js';
import { InterfaceAgent } from '../src/hive/InterfaceAgent.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig, type InboundMessage } from '../src/hive/HiveConfig.js';
import { EventType } from '../src/events/Event.js';

async function main() {
  console.log('🐝 HiveMind Integration Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  console.log('📋 Config:', JSON.stringify(hiveConfig, null, 2));

  // 获取事件总线
  const eventBus = getGlobalEventBus();
  console.log('✅ EventBus active');

  // 创建 Gateway 桥接
  const bridge = new HiveGatewayBridge({
    hiveConfig,
    eventBus,
  });

  console.log('🔗 Initializing Gateway Bridge...');
  await bridge.initialize();
  console.log('✅ Gateway Bridge initialized\n');

  // 模拟订阅事件（用于观察）
  eventBus.subscribe(EventType.NEW_MESSAGE, (event) => {
    console.log(`📨 [Event] NEW_MESSAGE received:`, event.payload);
  });

  eventBus.subscribe(EventType.MESSAGE_PROCESSED, (event) => {
    console.log(`✅ [Event] MESSAGE_PROCESSED received:`, event.payload);
  });

  // 模拟用户消息
  console.log('👤 Simulating user messages...\n');

  const messages: InboundMessage[] = [
    {
      id: 'msg_001',
      content: 'Hello, who are you?',
      userId: 'user_123',
      channelId: 'telegram_456',
    },
    {
      id: 'msg_002',
      content: 'What can you do?',
      userId: 'user_123',
      channelId: 'telegram_456',
    },
    {
      id: 'msg_003',
      content: 'Tell me about HiveMind',
      userId: 'user_123',
      channelId: 'telegram_456',
    },
  ];

  for (const msg of messages) {
    console.log(`📥 [User ${msg.userId}]: ${msg.content}`);

    try {
      const response = await bridge.interceptMessage(msg);
      console.log(`📤 [Bot ${response.agentId}]: ${response.content}\n`);
    } catch (error) {
      console.error(`❌ [Error]: ${error}\n`);
    }

    // 延迟以展示事件处理
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 显示状态
  console.log('📊 Bridge Status:', bridge.getStatus());

  // 清理
  console.log('\n\n🛑 Shutting down...');
  await bridge.shutdown();
  console.log('✅ Gateway Bridge shut down\n');

  // 显示 Event History
  console.log('📜 Event History:');
  const history = eventBus.getHistory(undefined, 10);
  history.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.type} (${new Date(e.timestamp).toLocaleTimeString()})`);
  });
}

main().catch(console.error);
