import dotenv from 'dotenv';
import { DatabaseConfig, RedisConfig, ApiConfig } from '@/types';

// Load environment variables
dotenv.config();

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigurationError(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getNumberEnvVar(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigurationError(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getBooleanEnvVar(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  return value.toLowerCase() === 'true';
}

export const config = {
  // Server configuration
  port: getNumberEnvVar('PORT', 3001),
  nodeEnv: getOptionalEnvVar('NODE_ENV', 'development'),
  jwtSecret: getRequiredEnvVar('JWT_SECRET'),

  // Database configuration
  database: {
    host: getOptionalEnvVar('DATABASE_HOST', 'localhost'),
    port: getNumberEnvVar('DATABASE_PORT', 5432),
    database: getOptionalEnvVar('DATABASE_NAME', 'feedbackflow'),
    username: getOptionalEnvVar('DATABASE_USER', 'admin'),
    password: getOptionalEnvVar('DATABASE_PASSWORD', 'password'),
    ssl: getBooleanEnvVar('DATABASE_SSL', false),
  } as DatabaseConfig,

  // Redis configuration
  redis: {
    host: getOptionalEnvVar('REDIS_HOST', 'localhost'),
    port: getNumberEnvVar('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: getNumberEnvVar('REDIS_DB', 0),
  } as RedisConfig,

  // API configuration
  apis: {
    huggingFace: {
      apiKey: getRequiredEnvVar('HUGGINGFACE_API_KEY'),
      baseUrl: getOptionalEnvVar('HUGGINGFACE_BASE_URL', 'https://api-inference.huggingface.co'),
    },
    openAi: {
      apiKey: getRequiredEnvVar('OPENAI_API_KEY'),
      baseUrl: getOptionalEnvVar('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    },
    news: {
      apiKey: getRequiredEnvVar('NEWS_API_KEY'),
      baseUrl: getOptionalEnvVar('NEWS_API_BASE_URL', 'https://newsapi.org/v2'),
    },
    reddit: {
      clientId: getRequiredEnvVar('REDDIT_CLIENT_ID'),
      clientSecret: getRequiredEnvVar('REDDIT_CLIENT_SECRET'),
      userAgent: getOptionalEnvVar('REDDIT_USER_AGENT', 'FeedbackFlow/1.0.0'),
    },
  } as ApiConfig,

  // Rate limiting
  rateLimiting: {
    windowMs: getNumberEnvVar('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getNumberEnvVar('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  // Processing configuration
  processing: {
    maxConcurrentJobs: getNumberEnvVar('MAX_CONCURRENT_JOBS', 5),
    sentimentBatchSize: getNumberEnvVar('SENTIMENT_BATCH_SIZE', 50),
    clusteringThreshold: parseFloat(getOptionalEnvVar('CLUSTERING_THRESHOLD', '0.3')),
  },

  // Validation
  isDevelopment: () => config.nodeEnv === 'development',
  isProduction: () => config.nodeEnv === 'production',
  isTest: () => config.nodeEnv === 'test',
} as const;

// Validate configuration on startup
export function validateConfig(): void {
  try {
    // Test required configurations
    config.apis.huggingFace.apiKey;
    config.apis.openAi.apiKey;
    config.apis.news.apiKey;
    config.apis.reddit.clientId;
    config.apis.reddit.clientSecret;
    config.jwtSecret;

    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    process.exit(1);
  }
}

export { ConfigurationError };
