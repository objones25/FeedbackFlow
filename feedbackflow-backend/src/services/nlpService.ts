import { InferenceClient } from '@huggingface/inference';
import { SentimentAnalysis, SentimentLabel } from '@/types';
import { ExternalApiError, ValidationError } from '@/utils/errors';
import { config } from '@/config';

interface HuggingFaceClassificationResult {
  readonly label: string;
  readonly score: number;
}

interface HuggingFaceTokenClassificationResult {
  readonly entity: string;
  readonly score: number;
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

interface KeyPhrase {
  readonly text: string;
  readonly label: string;
  readonly confidence: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export class NLPService {
  private readonly client: InferenceClient;
  private readonly sentimentModel = 'distilbert-base-uncased-finetuned-sst-2-english';
  private readonly nerModel = 'dbmdz/bert-large-cased-finetuned-conll03-english';
  private readonly embeddingModel = 'sentence-transformers/all-MiniLM-L6-v2';

  constructor() {
    this.client = new InferenceClient(config.apis.huggingFace.apiKey);
  }

  private validateText(text: string): void {
    if (!text || text.trim() === '') {
      throw new ValidationError('Text cannot be empty');
    }

    if (text.length > 10000) {
      throw new ValidationError('Text is too long (max 10,000 characters)');
    }
  }

  private mapSentimentLabel(label: string): SentimentLabel {
    const normalizedLabel = label.toLowerCase();
    
    if (normalizedLabel.includes('positive') || normalizedLabel === 'label_2') {
      return 'positive';
    } else if (normalizedLabel.includes('negative') || normalizedLabel === 'label_0') {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  private calculateConfidence(score: number, label: string): number {
    // For sentiment analysis, higher scores indicate higher confidence
    // Adjust confidence based on the model's typical score distribution
    if (label.includes('neutral')) {
      // Neutral predictions are often less confident
      return Math.min(score * 0.8, 0.95);
    }
    return Math.min(score, 0.99);
  }

  public async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    this.validateText(text);

    try {
      const result = await this.client.textClassification({
        model: this.sentimentModel,
        inputs: text,
      });

      if (!Array.isArray(result) || result.length === 0) {
        throw new ExternalApiError(
          'HuggingFace',
          'Invalid sentiment analysis response',
          500
        );
      }

      const topResult = result[0] as HuggingFaceClassificationResult;
      const label = this.mapSentimentLabel(topResult.label);
      const confidence = this.calculateConfidence(topResult.score, topResult.label);

      return {
        label,
        score: topResult.score,
        confidence,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }

      throw new ExternalApiError(
        'HuggingFace',
        `Sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  public async extractKeyPhrases(text: string, confidenceThreshold: number = 0.9): Promise<KeyPhrase[]> {
    this.validateText(text);

    if (confidenceThreshold < 0 || confidenceThreshold > 1) {
      throw new ValidationError('Confidence threshold must be between 0 and 1');
    }

    try {
      const result = await this.client.tokenClassification({
        model: this.nerModel,
        inputs: text,
      });

      if (!Array.isArray(result)) {
        throw new ExternalApiError(
          'HuggingFace',
          'Invalid key phrase extraction response',
          500
        );
      }

      const entities = result as HuggingFaceTokenClassificationResult[];
      
      return entities
        .filter(entity => entity.score >= confidenceThreshold)
        .map(entity => ({
          text: entity.word,
          label: entity.entity,
          confidence: entity.score,
          startIndex: entity.start,
          endIndex: entity.end,
        }));
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }

      throw new ExternalApiError(
        'HuggingFace',
        `Key phrase extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  public async embedText(text: string): Promise<readonly number[]> {
    this.validateText(text);

    try {
      const result = await this.client.featureExtraction({
        model: this.embeddingModel,
        inputs: text,
      });

      if (!Array.isArray(result)) {
        throw new ExternalApiError(
          'HuggingFace',
          'Invalid embedding response',
          500
        );
      }

      // The result might be nested arrays, flatten if necessary
      const embedding = Array.isArray(result[0]) ? result[0] : result;
      
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new ExternalApiError(
          'HuggingFace',
          'Invalid embedding format',
          500
        );
      }

      return embedding as readonly number[];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }

      throw new ExternalApiError(
        'HuggingFace',
        `Text embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  public async batchAnalyzeSentiment(texts: readonly string[]): Promise<SentimentAnalysis[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new ValidationError('Texts array cannot be empty');
    }

    if (texts.length > 100) {
      throw new ValidationError('Batch size cannot exceed 100 texts');
    }

    // Validate all texts first
    texts.forEach((text, index) => {
      try {
        this.validateText(text);
      } catch (error) {
        throw new ValidationError(`Text at index ${index} is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Process in parallel with some concurrency control
    const batchSize = 10;
    const results: SentimentAnalysis[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.analyzeSentiment(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        throw new ExternalApiError(
          'HuggingFace',
          `Batch sentiment analysis failed at batch starting index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          500
        );
      }
    }

    return results;
  }

  public async batchEmbedTexts(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new ValidationError('Texts array cannot be empty');
    }

    if (texts.length > 50) {
      throw new ValidationError('Batch size cannot exceed 50 texts for embeddings');
    }

    // Validate all texts first
    texts.forEach((text, index) => {
      try {
        this.validateText(text);
      } catch (error) {
        throw new ValidationError(`Text at index ${index} is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Process in smaller batches for embeddings (more resource intensive)
    const batchSize = 5;
    const results: (readonly number[])[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.embedText(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        throw new ExternalApiError(
          'HuggingFace',
          `Batch embedding failed at batch starting index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          500
        );
      }
    }

    return results;
  }

  public splitIntoSentences(text: string): readonly string[] {
    this.validateText(text);

    // Simple sentence splitting - could be enhanced with more sophisticated NLP
    const sentences = text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)
      .filter(sentence => sentence.length >= 10); // Filter out very short fragments

    if (sentences.length === 0) {
      return [text.trim()]; // Return original text if no sentences found
    }

    return sentences;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple sentiment analysis
      const testResult = await this.analyzeSentiment('This is a test message.');
      return testResult.label !== undefined && testResult.score !== undefined;
    } catch (error) {
      console.error('NLP service health check failed:', error);
      return false;
    }
  }

  public getModelInfo(): Record<string, string> {
    return {
      sentimentModel: this.sentimentModel,
      nerModel: this.nerModel,
      embeddingModel: this.embeddingModel,
    };
  }
}
