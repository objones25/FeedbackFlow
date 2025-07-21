import { RedditService } from "@/services/redditService";
import { NLPService } from "@/services/nlpService";
import {
  GeminiNLPService,
  StructuredFeedback,
} from "@/services/geminiNLPService";
import { ClusteringService } from "@/services/clusteringService";
import { DatabaseService } from "@/services/database";
import {
  FeedbackEntry,
  ProcessedSentence,
  ClusterResult,
  DashboardData,
  TrendData,
  FeedbackGroup,
} from "@/types";
import { ValidationError, ExternalApiError } from "@/utils/errors";

interface ProcessingOptions {
  readonly batchSize?: number;
  readonly enableClustering?: boolean;
  readonly sentimentThreshold?: number;
  readonly clusteringThreshold?: number;
  readonly maxSentences?: number;
}

interface ProcessingResult {
  readonly processedCount: number;
  readonly sentencesCount: number;
  readonly clustersCount: number;
  readonly outlierCount: number;
  readonly processingTimeMs: number;
}

export class FeedbackService {
  private readonly redditService: RedditService;
  private readonly nlpService: NLPService;
  private readonly geminiNLPService: GeminiNLPService;
  private readonly clusteringService: ClusteringService;
  private readonly databaseService: DatabaseService;

  constructor() {
    this.redditService = new RedditService();
    this.nlpService = new NLPService();
    this.geminiNLPService = new GeminiNLPService(); // Will throw error if API key not available
    this.clusteringService = new ClusteringService();
    this.databaseService = new DatabaseService();

    console.log("✅ All services initialized including Gemini NLP");
  }

  private validateProcessingOptions(options: ProcessingOptions): void {
    if (options.batchSize !== undefined) {
      if (options.batchSize < 1 || options.batchSize > 1000) {
        throw new ValidationError("Batch size must be between 1 and 1000");
      }
    }

    if (options.sentimentThreshold !== undefined) {
      if (options.sentimentThreshold < 0 || options.sentimentThreshold > 1) {
        throw new ValidationError(
          "Sentiment threshold must be between 0 and 1"
        );
      }
    }

    if (options.clusteringThreshold !== undefined) {
      if (options.clusteringThreshold < 0 || options.clusteringThreshold > 1) {
        throw new ValidationError(
          "Clustering threshold must be between 0 and 1"
        );
      }
    }

    if (options.maxSentences !== undefined) {
      if (options.maxSentences < 1 || options.maxSentences > 50000) {
        throw new ValidationError("Max sentences must be between 1 and 50,000");
      }
    }
  }

