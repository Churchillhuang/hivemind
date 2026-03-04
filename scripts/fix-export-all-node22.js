#!/usr/bin/env node
/**
 * Fix __exportAll circular dependency issue for Node.js 22
 *
 * This script modifies the built JavaScript files to avoid importing __exportAll
 * from ir-*.js files, which causes circular dependency issues in Node.js 22.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// The __exportAll function to inline
const exportAllCode = `var __exportAll = (all) => { let target = {}; for (var name in all) { 
Object.defineProperty(target, name, { get: all[name], enumerable: true }); } return target; };`;

async function fixFile(filePath) {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Check if file uses __exportAll from an import
    const importMatch = content.match(/import\s+\{\s*[^}]*\bs\s+as\s+__exportAll[^}]*\}\s+from\s+"\.\/[^"]+\.js";/);

    if (importMatch) {
        // Remove the import statement
        content = content.replace(importMatch[0], '');
        modified = true;

        // Add __exportAll and __defProp if not already present
        if (!content.includes('var __defProp = Object.defineProperty;')) {
            // Insert at the beginning
            content = `var __defProp = Object.defineProperty;\n${exportAllCode}\n${content}`;
        } else if (!content.includes('var __exportAll =')) {
            // Insert after __defProp
            content = content.replace(
                /var __defProp = Object\.defineProperty;/,
                `var __defProp = Object.defineProperty;\n${exportAllCode}`
            );
        }
    }

    if (modified) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Fixed: ${path.basename(filePath)}`);
        return true;
    }
    return false;
}

async function main() {
    console.log('Scanning dist directory for __exportAll imports...');

    const files = await fs.readdir(distDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));

    let fixedCount = 0;
    for (const file of jsFiles) {
        const filePath = path.join(distDir, file);
        if (await fixFile(filePath)) {
            fixedCount++;
        }
    }

    console.log(`Fixed ${fixedCount} files.`);
}

main().catch(console.error);
