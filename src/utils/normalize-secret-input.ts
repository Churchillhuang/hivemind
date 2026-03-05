/**
 * Secret normalization for copy/pasted credentials.
 *
 * Common footgun: line breaks (especially `\r`) embedded in API keys/tokens.
 * We strip line breaks anywhere, then trim whitespace at the ends.
 *
 * Intentionally does NOT remove ordinary spaces inside the string to avoid
 * silently altering "Bearer <token>" style values.
 */
import { isSecretRef, type SecretRef } from "../config/types.secrets.js";

export function normalizeSecretInput(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\r\n\u2028\u2029]+/g, "").trim();
}

/**
 * Resolve a SecretRef to its actual value.
 * Currently only supports 'env' source (environment variables).
 */
function resolveSecretRefToString(ref: SecretRef): string | undefined {
  if (ref.source === "env") {
    return process.env[ref.id];
  }
  // Other source types (file, exec) not supported in this context
  return undefined;
}

export function normalizeOptionalSecretInput(value: unknown): string | undefined {
  // Handle SecretRef objects
  if (isSecretRef(value)) {
    return resolveSecretRefToString(value);
  }

  const normalized = normalizeSecretInput(value);
  return normalized ? normalized : undefined;
}
