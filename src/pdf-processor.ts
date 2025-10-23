// src/pdf-processor.ts
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { PDFPage } from "./config/types.js";

/**
 * Process uploaded PDF files and extract page-wise content
 */
export async function processPDFFiles(files: Express.Multer.File[]): Promise<PDFPage[]> {
  const allPages: PDFPage[] = [];

  for (const file of files) {
    const pages = await extractPDFPages(file);
    allPages.push(...pages);
  }

  return allPages;
}

/**
 * Extract pages from a single PDF file
 */
async function extractPDFPages(file: Express.Multer.File): Promise<PDFPage[]> {
  try {
    const loader = new PDFLoader(file.path, {
      splitPages: true,
      parsedItemSeparator: "\n"
    });

    const docs = await loader.load();
    const filename = file.originalname;

    return docs.map((doc: Document, index: number) => ({
      filename,
      pageNumber: index + 1,
      pageText: doc.pageContent.trim(),
      fileType: "pdf" as const
    }));
  } catch (error) {
    throw new Error(`Failed to process PDF ${file.originalname}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Format PDF pages for model context
 */
export function formatPagesForContext(pages: PDFPage[]): string {
  return pages
    .map(page => 
      `[Document: ${page.filename}, Page: ${page.pageNumber}]\n${page.pageText}`
    )
    .join("\n\n---\n\n");
}
