import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

interface ChatTestleafParams extends BaseChatModelParams {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

interface TestleafResponse {
  transaction: {
    response: {
      choices: Array<{
        message: {
          content: string;
          role: string;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
}

/**
 * Custom LangChain chat model for Testleaf API
 * Uses OpenAI-compatible format internally via Testleaf's proxy
 */
export class ChatTestleaf extends BaseChatModel {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl: string;

  constructor(fields?: ChatTestleafParams) {
    super(fields ?? {});
    
    this.apiKey = fields?.apiKey ?? process.env.TESTLEAF_API_KEY ?? "";
    this.model = fields?.model ?? "gpt-4o-mini";
    this.temperature = fields?.temperature ?? 0.2;
    this.maxTokens = fields?.maxTokens ?? 4096;
    this.baseUrl = fields?.baseUrl ?? "https://api.testleaf.com/ai/v1/chat/completions";

    if (!this.apiKey) {
      throw new Error("TESTLEAF_API_KEY is required for ChatTestleaf");
    }
  }

  _llmType(): string {
    return "testleaf";
  }

  /**
   * Convert LangChain messages to Testleaf API format
   */
  private formatMessages(messages: BaseMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => {
        let role: string;

        if (msg instanceof SystemMessage) {
        role = "system";
        } else if (msg instanceof AIMessage) {
        role = "assistant";
        } else if (msg instanceof HumanMessage) {
        role = "user";
        } else {
        role = "user"; // default fallback
        }

        const content =
        typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);

        return { role, content };
    });
    }

  /**
   * Main generation method - calls Testleaf API
   */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const formattedMessages = this.formatMessages(messages);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          temperature: this.temperature,
          max_completion_tokens: this.maxTokens,
          ...(options?.stop ? { stop: options.stop } : {})
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Testleaf API call failed: ${response.status} - ${errorText}`);
      }

      const data: TestleafResponse = await response.json();
      const choice = data.transaction.response.choices[0];
      
      if (!choice || !choice.message) {
        throw new Error("Invalid response from Testleaf API");
      }

      const generation: ChatGeneration = {
        text: choice.message.content,
        message: new AIMessageChunk({
          content: choice.message.content,
          additional_kwargs: {}
        }),
        generationInfo: {
          finish_reason: choice.finish_reason
        }
      };

      return {
        generations: [generation],
        llmOutput: {
          tokenUsage: {
            promptTokens: data.transaction.response.usage.prompt_tokens,
            completionTokens: data.transaction.response.usage.completion_tokens,
            totalTokens: data.transaction.response.usage.total_tokens
          }
        }
      };
    } catch (error) {
      console.error("Error calling Testleaf API:", error);
      throw error;
    }
  }
}