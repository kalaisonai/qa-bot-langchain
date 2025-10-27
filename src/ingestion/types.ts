export interface ResumeData {
  name: string;
  email: string;
  phoneNumber: string;
  fullContent: string;
  fileName: string;
  processedAt: Date;
}

export interface ExtractionResult {
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  fullContent: string;
}
