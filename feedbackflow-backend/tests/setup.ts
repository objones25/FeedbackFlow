import { config } from '@/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = 'feedbackflow_test';
process.env.REDIS_DB = '1';

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidUUID(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidDate(received: unknown) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date`,
        pass: false,
      };
    }
  },

  toBeValidUUID(received: unknown) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});

// Test data factories
export const createMockFeedbackEntry = (overrides: Partial<any> = {}) => ({
  id: 1,
  sourceId: 1,
  rawText: 'This is a test feedback entry',
  author: 'test_user',
  timestamp: new Date(),
  metadata: {},
  createdAt: new Date(),
  processingStatus: 'pending' as const,
  ...overrides,
});

export const createMockSentence = (overrides: Partial<any> = {}) => ({
  id: 1,
  entryId: 1,
  text: 'This is a test sentence.',
  sentimentScore: 0.8,
  sentimentLabel: 'positive' as const,
  categories: ['general'],
  embedding: new Array(384).fill(0.1),
  createdAt: new Date(),
  ...overrides,
});

export const createMockRedditPost = (overrides: Partial<any> = {}) => ({
  title: 'Test Reddit Post',
  selftext: 'This is a test post content',
  author: 'test_redditor',
  createdUtc: Math.floor(Date.now() / 1000),
  score: 10,
  subreddit: 'test',
  permalink: '/r/test/comments/123/test_post',
  numComments: 5,
  ...overrides,
});

export const createMockNewsArticle = (overrides: Partial<any> = {}) => ({
  title: 'Test News Article',
  description: 'This is a test article description',
  content: 'This is the full article content',
  author: 'Test Author',
  publishedAt: new Date(),
  source: {
    id: 'test-source',
    name: 'Test News Source',
  },
  url: 'https://example.com/test-article',
  ...overrides,
});

// Database test utilities
export const clearTestDatabase = async () => {
  // This will be implemented when we add database connection
  // For now, it's a placeholder
};

export const seedTestDatabase = async () => {
  // This will be implemented when we add database connection
  // For now, it's a placeholder
};

// API test utilities
export const createMockApiResponse = <T>(data: T, success: boolean = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : {
    code: 'TEST_ERROR',
    message: 'Test error message',
  },
  timestamp: new Date(),
});

// Async test utilities
export const waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const expectAsync = async <T>(
  promise: Promise<T>,
  expectation: (result: T) => void
): Promise<void> => {
  const result = await promise;
  expectation(result);
};

// Mock external services
export const mockHuggingFaceResponse = (sentiment: 'positive' | 'negative' | 'neutral', score: number = 0.8) => ({
  label: sentiment.toUpperCase(),
  score,
});

export const mockOpenAIResponse = (content: string) => ({
  choices: [{
    message: {
      content,
      role: 'assistant',
    },
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
});

console.log('✅ Test setup completed');
