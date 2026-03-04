import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCliRuntimeCapture } from "../test-runtime-capture.js";

const startGatewayServer = vi.fn(async (_port: number, _opts?: unknown) => ({
  close: vi.fn(async () => {}),
}));
const setGatewayWsLogStyle = vi.fn((_style: string) => undefined);
const setVerbose = vi.fn((_enabled: boolean) => undefined);
const forceFreePortAndWait = vi.fn(async (_port: number, _opts: unknown) => ({
  killed: [],
  waitedMs: 0,
  escalatedToSigkill: false,
}));
const ensureDevGatewayConfig = vi.fn(async (_opts?: unknown) => {});
const runGatewayLoop = vi.fn(async ({ start }: { start: () => Promise<unknown> }) => {
  await start();
});
const hiveInitialize = vi.fn(async () => {});
const hiveShutdown = vi.fn(async () => {});
const hiveEnsureGatewayBridge = vi.fn(async () => {});
let mockConfig: Record<string, unknown> = {};

const { runtimeErrors, defaultRuntime, resetRuntimeCapture } = createCliRuntimeCapture();

vi.mock("../../config/config.js", () => ({
  getConfigPath: () => "/tmp/openclaw-test-missing-config.json",
  loadConfig: () => mockConfig,
  readConfigFileSnapshot: async () => ({ exists: false }),
  resolveStateDir: () => "/tmp",
  resolveGatewayPort: () => 18789,
}));

vi.mock("../../gateway/auth.js", () => ({
  resolveGatewayAuth: (params: { authConfig?: { token?: string }; env?: NodeJS.ProcessEnv }) => ({
    mode: "token",
    token: params.authConfig?.token ?? params.env?.OPENCLAW_GATEWAY_TOKEN,
    password: undefined,
    allowTailscale: false,
  }),
}));

vi.mock("../../gateway/server.js", () => ({
  startGatewayServer: (port: number, opts?: unknown) => startGatewayServer(port, opts),
}));

vi.mock("../../gateway/ws-logging.js", () => ({
  setGatewayWsLogStyle: (style: string) => setGatewayWsLogStyle(style),
}));

vi.mock("../../globals.js", () => ({
  setVerbose: (enabled: boolean) => setVerbose(enabled),
}));

vi.mock("../../infra/gateway-lock.js", () => ({
  GatewayLockError: class GatewayLockError extends Error {},
}));

vi.mock("../../infra/ports.js", () => ({
  formatPortDiagnostics: () => [],
  inspectPortUsage: async () => ({ status: "free" }),
}));

vi.mock("../../logging/console.js", () => ({
  setConsoleSubsystemFilter: () => undefined,
  setConsoleTimestampPrefix: () => undefined,
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../command-format.js", () => ({
  formatCliCommand: (cmd: string) => cmd,
}));

vi.mock("../ports.js", () => ({
  forceFreePortAndWait: (port: number, opts: unknown) => forceFreePortAndWait(port, opts),
}));

vi.mock("./dev.js", () => ({
  ensureDevGatewayConfig: (opts?: unknown) => ensureDevGatewayConfig(opts),
}));

vi.mock("./run-loop.js", () => ({
  runGatewayLoop: (params: { start: () => Promise<unknown> }) => runGatewayLoop(params),
}));

vi.mock("../../events/EventBus.js", () => ({
  getGlobalEventBus: () => ({ publish: vi.fn(async () => {}) }),
  EventBus: class EventBus {},
}));

vi.mock("../../hive/HiveConfig.js", () => ({
  DEFAULT_HIVE_CONFIG: {
    enabled: false,
    mode: "single",
    eventBus: { maxHistorySize: 1000 },
    orchestrator: { maxAgents: 10, idleTimeout: 30000, negotiationTimeout: 5000 },
    stateMachine: { persist: true, checkpointInterval: 10000, checkpointPath: "/tmp/state.json" },
    agents: {
      system: {
        interface: { enabled: true },
        memory: { enabled: true },
        memoryGateway: { enabled: true },
        orchestrator: { enabled: true },
        reflection: { enabled: true },
      },
      functional: { enabled: true, maxConcurrent: 5, lifespan: "task" },
    },
    skillLearning: {
      enabled: true,
      sharedSkillsPath: "shared_skills/",
      agentSkillsPath: "agent_skills/",
      minSuccessThreshold: 0.8,
    },
    memory: {
      layers: {
        orchestrator: "none",
        interface: "session",
        functional: "task",
        memory: "knowledge",
        reflection: "sample",
      },
      retention: { sessionDays: 2, sampleDays: 14, taskMaxFiles: 10 },
      indexing: {
        enableSemanticSearch: true,
        enableVectorCache: true,
        workspacePath: "/tmp/workspace",
        memoryPath: "/tmp/workspace/memory",
      },
    },
    agentModels: {
      tierMapping: {
        nano: "distilbert-base",
        light: "llama-7b",
        standard: "llama-13b",
        heavy: "llama-70b",
      },
      system: {
        orchestrator: { tier: "light" },
        interface: { tier: "standard" },
        memory: { tier: "nano" },
        reflection: { tier: "standard" },
      },
      functional: {
        default: { tier: "light" },
        overrides: {},
      },
    },
  },
}));

