import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";
import { DocumentPage } from "../config/index.js";

/**
 * PDF-specific loader for processing PDF files
 */
export class PDFDocumentLoader {
  /**
   * Process uploaded PDF files and extract page-wise content
   */
  static async processFiles(files: Express.Multer.File[]): Promise<DocumentPage[]> {
    const allPages: DocumentPage[] = [];

    for (const file of files) {
      const pages = await this.extractPages(file);
      allPages.push(...pages);
    }

    return allPages;
  }

  /**
   * Extract pages from a single PDF file
   */
  private static async extractPages(file: Express.Multer.File): Promise<DocumentPage[]> {
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
        fileType: "pdf"
      }));
    } catch (error) {
      throw new Error(
        `Failed to process PDF ${file.originalname}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format PDF pages for model context
   */
  static formatPagesForContext(pages: DocumentPage[]): string {
    return pages
      .map(page => `[Document: ${page.filename}, Page: ${page.pageNumber}]\n${page.pageText}`)
      .join("\n\n---\n\n");
  }
}
