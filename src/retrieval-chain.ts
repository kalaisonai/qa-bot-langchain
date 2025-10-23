// src/retrieval-chain.ts
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Runnable } from "@langchain/core/runnables";
import { SourceReference, RetrievalResult } from "./config/types.js";
import { RETRIEVAL_SYSTEM_PROMPT } from "./config/prompts.js";

/**
 * Build a retrieval chain that returns sources with page numbers
 */
export function buildRetrievalChain(model: BaseChatModel): Runnable {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", RETRIEVAL_SYSTEM_PROMPT],
    ["human", "{question}"]
  ]);

  return prompt.pipe(model).pipe(new StringOutputParser());
}

/**
 * Parse and validate the model's response
 */
export function parseRetrievalResponse(response: string): RetrievalResult {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.answer || !Array.isArray(parsed.sources)) {
      throw new Error("Invalid response structure");
    }

    // Validate and clean sources
    const sources = parsed.sources.map((source: any) => ({
      document: String(source.document || ""),
      page: Number(source.page || 0),
      relevance_score: Number(source.relevance_score || 0),
      snippet: source.snippet ? String(source.snippet) : undefined
    })).filter((s: SourceReference) => s.document && s.page > 0);

    return {
      answer: parsed.answer,
      sources: sources.sort((a: SourceReference, b: SourceReference) => 
        b.relevance_score - a.relevance_score
      )
    };
  } catch (error) {
    console.error("Failed to parse retrieval response:", error);
    console.error("Raw response:", response);
    
    // Fallback: return the raw response as answer with no sources
    return {
      answer: response,
      sources: []
    };
  }
}
