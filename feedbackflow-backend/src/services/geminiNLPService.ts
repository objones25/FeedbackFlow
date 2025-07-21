import { GoogleGenAI, Type } from '@google/genai';
import { ValidationError, ExternalApiError } from '@/utils/errors';

export interface StructuredFeedback {
  readonly sentiment: {
    readonly primary: 'positive' | 'negative' | 'neutral';
    readonly confidence: number;
    readonly emotions: readonly string[];
  };
  readonly category: 'bug_report' | 'feature_request' | 'complaint' | 'praise' | 'question' | 'discussion';
  readonly themes: readonly string[];
  readonly urgency: 'low' | 'medium' | 'high' | 'critical';
  readonly summary: string;
  readonly suggestedResponse?: string;
  readonly actionItems: readonly string[];
  readonly keyPhrases: readonly string[];
}

export class GeminiNLPService {
  private readonly ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is required for Gemini NLP service');
    }
    
    this.ai = new GoogleGenAI({ apiKey });
  }

  private validateText(text: string): void {
    if (!text || text.trim() === '') {
      throw new ValidationError('Text cannot be empty');
    }

    if (text.length > 30000) {
      throw new ValidationError('Text is too long (max 30,000 characters)');
    }
  }

  private getResponseSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        sentiment: {
          type: Type.OBJECT,
          properties: {
            primary: {
              type: Type.STRING,
              enum: ['positive', 'negative', 'neutral']
            },
            confidence: {
              type: Type.NUMBER
            },
            emotions: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          },
          required: ['primary', 'confidence', 'emotions']
        },
        category: {
          type: Type.STRING,
          enum: ['bug_report', 'feature_request', 'complaint', 'praise', 'question', 'discussion']
        },
        themes: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
        urgency: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high', 'critical']
        },
        summary: {
          type: Type.STRING
        },
        suggestedResponse: {
          type: Type.STRING
        },
        actionItems: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        },
        keyPhrases: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      },
      required: ['sentiment', 'category', 'themes', 'urgency', 'summary', 'actionItems', 'keyPhrases']
    };
  }

  private createAnalysisPrompt(text: string): string {
    return `
Analyze the following feedback text and provide a structured analysis.

Text to analyze: "${text}"

Guidelines:
- sentiment.primary: Overall emotional tone (positive, negative, or neutral)
- sentiment.confidence: How confident you are in the sentiment (0.0-1.0)
- sentiment.emotions: Specific emotions detected (frustrated, excited, confused, etc.)
- category: Primary type of feedback (bug_report, feature_request, complaint, praise, question, discussion)
- themes: Main topics/subjects discussed (performance, ui/ux, pricing, etc.)
- urgency: How quickly this needs attention (low, medium, high, critical)
- summary: Brief, clear summary of what the user is saying (1-2 sentences)
- suggestedResponse: Optional suggested response if you can provide a helpful one
- actionItems: What should be done about this feedback
- keyPhrases: Important phrases that capture the essence

Provide a thorough analysis based on the content and context of the feedback.
`;
  }

  public async analyzeStructuredFeedback(text: string): Promise<StructuredFeedback> {
    this.validateText(text);

    try {
      const prompt = this.createAnalysisPrompt(text);
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getResponseSchema()
        }
      });

      if (!response.text) {
        throw new ExternalApiError('Gemini', 'No response text received', 500);
      }

      // Parse the JSON response
      const analysis = JSON.parse(response.text) as Record<string, unknown>;

      // Validate and sanitize the response
      const baseStructuredFeedback = {
        sentiment: {
          primary: this.validateSentiment(analysis.sentiment && typeof analysis.sentiment === 'object' ? (analysis.sentiment as Record<string, unknown>).primary : undefined),
          confidence: this.validateConfidence(analysis.sentiment && typeof analysis.sentiment === 'object' ? (analysis.sentiment as Record<string, unknown>).confidence : undefined),
          emotions: Array.isArray(analysis.sentiment && typeof analysis.sentiment === 'object' ? (analysis.sentiment as Record<string, unknown>).emotions : undefined) 
            ? ((analysis.sentiment as Record<string, unknown>).emotions as string[]).slice(0, 5) // Limit to 5 emotions
            : [],
        },
        category: this.validateCategory(analysis.category),
        themes: Array.isArray(analysis.themes) 
          ? (analysis.themes as string[]).slice(0, 10) // Limit to 10 themes
          : [],
        urgency: this.validateUrgency(analysis.urgency),
        summary: typeof analysis.summary === 'string' 
          ? analysis.summary.slice(0, 500) // Limit summary length
          : 'No summary provided',
        actionItems: Array.isArray(analysis.actionItems) 
          ? (analysis.actionItems as string[]).slice(0, 10) // Limit to 10 action items
          : [],
        keyPhrases: Array.isArray(analysis.keyPhrases) 
          ? (analysis.keyPhrases as string[]).slice(0, 15) // Limit to 15 key phrases
          : [],
      };

      // Add suggestedResponse only if it exists and is not empty
      const structuredFeedback: StructuredFeedback = typeof analysis.suggestedResponse === 'string' && analysis.suggestedResponse.trim() !== ''
        ? {
            ...baseStructuredFeedback,
            suggestedResponse: analysis.suggestedResponse.slice(0, 1000)
          }
        : baseStructuredFeedback;

      return structuredFeedback;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new ExternalApiError(
          'Gemini',
          'Failed to parse structured analysis response',
          500
        );
      }

      throw new ExternalApiError(
        'Gemini',
        `Structured feedback analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  public async batchAnalyzeStructuredFeedback(texts: readonly string[]): Promise<StructuredFeedback[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new ValidationError('Texts array cannot be empty');
    }

    if (texts.length > 20) {
      throw new ValidationError('Batch size cannot exceed 20 texts for Gemini analysis');
    }

    // Validate all texts first
    texts.forEach((text, index) => {
      try {
        this.validateText(text);
      } catch (error) {
        throw new ValidationError(`Text at index ${index} is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Process with some delay to respect rate limits
    const results: StructuredFeedback[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text) continue;
      
      const analysis = await this.analyzeStructuredFeedback(text);
      results.push(analysis);
      
      // Add delay between requests to respect rate limits
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return results;
  }

  private validateSentiment(sentiment: unknown): 'positive' | 'negative' | 'neutral' {
    const validSentiments = ['positive', 'negative', 'neutral'];
    return validSentiments.includes(sentiment as string) ? sentiment as 'positive' | 'negative' | 'neutral' : 'neutral';
  }

  private validateConfidence(confidence: unknown): number {
    const conf = parseFloat(String(confidence));
    if (isNaN(conf)) return 0.5;
    return Math.max(0, Math.min(1, conf));
  }

  private validateCategory(category: unknown): StructuredFeedback['category'] {
    const validCategories = ['bug_report', 'feature_request', 'complaint', 'praise', 'question', 'discussion'];
    return validCategories.includes(category as string) ? category as StructuredFeedback['category'] : 'discussion';
  }

  private validateUrgency(urgency: unknown): StructuredFeedback['urgency'] {
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    return validUrgencies.includes(urgency as string) ? urgency as StructuredFeedback['urgency'] : 'low';
  }


  public async healthCheck(): Promise<boolean> {
    try {
      // Use a simple test that's less likely to hit rate limits
      const testAnalysis = await this.analyzeStructuredFeedback('Good service.');
      return testAnalysis.sentiment.primary !== undefined && 
             testAnalysis.category !== undefined &&
             testAnalysis.summary !== undefined;
    } catch (error) {
      console.warn('Gemini NLP service health check failed:', error instanceof Error ? error.message : 'Unknown error');
      // Return true if it's just a rate limit issue, false for other errors
      if (error instanceof Error && error.message.includes('rate limit')) {
        return true; // Service is healthy, just rate limited
      }
      return false;
    }
  }

  public getModelInfo(): Record<string, string> {
    return {
      model: 'gemini-2.0-flash-001',
      provider: 'Google',
      capabilities: 'structured_analysis',
    };
  }
}
