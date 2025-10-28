import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Model Provider
  modelProvider: (process.env.MODEL_PROVIDER || "groq").toLowerCase().trim(),
  temperature: Number(process.env.TEMPERATURE ?? 0.1),
  maxTokens: Number(process.env.MAX_TOKENS) || 4096,

  // Testleaf
  testleaf: {
    apiKey: process.env.TESTLEAF_API_KEY || "",
    model: process.env.TESTLEAF_MODEL || "gpt-4o-mini",
  },

  // Groq
  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    model: process.env.GROQ_MODEL || "",
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },

  // Anthropic
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || "",
    dbName: process.env.MONGODB_DB_NAME || "db_resumes",
    collection: process.env.MONGODB_COLLECTION || "resumes",
    vectorIndexName: process.env.MONGODB_VECTOR_INDEX || "resume_vector_index",
  },

  // Embeddings
  embeddings: {
    provider: process.env.EMBEDDING_PROVIDER || "openai",
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    dimension: Number(process.env.EMBEDDING_DIMENSION) || 1536,
  },

  // Documents
  documents: {
    folder: process.env.DOCUMENTS_FOLDER || "./documents",
  },

  // Server
  server: {
    url: process.env.SERVER_URL || "http://localhost:8787",
    port: Number(process.env.PORT) || 8787,
  },
} as const;

export type Config = typeof config;
