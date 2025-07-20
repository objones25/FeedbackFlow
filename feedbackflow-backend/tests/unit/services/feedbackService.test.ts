import { FeedbackService } from '../../../src/services/feedbackService';
import { RedditService } from '../../../src/services/redditService';
import { NLPService } from '../../../src/services/nlpService';
import { ClusteringService } from '../../../src/services/clusteringService';
import { DatabaseService } from '../../../src/services/database';
import { ValidationError, ExternalApiError } from '../../../src/utils/errors';
import { RedditPost, SentimentAnalysis } from '../../../src/types';

// Mock all dependencies
jest.mock('../../../src/services/redditService');
jest.mock('../../../src/services/nlpService');
jest.mock('../../../src/services/clusteringService');
jest.mock('../../../src/services/database');

describe('FeedbackService', () => {
  let feedbackService: FeedbackService;
  let mockRedditService: jest.Mocked<RedditService>;
  let mockNlpService: jest.Mocked<NLPService>;
  let mockClusteringService: jest.Mocked<ClusteringService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockRedditService = new RedditService() as jest.Mocked<RedditService>;
    mockNlpService = new NLPService() as jest.Mocked<NLPService>;
    mockClusteringService = new ClusteringService() as jest.Mocked<ClusteringService>;
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;

    // Create service instance
    feedbackService = new FeedbackService();

    // Replace private properties with mocks
    (feedbackService as any).redditService = mockRedditService;
    (feedbackService as any).nlpService = mockNlpService;
    (feedbackService as any).clusteringService = mockClusteringService;
    (feedbackService as any).databaseService = mockDatabaseService;
  });

  describe('processFeedbackFromReddit', () => {
    const mockRedditPosts: RedditPost[] = [
      {
        title: 'Great product!',
        selftext: 'I love this product, it works perfectly.',
        author: 'user1',
        createdUtc: 1640995200,
        score: 10,
        subreddit: 'testsubreddit',
        permalink: '/r/testsubreddit/comments/123/great_product',
        numComments: 5,
      },
      {
        title: 'Issues with the app',
        selftext: 'The app crashes frequently and is very slow.',
        author: 'user2',
        createdUtc: 1640995300,
        score: 3,
        subreddit: 'testsubreddit',
        permalink: '/r/testsubreddit/comments/124/issues_with_app',
        numComments: 2,
      },
    ];

    const mockSentiment: SentimentAnalysis = {
      label: 'positive',
      score: 0.8,
      confidence: 0.9,
    };

    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    beforeEach(() => {
      mockRedditService.fetchSubredditPosts.mockResolvedValue(mockRedditPosts);
      mockDatabaseService.createFeedbackSource.mockResolvedValue(1);
      mockDatabaseService.createFeedbackEntries.mockResolvedValue([1, 2]);
      mockNlpService.splitIntoSentences.mockReturnValue(['Great product!', 'I love this product, it works perfectly.']);
      mockNlpService.analyzeSentiment.mockResolvedValue(mockSentiment);
      mockNlpService.embedText.mockResolvedValue(mockEmbedding);
      mockDatabaseService.createSentences.mockResolvedValue([1, 2]);
      mockClusteringService.clusterSentences.mockResolvedValue({
        clusters: [{
          id: 'cluster1',
          sentenceIds: [1, 2],
          centroid: [0.1, 0.2, 0.3],
          theme: 'positive feedback',
          confidence: 0.8,
        }],
        outliers: [],
      });
      mockDatabaseService.createFeedbackGroups.mockResolvedValue([1]);
    });

    it('should process Reddit feedback successfully', async () => {
      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit');

      // Assert
      expect(result.processedCount).toBe(2);
      expect(result.sentencesCount).toBe(4); // 2 sentences per post
      expect(result.clustersCount).toBe(1);
      expect(result.outlierCount).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // Verify service calls
      expect(mockRedditService.fetchSubredditPosts).toHaveBeenCalledWith('testsubreddit', 25);
      expect(mockDatabaseService.createFeedbackSource).toHaveBeenCalledWith({
        name: 'r/testsubreddit',
        type: 'reddit',
        metadata: expect.objectContaining({
          subreddit: 'testsubreddit',
          postCount: 2,
        }),
      });
      expect(mockDatabaseService.createFeedbackEntries).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rawText: 'Great product!\nI love this product, it works perfectly.',
            author: 'user1',
          }),
        ])
      );
    });

    it('should validate subreddit parameter', async () => {
      // Act & Assert
      await expect(feedbackService.processFeedbackFromReddit('')).rejects.toThrow(ValidationError);
      await expect(feedbackService.processFeedbackFromReddit('   ')).rejects.toThrow(ValidationError);
    });

    it('should validate processing options', async () => {
      // Act & Assert
      await expect(
        feedbackService.processFeedbackFromReddit('test', { batchSize: 0 })
      ).rejects.toThrow(ValidationError);

      await expect(
        feedbackService.processFeedbackFromReddit('test', { sentimentThreshold: -0.1 })
      ).rejects.toThrow(ValidationError);

      await expect(
        feedbackService.processFeedbackFromReddit('test', { clusteringThreshold: 1.1 })
      ).rejects.toThrow(ValidationError);

      await expect(
        feedbackService.processFeedbackFromReddit('test', { maxSentences: 0 })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle empty Reddit posts', async () => {
      // Arrange
      mockRedditService.fetchSubredditPosts.mockResolvedValue([]);

      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit');

      // Assert
      expect(result.processedCount).toBe(0);
      expect(result.sentencesCount).toBe(0);
      expect(result.clustersCount).toBe(0);
      expect(result.outlierCount).toBe(0);
    });

    it('should handle sentiment analysis failures gracefully', async () => {
      // Arrange
      mockNlpService.analyzeSentiment.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit');

      // Assert
      expect(result.processedCount).toBe(2);
      expect(result.sentencesCount).toBe(0); // No sentences processed due to failures
    });

    it('should skip clustering when disabled', async () => {
      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit', {
        enableClustering: false,
      });

      // Assert
      expect(result.clustersCount).toBe(0);
      expect(mockClusteringService.clusterSentences).not.toHaveBeenCalled();
      expect(mockDatabaseService.createFeedbackGroups).not.toHaveBeenCalled();
    });

    it('should handle clustering failures gracefully', async () => {
      // Arrange
      mockClusteringService.clusterSentences.mockRejectedValue(new Error('Clustering failed'));

      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit');

      // Assert
      expect(result.clustersCount).toBe(0);
      expect(result.outlierCount).toBe(0);
    });

    it('should respect maxSentences limit', async () => {
      // Act
      await feedbackService.processFeedbackFromReddit('testsubreddit', {
        maxSentences: 1,
      });

      // Assert
      expect(mockNlpService.analyzeSentiment).toHaveBeenCalledTimes(1);
    });

    it('should filter sentences by sentiment threshold', async () => {
      // Arrange
      mockNlpService.analyzeSentiment.mockResolvedValue({
        label: 'positive',
        score: 0.8,
        confidence: 0.3, // Below threshold
      });

      // Act
      const result = await feedbackService.processFeedbackFromReddit('testsubreddit', {
        sentimentThreshold: 0.5,
      });

      // Assert
      expect(result.sentencesCount).toBe(0); // All sentences filtered out
    });
  });

  describe('processFeedbackFromFile', () => {
    const mockFileContent = 'This is great feedback. The product works well. Some issues exist though.';
    const mockSentiment: SentimentAnalysis = {
      label: 'positive',
      score: 0.7,
      confidence: 0.8,
    };
    const mockEmbedding = [0.1, 0.2, 0.3];

    beforeEach(() => {
      mockDatabaseService.createFeedbackSource.mockResolvedValue(1);
      mockDatabaseService.createFeedbackEntries.mockResolvedValue([1]);
      mockNlpService.splitIntoSentences.mockReturnValue([
        'This is great feedback.',
        'The product works well.',
        'Some issues exist though.',
      ]);
      mockNlpService.batchAnalyzeSentiment.mockResolvedValue([mockSentiment, mockSentiment, mockSentiment]);
      mockNlpService.batchEmbedTexts.mockResolvedValue([mockEmbedding, mockEmbedding, mockEmbedding]);
      mockDatabaseService.createSentences.mockResolvedValue([1, 2, 3]);
      mockClusteringService.clusterSentences.mockResolvedValue({
        clusters: [{
          id: 'cluster1',
          sentenceIds: [1, 2, 3],
          centroid: [0.1, 0.2, 0.3],
          theme: 'product feedback',
          confidence: 0.8,
        }],
        outliers: [],
      });
      mockDatabaseService.createFeedbackGroups.mockResolvedValue([1]);
    });

    it('should process file feedback successfully', async () => {
      // Act
      const result = await feedbackService.processFeedbackFromFile(mockFileContent, 'test-file');

      // Assert
      expect(result.processedCount).toBe(1);
      expect(result.sentencesCount).toBe(3);
      expect(result.clustersCount).toBe(1);
      expect(result.outlierCount).toBe(0);

      // Verify service calls
      expect(mockDatabaseService.createFeedbackSource).toHaveBeenCalledWith({
        name: 'test-file',
        type: 'file_upload',
        metadata: expect.objectContaining({
          contentLength: mockFileContent.length,
        }),
      });
      expect(mockNlpService.batchAnalyzeSentiment).toHaveBeenCalled();
      expect(mockNlpService.batchEmbedTexts).toHaveBeenCalled();
    });

    it('should validate file content', async () => {
      // Act & Assert
      await expect(
        feedbackService.processFeedbackFromFile('', 'test-file')
      ).rejects.toThrow(ValidationError);

      await expect(
        feedbackService.processFeedbackFromFile('   ', 'test-file')
      ).rejects.toThrow(ValidationError);
    });

    it('should validate source name', async () => {
      // Act & Assert
      await expect(
        feedbackService.processFeedbackFromFile(mockFileContent, '')
      ).rejects.toThrow(ValidationError);

      await expect(
        feedbackService.processFeedbackFromFile(mockFileContent, '   ')
      ).rejects.toThrow(ValidationError);
    });

    it('should handle batch processing failures gracefully', async () => {
      // Arrange
      mockNlpService.batchAnalyzeSentiment.mockRejectedValue(new Error('Batch failed'));

      // Act
      const result = await feedbackService.processFeedbackFromFile(mockFileContent, 'test-file');

      // Assert
      expect(result.sentencesCount).toBe(0); // No sentences processed due to batch failure
    });
  });

  describe('getDashboardData', () => {
    beforeEach(() => {
      mockDatabaseService.getFeedbackSourceCount.mockResolvedValue(5);
      mockDatabaseService.getFeedbackEntryCount.mockResolvedValue(100);
      mockDatabaseService.getSentenceCount.mockResolvedValue(500);
      mockDatabaseService.getFeedbackGroupCount.mockResolvedValue(10);
      mockDatabaseService.getSentimentDistribution.mockResolvedValue({
        positive: 60,
        negative: 20,
        neutral: 20,
      });
      mockDatabaseService.getSentimentTrends.mockResolvedValue([
        { date: '2024-01-01', positive: 10, negative: 5, neutral: 5, total: 20 },
      ]);
      mockDatabaseService.getTopFeedbackGroups.mockResolvedValue([
        {
          id: 1,
          name: 'Product Issues',
          description: 'Issues with the product',
          sentenceIds: [1, 2, 3],
          trendScore: 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return dashboard data successfully', async () => {
      // Act
      const result = await feedbackService.getDashboardData('7d');

      // Assert
      expect(result.metrics.totalSources).toBe(5);
      expect(result.metrics.totalEntries).toBe(100);
      expect(result.metrics.totalSentences).toBe(500);
      expect(result.metrics.totalGroups).toBe(10);
      expect(result.trends).toHaveLength(1);
      expect(result.groups).toHaveLength(1);
      expect(result.alerts).toBeDefined();
      expect(result.timeframe).toBe('7d');
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should validate timeframe parameter', async () => {
      // Act & Assert
      await expect(feedbackService.getDashboardData('invalid')).rejects.toThrow(ValidationError);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDatabaseService.getFeedbackSourceCount.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(feedbackService.getDashboardData('7d')).rejects.toThrow(ExternalApiError);
    });
  });

  describe('getSentimentTrends', () => {
    beforeEach(() => {
      mockDatabaseService.getSentimentTrends.mockResolvedValue([
        { date: '2024-01-01', positive: 10, negative: 5, neutral: 5, total: 20 },
        { date: '2024-01-02', positive: 12, negative: 3, neutral: 5, total: 20 },
      ]);
    });

    it('should return sentiment trends successfully', async () => {
      // Act
      const result = await feedbackService.getSentimentTrends('7d');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01-01',
        positive: 10,
        negative: 5,
        neutral: 5,
        total: 20,
      });
    });

    it('should validate timeframe parameter', async () => {
      // Act & Assert
      await expect(feedbackService.getSentimentTrends('invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('getFeedbackGroups', () => {
    beforeEach(() => {
      mockDatabaseService.getTopFeedbackGroups.mockResolvedValue([
        {
          id: 1,
          name: 'Product Issues',
          description: 'Issues with the product',
          sentenceIds: [1, 2, 3],
          trendScore: 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should return feedback groups successfully', async () => {
      // Act
      const result = await feedbackService.getFeedbackGroups(10);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Product Issues');
      expect(mockDatabaseService.getTopFeedbackGroups).toHaveBeenCalledWith(10);
    });

    it('should validate limit parameter', async () => {
      // Act & Assert
      await expect(feedbackService.getFeedbackGroups(0)).rejects.toThrow(ValidationError);
      await expect(feedbackService.getFeedbackGroups(101)).rejects.toThrow(ValidationError);
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      mockRedditService.healthCheck.mockResolvedValue(true);
      mockNlpService.healthCheck.mockResolvedValue(true);
      mockDatabaseService.healthCheck.mockResolvedValue(true);
    });

    it('should return healthy status when all services are healthy', async () => {
      // Act
      const result = await feedbackService.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.services.reddit).toBe(true);
      expect(result.services.nlp).toBe(true);
      expect(result.services.clustering).toBe(true);
      expect(result.services.database).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // Arrange
      mockRedditService.healthCheck.mockResolvedValue(false);
      mockNlpService.healthCheck.mockResolvedValue(false);

      // Act
      const result = await feedbackService.healthCheck();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.services.reddit).toBe(false);
      expect(result.services.nlp).toBe(false);
      expect(result.services.clustering).toBe(true);
      expect(result.services.database).toBe(true);
    });

    it('should return unhealthy status when most services are unhealthy', async () => {
      // Arrange
      mockRedditService.healthCheck.mockResolvedValue(false);
      mockNlpService.healthCheck.mockResolvedValue(false);
      mockDatabaseService.healthCheck.mockResolvedValue(false);

      // Act
      const result = await feedbackService.healthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
    });

    it('should handle service health check failures gracefully', async () => {
      // Arrange
      mockRedditService.healthCheck.mockRejectedValue(new Error('Health check failed'));

      // Act
      const result = await feedbackService.healthCheck();

      // Assert
      expect(result.services.reddit).toBe(false);
      expect(result.status).toBe('degraded');
    });
  });

  describe('error handling', () => {
    it('should wrap unknown errors in ExternalApiError', async () => {
      // Arrange
      mockRedditService.fetchSubredditPosts.mockRejectedValue(new Error('Unknown error'));

      // Act & Assert
      await expect(
        feedbackService.processFeedbackFromReddit('test')
      ).rejects.toThrow(ExternalApiError);
    });

    it('should preserve ValidationError and ExternalApiError', async () => {
      // Arrange
      const validationError = new ValidationError('Invalid input');
      mockRedditService.fetchSubredditPosts.mockRejectedValue(validationError);

      // Act & Assert
      await expect(
        feedbackService.processFeedbackFromReddit('test')
      ).rejects.toThrow(ValidationError);
    });
  });
});
