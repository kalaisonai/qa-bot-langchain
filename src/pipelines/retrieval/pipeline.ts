import { Collection } from "mongodb";
import { ResumeVectorStore } from "../../lib/vectorstore/index.js";
import { KeywordSearchEngine } from "./keywordSearch.js";
import { VectorSearchEngine } from "./vectorSearch.js";
import { HybridSearchEngine, HybridSearchConfig } from "./hybridSearch.js";
import { SearchResultItem, SearchMetadata } from "./types.js";

/**
 * Main retrieval pipeline orchestrating all search types
 */
export class RetrievalPipeline {
  private keywordEngine: KeywordSearchEngine;
  private vectorEngine: VectorSearchEngine;
  private hybridEngine: HybridSearchEngine;
  private isInitialized = false;

  constructor(
    collection: Collection,
    vectorStore: ResumeVectorStore,
    hybridConfig: HybridSearchConfig
  ) {
    // Initialize search engines
    this.keywordEngine = new KeywordSearchEngine(collection);
    this.vectorEngine = new VectorSearchEngine(vectorStore);
    this.hybridEngine = new HybridSearchEngine(
      this.keywordEngine,
      this.vectorEngine,
      hybridConfig
    );

    this.isInitialized = true;
    console.log("[Retrieval Pipeline] Initialized successfully");
    console.log(`[Retrieval Pipeline] Hybrid weights: vector=${hybridConfig.vectorWeight}, keyword=${hybridConfig.keywordWeight}`);
  }

  /**
   * Execute search based on type
   */
  async search(
    query: string,
    searchType: "keyword" | "pm25" | "hybrid",
    topK: number,
    traceId: string
  ): Promise<SearchResultItem[]> {
    if (!this.isInitialized) {
      throw new Error("Retrieval pipeline not initialized");
    }

    const metadata: SearchMetadata = {
      traceId,
      startTime: Date.now(),
      searchType,
    };

    console.log(`[${traceId}] [Retrieval Pipeline] Executing ${searchType} search`);

    let results: SearchResultItem[];

    switch (searchType) {
      case "keyword":
        results = await this.keywordEngine.search(query, topK, metadata);
        break;

      case "pm25":
        results = await this.vectorEngine.search(query, topK, metadata);
        break;

      case "hybrid":
        results = await this.hybridEngine.search(query, topK, metadata);
        break;

      default:
        throw new Error(`Unknown search type: ${searchType}`);
    }

    const duration = Date.now() - metadata.startTime;
    console.log(
      `[${traceId}] [Retrieval Pipeline] Search completed in ${duration}ms, ` +
      `returned ${results.length} results`
    );

    return results;
  }

  /**
   * Perform keyword search
   */
  async keywordSearch(query: string, topK: number, traceId: string): Promise<SearchResultItem[]> {
    return this.search(query, "keyword", topK, traceId);
  }

  /**
   * Perform vector search (PM25)
   */
  async vectorSearch(query: string, topK: number, traceId: string): Promise<SearchResultItem[]> {
    return this.search(query, "pm25", topK, traceId);
  }

  /**
   * Perform hybrid search
   */
  async hybridSearch(query: string, topK: number, traceId: string): Promise<SearchResultItem[]> {
    return this.search(query, "hybrid", topK, traceId);
  }

  /**
   * Update hybrid search weights dynamically
   */
  updateHybridWeights(vectorWeight: number, keywordWeight: number): void {
    this.hybridEngine.updateWeights(vectorWeight, keywordWeight);
  }

  /**
   * Get current hybrid weights
   */
  getHybridWeights(): HybridSearchConfig {
    return this.hybridEngine.getWeights();
  }

  /**
   * Check if pipeline is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