vi.mock("../../hive/HiveManager.js", () => ({
  HiveManager: class {
    async initialize() {
      await hiveInitialize();
    }
    async ensureGatewayBridge() {
      await hiveEnsureGatewayBridge();
      return undefined;
    }
    async shutdown() {
      await hiveShutdown();
    }
  },
}));

describe("gateway run option collisions", () => {
  let addGatewayRunCommand: typeof import("./run.js").addGatewayRunCommand;
  let sharedProgram: Command;

  beforeAll(async () => {
    ({ addGatewayRunCommand } = await import("./run.js"));
    sharedProgram = new Command();
    sharedProgram.exitOverride();
    const gateway = addGatewayRunCommand(sharedProgram.command("gateway"));
    addGatewayRunCommand(gateway.command("run"));
  });

  beforeEach(() => {
    mockConfig = {};
    resetRuntimeCapture();
    startGatewayServer.mockClear();
    setGatewayWsLogStyle.mockClear();
    setVerbose.mockClear();
    forceFreePortAndWait.mockClear();
    ensureDevGatewayConfig.mockClear();
    runGatewayLoop.mockClear();
    hiveInitialize.mockClear();
    hiveEnsureGatewayBridge.mockClear();
    hiveShutdown.mockClear();
  });

  async function runGatewayCli(argv: string[]) {
    await sharedProgram.parseAsync(argv, { from: "user" });
  }

  function expectAuthOverrideMode(mode: string) {
    expect(startGatewayServer).toHaveBeenCalledWith(
      18789,
      expect.objectContaining({
        auth: expect.objectContaining({
          mode,
        }),
      }),
    );
  }

  it("forwards parent-captured options to `gateway run` subcommand", async () => {
    await runGatewayCli([
      "gateway",
      "run",
      "--token",
      "tok_run",
      "--allow-unconfigured",
      "--ws-log",
      "full",
      "--force",
    ]);

    expect(forceFreePortAndWait).toHaveBeenCalledWith(18789, expect.anything());
    expect(setGatewayWsLogStyle).toHaveBeenCalledWith("full");
    expect(startGatewayServer).toHaveBeenCalledWith(
      18789,
      expect.objectContaining({
        auth: expect.objectContaining({
          token: "tok_run",
        }),
      }),
    );
  });

  it("starts gateway when token mode has no configured token (startup bootstrap path)", async () => {
    await runGatewayCli(["gateway", "run", "--allow-unconfigured"]);

    expect(startGatewayServer).toHaveBeenCalledWith(
      18789,
      expect.objectContaining({
        bind: "loopback",
      }),
    );
  });

  it("accepts --auth none override", async () => {
    await runGatewayCli(["gateway", "run", "--auth", "none", "--allow-unconfigured"]);

    expectAuthOverrideMode("none");
  });

  it("accepts --auth trusted-proxy override", async () => {
    await runGatewayCli(["gateway", "run", "--auth", "trusted-proxy", "--allow-unconfigured"]);

    expectAuthOverrideMode("trusted-proxy");
  });

  it("prints all supported modes on invalid --auth value", async () => {
    await expect(
      runGatewayCli(["gateway", "run", "--auth", "bad-mode", "--allow-unconfigured"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors).toContain(
      'Invalid --auth (use "none", "token", "password", or "trusted-proxy")',
    );
  });

  it("enables hive runtime with --hive", async () => {
    await runGatewayCli(["gateway", "run", "--allow-unconfigured", "--hive"]);
    expect(hiveInitialize).toHaveBeenCalledTimes(1);
    expect(hiveEnsureGatewayBridge).toHaveBeenCalledTimes(1);
    expect(hiveShutdown).toHaveBeenCalledTimes(0);
  });

  it("enables hive runtime from config gateway.hive.enabled", async () => {
    mockConfig = {
      gateway: {
        hive: {
          enabled: true,
          mode: "multi",
        },
      },
    };

    await runGatewayCli(["gateway", "run", "--allow-unconfigured"]);
    expect(hiveInitialize).toHaveBeenCalledTimes(1);
  });

  it("does not start hive when config mode is single", async () => {
    mockConfig = {
      gateway: {
        hive: {
          enabled: true,
          mode: "single",
        },
      },
    };

    await runGatewayCli(["gateway", "run", "--allow-unconfigured"]);
    expect(hiveInitialize).toHaveBeenCalledTimes(0);
  });

  it("allows CLI --hive-mode to override config mode", async () => {
    mockConfig = {
      gateway: {
        hive: {
          enabled: true,
          mode: "single",
        },
      },
    };

    await runGatewayCli(["gateway", "run", "--allow-unconfigured", "--hive-mode", "multi"]);
    expect(hiveInitialize).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid --hive-mode", async () => {
    await expect(
      runGatewayCli([
        "gateway",
        "run",
        "--allow-unconfigured",
        "--hive",
        "--hive-mode",
        "bad-mode",
      ]),
    ).rejects.toThrow("__exit__:1");
    expect(runtimeErrors).toContain('Gateway failed to start: Error: Invalid --hive-mode (use "single" or "multi")');
  });
});
