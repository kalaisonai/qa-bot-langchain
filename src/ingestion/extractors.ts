import { ExtractionResult } from "./types.js";

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
  
  // Name extraction - typically at the beginning of resume
  // Look for lines with capitalized words (2-4 words) near the top
  const nameRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/m;
  const nameMatch = text.match(nameRegex);
  
  // Alternative name pattern - look for common patterns like "Name:" or first significant capitalized text
  let extractedName = nameMatch ? nameMatch[1] : null;
  
  if (!extractedName) {
    // Try to find name from first few lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      // Check if line looks like a name (2-4 capitalized words, reasonable length)
      if (line.length > 3 && line.length < 50 && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line)) {
        extractedName = line;
        break;
      }
    }
  }
  
  return {
    name: extractedName,
    email: emailMatch ? emailMatch[0] : null,
    phoneNumber: phoneMatch ? phoneMatch[0] : null,
    fullContent: text.trim()
  };
}
