import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { createTestLeafModel } from "./models/index.js";

/**
 * Optimized model creation with switch case for all providers
 */
export function createChatModel(): BaseChatModel {
  const provider = (process.env.MODEL_PROVIDER || "groq").toLowerCase().trim();
  const temperature = Number(process.env.TEMPERATURE ?? 0.1);

  // Validate temperature
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    throw new Error(`Invalid temperature: ${process.env.TEMPERATURE}. Must be between 0 and 2.`);
  }

  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required when MODEL_PROVIDER=openai");
      }

      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxTokens: Number(process.env.MAX_TOKENS) || undefined
      }) as unknown as BaseChatModel;
    }

    case "claude":
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      const model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";

      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is required when MODEL_PROVIDER=claude");
      }

      return new ChatAnthropic({
        apiKey,
        model,
        temperature,
        maxTokens: Number(process.env.MAX_TOKENS) || 4096
      }) as unknown as BaseChatModel;
    }

    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

      if (!apiKey) {
        throw new Error("GROQ_API_KEY is required when MODEL_PROVIDER=groq");
      }

      return new ChatGroq({
        apiKey,
        model,
        temperature,
        maxTokens: Number(process.env.MAX_TOKENS) || undefined
      }) as unknown as BaseChatModel;
    }

    case "testleaf": {
      const apiKey = process.env.TESTLEAF_API_KEY;
      const model = process.env.TESTLEAF_MODEL ?? "ft:gpt-4o-mini-2024-07-18:testleaf::B5pmju86";
      const baseURL = process.env.TESTLEAF_BASE_URL;
      const maxTokens = Number(process.env.MAX_TOKENS) || undefined;

      if (!apiKey) {
        throw new Error("TESTLEAF_API_KEY is required when MODEL_PROVIDER=testleaf");
      }

      return createTestLeafModel({
        apiKey,
        model,
        temperature,
        baseURL, 
        maxTokens
      }) as unknown as BaseChatModel;
    }

    default:
      throw new Error(
        `Unsupported MODEL_PROVIDER: "${provider}". ` +
        `Supported providers: openai, claude, groq, testleaf`
      );
  }
}

/**
 * Get information about the current model configuration
 */
export function getModelInfo(): {
  provider: string;
  model: string;
  temperature: number;
} {
  const provider = (process.env.MODEL_PROVIDER || "groq").toLowerCase().trim();
  const temperature = Number(process.env.TEMPERATURE ?? 0.1);

  let model = "unknown";
  switch (provider) {
    case "openai":
      model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      break;
    case "claude":
    case "anthropic":
      model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
      break;
    case "groq":
      model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      break;
    case "testleaf":
      model = process.env.TESTLEAF_MODEL ?? "ft:gpt-4o-mini-2024-07-18:testleaf::B5pmju86";
      break;
  }

  return { provider, model, temperature };
}
