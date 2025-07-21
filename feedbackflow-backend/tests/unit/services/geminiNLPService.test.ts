import { GeminiNLPService } from '../../../src/services/geminiNLPService';
import { ValidationError, ExternalApiError } from '../../../src/utils/errors';

describe('GeminiNLPService', () => {
  let geminiService: GeminiNLPService;

  beforeAll(() => {
    // Ensure we have the API key for testing
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY environment variable is required for testing');
    }
    geminiService = new GeminiNLPService();
  });

  describe('constructor', () => {
    it('should throw error if no API key is provided', () => {
      const originalApiKey = process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      
      expect(() => new GeminiNLPService()).toThrow('Google API key is required for Gemini NLP service');
      
      process.env.GOOGLE_API_KEY = originalApiKey;
    });

    it('should initialize successfully with API key', () => {
      expect(geminiService).toBeInstanceOf(GeminiNLPService);
    });
  });

  describe('analyzeStructuredFeedback', () => {
    it('should throw ValidationError for empty text', async () => {
      await expect(geminiService.analyzeStructuredFeedback('')).rejects.toThrow(ValidationError);
      await expect(geminiService.analyzeStructuredFeedback('   ')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for text that is too long', async () => {
      const longText = 'a'.repeat(30001);
      await expect(geminiService.analyzeStructuredFeedback(longText)).rejects.toThrow(ValidationError);
    });

    it('should analyze negative feedback correctly', async () => {
      const negativeText = "The new update broke my login, keeps crashing on mobile. This is really frustrating!";
      
      const result = await geminiService.analyzeStructuredFeedback(negativeText);
      
      expect(result).toHaveProperty('sentiment');
      expect(result.sentiment).toHaveProperty('primary');
      expect(result.sentiment).toHaveProperty('confidence');
      expect(result.sentiment).toHaveProperty('emotions');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('themes');
      expect(result).toHaveProperty('urgency');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('actionItems');
      expect(result).toHaveProperty('keyPhrases');
      
      // Validate types
      expect(['positive', 'negative', 'neutral']).toContain(result.sentiment.primary);
      expect(typeof result.sentiment.confidence).toBe('number');
      expect(result.sentiment.confidence).toBeGreaterThanOrEqual(0);
      expect(result.sentiment.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.sentiment.emotions)).toBe(true);
      expect(['bug_report', 'feature_request', 'complaint', 'praise', 'question', 'discussion']).toContain(result.category);
      expect(Array.isArray(result.themes)).toBe(true);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.urgency);
      expect(typeof result.summary).toBe('string');
      expect(Array.isArray(result.actionItems)).toBe(true);
      expect(Array.isArray(result.keyPhrases)).toBe(true);
      
      // For negative feedback, we expect negative sentiment
      expect(result.sentiment.primary).toBe('negative');
    }, 30000); // 30 second timeout for API call

    it('should analyze positive feedback correctly', async () => {
      const positiveText = "This new feature is amazing! I love how easy it is to use. Great job on the update!";
      
      const result = await geminiService.analyzeStructuredFeedback(positiveText);
      
      expect(result.sentiment.primary).toBe('positive');
      expect(result.category).toBe('praise');
    }, 30000);

  });

  describe('batchAnalyzeStructuredFeedback', () => {
    it('should throw ValidationError for empty array', async () => {
      await expect(geminiService.batchAnalyzeStructuredFeedback([])).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for batch size too large', async () => {
      const largeBatch = Array(21).fill('test text');
      await expect(geminiService.batchAnalyzeStructuredFeedback(largeBatch)).rejects.toThrow(ValidationError);
    });

    it('should process multiple texts', async () => {
      const texts = [
        "Great product, love it!",
        "This app has serious bugs and crashes all the time",
        "How do I reset my password?"
      ];
      
      const results = await geminiService.batchAnalyzeStructuredFeedback(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0]?.sentiment.primary).toBe('positive');
      expect(['negative', 'neutral']).toContain(results[1]?.sentiment.primary); // More flexible
      expect(['question', 'discussion']).toContain(results[2]?.category); // More flexible
    }, 60000); // 60 second timeout for batch processing
  });

  describe('healthCheck', () => {
    it('should return a boolean for health check', async () => {
      const isHealthy = await geminiService.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
      // Health check might fail due to rate limiting, but should still return a boolean
    }, 30000);
  });

  describe('getModelInfo', () => {
    it('should return model information', () => {
      const modelInfo = geminiService.getModelInfo();
      
      expect(modelInfo).toHaveProperty('model');
      expect(modelInfo).toHaveProperty('provider');
      expect(modelInfo).toHaveProperty('capabilities');
      expect(modelInfo.model).toBe('gemini-2.0-flash-001');
      expect(modelInfo.provider).toBe('Google');
      expect(modelInfo.capabilities).toBe('structured_analysis');
    });
  });
});
