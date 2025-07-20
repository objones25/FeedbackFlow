import request from 'supertest';
import express from 'express';
import { ValidationError, ExternalApiError } from '../../../src/utils/errors';

// Create a simple mock for the FeedbackService
const mockFeedbackService = {
  getDashboardData: jest.fn(),
  getSentimentTrends: jest.fn(),
  getFeedbackGroups: jest.fn(),
  processFeedbackFromReddit: jest.fn(),
  processFeedbackFromFile: jest.fn(),
  healthCheck: jest.fn(),
};

// Mock the entire routes module to inject our mock service
jest.mock('../../../src/services/feedbackService', () => ({
  FeedbackService: jest.fn(() => mockFeedbackService),
}));

// Import routes after mocking
import feedbackRoutes from '../../../src/routes/feedback';

describe('Feedback Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/feedback', feedbackRoutes);
  });

  describe('GET /api/feedback/dashboard', () => {
    const mockDashboardData = {
      metrics: {
        totalSources: 5,
        totalEntries: 100,
        totalSentences: 500,
        totalGroups: 10,
        sentimentDistribution: { positive: 60, negative: 20, neutral: 20 },
      },
      trends: [
        { date: '2024-01-01', positive: 10, negative: 5, neutral: 5, total: 20 },
      ],
      groups: [
        {
          id: 1,
          name: 'Product Issues',
          description: 'Issues with the product',
          sentenceIds: [1, 2, 3],
          trendScore: 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      alerts: [],
      timeframe: '7d',
      lastUpdated: new Date(),
    };

    beforeEach(() => {
      mockFeedbackService.getDashboardData.mockResolvedValue(mockDashboardData);
    });

    it('should return dashboard data successfully', async () => {
      const response = await request(app)
        .get('/api/feedback/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toEqual(mockDashboardData.metrics);
      expect(response.body.data.trends).toEqual(mockDashboardData.trends);
      expect(response.body.data.alerts).toEqual(mockDashboardData.alerts);
      expect(response.body.data.timeframe).toBe(mockDashboardData.timeframe);
      expect(response.body.data.groups).toHaveLength(1);
      expect(response.body.data.groups[0].id).toBe(1);
      expect(response.body.data.groups[0].name).toBe('Product Issues');
      expect(response.body.data.lastUpdated).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(mockFeedbackService.getDashboardData).toHaveBeenCalledWith('7d');
    });

    it('should accept custom timeframe parameter', async () => {
      await request(app)
        .get('/api/feedback/dashboard?timeframe=30d')
        .expect(200);

      expect(mockFeedbackService.getDashboardData).toHaveBeenCalledWith('30d');
    });

    it('should handle validation errors', async () => {
      mockFeedbackService.getDashboardData.mockRejectedValue(
        new ValidationError('Invalid timeframe')
      );

      const response = await request(app)
        .get('/api/feedback/dashboard?timeframe=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid timeframe');
    });

    it('should handle external API errors', async () => {
      mockFeedbackService.getDashboardData.mockRejectedValue(
        new ExternalApiError('TestService', 'Service unavailable', 503)
      );

      const response = await request(app)
        .get('/api/feedback/dashboard')
        .expect(502);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXTERNAL_API_ERROR');
      expect(response.body.error.details.service).toBe('TestService');
    });

    it('should handle generic errors', async () => {
      mockFeedbackService.getDashboardData.mockRejectedValue(
        new Error('Unexpected error')
      );

      const response = await request(app)
        .get('/api/feedback/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('GET /api/feedback/trends', () => {
    const mockTrends = [
      { date: '2024-01-01', positive: 10, negative: 5, neutral: 5, total: 20 },
      { date: '2024-01-02', positive: 12, negative: 3, neutral: 5, total: 20 },
    ];

    beforeEach(() => {
      mockFeedbackService.getSentimentTrends.mockResolvedValue(mockTrends);
    });

    it('should return sentiment trends successfully', async () => {
      const response = await request(app)
        .get('/api/feedback/trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrends);
      expect(mockFeedbackService.getSentimentTrends).toHaveBeenCalledWith('7d');
    });

    it('should accept custom timeframe parameter', async () => {
      await request(app)
        .get('/api/feedback/trends?timeframe=30d')
        .expect(200);

      expect(mockFeedbackService.getSentimentTrends).toHaveBeenCalledWith('30d');
    });
  });

  describe('GET /api/feedback/groups', () => {
    const mockGroups = [
      {
        id: 1,
        name: 'Product Issues',
        description: 'Issues with the product',
        sentenceIds: [1, 2, 3],
        trendScore: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockFeedbackService.getFeedbackGroups.mockResolvedValue(mockGroups);
    });

    it('should return feedback groups successfully', async () => {
      const response = await request(app)
        .get('/api/feedback/groups')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(1);
      expect(response.body.data[0].name).toBe('Product Issues');
      expect(response.body.data[0].description).toBe('Issues with the product');
      expect(response.body.data[0].sentenceIds).toEqual([1, 2, 3]);
      expect(response.body.data[0].trendScore).toBe(0.8);
      expect(response.body.data[0].createdAt).toBeDefined();
      expect(response.body.data[0].updatedAt).toBeDefined();
      expect(mockFeedbackService.getFeedbackGroups).toHaveBeenCalledWith(20);
    });

    it('should accept custom limit parameter', async () => {
      await request(app)
        .get('/api/feedback/groups?limit=50')
        .expect(200);

      expect(mockFeedbackService.getFeedbackGroups).toHaveBeenCalledWith(50);
    });

    it('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/feedback/groups?limit=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Limit must be a valid number');
    });
  });

  describe('POST /api/feedback/process/reddit', () => {
    const mockProcessingResult = {
      processedCount: 10,
      sentencesCount: 50,
      clustersCount: 3,
      outlierCount: 2,
      processingTimeMs: 5000,
    };

    beforeEach(() => {
      mockFeedbackService.processFeedbackFromReddit.mockResolvedValue(mockProcessingResult);
    });

    it('should process Reddit feedback successfully', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({ subreddit: 'testsubreddit' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessingResult);
      expect(mockFeedbackService.processFeedbackFromReddit).toHaveBeenCalledWith('testsubreddit', {});
    });

    it('should accept processing options', async () => {
      const options = { batchSize: 50, enableClustering: false };

      await request(app)
        .post('/api/feedback/process/reddit')
        .send({ subreddit: 'testsubreddit', options })
        .expect(200);

      expect(mockFeedbackService.processFeedbackFromReddit).toHaveBeenCalledWith('testsubreddit', options);
    });

    it('should validate required subreddit parameter', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Subreddit is required and must be a string');
    });

    it('should validate subreddit parameter type', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({ subreddit: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate options parameter type', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({ subreddit: 'test', options: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Options must be an object');
    });
  });

  describe('POST /api/feedback/process/file', () => {
    const mockProcessingResult = {
      processedCount: 1,
      sentencesCount: 25,
      clustersCount: 2,
      outlierCount: 1,
      processingTimeMs: 3000,
    };

    beforeEach(() => {
      mockFeedbackService.processFeedbackFromFile.mockResolvedValue(mockProcessingResult);
    });

    it('should process file feedback successfully', async () => {
      const fileContent = 'This is test feedback content.';
      const sourceName = 'test-file.txt';

      const response = await request(app)
        .post('/api/feedback/process/file')
        .send({ content: fileContent, sourceName })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessingResult);
      expect(mockFeedbackService.processFeedbackFromFile).toHaveBeenCalledWith(fileContent, sourceName, {});
    });

    it('should accept processing options', async () => {
      const options = { maxSentences: 100, sentimentThreshold: 0.7 };

      await request(app)
        .post('/api/feedback/process/file')
        .send({ 
          content: 'Test content', 
          sourceName: 'test.txt', 
          options 
        })
        .expect(200);

      expect(mockFeedbackService.processFeedbackFromFile).toHaveBeenCalledWith('Test content', 'test.txt', options);
    });

    it('should validate required content parameter', async () => {
      const response = await request(app)
        .post('/api/feedback/process/file')
        .send({ sourceName: 'test.txt' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Content is required and must be a string');
    });

    it('should validate required sourceName parameter', async () => {
      const response = await request(app)
        .post('/api/feedback/process/file')
        .send({ content: 'Test content' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Source name is required and must be a string');
    });
  });

  describe('GET /api/feedback/health', () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      services: {
        reddit: true,
        nlp: true,
        clustering: true,
        database: true,
      },
      timestamp: new Date(),
    };

    beforeEach(() => {
      mockFeedbackService.healthCheck.mockResolvedValue(mockHealthStatus);
    });

    it('should return health status successfully', async () => {
      const response = await request(app)
        .get('/api/feedback/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toEqual(mockHealthStatus.services);
    });

    it('should return degraded status with 200 status code', async () => {
      const degradedHealth = { ...mockHealthStatus, status: 'degraded' as const };
      mockFeedbackService.healthCheck.mockResolvedValue(degradedHealth);

      const response = await request(app)
        .get('/api/feedback/health')
        .expect(200);

      expect(response.body.data.status).toBe('degraded');
    });

    it('should return unhealthy status with 503 status code', async () => {
      const unhealthyStatus = { ...mockHealthStatus, status: 'unhealthy' as const };
      mockFeedbackService.healthCheck.mockResolvedValue(unhealthyStatus);

      const response = await request(app)
        .get('/api/feedback/health')
        .expect(503);

      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('POST /api/feedback/analyze', () => {
    const mockProcessingResult = {
      processedCount: 5,
      sentencesCount: 20,
      clustersCount: 2,
      outlierCount: 1,
      processingTimeMs: 2000,
    };

    beforeEach(() => {
      mockFeedbackService.processFeedbackFromReddit.mockResolvedValue(mockProcessingResult);
      mockFeedbackService.processFeedbackFromFile.mockResolvedValue(mockProcessingResult);
    });

    it('should analyze Reddit source successfully', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ source: 'reddit', query: 'testsubreddit' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessingResult);
      expect(mockFeedbackService.processFeedbackFromReddit).toHaveBeenCalledWith('testsubreddit', {});
    });

    it('should analyze file source successfully', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ 
          source: 'file', 
          query: 'File content here',
          options: { sourceName: 'test.txt' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessingResult);
      expect(mockFeedbackService.processFeedbackFromFile).toHaveBeenCalledWith(
        'File content here', 
        'test.txt', 
        { sourceName: 'test.txt' }
      );
    });

    it('should validate required source parameter', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ query: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Source is required and must be a string');
    });

    it('should validate required query parameter', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ source: 'reddit' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Query is required and must be a string');
    });

    it('should validate unsupported source', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ source: 'unsupported', query: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Unsupported source: unsupported');
    });

    it('should validate sourceName for file processing', async () => {
      const response = await request(app)
        .post('/api/feedback/analyze')
        .send({ source: 'file', query: 'content' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Source name is required for file processing');
    });
  });

  describe('GET /api/feedback/status/:jobId', () => {
    it('should return job status successfully', async () => {
      const response = await request(app)
        .get('/api/feedback/status/test-job-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-job-123');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.progress).toBe(100);
      expect(response.body.data.result).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle null values in request', async () => {
      const response = await request(app)
        .post('/api/feedback/process/reddit')
        .send({ subreddit: null })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Response format consistency', () => {
    beforeEach(() => {
      mockFeedbackService.getDashboardData.mockResolvedValue({
        metrics: { totalSources: 0, totalEntries: 0, totalSentences: 0, totalGroups: 0, sentimentDistribution: {} },
        trends: [],
        groups: [],
        alerts: [],
        timeframe: '7d',
        lastUpdated: new Date(),
      });
    });

    it('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api/feedback/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).not.toHaveProperty('error');
    });

    it('should return consistent error response format', async () => {
      mockFeedbackService.getDashboardData.mockRejectedValue(
        new ValidationError('Test error')
      );

      const response = await request(app)
        .get('/api/feedback/dashboard')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).not.toHaveProperty('data');
    });
  });
});
