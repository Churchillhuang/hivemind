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
const exportAllCode = `var __exportAll = (target) => { for (var name in all) { var desc = Object.getOwnPropertyDescriptor(all, name); if (desc && (desc.get || desc.set)) { Object.defineProperty(target, name, desc); } else { target[name] = all[name]; } } return target; };\nvar __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);\nvar __copyProps = (to, from, except, desc) => { if (from && typeof from === "object" || typeof from === "function") { for (let key of __getOwnPropNames(from)) { if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, { get: () => from[key], enumerable: !(desc = Object.getOwnPropertyDescriptor(from, key)) || desc.enumerable }); } } return to; };\nvar __getOwnPropNames = Object.getOwnPropertyNames;\nvar __hasOwnProp = Object.prototype.hasOwnProperty;\nvar __defProp = Object.defineProperty;`;

async function fixFile(filePath) {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Check if file uses __exportAll from an import
    const importMatch = content.match(/import\s*\{\s*[^}]*\bs\s+as\s+__exportAll[^}]*\}\s+from\s+"\.\/[^"]+\.js";/);

    if (importMatch) {
        // Remove the import statement
        content = content.replace(importMatch[0], '');
        modified = true;

        // Add __exportAll and __defProp if not already present
        if (!content.includes('var __defProp = Object.defineProperty;')) {
            // Insert at the beginning (after "use strict" if present)
            if (content.startsWith('"use strict";\n') || content.startsWith("'use strict';\n")) {
                content = content.replace(
                    /^(["'])use strict\1;?\n/,
                    `$&${exportAllCode}\n`
                );
            } else {
                content = `${exportAllCode}\n${content}`;
            }
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
    const jsFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('node_modules'));

    let fixedCount = 0;
    for (const file of jsFiles) {
        try {
            const filePath = path.join(distDir, file);
            if (await fixFile(filePath)) {
                fixedCount++;
            }
        } catch (e) {
            // Skip files that can't be read (directories, etc.)
        }
    }

    console.log(`Fixed ${fixedCount} files.`);
}

main().catch(console.error);
