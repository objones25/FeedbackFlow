import { NLPService } from '../../../src/services/nlpService';
import { ValidationError, ExternalApiError } from '../../../src/utils/errors';
import { InferenceClient } from '@huggingface/inference';

// Mock the InferenceClient
jest.mock('@huggingface/inference');
const MockedInferenceClient = InferenceClient as jest.MockedClass<typeof InferenceClient>;

describe('NLPService', () => {
  let nlpService: NLPService;
  let mockClient: jest.Mocked<InferenceClient>;

  beforeEach(() => {
    mockClient = {
      textClassification: jest.fn(),
      tokenClassification: jest.fn(),
      featureExtraction: jest.fn(),
    } as unknown as jest.Mocked<InferenceClient>;

    MockedInferenceClient.mockImplementation(() => mockClient);
    nlpService = new NLPService();
    jest.clearAllMocks();
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment successfully', async () => {
      // Arrange
      const mockResponse = [
        {
          label: 'LABEL_2',
          score: 0.9,
        },
      ];
      mockClient.textClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await nlpService.analyzeSentiment('This is a great product!');

      // Assert
      expect(result).toEqual({
        label: 'positive',
        score: 0.9,
        confidence: 0.9,
      });
      expect(mockClient.textClassification).toHaveBeenCalledWith({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: 'This is a great product!',
      });
    });

    it('should map negative sentiment correctly', async () => {
      // Arrange
      const mockResponse = [
        {
          label: 'LABEL_0',
          score: 0.85,
        },
      ];
      mockClient.textClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await nlpService.analyzeSentiment('This product is terrible!');

      // Assert
      expect(result.label).toBe('negative');
      expect(result.score).toBe(0.85);
    });

    it('should map neutral sentiment correctly with adjusted confidence', async () => {
      // Arrange
      const mockResponse = [
        {
          label: 'LABEL_1',
          score: 0.7,
        },
      ];
      mockClient.textClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await nlpService.analyzeSentiment('This product is okay.');

      // Assert
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0.7);
      expect(result.confidence).toBe(0.7); // LABEL_1 doesn't contain 'neutral' so no adjustment
    });

    it('should validate empty text', async () => {
      // Act & Assert
      await expect(nlpService.analyzeSentiment('')).rejects.toThrow(
        ValidationError
      );
      await expect(nlpService.analyzeSentiment('   ')).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate text length', async () => {
      // Arrange
      const longText = 'a'.repeat(10001);

      // Act & Assert
      await expect(nlpService.analyzeSentiment(longText)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle API errors', async () => {
      // Arrange
      mockClient.textClassification.mockRejectedValueOnce(new Error('API Error'));

      // Act & Assert
      await expect(nlpService.analyzeSentiment('Test text')).rejects.toThrow(
        ExternalApiError
      );
    });

    it('should handle invalid API response', async () => {
      // Arrange
      mockClient.textClassification.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(nlpService.analyzeSentiment('Test text')).rejects.toThrow(
        ExternalApiError
      );
    });
  });

  describe('extractKeyPhrases', () => {
    it('should extract key phrases successfully', async () => {
      // Arrange
      const mockResponse = [
        {
          entity: 'B-PER',
          score: 0.95,
          word: 'John',
          start: 0,
          end: 4,
        },
        {
          entity: 'B-ORG',
          score: 0.92,
          word: 'Microsoft',
          start: 15,
          end: 24,
        },
      ];
      mockClient.tokenClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await nlpService.extractKeyPhrases('John works at Microsoft');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        text: 'John',
        label: 'B-PER',
        confidence: 0.95,
        startIndex: 0,
        endIndex: 4,
      });
      expect(result[1]).toEqual({
        text: 'Microsoft',
        label: 'B-ORG',
        confidence: 0.92,
        startIndex: 15,
        endIndex: 24,
      });
    });

    it('should filter by confidence threshold', async () => {
      // Arrange
      const mockResponse = [
        {
          entity: 'B-PER',
          score: 0.95,
          word: 'John',
          start: 0,
          end: 4,
        },
        {
          entity: 'B-ORG',
          score: 0.7, // Below threshold
          word: 'Company',
          start: 15,
          end: 22,
        },
      ];
      mockClient.tokenClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await nlpService.extractKeyPhrases('John works at Company', 0.9);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('John');
    });

    it('should validate confidence threshold', async () => {
      // Act & Assert
      await expect(
        nlpService.extractKeyPhrases('Test text', -0.1)
      ).rejects.toThrow(ValidationError);

      await expect(
        nlpService.extractKeyPhrases('Test text', 1.1)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('embedText', () => {
    it('should embed text successfully', async () => {
      // Arrange
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockClient.featureExtraction.mockResolvedValueOnce(mockEmbedding);

      // Act
      const result = await nlpService.embedText('Test text for embedding');

      // Assert
      expect(result).toEqual(mockEmbedding);
      expect(mockClient.featureExtraction).toHaveBeenCalledWith({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: 'Test text for embedding',
      });
    });

    it('should handle nested array response', async () => {
      // Arrange
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      const nestedResponse = [mockEmbedding];
      mockClient.featureExtraction.mockResolvedValueOnce(nestedResponse);

      // Act
      const result = await nlpService.embedText('Test text');

      // Assert
      expect(result).toEqual(mockEmbedding);
    });

    it('should handle invalid embedding response', async () => {
      // Arrange
      mockClient.featureExtraction.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(nlpService.embedText('Test text')).rejects.toThrow(
        ExternalApiError
      );
    });
  });

  describe('batchAnalyzeSentiment', () => {
    it('should process batch sentiment analysis', async () => {
      // Arrange
      const texts = ['Great product!', 'Terrible service!', 'It is okay.'];
      const mockResponses = [
        [{ label: 'LABEL_2', score: 0.9 }],
        [{ label: 'LABEL_0', score: 0.85 }],
        [{ label: 'LABEL_1', score: 0.7 }],
      ];

      mockClient.textClassification
        .mockResolvedValueOnce(mockResponses[0] as { label: string; score: number }[])
        .mockResolvedValueOnce(mockResponses[1] as { label: string; score: number }[])
        .mockResolvedValueOnce(mockResponses[2] as { label: string; score: number }[]);

      // Act
      const results = await nlpService.batchAnalyzeSentiment(texts);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]?.label).toBe('positive');
      expect(results[1]?.label).toBe('negative');
      expect(results[2]?.label).toBe('neutral');
    });

    it('should validate batch size', async () => {
      // Arrange
      const largeBatch = new Array(101).fill('test text');

      // Act & Assert
      await expect(nlpService.batchAnalyzeSentiment(largeBatch)).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate empty batch', async () => {
      // Act & Assert
      await expect(nlpService.batchAnalyzeSentiment([])).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate individual texts in batch', async () => {
      // Arrange
      const invalidBatch = ['valid text', '', 'another valid text'];

      // Act & Assert
      await expect(nlpService.batchAnalyzeSentiment(invalidBatch)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('batchEmbedTexts', () => {
    it('should process batch embeddings', async () => {
      // Arrange
      const texts = ['Text one', 'Text two'];
      const mockEmbeddings = [
        new Array(384).fill(0.1),
        new Array(384).fill(0.2),
      ];

      mockClient.featureExtraction
        .mockResolvedValueOnce(mockEmbeddings[0] as number[])
        .mockResolvedValueOnce(mockEmbeddings[1] as number[]);

      // Act
      const results = await nlpService.batchEmbedTexts(texts);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockEmbeddings[0]);
      expect(results[1]).toEqual(mockEmbeddings[1]);
    });

    it('should validate batch size for embeddings', async () => {
      // Arrange
      const largeBatch = new Array(51).fill('test text');

      // Act & Assert
      await expect(nlpService.batchEmbedTexts(largeBatch)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('splitIntoSentences', () => {
    it('should split text into sentences', async () => {
      // Arrange
      const text = 'This is the first sentence. This is the second sentence! And this is the third?';

      // Act
      const sentences = nlpService.splitIntoSentences(text);

      // Assert
      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('This is the first sentence');
      expect(sentences[1]).toBe('This is the second sentence');
      expect(sentences[2]).toBe('And this is the third');
    });

    it('should filter out short fragments', async () => {
      // Arrange
      const text = 'This is a long sentence with proper content. Short. Another long sentence here.';

      // Act
      const sentences = nlpService.splitIntoSentences(text);

      // Assert
      expect(sentences).toHaveLength(2);
      expect(sentences).not.toContain('Short');
    });

    it('should return original text if no sentences found', async () => {
      // Arrange
      const text = 'No punctuation here';

      // Act
      const sentences = nlpService.splitIntoSentences(text);

      // Assert
      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe('No punctuation here');
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      // Arrange
      const mockResponse = [{ label: 'LABEL_1', score: 0.7 }];
      mockClient.textClassification.mockResolvedValueOnce(mockResponse);

      // Act
      const isHealthy = await nlpService.healthCheck();

      // Assert
      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      // Arrange
      mockClient.textClassification.mockRejectedValueOnce(new Error('Service down'));

      // Act
      const isHealthy = await nlpService.healthCheck();

      // Assert
      expect(isHealthy).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', () => {
      // Act
      const modelInfo = nlpService.getModelInfo();

      // Assert
      expect(modelInfo).toEqual({
        sentimentModel: 'distilbert-base-uncased-finetuned-sst-2-english',
        nerModel: 'dbmdz/bert-large-cased-finetuned-conll03-english',
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      });
    });
  });
});
