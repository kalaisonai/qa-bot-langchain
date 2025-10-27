import path from "node:path";
import dotenv from "dotenv";
import { MongoDBClient } from "./mongodb.js";
import { loadDocument, getResumeFiles } from "./documentLoader.js";
import { extractResumeInfo } from "./extractors.js";
import { ResumeData } from "./types.js";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "db_resumes";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "resumes";
const DOCUMENTS_FOLDER = process.env.DOCUMENTS_FOLDER || "./documents";

/**
 * Main ingestion pipeline that processes resumes and stores them in MongoDB
 */
export async function ingestResumes(clearExisting: boolean = false): Promise<void> {
  console.log("🚀 Starting resume ingestion pipeline...\n");
  
  // Validate configuration
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in .env file");
  }
  
  // Initialize MongoDB client
  const mongoClient = new MongoDBClient(MONGODB_URI, MONGODB_DB_NAME, MONGODB_COLLECTION);
  
  try {
    // Connect to MongoDB
    await mongoClient.connect();
    
    // Clear existing data if requested
    if (clearExisting) {
      console.log("🗑️  Clearing existing resumes...");
      await mongoClient.clearCollection();
      console.log();
    }
    
    // Get all resume files
    console.log(`📁 Reading documents from: ${DOCUMENTS_FOLDER}`);
    const resumeFiles = await getResumeFiles(DOCUMENTS_FOLDER);
    
    if (resumeFiles.length === 0) {
      console.log("⚠️  No PDF or DOCX files found in documents folder");
      return;
    }
    
    console.log(`📄 Found ${resumeFiles.length} resume(s)\n`);
    
    // Process each resume
    const resumesData: ResumeData[] = [];
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
        const resumeData: ResumeData = {
          name: extractedInfo.name || "Not found",
          email: extractedInfo.email || "Not found",
          phoneNumber: extractedInfo.phoneNumber || "Not found",
          fullContent: extractedInfo.fullContent,
          fileName: fileName,
          processedAt: new Date()
        };
        
        resumesData.push(resumeData);
        
        console.log(`  ✓ Name: ${resumeData.name}`);
        console.log(`  ✓ Email: ${resumeData.email}`);
        console.log(`  ✓ Phone: ${resumeData.phoneNumber}`);
        console.log();
        
        successCount++;
        
      } catch (error) {
        console.error(`  ✗ Error processing ${fileName}:`, error instanceof Error ? error.message : String(error));
        console.log();
        errorCount++;
      }
    }
    
    // Insert all resumes into MongoDB
    if (resumesData.length > 0) {
      console.log(`💾 Storing ${resumesData.length} resume(s) in MongoDB...`);
      await mongoClient.insertResumes(resumesData);
      console.log();
    }
    
    // Summary
    console.log("✅ Ingestion complete!");
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${resumeFiles.length}`);
    
  } catch (error) {
    console.error("❌ Ingestion failed:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoClient.close();
  }
}

/**
 * Run the ingestion pipeline if this script is executed directly
 * Usage: tsx src/ingestion/pipeline.ts [--clear]
 */
async function main() {
  const clearExisting = process.argv.includes("--clear");
  
  try {
    await ingestResumes(clearExisting);
    console.log("\n🎉 Done!");
    process.exit(0);
  } catch (error) {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.includes("pipeline")) {
  main();
}
