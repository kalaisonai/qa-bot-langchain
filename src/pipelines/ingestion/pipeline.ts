import path from "node:path";
import { config } from "../../config/index.js";
import { ResumeVectorStore } from "../../lib/vectorstore/index.js";
import { loadDocument, getResumeFiles, extractResumeInfo } from "../../utils/index.js";

/**
 * Main ingestion pipeline with vector embeddings using LangChain
 */
export async function ingestResumes(clearExisting: boolean = false): Promise<void> {
  console.log("Starting resume ingestion pipeline with vector embeddings...\n");
  
  // Validate configuration
  if (!config.mongodb.uri) {
    throw new Error("MONGODB_URI is not set in .env file");
  }
  
  if (!config.openai.apiKey) {
    throw new Error("OPENAI_API_KEY is required for generating embeddings");
  }
  
  // Initialize LangChain MongoDB Vector Store
  const vectorStore = new ResumeVectorStore({
    mongoUri: config.mongodb.uri,
    dbName: config.mongodb.dbName,
    collectionName: config.mongodb.collection,
    indexName: config.mongodb.vectorIndexName,
    embeddingModel: config.embeddings.model,
    apiKey: config.openai.apiKey
  });
  
  try {
    // Connect to MongoDB
    await vectorStore.initialize();
    
    // Clear existing data if requested
    if (clearExisting) {
      console.log("Clearing existing resumes...");
      await vectorStore.clearCollection();
      console.log();
    }
    
    // Get all resume files
    console.log(`Reading documents from: ${config.documents.folder}`);
    const resumeFiles = await getResumeFiles(config.documents.folder);
    
    if (resumeFiles.length === 0) {
      console.log("No PDF or DOCX files found in documents folder");
      return;
    }
    
    console.log(`Found ${resumeFiles.length} resume(s)\n`);
    
    // Process each resume
    const resumesData: Array<{
      email: string;
      phoneNumber: string;
      fullContent: string;
      fileName: string;
    }> = [];
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const filePath of resumeFiles) {
      const fileName = path.basename(filePath);
      
      try {
        console.log(`Processing: ${fileName}...`);
        
        // Load document content
        const content = await loadDocument(filePath);
        
        // Extract information using regex
        const extractedInfo = extractResumeInfo(content);
        
        // Create resume data object
        const resumeData = {
          email: extractedInfo.email || "Not found",
          phoneNumber: extractedInfo.phoneNumber || "Not found",
          fullContent: extractedInfo.fullContent,
          fileName: fileName
        };
        
        resumesData.push(resumeData);
        
        console.log(`Email: ${resumeData.email}`);
        console.log(`Phone: ${resumeData.phoneNumber}`);
        console.log(`Content length: ${resumeData.fullContent.length} chars`);
        console.log();
        
        successCount++;
        
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error instanceof Error ? error.message : String(error));
        console.log();
        errorCount++;
      }
    }
    
    // Add all resumes with embeddings to MongoDB
    if (resumesData.length > 0) {
      console.log(`Generating embeddings and storing ${resumesData.length} resume(s)...`);
      console.log(`Using model: ${config.embeddings.model}`);
      await vectorStore.addResumes(resumesData);
      console.log();
    }
    
    // Summary
    console.log("Ingestion complete!");
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${resumeFiles.length}`);
    console.log(`Embeddings: Generated for ${resumesData.length} resumes`);

  } catch (error) {
    console.error("Ingestion failed:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Close MongoDB connection
    await vectorStore.close();
  }
}

/**
 * Run the ingestion pipeline if this script is executed directly
 * Usage: tsx src/pipelines/ingestion/pipeline.ts [--clear]
 */
async function main() {
  const clearExisting = process.argv.includes("--clear");
  
  try {
    await ingestResumes(clearExisting);
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.includes("pipeline")) {
  main();
}
