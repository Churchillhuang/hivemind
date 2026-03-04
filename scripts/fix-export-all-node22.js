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

async function fixRuntimeFile(filePath) {
    // Check if this is a rolldown-runtime file
    if (!path.basename(filePath).startsWith('rolldown-runtime-')) {
        return false;
    }

    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Remove Symbol.toStringTag setting to avoid "Cannot convert object to primitive value" in Node.js 22
    if (content.includes('Symbol.toStringTag')) {
        content = content.replace(
            /if \(!no_symbols\) \{[\s\S]*?__defProp\(target, Symbol\.toStringTag, \{ value: "Module" \}\);[\s\S]*?\}/g,
            '/* Symbol.toStringTag removed for Node.js 22 compatibility */"'
        );
        
        // Also simplify the __exportAll function call
        content = content.replace(
            /var __exportAll = \(all, no_symbols\) => \{/g,
            'var __exportAll = (all) => {'
        );
        
        // Remove the no_symbols parameter usage
        content = content.replace(/__exportAll\(([^,]+),\s*[^)]+\)/g, '__exportAll($1)');
        
        modified = true;
        console.log(`Fixed: ${path.basename(filePath)} (removed Symbol.toStringTag)`);
    }

    if (modified) {
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    }
    return false;
}

async function fixFile(filePath) {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Check if file uses __exportAll from an import
    // Match: import { t as __exportAll } from "./rolldown-runtime-*.js";
    const importMatch = content.match(/import\s*\{\s*[^}]*\b[a-z]\s+as\s+__exportAll[^}]*\}\s+from\s+"\.\/[^"]+\.js";/);

    if (importMatch) {
        // Replace import with inline __exportAll function
        const exportAllInline = `var __defProp = Object.defineProperty;
var __exportAll = (all) => { let target = {}; for (var name in all) { __defProp(target, name, { get: all[name], enumerable: true }); } return target; };`;
        
        content = content.replace(importMatch[0], exportAllInline);
        modified = true;
        
        // Remove the second parameter (no_symbols) from ALL __exportAll calls
        // Pattern: __exportAll({...}, false) -> __exportAll({...})
        // Pattern: __exportAll({...}, true) -> __exportAll({...})
        content = content.replace(/,\s*(?:true|false)\s*(?=\)\s*[;,])/g, '');
        
        if (modified) {
            await fs.writeFile(filePath, content, 'utf8');
            console.log(`Fixed: ${path.basename(filePath)}`);
            return true;
        }
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
            
            // First try to fix runtime files
            if (await fixRuntimeFile(filePath)) {
                fixedCount++;
                continue;
            }
            
            // Then fix other files with __exportAll imports
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
