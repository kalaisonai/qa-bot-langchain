import { z } from "zod";

// ============================================
// DOCUMENT PROCESSING TYPES
// ============================================

/**
 * Represents a page from any document type
 */
export interface DocumentPage {
  filename: string;
  pageNumber: number;
  pageText: string;
  fileType: "pdf" | "docx" | "txt" | "md";
}

/**
 * Legacy: PDF-specific page (kept for backwards compatibility)
 * @deprecated Use DocumentPage instead
 */
export type PDFPage = DocumentPage;

// ============================================
// SOURCE REFERENCE TYPES
// ============================================

export interface SourceReference {
  document: string;
  page: number;
  relevance_score: number;
  snippet?: string;
}

export interface RetrievalResult {
  answer: string;
  sources: SourceReference[];
}

// ============================================
// LEGACY TYPES (Backwards Compatibility)
// ============================================

export const InvokeSchema = z.object({
  question: z.string().min(1),
  documentPath: z.string().optional(),
  documentText: z.string().optional(),
  promptType: z.enum(["default", "detailed", "concise", "technical"]).optional()
}).refine(v => !!(v.documentPath || v.documentText), {
  message: "Provide either documentPath or documentText"
});

export type InvokeBody = z.infer<typeof InvokeSchema>;

export type InvokeResult = {
  output: string;
  model: string;
  provider: string;
  promptType?: string;
};

// ============================================
// API RESPONSE TYPES
// ============================================

// API Response Types
export interface InvokeWithFilesResult {
  question: string;
  answer: string;
  sources: SourceReference[];
  model: string;
  provider: string;
  filesProcessed: number;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
