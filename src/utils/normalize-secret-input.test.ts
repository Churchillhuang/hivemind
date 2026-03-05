/**
 * Test normalizeOptionalSecretInput with SecretRef support
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SecretRef } from "../config/types.secrets.js";
import { normalizeOptionalSecretInput } from "./normalize-secret-input.js";

describe("normalizeOptionalSecretInput", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("plaintext strings", () => {
    it("should return trimmed string", () => {
      expect(normalizeOptionalSecretInput("  test-key  ")).toBe("test-key");
    });

    it("should remove line breaks", () => {
      expect(normalizeOptionalSecretInput("test\r\nkey\n")).toBe("testkey");
    });

    it("should return undefined for empty string", () => {
      expect(normalizeOptionalSecretInput("")).toBeUndefined();
      expect(normalizeOptionalSecretInput("   ")).toBeUndefined();
    });

    it("should return undefined for non-string values", () => {
      expect(normalizeOptionalSecretInput(null)).toBeUndefined();
      expect(normalizeOptionalSecretInput(undefined)).toBeUndefined();
      expect(normalizeOptionalSecretInput(123)).toBeUndefined();
    });
  });

  describe("SecretRef objects", () => {
    it("should resolve env SecretRef", () => {
      process.env.CUSTOM_API_KEY = "sk-test-123";
      const ref: SecretRef = {
        source: "env",
        id: "CUSTOM_API_KEY",
        provider: "custom-test",
      };
      expect(normalizeOptionalSecretInput(ref)).toBe("sk-test-123");
    });

    it("should return undefined for missing env var", () => {
      delete process.env.MISSING_KEY;
      const ref: SecretRef = {
        source: "env",
        id: "MISSING_KEY",
        provider: "custom-test",
      };
      expect(normalizeOptionalSecretInput(ref)).toBeUndefined();
    });

    it("should handle env var with whitespace", () => {
      process.env.CUSTOM_API_KEY = "  sk-test-456  ";
      const ref: SecretRef = {
        source: "env",
        id: "CUSTOM_API_KEY",
        provider: "custom-test",
      };
      // Note: env vars are returned as-is, not trimmed
      expect(normalizeOptionalSecretInput(ref)).toBe("  sk-test-456  ");
    });

    it("should return undefined for unsupported source types", () => {
      const ref: SecretRef = {
        source: "file",
        id: "/path/to/key",
        provider: "custom-test",
      };
      expect(normalizeOptionalSecretInput(ref)).toBeUndefined();
    });

    it("should return undefined for exec source", () => {
      const ref: SecretRef = {
        source: "exec",
        id: "get-api-key",
        provider: "custom-test",
      };
      expect(normalizeOptionalSecretInput(ref)).toBeUndefined();
    });
  });
});
