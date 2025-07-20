import axios, { AxiosResponse } from 'axios';
import { RedditPost } from '@/types';
import { ExternalApiError, ValidationError } from '@/utils/errors';
import { config } from '@/config';

interface RedditApiResponse {
  data: {
    children: Array<{
      data: {
        title: string;
        selftext: string;
        author: string;
        created_utc: number;
        score: number;
        subreddit: string;
        permalink: string;
        num_comments: number;
        body?: string; // For comments
      };
    }>;
  };
}

interface RedditComment {
  readonly body: string;
  readonly author: string;
  readonly createdUtc: number;
  readonly score: number;
}

export class RedditService {
  private readonly baseUrl = 'https://www.reddit.com';
  private readonly userAgent: string;
  private readonly rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor() {
    this.userAgent = config.apis.reddit.userAgent;
  }

  private async makeRequest<T>(url: string): Promise<AxiosResponse<T>> {
    // Simple rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }

    try {
      const response = await axios.get<T>(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000, // 10 second timeout
      });

      this.lastRequestTime = Date.now();
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ExternalApiError(
          'Reddit',
          error.message,
          error.response?.status
        );
      }
      throw error;
    }
  }

  private validateSubreddit(subreddit: string): void {
    if (!subreddit || subreddit.trim() === '') {
      throw new ValidationError('Subreddit name cannot be empty');
    }
  }

  private validateLimit(limit: number): void {
    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }
  }

  private validateQuery(query: string): void {
    if (!query || query.trim() === '') {
      throw new ValidationError('Search query cannot be empty');
    }
  }

  private validatePostId(postId: string): void {
    if (!postId || postId.trim() === '') {
      throw new ValidationError('Post ID cannot be empty');
    }
  }

  private mapRedditPostData(data: RedditApiResponse['data']['children'][0]['data']): RedditPost {
    return {
      title: data.title || '',
      selftext: data.selftext || '',
      author: data.author || '',
      createdUtc: data.created_utc || 0,
      score: data.score || 0,
      subreddit: data.subreddit || '',
      permalink: data.permalink || '',
      numComments: data.num_comments || 0,
    };
  }

  public async fetchSubredditPosts(
    subreddit: string, 
    limit: number = 25
  ): Promise<RedditPost[]> {
    this.validateSubreddit(subreddit);
    this.validateLimit(limit);

    try {
      const url = `${this.baseUrl}/r/${subreddit}/new.json?limit=${limit}`;
      const response = await this.makeRequest<RedditApiResponse>(url);

      return response.data.data.children.map(child => 
        this.mapRedditPostData(child.data)
      );
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }
      
      // Log error but return empty array for resilience
      console.error('Reddit API error:', error);
      return [];
    }
  }

  public async searchSubreddit(
    subreddit: string,
    query: string,
    limit: number = 25
  ): Promise<RedditPost[]> {
    this.validateSubreddit(subreddit);
    this.validateQuery(query);
    this.validateLimit(limit);

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodedQuery}&restrict_sr=1&sort=new&limit=${limit}`;
      
      const response = await this.makeRequest<RedditApiResponse>(url);

      return response.data.data.children.map(child => 
        this.mapRedditPostData(child.data)
      );
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }
      
      console.error('Reddit search error:', error);
      return [];
    }
  }

  public async getPostComments(
    subreddit: string,
    postId: string,
    limit: number = 25
  ): Promise<RedditComment[]> {
    this.validateSubreddit(subreddit);
    this.validatePostId(postId);
    this.validateLimit(limit);

    try {
      const url = `${this.baseUrl}/r/${subreddit}/comments/${postId}.json?limit=${limit}`;
      const response = await this.makeRequest<RedditApiResponse[]>(url);

      // Reddit returns an array where the second element contains comments
      const commentsData = response.data[1];
      if (!commentsData?.data?.children) {
        return [];
      }

      return commentsData.data.children
        .filter(child => child.data.body) // Filter out deleted/removed comments
        .map(child => ({
          body: child.data.body || '',
          author: child.data.author || '',
          createdUtc: child.data.created_utc || 0,
          score: child.data.score || 0,
        }));
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalApiError) {
        throw error;
      }
      
      console.error('Reddit comments error:', error);
      return [];
    }
  }

  public async getMultipleSubreddits(
    subreddits: string[],
    limit: number = 25
  ): Promise<{ subreddit: string; posts: RedditPost[] }[]> {
    if (!subreddits.length) {
      throw new ValidationError('At least one subreddit must be provided');
    }

    const results = await Promise.allSettled(
      subreddits.map(async subreddit => ({
        subreddit,
        posts: await this.fetchSubredditPosts(subreddit, limit),
      }))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ subreddit: string; posts: RedditPost[] }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  public async searchMultipleSubreddits(
    subreddits: string[],
    query: string,
    limit: number = 25
  ): Promise<{ subreddit: string; posts: RedditPost[] }[]> {
    if (!subreddits.length) {
      throw new ValidationError('At least one subreddit must be provided');
    }

    this.validateQuery(query);

    const results = await Promise.allSettled(
      subreddits.map(async subreddit => ({
        subreddit,
        posts: await this.searchSubreddit(subreddit, query, limit),
      }))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ subreddit: string; posts: RedditPost[] }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch a small amount of data from a popular subreddit
      const posts = await this.fetchSubredditPosts('announcements', 1);
      return Array.isArray(posts);
    } catch (error) {
      console.error('Reddit service health check failed:', error);
      return false;
    }
  }
}
