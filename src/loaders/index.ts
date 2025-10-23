// src/loaders/index.ts
/**
 * Document Loaders
 * 
 * This package contains loaders for different document types.
 * Each loader is responsible for:
 * - Processing uploaded files
 * - Extracting page-wise content
 * - Formatting content for model context
 */

export { PDFDocumentLoader } from "./pdf.loader.js";

// Future loaders can be added here:
// export { DOCXDocumentLoader } from "./docx.loader.js";
// export { MarkdownDocumentLoader } from "./markdown.loader.js";
// export { TextDocumentLoader } from "./text.loader.js";
