/**
 * Integration test for custom provider API key resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCustomProviderApiKey } from "../agents/model-auth.js";
import type { OpenClawConfig } from "../config/config.js";

describe("getCustomProviderApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("plaintext API keys", () => {
    it("should return plaintext API key from config", () => {
      const config: OpenClawConfig = {
        models: {
          providers: {
            "custom-test": {
              baseUrl: "https://api.example.com/v1",
              apiKey: "sk-plaintext-123",
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      expect(getCustomProviderApiKey(config, "custom-test")).toBe("sk-plaintext-123");
    });

    it("should return undefined if API key is missing", () => {
      const config: OpenClawConfig = {
        models: {
          providers: {
            "custom-test": {
              baseUrl: "https://api.example.com/v1",
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      expect(getCustomProviderApiKey(config, "custom-test")).toBeUndefined();
    });
  });

  describe("SecretRef API keys", () => {
    it("should resolve env SecretRef", () => {
      process.env.CUSTOM_API_KEY = "sk-env-123";

      const config: OpenClawConfig = {
        models: {
          providers: {
            "custom-test": {
              baseUrl: "https://api.example.com/v1",
              apiKey: {
                source: "env",
                id: "CUSTOM_API_KEY",
                provider: "custom-test",
              },
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      expect(getCustomProviderApiKey(config, "custom-test")).toBe("sk-env-123");
    });

    it("should return undefined for missing env var", () => {
      delete process.env.MISSING_KEY;

      const config: OpenClawConfig = {
        models: {
          providers: {
            "custom-test": {
              baseUrl: "https://api.example.com/v1",
              apiKey: {
                source: "env",
                id: "MISSING_KEY",
                provider: "custom-test",
              },
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      expect(getCustomProviderApiKey(config, "custom-test")).toBeUndefined();
    });

    it("should resolve CUSTOM_API_KEY env var", () => {
      process.env.CUSTOM_API_KEY = "sk-custom-456";

      const config: OpenClawConfig = {
        models: {
          providers: {
            "custom-provider": {
              baseUrl: "https://api.custom.com/v1",
              apiKey: {
                source: "env",
                id: "CUSTOM_API_KEY",
                provider: "custom-provider",
              },
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      expect(getCustomProviderApiKey(config, "custom-provider")).toBe("sk-custom-456");
    });
  });

  describe("provider normalization", () => {
    it("should handle normalized provider IDs", () => {
      process.env.CUSTOM_API_KEY = "sk-normalized-123";

      const config: OpenClawConfig = {
        models: {
          providers: {
            Custom_Test: {
              baseUrl: "https://api.example.com/v1",
              apiKey: {
                source: "env",
                id: "CUSTOM_API_KEY",
                provider: "Custom_Test",
              },
              api: "openai-completions",
              models: [],
            },
          },
        },
      };

      // Should normalize to 'custom-test'
      expect(getCustomProviderApiKey(config, "custom-test")).toBe("sk-normalized-123");
    });
  });
});
