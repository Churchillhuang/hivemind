# Fix Build Errors for Node.js 22

## Changes made on remote server (192.168.122.123):

### 1. Update tsconfig.json lib to ES2023
```json
{
  "compilerOptions": {
    "lib": ["ES2023"]  // Changed from "ES2022"
  }
}
```

### 2. Install type declarations
```bash
pnpm add -Dw @types/qrcode-terminal @grammyjs/types @types/ws @types/express
```

## To reproduce locally:
```bash
# Update tsconfig.json
cd /root/.openclaw/workspace/hivemind-fix
sed -i 's/"lib": \["ES2022"\]/"lib": ["ES2023"]/' tsconfig.json

# Install types
pnpm add -Dw @types/qrcode-terminal @grammyjs/types @types/ws @types/express

# Build
pnpm build
```

## Remaining build errors:
- `moduleResolution` needs to be set to "bundler" or "node16"
- `allowImportingTsExtensions` issues
- Undici types conflicts

These are pre-existing issues, not related to our Bug #1 and #2 fixes.
