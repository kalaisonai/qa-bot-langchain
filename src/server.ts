import "dotenv/config";
import express from "express";
import multer from "multer";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { ModelFactory } from "./models/index.js";
import { RetrievalChain } from "./chains/index.js";
import { PDFDocumentLoader } from "./loaders/index.js";
import { InvokeWithFilesResult, ErrorResponse } from "./config/index.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (path.extname(file.originalname).toLowerCase() === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF documents are supported at this time."));
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  const modelInfo = ModelFactory.getModelInfo();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    model: modelInfo
  });
});

/**
 * Main invoke endpoint with file upload support
 * Accepts multipart/form-data with question and PDF files
 */
app.post("/search/documents", upload.array("files", 5), async (req, res) => {
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;

  try {
    // Validate request
    const { question } = req.body;
    
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({
        error: "Question is required and must be a non-empty string"
      } as ErrorResponse);
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        error: "At least one PDF file must be uploaded"
      } as ErrorResponse);
    }

    // Validate model supports this operation
    const modelInfo = ModelFactory.getModelInfo();
    const supportedProviders = ["openai", "claude", "anthropic", "groq"];
    
    if (!supportedProviders.includes(modelInfo.provider)) {
      return res.status(400).json({
        error: "The selected model does not support file attachments.",
        details: `Provider '${modelInfo.provider}' is not supported. Use: openai, claude, or groq`
      } as ErrorResponse);
    }

    // Process PDF files
    console.log(`📄 Processing ${uploadedFiles.length} PDF file(s)...`);
    const pages = await PDFDocumentLoader.processFiles(uploadedFiles);
    console.log(`Extracted ${pages.length} pages from ${uploadedFiles.length} document(s)`);

    // Format pages for context
    const context = PDFDocumentLoader.formatPagesForContext(pages);

    // Create model and chain
    const model = ModelFactory.createChatModel();
    const chain = RetrievalChain.build(model);

    // Invoke the chain
    console.log(`🤖 Invoking ${modelInfo.provider} model...`);
    const response = await chain.invoke({
      context,
      question: question.trim()
    });

    // Parse the response
    const result = RetrievalChain.parseResponse(response);

    // Build response
    const apiResponse: InvokeWithFilesResult = {
      question: question.trim(),
      answer: result.answer,
      sources: result.sources,
      model: modelInfo.model,
      provider: modelInfo.provider,
      filesProcessed: uploadedFiles.length
    };

    res.json(apiResponse);

  } catch (err: any) {
    console.error("Error processing request:", err);
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File too large. Maximum size is 10MB per file."
        } as ErrorResponse);
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          error: "Too many files. Maximum is 5 files per request."
        } as ErrorResponse);
      }
    }

    res.status(400).json({
      error: err.message ?? String(err)
    } as ErrorResponse);
  } finally {
    // Clean up uploaded files
    if (uploadedFiles) {
      for (const file of uploadedFiles) {
        try {
          await unlink(file.path);
        } catch (cleanupErr) {
          console.error(`Failed to delete ${file.path}:`, cleanupErr);
        }
      }
    }
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  const modelInfo = ModelFactory.getModelInfo();
  console.log(`QA Bot API listening on http://localhost:${port}`);
  console.log(`Provider: ${modelInfo.provider}`);
  console.log(`Model: ${modelInfo.model}`);
  console.log(`Temperature: ${modelInfo.temperature}`);
  console.log(`File upload: Enabled (PDF only, max 5 files)`);
});
