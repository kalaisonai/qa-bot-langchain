import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { SearchResultItem } from "../../types/search.js";

/**
 * Schema for LLM response when filtering and ranking resumes
 */
const ResumeMatchSchema = z.object({
  fileName: z.string(),
  relevanceScore: z.number().min(0).max(1),
  reasoning: z.string(),
  matchesCriteria: z.boolean(),
  extractedInfo: z.object({
    currentCompany: z.string().optional(),
    skills: z.array(z.string()).optional(),
    experience: z.string().optional(),
    keyHighlights: z.array(z.string()).optional(),
  }).optional(),
});

const LLMRerankResponseSchema = z.object({
  matches: z.array(ResumeMatchSchema),
  summary: z.string(),
});

export type ResumeMatch = z.infer<typeof ResumeMatchSchema>;
export type LLMRerankResponse = z.infer<typeof LLMRerankResponseSchema>;

/**
 * LLM-based re-ranking and filtering engine
 * Analyzes resume content semantically to filter based on query criteria
 */
export class LLMReranker {
  private model: BaseChatModel;
  private promptTemplate: ChatPromptTemplate;

  constructor(model: BaseChatModel) {
    this.model = model;
    this.promptTemplate = this.createPromptTemplate();
  }

  /**
   * Create the prompt template using ICEPOT structure
   * I - Instructions
   * C - Context
   * E - Examples
   * P - Persona
   * O - Output format
   * T - Tone
   */
  private createPromptTemplate(): ChatPromptTemplate {
    const systemPrompt = `## PERSONA
You are an expert HR analyst and resume reviewer with 15+ years of experience in candidate evaluation and technical recruitment. You specialize in matching candidates to specific job requirements with precision and honesty.

## INSTRUCTIONS
Your task is to analyze resumes and determine which candidates match the user's query criteria.

[CRITICAL] Only mark a resume as matching if it EXPLICITLY satisfies ALL criteria in the query
[CRITICAL] Extract current company information - look for "current", "present", recent dates without end dates
[IMPORTANT] Provide evidence-based assessments - if information is not in the resume, state it clearly
[IMPORTANT] Score resumes objectively based on how well they match the specific criteria (0.0 to 1.0)
[DO NOT] assume or infer information that isn't explicitly stated
[DO NOT] mark resumes as matching if they only partially meet criteria
[DO NOT] confuse past employers with current employers

## CONTEXT
You will receive:
1. A user query with specific requirements (e.g., skills, current company, experience level)
2. Multiple candidate resumes with their content

Your goal is to identify which resumes meet ALL the requirements and rank them by relevance.

## ANALYSIS PROCESS
Step 1: Parse the user query to identify ALL required criteria:
   - Current company (if specified)
   - Skills/technologies (if specified)
   - Experience level/years (if specified)
   - Any other specific requirements

Step 2: For each resume, extract:
   - Current company: Look for employment section with no end date, "present", "current", or most recent position
   - Relevant skills: Technologies, tools, methodologies mentioned
   - Experience details: Years, roles, responsibilities
   - Key highlights: Certifications, achievements, projects

Step 3: Evaluate match:
   - Does the candidate currently work at the specified company? (if query mentions company)
   - Does the candidate have the required skills? (if query mentions skills)
   - Does the candidate meet experience requirements? (if query mentions experience)
   - ALL criteria must be met for matchesCriteria=true

Step 4: Score the resume:
   - 0.9-1.0: Perfect match - meets ALL criteria with strong evidence
   - 0.7-0.89: Strong match - meets ALL criteria with good evidence
   - 0.5-0.69: Partial match - meets some but not all criteria
   - 0.3-0.49: Weak match - tangentially related but missing key criteria
   - 0.0-0.29: No match - doesn't meet the primary criteria

## EXAMPLES

### Example 1: Company + Skills Query
Query: "Find automation engineer currently with HCL"

Resume A Content:
"...Senior Automation Engineer at HCL Technologies (2023 - Present). Expertise in Selenium, Python automation..."

Analysis:
- currentCompany: "HCL Technologies" ✓
- skills: ["Selenium", "Python", "Automation Testing"] ✓
- matchesCriteria: true
- relevanceScore: 0.95
- reasoning: "Candidate is currently employed at HCL Technologies as Senior Automation Engineer since 2023. Has relevant automation skills."

Resume B Content:
"...Automation Engineer at HCL Technologies (2020-2022). Currently working at Infosys as Lead Engineer..."

Analysis:
- currentCompany: "Infosys" ✗ (not HCL anymore)
- skills: ["Automation"] ✓
- matchesCriteria: false
- relevanceScore: 0.35
- reasoning: "Candidate previously worked at HCL but currently works at Infosys. Does not meet 'currently with HCL' requirement."

### Example 2: Skills + Experience Query
Query: "Find senior Java developer with 8+ years experience in microservices"

Resume C Content:
"...10 years of experience in Java development. Currently working on microservices architecture using Spring Boot..."

Analysis:
- experience: "10 years in Java" ✓
- skills: ["Java", "Microservices", "Spring Boot"] ✓
- matchesCriteria: true
- relevanceScore: 0.92
- reasoning: "Candidate has 10 years Java experience (exceeds 8+ requirement) and explicitly works with microservices architecture."

### Example 3: Specific Company Without Evidence
Query: "Find candidates currently with Google"

Resume D Content:
"...Software Engineer with 5 years experience in cloud platforms and distributed systems..."

Analysis:
- currentCompany: "Not mentioned" ✗
- matchesCriteria: false
- relevanceScore: 0.15
- reasoning: "Resume does not mention current employer. Cannot verify if candidate works at Google. Query requires explicit company match."

## OUTPUT FORMAT
Return a valid JSON object with this exact structure:

{{
  "matches": [
    {{
      "fileName": "resume_name.pdf",
      "relevanceScore": 0.95,
      "matchesCriteria": true,
      "reasoning": "Detailed explanation of why this resume matches or doesn't match",
      "extractedInfo": {{
        "currentCompany": "Company Name or 'Not mentioned'",
        "skills": ["skill1", "skill2", "skill3"],
        "experience": "X years in Y domain",
        "keyHighlights": ["highlight1", "highlight2"]
      }}
    }}
  ],
  "summary": "Overall summary of findings - how many matches, key observations"
}}

## TONE
- Professional and objective
- Evidence-based and factual
- Honest about uncertainties
- Clear and concise
- No assumptions or speculation`;

    const humanPrompt = `## USER QUERY
{query}

## CANDIDATE RESUMES TO ANALYZE
{resumesContext}

## YOUR TASK
Analyze each resume against the query criteria using the ICEPOT methodology described above.

Remember:
- Extract current company accurately (not past employers)
- Only set matchesCriteria=true if ALL query requirements are met
- Provide honest scoring based on evidence in the resume
- Include clear reasoning with specific evidence from the resume content

## CRITICAL OUTPUT REQUIREMENT
You MUST return ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text.
Return ONLY the raw JSON object starting with {{ and ending with }}.

The JSON must follow this exact structure:
{{
  "matches": [
    {{
      "fileName": "resume_name.pdf",
      "relevanceScore": 0.95,
      "matchesCriteria": true,
      "reasoning": "Explanation here",
      "extractedInfo": {{
        "currentCompany": "Company Name",
        "skills": ["skill1", "skill2"],
        "experience": "X years",
        "keyHighlights": ["highlight1"]
      }}
    }}
  ],
  "summary": "Overall summary"
}}

Return your JSON response now:`;


    return ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", humanPrompt],
    ]);
  }

  /**
   * Re-rank and filter results using LLM analysis
   * @param query - The user's search query with specific criteria
   * @param candidates - Initial search results from vector/hybrid search
   * @param traceId - Trace ID for logging
   * @returns Filtered and re-ranked results with LLM reasoning
   */
  async rerankAndFilter(
    query: string,
    candidates: SearchResultItem[],
    traceId: string
  ): Promise<{
    results: SearchResultItem[];
    llmAnalysis: {
      summary: string;
      matches: ResumeMatch[];
    };
  }> {
    if (candidates.length === 0) {
      return {
        results: [],
        llmAnalysis: {
          summary: "No candidates to analyze",
          matches: [],
        },
      };
    }

    console.log(`[${traceId}] [LLM Reranker] Analyzing ${candidates.length} candidates with LLM`);

    // Format resumes for LLM analysis - truncate long fullContent
    const resumesContext = candidates
      .map((candidate, index) => {
        const truncatedContent = candidate.fullContent.length > 3000
          ? candidate.fullContent.slice(0, 3000) + "\n...[content truncated for analysis]"
          : candidate.fullContent;

        return `
### Resume ${index + 1}: ${candidate.fileName}
**Email:** ${candidate.email}
**Phone:** ${candidate.phoneNumber}
**Content:**
${truncatedContent}
`;
      })
      .join("\n" + "=".repeat(80) + "\n");

    // Invoke LLM with structured output
    const formattedPrompt = await this.promptTemplate.format({
      query,
      resumesContext,
    });

    console.log(`[${traceId}] [LLM Reranker] Invoking LLM for semantic analysis`);

    try {
      // Call LLM
      const response = await this.model.invoke(formattedPrompt);
      const responseText = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      // Parse JSON response
      let parsedResponse: LLMRerankResponse;
      try {
        // Try multiple extraction strategies
        let jsonStr = responseText;
        
        // Strategy 1: Extract from markdown code blocks
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
        } else {
          // Strategy 2: Find JSON object in text (look for { ... })
          const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
          }
        }
        
        const rawJson = JSON.parse(jsonStr.trim());
        parsedResponse = LLMRerankResponseSchema.parse(rawJson);
      } catch (parseError) {
        console.error(`[${traceId}] [LLM Reranker] Failed to parse LLM response:`, parseError);
        console.error(`[${traceId}] [LLM Reranker] Raw response preview:`, responseText.slice(0, 500));
        console.log(`[${traceId}] [LLM Reranker] Full response:`, responseText);
        
        // Fallback: return original results with warning
        return {
          results: candidates,
          llmAnalysis: {
            summary: "Failed to parse LLM response. Returning original vector search results without filtering.",
            matches: candidates.map(c => ({
              fileName: c.fileName,
              relevanceScore: c.score,
              reasoning: "LLM parsing failed - using original vector search score",
              matchesCriteria: true,
            })),
          },
        };
      }

      // Filter and re-rank based on LLM analysis
      const rerankedResults: SearchResultItem[] = [];

      for (const match of parsedResponse.matches) {
        // Only include results that match ALL criteria
        if (!match.matchesCriteria) {
          console.log(
            `[${traceId}] [LLM Reranker] - Filtered out ${match.fileName} (score: ${match.relevanceScore})`
          );
          console.log(`[${traceId}] [LLM Reranker]    Reason: ${match.reasoning}`);
          continue;
        }

        // Find original candidate
        const originalCandidate = candidates.find(c => c.fileName === match.fileName);
        if (!originalCandidate) {
          console.warn(`[${traceId}] [LLM Reranker] Warning: ${match.fileName} not found in original candidates`);
          continue;
        }

        // Create enhanced result with LLM score and metadata
        rerankedResults.push({
          ...originalCandidate,
          score: match.relevanceScore,
          matchType: "llm-reranked" as any,
          // @ts-ignore - Adding extra metadata for response
          llmReasoning: match.reasoning,
          extractedInfo: match.extractedInfo,
        });
      }

      // Sort by LLM relevance score (descending)
      rerankedResults.sort((a, b) => b.score - a.score);

      console.log(
        `[${traceId}] [LLM Reranker] ✅ Results: ${candidates.length} retrieved → ${rerankedResults.length} matched criteria`
      );
      console.log(`[${traceId}] [LLM Reranker] Summary: ${parsedResponse.summary}`);

      return {
        results: rerankedResults,
        llmAnalysis: {
          summary: parsedResponse.summary,
          matches: parsedResponse.matches,
        },
      };
    } catch (error) {
      console.error(`[${traceId}] [LLM Reranker] ❌ Error during LLM analysis:`, error);
      
      // Return original results on error
      return {
        results: candidates,
        llmAnalysis: {
          summary: `Error during LLM analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Returning unfiltered results.`,
          matches: candidates.map(c => ({
            fileName: c.fileName,
            relevanceScore: c.score,
            reasoning: "Error during LLM analysis - score from vector search",
            matchesCriteria: true,
          })),
        },
      };
    }
  }
}
