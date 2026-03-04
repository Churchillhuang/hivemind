# Deployment Bug Report

**Date:** 2026-03-04
**Repository:** OpenClaw / HiveMind
**Version:** 0.1.0 (commit 99ee348)

---

## 🐛 Bug #1: API Key Configuration Not Saved

### Summary
API key configuration verification passes successfully, but the configuration file (`~/.openclaw/agents/main/agent/auth-profiles.json`) is not created, causing all models to fail with "No API key found" errors.

### Steps to Reproduce
1. Run `openclaw models auth login` or `openclaw models auth add`
2. Provider credentials (e.g., Anthropic, NVIDIA) configuration
3. Verification passes successfully
4. Check file: `ls -la ~/.openclaw/agents/main/agent/auth-profiles.json`
5. Result: File does not exist

### Expected Behavior
- After successful configuration verification, `auth-profiles.json` should be created automatically
- All configured API keys should be persisted

### Actual Behavior
- Configuration verification passes but `auth-profiles.json` is not created
- All models fail with error: "No API key found for provider \"anthropic\""

### Error Logs
```
2026-03-04T12:39:06.667Z [diagnostic] lane task error: lane=session:agent:main:main durationMs=34 error="Error: No API key found for provider \"anthropic\". Auth store: /home/churchill/.openclaw/agents/main/agent/auth-profiles.json (agentDir: /home/chclaw/.openclaw/agents/main/agent). Configure auth for this agent (openclaw agents add <id>) or copy auth-profiles.json from the main agentDir."
```

### Temporary Workaround
Manually create `auth-profiles.json`:
```bash
mkdir -p ~/.openclaw/agents/main/agent
echo '{
  "anthropic": {
    "apiKey": "sk-ant-..."
  },
  "nvidia": {
    "apiKey": "nvapi-..."
  }
}' > ~/.openclaw/agents/main/agent/auth-profiles.json
```

### Impact
- **Severity:** Critical (prevents any model from running)
- **Components:** `models auth` command, configuration persistence
- **Affects:** All OpenClaw deployments requiring model API keys

---

## 🐛 Bug #2: Models List Shows All Available Models Instead of Configured Only

### Summary
`openclaw models list` command displays all available models in the system, regardless of whether their API keys are configured, making it confusing for users to see which models are actually usable.

### Steps to Reproduce
1. Run `openclaw models list`
2. Observe output showing models like:
   - `anthropic/claude-opus-4-6`
   - `vercel-ai-gateway/openai/gpt-oss-safeguard-20b`
3. Do not configure API keys for any provider
4. Models are still listed as available

### Expected Behavior
- Only show models that have configured API keys
- Or clearly distinguish between "configured" and "available but not configured" models
- Include authentication status (✓ configured, ✗ not configured)

### Actual Behavior
- All models are listed regardless of authentication status
- No indication of which models require configuration
- Users may attempt to use unconfigured models

### Example of Expected Output
```
Model                                      Ctx      Auth  Status
anthropic/claude-opus-4-6                  195k     ✓     Ready
nvidia/llama-3.1-70b-instruct              128k     ✓     Ready
openai/gpt-4                               128k     ✗     Not configured
```

### Impact
- **Severity:** Medium (UX issue, confusing)
- **Components:** `models list` command
- **Affects:** All OpenClaw deployments with multiple providers

---

## 📊 Test Environment

| Property | Value |
|----------|-------|
| OS | Linux Mint 22.3 (Ubuntu 24.04) |
| Node.js | v22.22.0 |
| pnpm | v10.30.3 |
| OpenClaw Version | 0.1.0 (99ee348) |
| Deployment | SSH remote (192.168.122.123) |

---

## 🔗 Related Issues

- None (first report)

---

## 📝 Additional Notes

1. **Bug #1** was discovered during deployment of HiveMind to a remote Linux Mint 22.3 system
2. A temporary workaround was used (manual creation of `auth-profiles.json`)
3. The configuration verification (`openclaw models auth login`) works correctly but doesn't persist
4. This suggests a timing or file write issue in the configuration save function

---

## 🚀 Next Steps

- [ ] Fix Bug #1: Ensure `auth-profiles.json` is created after successful configuration
- [ ] Fix Bug #2: Update `models list` to show authentication status
- [ ] Add tests for configuration persistence
- [ ] Improve error messages (indicate which providers need configuration)
