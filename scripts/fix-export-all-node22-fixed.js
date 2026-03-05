#!/usr/bin/env node
/**
 * 修复后的 __exportAll inline 实现
 *
 * 问题：原实现中 `get: all[name]` 立即求值，应该是 `get: () => all[name]`
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// 修复后的 __exportAll 函数 inline 实现
const exportAllInlineFixed = `var __defProp = Object.defineProperty;
var __exportAll = (all) => {
  let target = {};
  for (var name in all) {
    __defProp(target, name, {
      get: () => all[name],  // 修复：使用 getter 懒加载
      enumerable: true
    });
  }
  return target;
};`;

async function fixRuntimeFile(filePath) {
  if (!path.basename(filePath).startsWith('rolldown-runtime-')) {
    return false;
  }

  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;

  // 更安全地移除 Symbol.toStringTag
  if (content.includes('Symbol.toStringTag')) {
    // 精确匹配，确保只移除相关代码块
    const tagCodeBlock = /if \(!no_symbols\) \{[\s\S]*?__defProp\(target, Symbol\.toStringTag, \{ value: "Module" \}\);[\s\S]*?\}/;
    content = content.replace(tagCodeBlock, '/* Symbol.toStringTag removed */');

    // 简化 __exportAll 函数签名
    content = content.replace(/var __exportAll = \(all, no_symbols\) => \{/g, 'var __exportAll = (all) => {');

    // 移除 __exportAll 调用的第二个参数
    content = content.replace(/__exportAll\(([^,]+),\s*[^)]+\)/g, '__exportAll($1)');

    modified = true;
    console.log(`Fixed: ${path.basename(filePath)}`);
  }

  if (modified) {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  }
  return false;
}

async function fixFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  let originalContent = content;
  let modified = false;

  // 匹配 __exportAll import（使用 rolldown 格式）
  const importMatch = content.match(/import\s*\{\s*([^}]*\b[a-z]\s+as\s+__exportAll[^}]*)\}\s+from\s+"\.\/[^"]+\.js";/);

  if (importMatch) {
    // 使用修复后的 inline 实现
    content = content.replace(importMatch[0], exportAllInlineFixed);

    // 移除 __exportAll 调用的第二个参数（更安全的正则）
    // 匹配: __exportAll({...}, true) 或 __exportAll({...}, false)
    // 替换为: __exportAll({...})
    const callPattern = /__exportAll\((\{[^}]*\}),\s*(?:true|false)\)/g;
    content = content.replace(callPattern, '__exportAll($1)');

    modified = true;
    console.log(`Fixed: ${path.basename(filePath)} (replaced import with inline)`);
  }

  // 如果修改了且内容不同，写入文件
  if (modified && content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  }
  return false;
}

async function main() {
  console.log('🔧 Starting __exportAll fix with corrected implementation...\n');

  const files = await fs.readdir(distDir);
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('node_modules'));

  let fixedRuntime = 0;
  let fixedImport = 0;

  for (const file of jsFiles) {
    try {
      const filePath = path.join(distDir, file);

      if (await fixRuntimeFile(filePath)) {
        fixedRuntime++;
      } else if (await fixFile(filePath)) {
        fixedImport++;
      }
    } catch (e) {
      console.error(`  ⚠️  Skipped ${file}: ${e.message}`);
    }
  }

  console.log(`\n✅ Completed! Fixed ${fixedRuntime} runtime files and ${fixedImport} import files (total: ${fixedRuntime + fixedImport})`);

  // 验证：检查是否还有未修复的 import
  const remainingImports = jsFiles.some(file => {
    try {
      const content = fs.readFileSync(path.join(distDir, file), 'utf8');
      return content.includes('import') && content.includes('as __exportAll');
    } catch {
      return false;
    }
  });

  if (remainingImports) {
    console.warn('⚠️  Warning: Some files still have __exportAll imports - manual review recommended');
  }
}

main().catch(console.error);
