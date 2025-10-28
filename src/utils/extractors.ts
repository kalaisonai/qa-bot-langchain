import { ExtractionResult } from "../types/resume.js";

/**
 * Extract contact information from resume text using regex patterns
 */
export function extractResumeInfo(text: string): ExtractionResult {
  // Email regex pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = text.match(emailRegex);
  
  // Phone number regex pattern (supports various formats)
  // Matches: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?(?:\d{3})\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  const phoneMatch = text.match(phoneRegex);
  
  // Remove all whitespace from phone number
  const cleanedPhone = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : null;
  
  return {
    email: emailMatch ? emailMatch[0] : null,
    phoneNumber: cleanedPhone,
    fullContent: text.trim()
  };
}