  public async processFeedbackFromReddit(
    subreddit: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (
        !subreddit ||
        typeof subreddit !== "string" ||
        subreddit.trim() === ""
      ) {
        throw new ValidationError("Subreddit name is required");
      }

      this.validateProcessingOptions(options);

      const {
        batchSize = 25,
        enableClustering = true,
        sentimentThreshold = 0.5,
        clusteringThreshold = 0.3,
        maxSentences = 1000,
      } = options;

      // 1. Fetch Reddit posts
      const posts = await this.redditService.fetchSubredditPosts(
        subreddit,
        batchSize
      );

      if (posts.length === 0) {
        return {
          processedCount: 0,
          sentencesCount: 0,
          clustersCount: 0,
          outlierCount: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // 2. Create feedback source
      const sourceId = await this.databaseService.createFeedbackSource({
        name: `r/${subreddit}`,
        type: "reddit",
        metadata: {
          subreddit,
          fetchedAt: new Date().toISOString(),
          postCount: posts.length,
        },
      });

      // 3. Process posts into feedback entries
      const feedbackEntries: FeedbackEntry[] = posts.map((post) => {
        const postId = post.permalink.split("/")[4] || post.permalink; 
        return {
          sourceId,
          rawText: `${post.title}\n${post.selftext || ""}`.trim(),
          author: post.author,
          timestamp: new Date(post.createdUtc * 1000),
          externalId: postId, // Add this line
          metadata: {
            postId: postId, // Use extracted ID, not full permalink
            permalink: post.permalink,
            score: post.score,
            subreddit: post.subreddit,
            url: `https://reddit.com${post.permalink}`,
          },
        };
      });

      // 4. Store feedback entries and get IDs
      const entryIds =
        await this.databaseService.createFeedbackEntries(feedbackEntries);

      // 5. Process sentences with NLP
      const allSentences: ProcessedSentence[] = [];

      for (let i = 0; i < feedbackEntries.length; i++) {
        const entry = feedbackEntries[i];
        const entryId = entryIds[i];

        if (!entry || !entryId) continue;

        // Split into sentences
        const sentences = this.nlpService.splitIntoSentences(entry.rawText);

        // Process each sentence
        for (const sentenceText of sentences) {
          if (allSentences.length >= maxSentences) {
            break;
          }

          try {
            // Analyze sentiment
            const sentiment =
              await this.nlpService.analyzeSentiment(sentenceText);

            // Skip sentences below sentiment threshold
            if (sentiment.confidence < sentimentThreshold) {
              continue;
            }

            // Generate embedding
            const embedding = await this.nlpService.embedText(sentenceText);

            const processedSentence: ProcessedSentence = {
              entryId,
              text: sentenceText,
              sentimentScore: sentiment.score,
              sentimentLabel: sentiment.label,
              embedding: [...embedding], // Convert to mutable array
              categories: [], // Will be populated by clustering
            };

            allSentences.push(processedSentence);
          } catch (error) {
            console.warn(`Failed to process sentence: ${sentenceText}`, error);
            // Continue processing other sentences
          }
        }

        if (allSentences.length >= maxSentences) {
          break;
        }
      }

      // 6. Store processed sentences
      const sentenceIds =
        await this.databaseService.createSentences(allSentences);

      // 7. Perform clustering if enabled
      let clusterResult: ClusterResult | null = null;

      if (enableClustering && allSentences.length > 1) {
        try {
          const sentencesWithEmbedding = allSentences.map(
            (sentence, index) => ({
              id: sentenceIds[index] || 0,
              text: sentence.text,
              embedding: sentence.embedding,
            })
          );

          clusterResult = await this.clusteringService.clusterSentences(
            sentencesWithEmbedding,
            clusteringThreshold
          );

          // Store clustering results
          if (clusterResult.clusters.length > 0) {
            await this.databaseService.createFeedbackGroups(
              clusterResult.clusters.map((cluster) => ({
                name: cluster.theme,
                description: `Cluster of ${cluster.sentenceIds.length} similar feedback items`,
                sentenceIds: cluster.sentenceIds,
                trendScore: cluster.confidence,
                metadata: {
                  clusterId: cluster.id,
                  centroid: cluster.centroid,
                  confidence: cluster.confidence,
                },
              }))
            );
          }
        } catch (error) {
          console.warn(
            "Clustering failed, continuing without clustering:",
            error
          );
          clusterResult = { clusters: [], outliers: [] };
        }
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        processedCount: feedbackEntries.length,
        sentencesCount: allSentences.length,
        clustersCount: clusterResult?.clusters.length || 0,
        outlierCount: clusterResult?.outliers.length || 0,
        processingTimeMs,
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof ExternalApiError
      ) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to process Reddit feedback: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  public async processFeedbackFromFile(
    fileContent: string,
    sourceName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (
        !fileContent ||
        typeof fileContent !== "string" ||
        fileContent.trim() === ""
      ) {
        throw new ValidationError("File content cannot be empty");
      }

      if (
        !sourceName ||
        typeof sourceName !== "string" ||
        sourceName.trim() === ""
      ) {
        throw new ValidationError("Source name is required");
      }

      this.validateProcessingOptions(options);

      const {
        enableClustering = true,
        sentimentThreshold = 0.5,
        clusteringThreshold = 0.3,
        maxSentences = 1000,
      } = options;

      // 1. Create feedback source
      const sourceId = await this.databaseService.createFeedbackSource({
        name: sourceName,
        type: "file_upload",
        metadata: {
          uploadedAt: new Date().toISOString(),
          contentLength: fileContent.length,
        },
      });

      // 2. Create single feedback entry
      const feedbackEntry: FeedbackEntry = {
        sourceId,
        rawText: fileContent,
        author: "file_upload",
        timestamp: new Date(),
        metadata: {
          sourceName,
          type: "bulk_text",
        },
      };

      const [entryId] = await this.databaseService.createFeedbackEntries([
        feedbackEntry,
      ]);

      if (!entryId) {
        throw new ExternalApiError(
          "Database",
          "Failed to create feedback entry",
          500
        );
      }

      // 3. Process sentences with NLP
      const sentences = this.nlpService.splitIntoSentences(fileContent);
      const allSentences: ProcessedSentence[] = [];

      // Process sentences in batches for better performance
      const batchSize = 10;
      for (
        let i = 0;
        i < sentences.length && allSentences.length < maxSentences;
        i += batchSize
      ) {
        const batch = sentences.slice(i, i + batchSize);

        try {
          // Batch process sentiment analysis
          const sentiments = await this.nlpService.batchAnalyzeSentiment(batch);

          // Batch process embeddings
          const embeddings = await this.nlpService.batchEmbedTexts(batch);

          // Combine results
          for (let j = 0; j < batch.length; j++) {
            const sentenceText = batch[j];
            const sentiment = sentiments[j];
            const embedding = embeddings[j];

            if (!sentenceText || !sentiment || !embedding) continue;

            // Skip sentences below sentiment threshold
            if (sentiment.confidence < sentimentThreshold) {
              continue;
            }

            const processedSentence: ProcessedSentence = {
              entryId,
              text: sentenceText,
              sentimentScore: sentiment.score,
              sentimentLabel: sentiment.label,
              embedding: [...embedding],
              categories: [],
            };

            allSentences.push(processedSentence);

            if (allSentences.length >= maxSentences) {
              break;
            }
          }
        } catch (error) {
          console.warn(
            `Failed to process sentence batch starting at index ${i}:`,
            error
          );
          // Continue with next batch
        }
      }

      // 4. Store processed sentences
      const sentenceIds =
        await this.databaseService.createSentences(allSentences);

      // 5. Perform clustering if enabled
      let clusterResult: ClusterResult | null = null;

      if (enableClustering && allSentences.length > 1) {
        try {
          const sentencesWithEmbedding = allSentences.map(
            (sentence, index) => ({
              id: sentenceIds[index] || 0,
              text: sentence.text,
              embedding: sentence.embedding,
            })
          );

          clusterResult = await this.clusteringService.clusterSentences(
            sentencesWithEmbedding,
            clusteringThreshold
          );

          // Store clustering results
          if (clusterResult.clusters.length > 0) {
            await this.databaseService.createFeedbackGroups(
              clusterResult.clusters.map((cluster) => ({
                name: cluster.theme,
                description: `Cluster of ${cluster.sentenceIds.length} similar feedback items`,
                sentenceIds: cluster.sentenceIds,
                trendScore: cluster.confidence,
                metadata: {
                  clusterId: cluster.id,
                  centroid: cluster.centroid,
                  confidence: cluster.confidence,
                },
              }))
            );
          }
        } catch (error) {
          console.warn(
            "Clustering failed, continuing without clustering:",
            error
          );
          clusterResult = { clusters: [], outliers: [] };
        }
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        processedCount: 1,
        sentencesCount: allSentences.length,
        clustersCount: clusterResult?.clusters.length || 0,
        outlierCount: clusterResult?.outliers.length || 0,
        processingTimeMs,
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof ExternalApiError
      ) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to process file feedback: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  public async getDashboardData(
    timeframe: string = "7d"
  ): Promise<DashboardData> {
    try {
      // Validate timeframe
      const validTimeframes = ["1d", "7d", "30d", "90d"];
      if (!validTimeframes.includes(timeframe)) {
        throw new ValidationError(
          `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}`
        );
      }

      // Get basic metrics
      const totalSources = await this.databaseService.getFeedbackSourceCount();
      const totalEntries = await this.databaseService.getFeedbackEntryCount();
      const totalSentences = await this.databaseService.getSentenceCount();
      const totalGroups = await this.databaseService.getFeedbackGroupCount();

      // Get sentiment distribution
      const sentimentDistribution =
        await this.databaseService.getSentimentDistribution(timeframe);

      // Get recent trends
      const trends = await this.databaseService.getSentimentTrends(timeframe);

      // Get top feedback groups
      const groups = await this.databaseService.getTopFeedbackGroups(10);

      // Get recent alerts (sentiment anomalies)
      const alerts = await this.detectAnomalies(timeframe);

      return {
        metrics: {
          totalSources,
          totalEntries,
          totalSentences,
          totalGroups,
          sentimentDistribution,
        },
        trends,
        groups,
        alerts,
        timeframe,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to get dashboard data: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  public async getSentimentTrends(
    timeframe: string = "7d"
  ): Promise<TrendData[]> {
    try {
      const validTimeframes = ["1d", "7d", "30d", "90d"];
      if (!validTimeframes.includes(timeframe)) {
        throw new ValidationError(
          `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}`
        );
      }

      return await this.databaseService.getSentimentTrends(timeframe);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to get sentiment trends: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  public async getFeedbackGroups(limit: number = 20): Promise<FeedbackGroup[]> {
    try {
      if (limit < 1 || limit > 100) {
        throw new ValidationError("Limit must be between 1 and 100");
      }

      return await this.databaseService.getTopFeedbackGroups(limit);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to get feedback groups: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  private async detectAnomalies(timeframe: string): Promise<
    Array<{
      type: string;
      severity: "low" | "medium" | "high";
      description: string;
      timestamp: Date;
    }>
  > {
    try {
      const alerts: Array<{
        type: string;
        severity: "low" | "medium" | "high";
        description: string;
        timestamp: Date;
      }> = [];

      // Get recent sentiment average
      const recentTrends =
        await this.databaseService.getSentimentTrends(timeframe);

      if (recentTrends.length < 2) {
        return alerts; // Not enough data for anomaly detection
      }

      // Calculate recent vs historical sentiment
      const recentAvg =
        recentTrends.slice(-3).reduce((sum: number, trend) => {
          return sum + (trend.positive - trend.negative);
        }, 0) / 3;

      const historicalAvg =
        recentTrends.reduce((sum: number, trend) => {
          return sum + (trend.positive - trend.negative);
        }, 0) / recentTrends.length;

      const sentimentShift = Math.abs(recentAvg - historicalAvg);

      // Detect significant sentiment shifts
      if (sentimentShift > 0.3) {
        alerts.push({
          type: "sentiment_shift",
          severity: sentimentShift > 0.5 ? "high" : "medium",
          description: `Significant sentiment shift detected: ${recentAvg > historicalAvg ? "improvement" : "decline"} of ${(sentimentShift * 100).toFixed(1)}%`,
          timestamp: new Date(),
        });
      }

      // Detect volume anomalies
      const recentVolume = recentTrends.slice(-1)[0]?.total || 0;
      const avgVolume =
        recentTrends.reduce((sum: number, trend) => sum + trend.total, 0) /
        recentTrends.length;

      if (recentVolume > avgVolume * 2) {
        alerts.push({
          type: "volume_spike",
          severity: "medium",
          description: `Feedback volume spike detected: ${((recentVolume / avgVolume - 1) * 100).toFixed(1)}% above average`,
          timestamp: new Date(),
        });
      }

      return alerts;
    } catch (error) {
      console.warn("Anomaly detection failed:", error);
      return []; // Return empty array on failure
    }
  }

  /**
   * Enhanced feedback analysis using Gemini NLP service
   * Provides structured analysis with categories, themes, urgency, and action items
   */
  public async analyzeStructuredFeedback(
    texts: string[]
  ): Promise<StructuredFeedback[]> {
    if (!this.geminiNLPService) {
      throw new ExternalApiError(
        "GeminiNLP",
        "Gemini NLP service is not available. Please configure GOOGLE_API_KEY.",
        503
      );
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new ValidationError("Texts array cannot be empty");
    }

    if (texts.length > 20) {
      throw new ValidationError("Cannot analyze more than 20 texts at once");
    }

    try {
      return await this.geminiNLPService.batchAnalyzeStructuredFeedback(texts);
    } catch (error) {
      throw new ExternalApiError(
        "GeminiNLP",
        `Structured feedback analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  /**
   * Enhanced Reddit processing with Gemini NLP for structured analysis
   */
  public async processRedditWithStructuredAnalysis(
    subreddit: string,
    options: ProcessingOptions & { useGeminiAnalysis?: boolean } = {}
  ): Promise<ProcessingResult & { structuredAnalyses?: StructuredFeedback[] }> {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (
        !subreddit ||
        typeof subreddit !== "string" ||
        subreddit.trim() === ""
      ) {
        throw new ValidationError("Subreddit name is required");
      }

      this.validateProcessingOptions(options);

      const {
        batchSize = 10, // Smaller batch for Gemini processing
        useGeminiAnalysis = true,
      } = options;

      // 1. Fetch Reddit posts
      const posts = await this.redditService.fetchSubredditPosts(
        subreddit,
        batchSize
      );

      if (posts.length === 0) {
        return {
          processedCount: 0,
          sentencesCount: 0,
          clustersCount: 0,
          outlierCount: 0,
          processingTimeMs: Date.now() - startTime,
          structuredAnalyses: [],
        };
      }

      // 2. Create feedback source
      const sourceId = await this.databaseService.createFeedbackSource({
        name: `r/${subreddit} (Enhanced)`,
        type: "reddit_enhanced",
        metadata: {
          subreddit,
          fetchedAt: new Date().toISOString(),
          postCount: posts.length,
          analysisType: "gemini_structured",
        },
      });

      // 3. Process posts into feedback entries
      const feedbackEntries: FeedbackEntry[] = posts.map((post) => ({
        sourceId,
        rawText: `${post.title}\n${post.selftext || ""}`.trim(),
        author: post.author,
        timestamp: new Date(post.createdUtc * 1000),
        metadata: {
          postId: post.permalink,
          score: post.score,
          subreddit: post.subreddit,
          url: post.permalink,
        },
      }));

      // 4. Store feedback entries and get IDs
      const entryIds =
        await this.databaseService.createFeedbackEntries(feedbackEntries);

      // 5. Perform structured analysis with Gemini and create sentences
      let structuredAnalyses: StructuredFeedback[] = [];
      const allSentences: Array<{
        entryId: number;
        text: string;
        sentimentScore: number;
        sentimentLabel: string;
        embedding: number[];
        categories: string[];
        metadata?: Record<string, unknown>;
      }> = [];

      if (useGeminiAnalysis) {
        const texts = feedbackEntries.map((entry) => entry.rawText);
        structuredAnalyses =
          await this.geminiNLPService.batchAnalyzeStructuredFeedback(texts);

        console.log(
          `✅ Gemini analysis completed for ${structuredAnalyses.length} posts`
        );

        // Create sentences with structured analysis metadata
        for (let i = 0; i < feedbackEntries.length; i++) {
          const entry = feedbackEntries[i];
          const entryId = entryIds[i];
          const analysis = structuredAnalyses[i];

          if (!entry || !entryId || !analysis) continue;

          // Convert sentiment to score and ensure valid label
          const sentimentLabel =
            analysis.sentiment.primary === "positive"
              ? "positive"
              : analysis.sentiment.primary === "negative"
                ? "negative"
                : "neutral";

          const sentimentScore =
            analysis.sentiment.primary === "positive"
              ? analysis.sentiment.confidence
              : analysis.sentiment.primary === "negative"
                ? -analysis.sentiment.confidence
                : 0;

          // Generate a simple embedding (we could use NLP service here too)
          const embedding = new Array(384)
            .fill(0)
            .map(() => Math.random() - 0.5);

          const sentence = {
            entryId,
            text: entry.rawText,
            sentimentScore,
            sentimentLabel,
            embedding,
            categories: [analysis.category],
            metadata: {
              structuredAnalysis: analysis,
            },
          };

          console.log(
            `📝 Creating sentence with sentiment: ${sentimentLabel}, score: ${sentimentScore}`
          );

          allSentences.push(sentence);
        }
      }

      // Store sentences with structured analysis
      const sentenceIds =
        await this.databaseService.createSentences(allSentences);

      // 6. Create enhanced feedback groups based on structured analysis
      const feedbackGroups: Array<{
        name: string;
        description: string;
        sentenceIds: number[];
        trendScore: number;
        metadata: Record<string, unknown>;
      }> = [];

      // Group by category
      const categoryGroups = new Map<string, StructuredFeedback[]>();
      structuredAnalyses.forEach((analysis) => {
        const category = analysis.category;
        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, []);
        }
        categoryGroups.get(category)!.push(analysis);
      });

      // Create groups for each category
      for (const [category, analyses] of categoryGroups) {
        if (analyses.length > 0) {
          const themes = [...new Set(analyses.flatMap((a) => a.themes))];
          const avgUrgency = this.calculateAverageUrgency(
            analyses.map((a) => a.urgency)
          );

          feedbackGroups.push({
            name: `${category.replace("_", " ").toUpperCase()} Issues`,
            description: `${analyses.length} feedback items categorized as ${category}. Common themes: ${themes.slice(0, 3).join(", ")}`,
            sentenceIds: [], // Would need to map to actual sentence IDs
            trendScore: avgUrgency,
            metadata: {
              category,
              themes,
              count: analyses.length,
              urgencyLevel: avgUrgency,
              actionItems: [...new Set(analyses.flatMap((a) => a.actionItems))],
            },
          });
        }
      }

      // Store feedback groups
      if (feedbackGroups.length > 0) {
        await this.databaseService.createFeedbackGroups(feedbackGroups);
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        processedCount: feedbackEntries.length,
        sentencesCount: structuredAnalyses.length, // Each post is treated as one "sentence" for structured analysis
        clustersCount: feedbackGroups.length,
        outlierCount: 0,
        processingTimeMs,
        structuredAnalyses,
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof ExternalApiError
      ) {
        throw error;
      }

      throw new ExternalApiError(
        "FeedbackService",
        `Failed to process Reddit feedback with structured analysis: ${error instanceof Error ? error.message : "Unknown error"}`,
        500
      );
    }
  }

  private calculateAverageUrgency(
    urgencies: Array<"low" | "medium" | "high" | "critical">
  ): number {
    const urgencyValues = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    const total = urgencies.reduce(
      (sum, urgency) => sum + urgencyValues[urgency],
      0
    );
    return total / urgencies.length;
  }

  public async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: Record<string, boolean>;
    timestamp: Date;
  }> {
    const services = {
      reddit: false,
      nlp: false,
      clustering: true, // Clustering service doesn't have external dependencies
      database: false,
    };

    try {
      // Check Reddit service
      services.reddit = await this.redditService.healthCheck();
    } catch (error) {
      console.warn("Reddit service health check failed:", error);
    }

    try {
      // Check NLP service
      services.nlp = await this.nlpService.healthCheck();
    } catch (error) {
      console.warn("NLP service health check failed:", error);
    }

    try {
      // Check database service
      services.database = await this.databaseService.healthCheck();
    } catch (error) {
      console.warn("Database service health check failed:", error);
    }

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (healthyServices === totalServices) {
      status = "healthy";
    } else if (healthyServices >= totalServices / 2) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return {
      status,
      services,
      timestamp: new Date(),
    };
  }
}
