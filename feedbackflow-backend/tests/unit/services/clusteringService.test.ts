import { ClusteringService } from '../../../src/services/clusteringService';
import { ValidationError } from '../../../src/utils/errors';

interface SentenceWithEmbedding {
  readonly id: number;
  readonly text: string;
  readonly embedding: readonly number[];
}

describe('ClusteringService', () => {
  let clusteringService: ClusteringService;

  beforeEach(() => {
    clusteringService = new ClusteringService();
  });

  // Helper function to create mock sentences with embeddings
  const createMockSentence = (
    id: number,
    text: string,
    embedding: number[]
  ): SentenceWithEmbedding => ({
    id,
    text,
    embedding,
  });

  // Helper function to create similar embeddings
  const createSimilarEmbedding = (base: number[], variation: number = 0.1): number[] => {
    return base.map(val => val + (Math.random() - 0.5) * variation);
  };

  describe('clusterSentences', () => {
    it('should cluster similar sentences together', async () => {
      // Arrange
      const baseEmbedding1 = [0.8, 0.2, 0.1, 0.3];
      const baseEmbedding2 = [0.1, 0.8, 0.3, 0.2];

      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Great product quality', baseEmbedding1),
        createMockSentence(2, 'Excellent product features', createSimilarEmbedding(baseEmbedding1, 0.05)),
        createMockSentence(3, 'Poor customer service', baseEmbedding2),
        createMockSentence(4, 'Bad support experience', createSimilarEmbedding(baseEmbedding2, 0.05)),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.8);

      // Assert
      expect(result.clusters).toHaveLength(2);
      expect(result.clusters[0]?.sentenceIds).toHaveLength(2);
      expect(result.clusters[1]?.sentenceIds).toHaveLength(2);
      expect(result.outliers).toHaveLength(0);
    });

    it('should handle single sentence clusters as outliers', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]),
        createMockSentence(2, 'Poor service', [0.1, 0.8, 0.2]),
        createMockSentence(3, 'Average experience', [0.5, 0.5, 0.5]),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.9);

      // Assert
      expect(result.clusters).toHaveLength(0);
      expect(result.outliers).toHaveLength(3);
    });

    it('should generate meaningful themes for clusters', async () => {
      // Arrange
      const baseEmbedding = [0.8, 0.2, 0.1, 0.3];
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Great product quality and features', baseEmbedding),
        createMockSentence(2, 'Excellent product design and quality', createSimilarEmbedding(baseEmbedding, 0.05)),
        createMockSentence(3, 'Amazing product functionality', createSimilarEmbedding(baseEmbedding, 0.05)),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.7);

      // Assert
      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0]?.theme).toContain('product');
    });

    it('should validate input sentences', async () => {
      // Act & Assert
      await expect(clusteringService.clusterSentences([], 0.5)).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate threshold parameter', async () => {
      // Arrange
      const sentences = [createMockSentence(1, 'Test', [0.5, 0.5])];

      // Act & Assert
      await expect(clusteringService.clusterSentences(sentences, -0.1)).rejects.toThrow(
        ValidationError
      );
      await expect(clusteringService.clusterSentences(sentences, 1.1)).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate sentence structure', async () => {
      // Arrange
      const invalidSentences = [
        { id: 0, text: '', embedding: [0.5, 0.5] }, // Invalid id and empty text
      ] as SentenceWithEmbedding[];

      // Act & Assert
      await expect(clusteringService.clusterSentences(invalidSentences, 0.5)).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate embedding dimensions consistency', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Test 1', [0.5, 0.5]),
        createMockSentence(2, 'Test 2', [0.5, 0.5, 0.5]), // Different dimension
      ];

      // Act & Assert
      await expect(clusteringService.clusterSentences(sentences, 0.5)).rejects.toThrow(
        ValidationError
      );
    });

    it('should limit maximum number of clusters', async () => {
      // Arrange - Create many dissimilar sentences
      const sentences: SentenceWithEmbedding[] = [];
      for (let i = 1; i <= 60; i++) {
        const embedding = new Array(10).fill(0);
        embedding[i % 10] = 1; // Make each embedding unique
        sentences.push(createMockSentence(i, `Sentence ${i}`, embedding));
      }

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.1);

      // Assert - Should not exceed max clusters (50)
      expect(result.clusters.length).toBeLessThanOrEqual(50);
    });

    it('should sort clusters by size', async () => {
      // Arrange
      const baseEmbedding1 = [0.8, 0.2, 0.1];
      const baseEmbedding2 = [0.1, 0.8, 0.2];
      const baseEmbedding3 = [0.2, 0.1, 0.8];

      const sentences: SentenceWithEmbedding[] = [
        // Cluster 1 - 2 sentences
        createMockSentence(1, 'Good product', baseEmbedding1),
        createMockSentence(2, 'Great product', createSimilarEmbedding(baseEmbedding1, 0.05)),
        // Cluster 2 - 3 sentences
        createMockSentence(3, 'Bad service', baseEmbedding2),
        createMockSentence(4, 'Poor service', createSimilarEmbedding(baseEmbedding2, 0.05)),
        createMockSentence(5, 'Terrible support', createSimilarEmbedding(baseEmbedding2, 0.05)),
        // Cluster 3 - 4 sentences
        createMockSentence(6, 'Fast delivery', baseEmbedding3),
        createMockSentence(7, 'Quick shipping', createSimilarEmbedding(baseEmbedding3, 0.05)),
        createMockSentence(8, 'Rapid delivery', createSimilarEmbedding(baseEmbedding3, 0.05)),
        createMockSentence(9, 'Speedy service', createSimilarEmbedding(baseEmbedding3, 0.05)),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.7);

      // Assert
      expect(result.clusters).toHaveLength(3);
      expect(result.clusters[0]?.sentenceIds.length).toBeGreaterThanOrEqual(
        result.clusters[1]?.sentenceIds.length || 0
      );
      expect(result.clusters[1]?.sentenceIds.length).toBeGreaterThanOrEqual(
        result.clusters[2]?.sentenceIds.length || 0
      );
    });
  });

  describe('findSimilarSentences', () => {
    it('should find similar sentences above threshold', async () => {
      // Arrange
      const targetSentence = createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]);
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(2, 'Excellent product', [0.85, 0.15, 0.1]), // Very similar
        createMockSentence(3, 'Good product', [0.75, 0.25, 0.1]), // Similar
        createMockSentence(4, 'Bad service', [0.1, 0.8, 0.2]), // Dissimilar
      ];

      // Act
      const result = await clusteringService.findSimilarSentences(
        targetSentence,
        sentences,
        0.8,
        10
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(2);
      expect(result[0]?.similarity).toBeGreaterThanOrEqual(0.8);
    });

    it('should exclude target sentence from results', async () => {
      // Arrange
      const targetSentence = createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]);
      const sentences: SentenceWithEmbedding[] = [
        targetSentence, // Same sentence
        createMockSentence(2, 'Excellent product', [0.85, 0.15, 0.1]),
      ];

      // Act
      const result = await clusteringService.findSimilarSentences(
        targetSentence,
        sentences,
        0.5,
        10
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.sentence.id).toBe(2);
    });

    it('should respect maxResults parameter', async () => {
      // Arrange
      const targetSentence = createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]);
      const sentences: SentenceWithEmbedding[] = [];
      
      for (let i = 2; i <= 10; i++) {
        sentences.push(createMockSentence(i, `Product ${i}`, [0.8, 0.2, 0.1]));
      }

      // Act
      const result = await clusteringService.findSimilarSentences(
        targetSentence,
        sentences,
        0.5,
        3
      );

      // Assert
      expect(result).toHaveLength(3);
    });

    it('should validate maxResults parameter', async () => {
      // Arrange
      const targetSentence = createMockSentence(1, 'Test', [0.5, 0.5]);
      const sentences = [createMockSentence(2, 'Test 2', [0.5, 0.5])];

      // Act & Assert
      await expect(
        clusteringService.findSimilarSentences(targetSentence, sentences, 0.5, 0)
      ).rejects.toThrow(ValidationError);

      await expect(
        clusteringService.findSimilarSentences(targetSentence, sentences, 0.5, 101)
      ).rejects.toThrow(ValidationError);
    });

    it('should sort results by similarity descending', async () => {
      // Arrange
      const targetSentence = createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]);
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(2, 'Good product', [0.75, 0.25, 0.1]), // Less similar
        createMockSentence(3, 'Excellent product', [0.85, 0.15, 0.1]), // More similar
      ];

      // Act
      const result = await clusteringService.findSimilarSentences(
        targetSentence,
        sentences,
        0.5,
        10
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]?.similarity).toBeGreaterThanOrEqual(result[1]?.similarity || 0);
    });
  });

  describe('mergeClusters', () => {
    it('should merge two clusters correctly', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Great product', [0.8, 0.2]),
        createMockSentence(2, 'Good product', [0.75, 0.25]),
        createMockSentence(3, 'Bad service', [0.2, 0.8]),
        createMockSentence(4, 'Poor service', [0.25, 0.75]),
      ];

      const cluster1 = {
        id: 'cluster1',
        sentenceIds: [1, 2],
        centroid: [0.775, 0.225],
        theme: 'product',
        confidence: 0.9,
      };

      const cluster2 = {
        id: 'cluster2',
        sentenceIds: [3, 4],
        centroid: [0.225, 0.775],
        theme: 'service',
        confidence: 0.8,
      };

      // Act
      const result = await clusteringService.mergeClusters(cluster1, cluster2, sentences);

      // Assert
      expect(result.sentenceIds).toHaveLength(4);
      expect(result.sentenceIds).toEqual(expect.arrayContaining([1, 2, 3, 4]));
      expect(result.centroid).toHaveLength(2);
      expect(result.theme).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should validate cluster inputs', async () => {
      // Arrange
      const sentences = [createMockSentence(1, 'Test', [0.5, 0.5])];
      const emptyCluster = {
        id: 'empty',
        sentenceIds: [],
        centroid: [0.5, 0.5],
        theme: 'empty',
        confidence: 0,
      };
      const validCluster = {
        id: 'valid',
        sentenceIds: [1],
        centroid: [0.5, 0.5],
        theme: 'test',
        confidence: 0.8,
      };

      // Act & Assert
      await expect(
        clusteringService.mergeClusters(emptyCluster, validCluster, sentences)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate sentence availability', async () => {
      // Arrange
      const sentences = [createMockSentence(1, 'Test', [0.5, 0.5])];
      const cluster1 = {
        id: 'cluster1',
        sentenceIds: [1],
        centroid: [0.5, 0.5],
        theme: 'test',
        confidence: 0.8,
      };
      const cluster2 = {
        id: 'cluster2',
        sentenceIds: [999], // Non-existent sentence
        centroid: [0.5, 0.5],
        theme: 'test',
        confidence: 0.8,
      };

      // Act & Assert
      await expect(
        clusteringService.mergeClusters(cluster1, cluster2, sentences)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getOptimalThreshold', () => {
    it('should return default threshold for small datasets', () => {
      // Arrange
      const sentences = [
        createMockSentence(1, 'Test 1', [0.5, 0.5]),
        createMockSentence(2, 'Test 2', [0.6, 0.4]),
      ];

      // Act
      const threshold = clusteringService.getOptimalThreshold(sentences);

      // Assert
      expect(threshold).toBe(0.3); // Default threshold
    });

    it('should calculate threshold based on similarity for larger datasets', () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [];
      for (let i = 1; i <= 20; i++) {
        sentences.push(createMockSentence(i, `Test ${i}`, [0.5 + i * 0.01, 0.5 - i * 0.01]));
      }

      // Act
      const threshold = clusteringService.getOptimalThreshold(sentences);

      // Assert
      expect(threshold).toBeGreaterThan(0.1);
      expect(threshold).toBeLessThanOrEqual(0.8);
    });
  });

  describe('evaluateClustering', () => {
    it('should return zero metrics for empty clustering', async () => {
      // Arrange
      const result = {
        clusters: [],
        outliers: [],
      };
      const sentences: SentenceWithEmbedding[] = [];

      // Act
      const evaluation = await clusteringService.evaluateClustering(result, sentences);

      // Assert
      expect(evaluation.silhouetteScore).toBe(0);
      expect(evaluation.intraClusterDistance).toBe(0);
      expect(evaluation.interClusterDistance).toBe(0);
      expect(evaluation.clusterSizes).toHaveLength(0);
    });

    it('should calculate meaningful metrics for valid clustering', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Great product', [0.8, 0.2, 0.1]),
        createMockSentence(2, 'Good product', [0.75, 0.25, 0.1]),
        createMockSentence(3, 'Bad service', [0.1, 0.8, 0.2]),
        createMockSentence(4, 'Poor service', [0.15, 0.75, 0.2]),
      ];

      const result = {
        clusters: [
          {
            id: 'cluster1',
            sentenceIds: [1, 2],
            centroid: [0.775, 0.225, 0.1],
            theme: 'product',
            confidence: 0.9,
          },
          {
            id: 'cluster2',
            sentenceIds: [3, 4],
            centroid: [0.125, 0.775, 0.2],
            theme: 'service',
            confidence: 0.8,
          },
        ],
        outliers: [],
      };

      // Act
      const evaluation = await clusteringService.evaluateClustering(result, sentences);

      // Assert
      expect(evaluation.silhouetteScore).toBeGreaterThan(-1);
      expect(evaluation.silhouetteScore).toBeLessThan(1);
      expect(evaluation.intraClusterDistance).toBeGreaterThanOrEqual(0);
      expect(evaluation.interClusterDistance).toBeGreaterThanOrEqual(0);
      expect(evaluation.clusterSizes).toEqual([2, 2]);
    });

    it('should handle single cluster evaluation', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Test 1', [0.8, 0.2]),
        createMockSentence(2, 'Test 2', [0.75, 0.25]),
        createMockSentence(3, 'Test 3', [0.7, 0.3]),
      ];

      const result = {
        clusters: [
          {
            id: 'cluster1',
            sentenceIds: [1, 2, 3],
            centroid: [0.75, 0.25],
            theme: 'test',
            confidence: 0.8,
          },
        ],
        outliers: [],
      };

      // Act
      const evaluation = await clusteringService.evaluateClustering(result, sentences);

      // Assert
      expect(evaluation.interClusterDistance).toBe(0); // No inter-cluster distance with single cluster
      expect(evaluation.intraClusterDistance).toBeGreaterThan(0);
      expect(evaluation.clusterSizes).toEqual([3]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle sentences with zero embeddings', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Test 1', [0, 0, 0]),
        createMockSentence(2, 'Test 2', [0, 0, 0]),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.5);

      // Assert
      expect(result).toBeDefined();
      expect(result.clusters.length + result.outliers.length).toBe(2);
    });

    it('should handle very large embeddings', async () => {
      // Arrange
      const largeEmbedding = new Array(1000).fill(0.001);
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Test 1', largeEmbedding),
        createMockSentence(2, 'Test 2', [...largeEmbedding]),
      ];

      // Act
      const result = await clusteringService.clusterSentences(sentences, 0.9);

      // Assert
      expect(result).toBeDefined();
    });

    it('should validate embedding values for NaN', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [
        createMockSentence(1, 'Test', [NaN, 0.5, 0.3]),
      ];

      // Act & Assert
      await expect(clusteringService.clusterSentences(sentences, 0.5)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle maximum sentence limit', async () => {
      // Arrange
      const sentences: SentenceWithEmbedding[] = [];
      for (let i = 1; i <= 10001; i++) {
        sentences.push(createMockSentence(i, `Test ${i}`, [0.5, 0.5]));
      }

      // Act & Assert
      await expect(clusteringService.clusterSentences(sentences, 0.5)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
