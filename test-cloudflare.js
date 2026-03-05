#!/usr/bin/env node
import { ProviderRegistry, streamSimple } from "@mariozechner/pi-ai";

console.log("Testing Cloudflare AI Gateway provider registration...\n");

const provider = {
  id: "custom-api-cloudflare-com",
  name: "Cloudflare AI Gateway Test",
  baseUrl: "https://api.cloudflare.com/client/v4/accounts/1c8ccb59c67e37ff30b0009d51d105a1/ai/v1",
  auth: "api-key",
};

const testModel = {
  id: "@cf/openai/gpt-oss-120b",
  name: "Test Model",
  api: "openai-completions",
  provider: "custom-api-cloudflare-com",
  reasoning: false,
  input: ["text"],
  baseUrl: "https://api.cloudflare.com/client/v4/accounts/1c8ccb59c67e37ff30b0009d51d105a1/ai/v1",
};

console.log("Provider:", JSON.stringify(provider, null, 2));
console.log("\nModel:", JSON.stringify(testModel, null, 2));

const registry = new ProviderRegistry();
registry.setApiProvider("openai-completions", provider);

console.log("\n--- Testing model resolution ---");
const resolved = registry.findModel("custom-api-cloudflare-com", "@cf/openai/gpt-oss-120b");
console.log("Resolved model:", resolved ? "Found" : "Not found");

if (resolved) {
  console.log("Resolved model details:", {
    id: resolved.id,
    provider: resolved.provider,
    api: resolved.api,
    baseUrl: resolved.baseUrl,
  });

  const context = {
    apiKey: "XxCSmw8UoLd8a1bkmCRG2nD5aZUbz-T2yS1c4vRR",
    messages: [
      { role: "user", content: "Hi" }
    ],
  };

  console.log("\n--- Testing streamSimple ---");
  try {
    const stream = streamSimple(resolved, context, {});
    console.log("Stream created successfully");

    for await (const chunk of stream) {
      console.log("Chunk:", chunk);
      break;
    }
  } catch (e) {
    console.error("Error:", e.message);
    console.error("Stack:", e.stack);
  }
}
