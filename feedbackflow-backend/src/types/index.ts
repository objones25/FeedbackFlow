// Core domain types - no any types allowed!

export type SentimentLabel = 'positive' | 'negative' | 'neutral';
export type FeedbackSourceType = 'reddit' | 'news' | 'file_upload' | 'api' | 'manual';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface FeedbackSource {
  readonly id: number;
  readonly name: string;
  readonly type: FeedbackSourceType;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface FeedbackEntry {
  readonly id?: number;
  readonly sourceId: number;
  readonly rawText: string;
  readonly author: string;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown>;
  readonly externalId?: string; 
  readonly createdAt?: Date;
  readonly processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProcessedSentence {
  readonly entryId: number;
  readonly text: string;
  readonly sentimentScore: number;
  readonly sentimentLabel: SentimentLabel;
  readonly embedding: number[];
  readonly categories: string[];
}

export interface DashboardData {
  readonly metrics: {
    readonly totalSources: number;
    readonly totalEntries: number;
    readonly totalSentences: number;
    readonly totalGroups: number;
    readonly sentimentDistribution: Record<string, number>;
  };
  readonly trends: TrendData[];
  readonly groups: FeedbackGroup[];
  readonly alerts: Array<{
    readonly type: string;
    readonly severity: 'low' | 'medium' | 'high';
    readonly description: string;
    readonly timestamp: Date;
  }>;
  readonly timeframe: string;
  readonly lastUpdated: Date;
}

export interface TrendData {
  readonly date: string;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
  readonly total: number;
}

export interface SentimentAnalysis {
  readonly label: SentimentLabel;
  readonly score: number;
  readonly confidence: number;
}

export interface Sentence {
  readonly id: number;
  readonly entryId: number;
  readonly text: string;
  readonly sentimentScore: number;
  readonly sentimentLabel: SentimentLabel;
  readonly categories: readonly string[];
  readonly embedding: readonly number[];
  readonly createdAt: Date;
}

export interface FeedbackGroup {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly sentenceIds: readonly number[];
  readonly trendScore: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RedditPost {
  readonly title: string;
  readonly selftext: string;
  readonly author: string;
  readonly createdUtc: number;
  readonly score: number;
  readonly subreddit: string;
  readonly permalink: string;
  readonly numComments: number;
}

export interface NewsArticle {
  readonly title: string;
  readonly description: string;
  readonly content: string;
  readonly author: string | null;
  readonly publishedAt: Date;
  readonly source: {
    readonly id: string | null;
    readonly name: string;
  };
  readonly url: string;
}

export interface DashboardMetrics {
  readonly totalFeedback: number;
  readonly sentimentDistribution: {
    readonly positive: number;
    readonly negative: number;
    readonly neutral: number;
  };
  readonly trendsOverTime: readonly {
    readonly date: string;
    readonly positive: number;
    readonly negative: number;
    readonly neutral: number;
  }[];
  readonly topIssues: readonly {
    readonly category: string;
    readonly count: number;
    readonly sentiment: number;
  }[];
}

export interface Alert {
  readonly id: string;
  readonly type: 'sentiment_shift' | 'volume_spike' | 'new_issue_detected';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown>;
}

// API Response types
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly timestamp: Date;
}

// Configuration types
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl?: boolean;
}

export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly db?: number;
}

export interface ApiConfig {
  readonly huggingFace: {
    readonly apiKey: string;
    readonly baseUrl?: string;
  };
  readonly openAi: {
    readonly apiKey: string;
    readonly baseUrl?: string;
  };
  readonly news: {
    readonly apiKey: string;
    readonly baseUrl?: string;
  };
  readonly reddit: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly userAgent: string;
  };
}

// Error types
export interface FeedbackFlowError {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly statusCode: number;
  readonly timestamp: Date;
  readonly stack?: string;
}

// Processing pipeline types
export interface ProcessingJob {
  readonly id: string;
  readonly type: 'sentiment_analysis' | 'clustering' | 'trend_detection';
  readonly data: Record<string, unknown>;
  readonly status: ProcessingStatus;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly error?: string;
}

export interface ClusterResult {
  readonly clusters: readonly {
    readonly id: string;
    readonly sentenceIds: readonly number[];
    readonly centroid: readonly number[];
    readonly theme: string;
    readonly confidence: number;
  }[];
  readonly outliers: readonly number[];
}
