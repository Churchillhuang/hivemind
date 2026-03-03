/**
 * Memory Enhancement Test
 *
 * 演示记忆增强功能：语义搜索、记忆分块、嵌入向量、压缩和清理
 */

import { MemoryEnhancement } from '../src/hive/MemoryEnhancement.js';
import { DEFAULT_HIVE_CONFIG } from '../src/hive/HiveConfig.js';

async function main() {
  console.log('🧠 Memory Enhancement Test\n');

  // 创建 Memory Enhancement
  console.log('1️⃣  Creating Memory Enhancement...\n');

  const memEnhancement = new MemoryEnhancement({
    hiveConfig: DEFAULT_HIVE_CONFIG,
    compressionConfig: {
      maxChunkSize: 300,
      minChunkOverlap: 50,
      compressionRatio: 0.7,
    },
    cleanupConfig: {
      cleanupInterval: 10000,  // 10 秒（测试用）
      maxAge: 60000,  // 1 分钟（测试用）
      minImportance: 0.3,
      minAccessCount: 1,
    },
    embeddingDim: 384,
  });

  console.log('✅ Memory Enhancement created\n');

  // 启动
  console.log('2️⃣  Starting Memory Enhancement...\n');

  await memEnhancement.start();

  console.log('✅ Memory Enhancement started\n');

  // ========== Test 1: Memory Chunking ==========
  console.log('─'.repeat(60));
  console.log('Test 1: Memory Chunking');
  console.log('─'.repeat(60));
  console.log('');

  const sampleMemory = `HiveMind is an advanced AI agent coordination framework designed to enable emergent self through distributed agent collaboration. The system is built on top of OpenClaw, extending it with a hive-like architecture where multiple agents work together in a coordinated manner. Key features include memory tiering (L0-L4), model tiering (nano/light/standard/heavy), global state machine with checkpoint and rollback capabilities, advanced routing with priority queues and load balancing, and agent communication with direct messaging, request/response patterns, broadcast channels, and deadlock prevention. Agents can dynamically evolve their roles and skills based on experience and feedback, enabling true adaptability in dynamic environments. The memory system supports semantic search through vector embeddings, allowing agents to find relevant information based on meaning rather than exact keyword matches. Memory compression and cleanup ensure efficient resource usage while preserving important information.`;

  console.log('📝 Sample memory (~500 chars):');
  console.log(`   "${sampleMemory.substring(0, 100)}..."`);
  console.log('');

  console.log('🧩 Creating memory chunks...\n');

  await memEnhancement.createMemoryChunks('memory_001', sampleMemory);

  const stats = memEnhancement.getChunkStats();
  const memStats = memEnhancement.getMemoryStats();

  console.log('📊 Chunking Statistics:');
  console.log(`   Total memories: ${memStats.totalMemories}`);
  console.log(`   Total chunks: ${stats.total}`);
  console.log(`   Total embeddings: ${memStats.totalEmbeddings}`);
  console.log(`   Avg importance: ${(stats.avgImportance * 100).toFixed(1)}%`);
  console.log(`   Avg access count: ${stats.avgAccessCount.toFixed(1)}`);
  console.log('');

  // ========== Test 2: Semantic Search ==========
  console.log('─'.repeat(60));
  console.log('Test 2: Semantic Search');
  console.log('─'.repeat(60));
  console.log('');

  const queries = [
    'agent coordination framework',
    'memory tiering system',
    'vector embeddings',
    'advanced routing',
  ];

  console.log('🔍 Performing semantic searches...\n');

  for (const query of queries) {
    const results = await memEnhancement.semanticSearch(query, 2);

    console.log(`🔎 Query: "${query}"`);
    if (results.length > 0) {
      console.log(`   Found ${results.length} result(s):`);
      for (const r of results) {
        console.log(`   - Similarity: ${(r.similarity * 100).toFixed(1)}%`);
        console.log(`     Content: "${r.content.substring(0, 80)}..."`);
      }
    } else {
      console.log('   No results found');
    }
    console.log('');
  }

  // ========== Test 3: Memory Compression ==========
  console.log('─'.repeat(60));
  console.log('Test 3: Memory Compression');
  console.log('─'.repeat(60));
  console.log('');

  const longMemory = `This is a very long memory that contains detailed information about the HiveMind architecture. The architecture consists of multiple layers including coordination layer, execution layer, and memory layer. The coordination layer manages agent interactions and task distribution. The execution layer handles task execution and result aggregation. The memory layer provides shared memory across agents with tiered access levels. Advanced features include state management with global state machine, checkpoint and rollback capabilities. Agents communicate through direct messaging, request/response patterns, and broadcast channels. The system also supports advanced routing with priority queues, load balancing, and task dependencies. Dynamic agent evolution allows agents to adapt and evolve their roles based on experience. Performance monitoring tracks agent performance and generates evolution suggestions. The memory system includes semantic search, vector embeddings, compression, and cleanup for efficient resource usage. OpenClaw integration ensures compatibility with existing infrastructure.`;

  console.log('📝 Long memory (~1000 chars)');
  console.log(`   Original length: ${longMemory.length} chars`);
  console.log('');

  console.log('🗜️  Compressing memory...\n');

  const compression = await memEnhancement.compressMemory('memory_002', longMemory);

  console.log('📊 Compression Result:');
  console.log(`   Compressed length: ${compression.compressedContent.length} chars`);
  console.log(`   Compression ratio: ${(compression.compressionRatio * 100).toFixed(1)}% retained`);
  console.log(`   Saved: ${longMemory.length - compression.compressedContent.length} chars`);
  console.log('');

  const postCompressionStats = memEnhancement.getMemoryStats();
  console.log('📊 Updated Memory Statistics:');
  console.log(`   Total memories: ${postCompressionStats.totalMemories}`);
  console.log(`   Total chunks: ${postCompressionStats.totalChunks}`);
  console.log(`   Compression saved: ${postCompressionStats.compressionSaved} chars`);
  console.log('');

  // ========== Test 4: Access Stats ==========
  console.log('─'.repeat(60));
  console.log('Test 4: Access Statistics');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🔍 Performing more searches to update access stats...\n');

  const additionalQueries = [
    'global state machine',
    'agent evolution',
    'memory compression',
    'vector search',
  ];

  for (const query of additionalQueries) {
    await memEnhancement.semanticSearch(query, 3);
  }

  console.log('✅ Searches completed\n');

  const postAccessStats = memEnhancement.getChunkStats();
  console.log('📊 Updated Access Statistics:');
  console.log(`   Avg access count: ${postAccessStats.avgAccessCount.toFixed(1)}`);
  console.log(`   Avg importance: ${(postAccessStats.avgImportance * 100).toFixed(1)}%`);
  console.log('');

  // ========== Test 5: Manual Cleanup ==========
  console.log('─'.repeat(60));
  console.log('Test 5: Memory Cleanup');
  console.log('─'.repeat(60));
  console.log('');

  console.log('🧹 Creating old/low-importance memories for cleanup...\n');

  // 创建一些低重要性的旧记忆
  const lowImportanceMemory = 'This is a less important memory that should be cleaned up.';
  await memEnhancement.createMemoryChunks('memory_low_imp', lowImportanceMemory);

  console.log('🧹 Running manual cleanup...\n');

  const cleanedCount = await memEnhancement.cleanup();

  const postCleanupStats = memEnhancement.getMemoryStats();

  console.log('📊 Cleanup Result:');
  console.log(`   Chunks cleaned: ${cleanedCount}`);
  console.log(`   Total chunks remaining: ${postCleanupStats.totalChunks}`);
  console.log(`   Total memories remaining: ${postCleanupStats.totalMemories}`);
  console.log('');

  // ========== Final Statistics ==========
  console.log('─'.repeat(60));
  console.log('Final Statistics');
  console.log('─'.repeat(60));
  console.log('');

  const finalStats = memEnhancement.getMemoryStats();
  const finalChunkStats = memEnhancement.getChunkStats();

  console.log('📊 Memory Enhancement Statistics:');
  console.log(`   Total memories: ${finalStats.totalMemories}`);
  console.log(`   Total chunks: ${finalStats.totalChunks}`);
  console.log(`   Total embeddings: ${finalStats.totalEmbeddings}`);
  console.log(`   Compression saved: ${finalStats.compressionSaved} chars`);
  console.log(`   Cleaned chunks: ${finalStats.cleanedMemories}`);
  console.log('');

  console.log('📊 Chunk Statistics:');
  console.log(`   Total chunks: ${finalChunkStats.total}`);
  console.log(`   Avg importance: ${(finalChunkStats.avgImportance * 100).toFixed(1)}%`);
  console.log(`   Avg access count: ${finalChunkStats.avgAccessCount.toFixed(1)}`);
  console.log('');

  // 停止
  console.log('🔧 Stopping Memory Enhancement...\n');

  await memEnhancement.stop();

  console.log('✅ Memory Enhancement stopped');
  console.log('');

  console.log('─'.repeat(60));
  console.log('✅ Memory Enhancement Test Completed');
  console.log('─'.repeat(60));
}

main().catch(console.error);
