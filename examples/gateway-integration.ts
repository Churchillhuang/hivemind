/**
 * Example: OpenClaw Gateway Integration Test
 *
 * 演示 GatewayIntegrator - 连接到 Gateway 并使用 HiveGatewayBridge 拦截消息
 */

import { HiveGatewayBridge } from '../src/hive/HiveGatewayBridge.js';
import { EventBus, getGlobalEventBus } from '../src/events/EventBus.js';
import { DEFAULT_HIVE_CONFIG, type HiveConfig } from '../src/hive/HiveConfig.js';
import { GatewayIntegrator } from '../src/hive/GatewayIntegrator.js';

async function main() {
  console.log('🌐 OpenClaw Gateway Integration Test\n');

  // 配置 HiveMind
  const hiveConfig: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    enabled: true,
    mode: 'multi',
  };

  const eventBus = getGlobalEventBus();
  console.log('✅ EventBus active\n');

  // 1. 创建 HiveGatewayBridge
  console.log('🔗 Creating HiveGatewayBridge...');
  const bridge = new HiveGatewayBridge({
    hiveConfig,
    eventBus,
  });
  console.log('✅ HiveGatewayBridge created\n');

  // 2. 创建 GatewayIntegrator
  console.log('🌐 Creating GatewayIntegrator...');
  const integrator = new GatewayIntegrator({
    gatewayUrl: 'ws://127.0.0.1:18789',
    token: undefined,  // 可选
    hiveConfig,
    eventBus,
    bridge,
  });
  console.log('✅ GatewayIntegrator created\n');

  // 3. 连接到 Gateway（模拟）
  console.log('🔌 Connecting to Gateway...');
  await integrator.connect();
  console.log('✅ Connected (simulated)\n');

  // 4. 显示状态
  console.log('📊 Bridge Status:');
  const bridgeStatus = bridge.getStatus();
  console.log(`   Initialized: ${bridgeStatus.initialized}`);
  console.log(`   Hive Enabled: ${bridge.isHiveEnabled()}`);
  console.log(`   Agent Running: ${bridgeStatus.agentRunning}`);
  console.log('');

  console.log('📊 Integrator Status:');
  const integratorStatus = integrator.getStats();
  console.log(`   Connected: ${integratorStatus.connected}`);
  console.log(`   Pending Requests: ${integratorStatus.pendingRequests}`);
  console.log('');

  // 5. 模拟 Gateway 事件
  console.log('📨 Simulating Gateway events...\n');

  const mockEvent = {
    type: 'event',
    event: 'chat.send',
    payload: {
      id: 'msg_gateway_001',
      to: 'telegram:5185096746',
      message: 'Hello from Gateway!',
      channel: 'telegram',
      userId: 'user_123',
    },
  } as const;

  await integrator.handleEvent(mockEvent);

  console.log('');

  // 6. 模拟多个消息
  console.log('📨 Simulating multiple messages...\n');

  const messages = [
    'What is HiveMind?',
    'Tell me about yourself',
    'How do agents coordinate?',
  ];

  for (const [i, msg] of messages.entries()) {
    console.log(`📥 [Gateway]: ${msg}`);

    const mockMsg = {
      type: 'event',
      event: 'chat.send',
      payload: {
        id: `msg_gateway_${i}`,
        to: 'telegram:5185096746',
        message: msg,
        channel: 'telegram',
        userId: 'user_123',
      },
    } as const;

    await integrator.handleEvent(mockMsg);

    // 等待处理
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('');
  }

  // 7. 显示最终状态
  console.log('📊 Final Status:');
  const finalBridgeStatus = bridge.getStatus();
  const finalIntegratorStatus = integrator.getStats();
  console.log(`   Bridge: Initialized=${finalBridgeStatus.initialized}, Agent Running=${finalBridgeStatus.agentRunning}`);
  console.log(`   Integrator: Connected=${finalIntegratorStatus.connected}, Pending=${finalIntegratorStatus.pendingRequests}`);
  console.log('');

  // 8. 发送请求（模拟）
  console.log('📤 Sending simulated request...');
  try {
    const result = await integrator.sendRequest('health.check', {});
    console.log('✅ Response:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }
  console.log('');

  // 9. 断开连接
  console.log('🔌 Disconnecting...');
  await integrator.disconnect();
  console.log('✅ Disconnected\n');

  // 10. 清理
  console.log('🧹 Cleaning up...');
  await bridge.shutdown();
  console.log('✅ Gateway Bridge shutdown\n');
}

main().catch(console.error);
