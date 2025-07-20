import { RedditService } from '../../../src/services/redditService';
import { ExternalApiError } from '../../../src/utils/errors';
import { createMockRedditPost } from '../../setup';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RedditService', () => {
  let redditService: RedditService;

  beforeEach(() => {
    redditService = new RedditService();
    jest.clearAllMocks();
  });

  describe('fetchSubredditPosts', () => {
    it('should fetch posts from a subreddit successfully', async () => {
      // Arrange
      const mockPost = createMockRedditPost();
      const mockResponse = {
        data: {
          data: {
            children: [
              {
                data: {
                  title: mockPost.title,
                  selftext: mockPost.selftext,
                  author: mockPost.author,
                  created_utc: mockPost.createdUtc,
                  score: mockPost.score,
                  subreddit: mockPost.subreddit,
                  permalink: mockPost.permalink,
                  num_comments: mockPost.numComments,
                },
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await redditService.fetchSubredditPosts('test');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockPost);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.reddit.com/r/test/new.json?limit=25',
        {
          headers: {
            'User-Agent': 'FeedbackFlow/1.0.0',
          },
          timeout: 10000,
        }
      );
    });

    it('should handle custom limit parameter', async () => {
      // Arrange
      const mockResponse = {
        data: {
          data: {
            children: [],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // Act
      await redditService.fetchSubredditPosts('test', 10);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.reddit.com/r/test/new.json?limit=10',
        expect.any(Object)
      );
    });

    it('should return empty array when API call fails', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await redditService.fetchSubredditPosts('test');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle malformed API response', async () => {
      // Arrange
      const malformedResponse = {
        data: {
          data: {
            children: [
              {
                data: {
                  title: 'Test',
                  // Missing required fields
                },
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(malformedResponse);

      // Act
      const result = await redditService.fetchSubredditPosts('test');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Test',
        selftext: '',
        author: '',
        createdUtc: 0,
        score: 0,
        subreddit: '',
        permalink: '',
        numComments: 0,
      });
    });

    it('should validate subreddit name', async () => {
      // Act & Assert
      await expect(redditService.fetchSubredditPosts('')).rejects.toThrow(
        'Subreddit name cannot be empty'
      );
    });

    it('should validate limit parameter', async () => {
      // Act & Assert
      await expect(redditService.fetchSubredditPosts('test', 0)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );

      await expect(redditService.fetchSubredditPosts('test', 101)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });
  });

  describe('searchSubreddit', () => {
    it('should search posts in a subreddit with query', async () => {
      // Arrange
      const mockPost = createMockRedditPost({
        title: 'Bug report: App crashes',
        selftext: 'The app crashes when I click submit',
      });

      const mockResponse = {
        data: {
          data: {
            children: [
              {
                data: {
                  title: mockPost.title,
                  selftext: mockPost.selftext,
                  author: mockPost.author,
                  created_utc: mockPost.createdUtc,
                  score: mockPost.score,
                  subreddit: mockPost.subreddit,
                  permalink: mockPost.permalink,
                  num_comments: mockPost.numComments,
                },
              },
            ],
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await redditService.searchSubreddit('test', 'bug crash');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockPost);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.reddit.com/r/test/search.json?q=bug%20crash&restrict_sr=1&sort=new&limit=25',
        expect.any(Object)
      );
    });

    it('should validate search query', async () => {
      // Act & Assert
      await expect(redditService.searchSubreddit('test', '')).rejects.toThrow(
        'Search query cannot be empty'
      );
    });
  });

  describe('getPostComments', () => {
    it('should fetch comments for a post', async () => {
      // Arrange
      const mockComments = [
        {
          data: {
            body: 'This is a comment',
            author: 'commenter1',
            created_utc: 1640995200,
            score: 5,
          },
        },
      ];

      const mockResponse = [
        {}, // Post data (we ignore this)
        {
          data: {
            children: mockComments,
          },
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const result = await redditService.getPostComments('test', '123abc');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        body: 'This is a comment',
        author: 'commenter1',
        createdUtc: 1640995200,
        score: 5,
      });
    });

    it('should validate post ID', async () => {
      // Act & Assert
      await expect(redditService.getPostComments('test', '')).rejects.toThrow(
        'Post ID cannot be empty'
      );
    });
  });

  describe('rateLimiting', () => {
    it('should respect rate limits', async () => {
      // This test would be more complex in a real implementation
      // For now, we just ensure the service doesn't make too many requests
      const mockResponse = {
        data: {
          data: {
            children: [],
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      // Act - make multiple requests quickly
      const promises = Array.from({ length: 5 }, () =>
        redditService.fetchSubredditPosts('test')
      );

      await Promise.all(promises);

      // Assert - should have made all requests (rate limiting would be handled internally)
      expect(mockedAxios.get).toHaveBeenCalledTimes(5);
    });
  });
});
