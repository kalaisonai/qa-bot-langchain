/**
 * TestLeaf Chat Model Implementation
 * Follows standard OpenAI/Groq format (system, assistant, user)
 */

import { BaseChatModel, BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

export interface TestLeafConfig extends BaseChatModelParams {
  apiKey: string;
  model: string;
  temperature?: number;
  baseURL?: string;
  maxTokens?: number;
}

/**
 * TestLeaf Chat Model
 * Compatible with OpenAI/Groq API format
 */
export class ChatTestLeaf extends BaseChatModel {
  apiKey: string;
  model: string;
  temperature: number;
  baseURL: string;
  maxTokens?: number;

  constructor(config: TestLeafConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.1;
    this.baseURL = config.baseURL || "https://api.testleaf.com/ai/v1";
    this.maxTokens = config.maxTokens;
  }

  _llmType(): string {
    return "testleaf";
  }

  /**
   * Convert LangChain messages to OpenAI/Groq standard format
   * Roles: system, assistant, user (standard format)
   */
  private convertMessages(messages: BaseMessage[]): any[] {
    return messages.map((msg) => {
      const msgType = msg._getType();
      let role = "user";

      // Standard OpenAI/Groq roles
      if (msgType === "system") role = "system";
      else if (msgType === "ai") role = "assistant";
      else if (msgType === "human") role = "user";

      return {
        role,
        content: msg.content as string
      };
    });
  }

  /**
   * Generate chat completions using TestLeaf API
   */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const endpoint = `${this.baseURL}/chat/completions`;
    const requestBody: any = {
      model: this.model,
      messages: this.convertMessages(messages),
      temperature: this.temperature
    };

    if (this.maxTokens) {
      requestBody.max_tokens = this.maxTokens;
    }

    // Log outgoing request
    console.log('\n🚀 === TESTLEAF API REQUEST ===');
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`🤖 Model: ${this.model}`);
    console.log(`🌡️  Temperature: ${this.temperature}`);
    console.log(`💬 Messages count: ${messages.length}`);
    console.log(`🔑 API Key: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    console.log(`📤 Request Body:`, JSON.stringify(requestBody, null, 2));

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      console.log(`\n📥 === TESTLEAF API RESPONSE ===`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error Response:`, errorText);
        throw new Error(`TestLeaf API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      console.log(`✅ Response received successfully`);
      console.log(`📝 Content length: ${content.length} characters`);
      console.log(`🔢 Token usage:`, data.usage || 'N/A');
      console.log(`💰 Model used: ${data.model || this.model}`);
      console.log(`📄 Response preview: ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}`);
      console.log(`=================================\n`);

      const generation: ChatGeneration = {
        text: content,
        message: new AIMessage(content)
      };

      return {
        generations: [generation],
        llmOutput: {
          tokenUsage: data.usage,
          model: data.model
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ === TESTLEAF API ERROR ===`);
      console.error(`⏱️  Duration: ${duration}ms`);
      console.error(`🔥 Error:`, error instanceof Error ? error.message : String(error));
      console.error(`===============================\n`);
      throw error;
    }
  }
}

/**
 * Factory function to create TestLeaf chat model
 */
export function createTestLeafModel(config: TestLeafConfig): ChatTestLeaf {
  return new ChatTestLeaf(config);
}
