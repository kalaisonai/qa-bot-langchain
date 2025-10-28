import "dotenv/config";
import express from "express";
import { MongoClient } from "mongodb";
import { createChatModel, getModelInfo } from "./lib/models/index.js";
import { buildQAChain, loadDocumentToString } from "./lib/index.js";
import { ResumeVectorStore } from "./lib/vectorstore/index.js";
import { RetrievalPipeline } from "./pipelines/index.js";
import { 
  InvokeSchema, 
  InvokeBody, 
  InvokeResult, 
  SearchRequestSchema,
  SearchRequest,
  SearchResponse,
  ErrorResponse 
} from "./types/index.js";
import { config } from "./config/index.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Initialize retrieval pipeline (will be set up on server start)
let retrievalPipeline: RetrievalPipeline | null = null;
let mongoClient: MongoClient | null = null;

// Health check endpoint
app.get("/health", (req, res) => {
  const modelInfo = getModelInfo();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    model: modelInfo,
    retrievalPipeline: retrievalPipeline ? "ready" : "not initialized"
  });
});

// Resume search endpoint (keyword, vector, hybrid)
app.post("/search/resumes", async (req, res) => {
  const traceId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    console.log(`\n[${traceId}] === SEARCH REQUEST RECEIVED ===`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Request Body:`, JSON.stringify(req.body, null, 2));

    // Validate request
    const parsed = SearchRequestSchema.parse(req.body as SearchRequest);
    
    console.log(`[${traceId}] Request validated`);
    console.log(`  Query: "${parsed.query}"`);
    console.log(`  Search Type: ${parsed.searchType}`);
    console.log(`  Top-K: ${parsed.topK}`);

    // Check if retrieval pipeline is ready
    if (!retrievalPipeline) {
      throw new Error("Retrieval pipeline not initialized. Please ensure MongoDB is connected.");
    }

    // Perform search using retrieval pipeline
    const results = await retrievalPipeline.search(
      parsed.query,
      parsed.searchType,
      parsed.topK,
      traceId
    );

    const duration = Date.now() - startTime;

    console.log(`[${traceId}] Search completed in ${duration}ms`);
    console.log(`[${traceId}] Found ${results.length} results`);

    // Build response
    const response: SearchResponse = {
      query: parsed.query,
      searchType: parsed.searchType,
      topK: parsed.topK,
      resultCount: results.length,
      duration,
      results,
      metadata: {
        traceId,
        ...(parsed.searchType === "hybrid" && {
          hybridWeights: {
            vector: config.hybridSearch.vectorWeight,
            keyword: config.hybridSearch.keywordWeight,
          },
        }),
      },
    };

    console.log(`📤 [${traceId}] Sending response to client`);
    console.log(`====================================\n`);

    res.json(response);
  } catch (err: any) {
    const duration = Date.now() - startTime;
    
    console.error(`\n[${traceId}] === SEARCH ERROR ===`);
    console.error(`Error:`, err.message ?? String(err));
    console.error(`Duration: ${duration}ms`);
    console.error(`Stack:`, err.stack);
    console.error(`====================================\n`);

    const errorResponse: ErrorResponse = {
      error: err.message ?? String(err),
      details: err.stack,
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(errorResponse);
  }
});

app.post("/search/document", async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`\n[${requestId}] === NEW REQUEST RECEIVED ===`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Request Body:`, JSON.stringify(req.body, null, 2));

    const parsed = InvokeSchema.parse(req.body as InvokeBody);
    
    console.log(`[${requestId}] Request validated successfully`);
    console.log(`Question: "${parsed.question}"`);
    console.log(`Document source: ${parsed.documentPath ? `File: ${parsed.documentPath}` : `Inline text (${parsed.documentText?.length || 0} chars)`}`);
    console.log(`Prompt type: ${parsed.promptType || 'default'}`);

    const document =
      parsed.documentText ??
      (await loadDocumentToString(parsed.documentPath as string));

    console.log(`[${requestId}] Document loaded: ${document.length} characters`);

    const modelInfo = getModelInfo();
    console.log(`[${requestId}] Using model: ${modelInfo.provider}/${modelInfo.model}`);

    const model = createChatModel();
    const chain = buildQAChain(model, parsed.promptType);

    console.log(`[${requestId}] Processing with QA chain...`);
    const startTime = Date.now();

    const output = await chain.invoke({
      document,
      question: parsed.question
    });

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Chain processing completed in ${duration}ms`);
    console.log(`[${requestId}] Output length: ${output.length} characters`);

    const result: InvokeResult = {
      output,
      model: modelInfo.model,
      provider: modelInfo.provider,
      promptType: parsed.promptType || "default"
    };

    console.log(`📤 [${requestId}] Sending response to client`);
    console.log(`====================================\n`);

    res.json(result);
  } catch (err: any) {
    console.error(`\n[${requestId}] === REQUEST ERROR ===`);
    console.error(`Error:`, err.message ?? String(err));
    console.error(`Stack:`, err.stack);
    console.error(`====================================\n`);

    res.status(400).json({ error: err.message ?? String(err) });
  }
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "localhost";
const serverUrl = process.env.SERVER_URL ?? `http://${host}:${port}`;

/**
 * Initialize retrieval pipeline on server startup
 */
async function initializeRetrievalPipeline() {
  try {
    console.log("Initializing Retrieval Pipeline...");
    
    // Create MongoDB client
    const uri = config.mongodb.uri;
    if (!uri) {
      throw new Error("MONGODB_URI not configured");
    }
    
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    console.log("Connected to MongoDB");
    
    // Get collection
    const db = mongoClient.db(config.mongodb.dbName);
    const collection = db.collection(config.mongodb.collection);
    
    // Determine the correct API key based on embedding provider
    const embeddingApiKey = config.embeddings.provider === 'mistral'
      ? config.mistral.apiKey
      : config.openai.apiKey;
    
    if (!embeddingApiKey) {
      throw new Error(`API key not configured for embedding provider: ${config.embeddings.provider}`);
    }
    
    // Create vector store with full config
    const vectorStore = new ResumeVectorStore({
      mongoUri: config.mongodb.uri,
      dbName: config.mongodb.dbName,
      collectionName: config.mongodb.collection,
      indexName: config.mongodb.vectorIndexName,
      embeddingProvider: config.embeddings.provider,
      embeddingModel: config.embeddings.model,
      apiKey: embeddingApiKey,
    });
    
    // Initialize vector store
    await vectorStore.initialize();
    
    // Initialize retrieval pipeline with hybrid config
    retrievalPipeline = new RetrievalPipeline(
      collection,
      vectorStore,
      {
        vectorWeight: config.hybridSearch.vectorWeight,
        keywordWeight: config.hybridSearch.keywordWeight
      }
    );
    
    console.log("Retrieval Pipeline initialized");
    console.log(`   - Database: ${config.mongodb.dbName}`);
    console.log(`   - Collection: ${config.mongodb.collection}`);
    console.log(`   - Vector Index: ${config.mongodb.vectorIndexName}`);
    console.log(`   - Hybrid Weights: vector=${config.hybridSearch.vectorWeight}, keyword=${config.hybridSearch.keywordWeight}`);
    
  } catch (error) {
    console.error("Failed to initialize retrieval pipeline:", error);
    console.error("   The /search/resumes endpoint will not be available");
    console.error("   Please check your MongoDB connection and configuration");
  }
}

app.listen(port, async () => {
  const modelInfo = getModelInfo();
  console.log(`QA Bot API listening on ${serverUrl}`);
  console.log(`Provider: ${modelInfo.provider}`);
  console.log(`Model: ${modelInfo.model}`);
  console.log(`Temperature: ${modelInfo.temperature}`);
  
  // Initialize retrieval pipeline after server starts
  await initializeRetrievalPipeline();
  console.log("Server ready!");
});
