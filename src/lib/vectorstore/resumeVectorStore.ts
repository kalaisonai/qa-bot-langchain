import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { Document } from "@langchain/core/documents";
import { MongoClient } from "mongodb";

export interface VectorStoreConfig {
  mongoUri: string;
  dbName: string;
  collectionName: string;
  indexName?: string;
  embeddingModel?: string;
  apiKey?: string;
}

/**
 * LangChain-native MongoDB Vector Store wrapper
 * Uses MongoDBAtlasVectorSearch for built-in vector search capabilities
 */
export class ResumeVectorStore {
  private client: MongoClient;
  private vectorStore: MongoDBAtlasVectorSearch | null = null;
  private embeddings: OpenAIEmbeddings;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.client = new MongoClient(config.mongoUri);
    
    // Initialize embeddings (OpenAI by default)
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey || process.env.OPENAI_API_KEY,
      modelName: config.embeddingModel || "text-embedding-3-small"
    });
  }

  /**
   * Initialize the vector store connection
   */
  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      
      const collection = this.client
        .db(this.config.dbName)
        .collection(this.config.collectionName);

      this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
        collection,
        indexName: this.config.indexName || "vector_index",
        textKey: "fullContent",
        embeddingKey: "embedding"
      });

      console.log(`Connected to MongoDB Vector Store: ${this.config.dbName}.${this.config.collectionName}`);
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add resume documents with automatic embedding generation
   */
  async addResumes(resumes: Array<{
    email: string;
    phoneNumber: string;
    fullContent: string;
    fileName: string;
  }>): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    // Convert to LangChain Documents
    const documents = resumes.map((resume) => 
      new Document({
        pageContent: resume.fullContent,
        metadata: {
          email: resume.email,
          phoneNumber: resume.phoneNumber,
          fileName: resume.fileName,
          processedAt: new Date().toISOString()
        }
      })
    );

    try {
      await this.vectorStore.addDocuments(documents);
      console.log(`Added ${resumes.length} resumes with embeddings`);
    } catch (error) {
      throw new Error(`Failed to add resumes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Semantic search across resumes
   */
  async searchResumes(query: string, topK: number = 5): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, topK);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Semantic search with relevance scores
   */
  async searchWithScores(query: string, topK: number = 5): Promise<Array<[Document, number]>> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, topK);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection(): Promise<void> {
    try {
      const collection = this.client
        .db(this.config.dbName)
        .collection(this.config.collectionName);
      
      const result = await collection.deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from collection`);
    } catch (error) {
      throw new Error(`Failed to clear collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the MongoDB connection
   */
  async close(): Promise<void> {
    await this.client.close();
    console.log("MongoDB connection closed");
  }

  /**
   * Get the underlying vector store for advanced operations
   */
  getVectorStore(): MongoDBAtlasVectorSearch {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }
    return this.vectorStore;
  }
}
