import { ClusterResult } from '@/types';
import { ValidationError } from '@/utils/errors';

interface SentenceWithEmbedding {
  readonly id: number;
  readonly text: string;
  readonly embedding: readonly number[];
}

interface Cluster {
  readonly id: string;
  sentenceIds: number[];
  centroid: number[];
  theme: string;
  confidence: number;
}

export class ClusteringService {
  private readonly defaultThreshold = 0.3;
  private readonly minClusterSize = 2;
  private readonly maxClusters = 50;

  private validateSentences(sentences: readonly SentenceWithEmbedding[]): void {
    if (!Array.isArray(sentences) || sentences.length === 0) {
      throw new ValidationError('Sentences array cannot be empty');
    }

    if (sentences.length > 10000) {
      throw new ValidationError('Too many sentences to cluster (max 10,000)');
    }

    sentences.forEach((sentence, index) => {
      if (!sentence.id || typeof sentence.id !== 'number') {
        throw new ValidationError(`Sentence at index ${index} must have a valid numeric id`);
      }

      if (!sentence.text || typeof sentence.text !== 'string' || sentence.text.trim() === '') {
        throw new ValidationError(`Sentence at index ${index} must have valid text`);
      }

      if (!Array.isArray(sentence.embedding) || sentence.embedding.length === 0) {
        throw new ValidationError(`Sentence at index ${index} must have a valid embedding array`);
      }

      if (sentence.embedding.some((val: number) => typeof val !== 'number' || isNaN(val))) {
        throw new ValidationError(`Sentence at index ${index} has invalid embedding values`);
      }
    });

    // Validate all embeddings have the same dimension
    const firstEmbeddingLength = sentences[0]?.embedding.length;
    if (sentences.some(s => s.embedding.length !== firstEmbeddingLength)) {
      throw new ValidationError('All embeddings must have the same dimension');
    }
  }

  private validateThreshold(threshold: number): void {
    if (typeof threshold !== 'number' || isNaN(threshold)) {
      throw new ValidationError('Threshold must be a valid number');
    }

    if (threshold < 0 || threshold > 1) {
      throw new ValidationError('Threshold must be between 0 and 1');
    }
  }

  private cosineDistance(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length) {
      throw new ValidationError('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 1; // Maximum distance for zero vectors
    }

    const similarity = dotProduct / (normA * normB);
    return 1 - similarity; // Convert similarity to distance
  }

  private cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    return 1 - this.cosineDistance(a, b);
  }

  private updateCentroid(current: readonly number[], newPoint: readonly number[], count: number): number[] {
    if (current.length !== newPoint.length) {
      throw new ValidationError('Vectors must have the same dimension');
    }

    // Weighted average: (current * (count-1) + newPoint) / count
    return current.map((val, i) => {
      const newVal = newPoint[i];
      return newVal !== undefined ? ((val * (count - 1)) + newVal) / count : val;
    });
  }

  private generateClusterId(): string {
    return `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTheme(sentences: readonly SentenceWithEmbedding[]): string {
    if (sentences.length === 0) {
      return 'Empty cluster';
    }

    // Simple theme generation based on common words
    // In a real implementation, this could use more sophisticated NLP
    const allWords = sentences
      .flatMap(s => s.text.toLowerCase().split(/\s+/))
      .filter(word => word.length > 3) // Filter out short words
      .filter(word => !/^(the|and|or|but|in|on|at|to|for|of|with|by)$/.test(word)); // Filter stop words

    const wordCounts = new Map<string, number>();
    allWords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    return sortedWords.length > 0 ? sortedWords.join(', ') : 'General feedback';
  }

  private calculateClusterConfidence(
    sentences: readonly SentenceWithEmbedding[],
    centroid: readonly number[]
  ): number {
    if (sentences.length === 0) {
      return 0;
    }

    const similarities = sentences.map(s => this.cosineSimilarity(s.embedding, centroid));
    const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    
    // Normalize to 0-1 range and apply some adjustments
    const confidence = Math.max(0, Math.min(1, averageSimilarity));
    
    // Boost confidence for larger clusters (more evidence)
    const sizeBoost = Math.min(0.1, sentences.length * 0.01);
    
    return Math.min(1, confidence + sizeBoost);
  }

  public async clusterSentences(
    sentences: readonly SentenceWithEmbedding[],
    threshold: number = this.defaultThreshold
  ): Promise<ClusterResult> {
    this.validateSentences(sentences);
    this.validateThreshold(threshold);

    const clusters: Cluster[] = [];
    const outliers: number[] = [];
    const processed = new Set<number>();

    // Convert to mutable array for processing
    const sentenceList = [...sentences];

    for (const sentence of sentenceList) {
      if (processed.has(sentence.id)) {
        continue;
      }

      let bestCluster: Cluster | null = null;
      let bestSimilarity = 0;

      // Find the best matching cluster
      for (const cluster of clusters) {
        const similarity = this.cosineSimilarity(sentence.embedding, cluster.centroid);
        
        if (similarity > threshold && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = cluster;
        }
      }

      if (bestCluster) {
        // Add to existing cluster
        bestCluster.sentenceIds.push(sentence.id);
        
        // Update centroid
        const clusterSentences = sentenceList.filter(s => bestCluster!.sentenceIds.includes(s.id));
        bestCluster.centroid = this.updateCentroid(
          bestCluster.centroid,
          sentence.embedding,
          bestCluster.sentenceIds.length
        );

        // Update theme and confidence
        const updatedCluster: Cluster = {
          ...bestCluster,
          theme: this.generateTheme(clusterSentences),
          confidence: this.calculateClusterConfidence(clusterSentences, bestCluster.centroid),
        };

        // Replace the cluster in the array
        const clusterIndex = clusters.findIndex(c => c.id === bestCluster!.id);
        if (clusterIndex !== -1) {
          clusters[clusterIndex] = updatedCluster;
        }
      } else {
        // Create new cluster
        const newCluster: Cluster = {
          id: this.generateClusterId(),
          sentenceIds: [sentence.id],
          centroid: [...sentence.embedding],
          theme: this.generateTheme([sentence]),
          confidence: this.calculateClusterConfidence([sentence], sentence.embedding),
        };

        clusters.push(newCluster);
      }

      processed.add(sentence.id);

      // Prevent too many clusters
      if (clusters.length >= this.maxClusters) {
        break;
      }
    }

    // Filter out small clusters and mark as outliers
    const validClusters: Cluster[] = [];
    
    for (const cluster of clusters) {
      if (cluster.sentenceIds.length >= this.minClusterSize) {
        validClusters.push(cluster);
      } else {
        outliers.push(...cluster.sentenceIds);
      }
    }

    // Sort clusters by size (largest first)
    validClusters.sort((a, b) => b.sentenceIds.length - a.sentenceIds.length);

    return {
      clusters: validClusters.map(cluster => ({
        id: cluster.id,
        sentenceIds: [...cluster.sentenceIds], // Make readonly
        centroid: [...cluster.centroid], // Make readonly
        theme: cluster.theme,
        confidence: cluster.confidence,
      })),
      outliers: [...outliers], // Make readonly
    };
  }

  public async findSimilarSentences(
    targetSentence: SentenceWithEmbedding,
    sentences: readonly SentenceWithEmbedding[],
    threshold: number = this.defaultThreshold,
    maxResults: number = 10
  ): Promise<Array<{ sentence: SentenceWithEmbedding; similarity: number }>> {
    this.validateSentences([targetSentence]);
    this.validateSentences(sentences);
    this.validateThreshold(threshold);

    if (maxResults < 1 || maxResults > 100) {
      throw new ValidationError('maxResults must be between 1 and 100');
    }

    const similarities = sentences
      .filter(s => s.id !== targetSentence.id) // Exclude the target sentence itself
      .map(sentence => ({
        sentence,
        similarity: this.cosineSimilarity(targetSentence.embedding, sentence.embedding),
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    return similarities;
  }

  public async mergeClusters(
    cluster1: Cluster,
    cluster2: Cluster,
    sentences: readonly SentenceWithEmbedding[]
  ): Promise<Cluster> {
    if (!cluster1.sentenceIds.length || !cluster2.sentenceIds.length) {
      throw new ValidationError('Cannot merge empty clusters');
    }

    const mergedSentenceIds = [...cluster1.sentenceIds, ...cluster2.sentenceIds];
    const mergedSentences = sentences.filter(s => mergedSentenceIds.includes(s.id));

    if (mergedSentences.length !== mergedSentenceIds.length) {
      throw new ValidationError('Some sentences not found in the provided sentences array');
    }

    // Calculate new centroid as weighted average
    const totalSentences = mergedSentenceIds.length;
    const weight1 = cluster1.sentenceIds.length / totalSentences;
    const weight2 = cluster2.sentenceIds.length / totalSentences;

    const newCentroid = cluster1.centroid.map((val, i) => {
      const val2 = cluster2.centroid[i];
      return val2 !== undefined ? val * weight1 + val2 * weight2 : val;
    });

    return {
      id: this.generateClusterId(),
      sentenceIds: mergedSentenceIds,
      centroid: newCentroid,
      theme: this.generateTheme(mergedSentences),
      confidence: this.calculateClusterConfidence(mergedSentences, newCentroid),
    };
  }

  public getOptimalThreshold(sentences: readonly SentenceWithEmbedding[]): number {
    this.validateSentences(sentences);

    if (sentences.length < 10) {
      return this.defaultThreshold;
    }

    // Sample a subset for performance
    const sampleSize = Math.min(100, sentences.length);
    const sample = sentences.slice(0, sampleSize);

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let pairCount = 0;

      for (let i = 0; i < sample.length - 1; i++) {
        for (let j = i + 1; j < sample.length; j++) {
          const sampleI = sample[i];
          const sampleJ = sample[j];
          if (sampleI && sampleJ) {
            totalSimilarity += this.cosineSimilarity(sampleI.embedding, sampleJ.embedding);
            pairCount++;
          }
        }
      }

    const averageSimilarity = totalSimilarity / pairCount;
    
    // Set threshold slightly above average to create meaningful clusters
    return Math.min(0.8, Math.max(0.1, averageSimilarity + 0.1));
  }

  public async evaluateClustering(
    result: ClusterResult,
    sentences: readonly SentenceWithEmbedding[]
  ): Promise<{
    readonly silhouetteScore: number;
    readonly intraClusterDistance: number;
    readonly interClusterDistance: number;
    readonly clusterSizes: readonly number[];
  }> {
    if (result.clusters.length === 0) {
      return {
        silhouetteScore: 0,
        intraClusterDistance: 0,
        interClusterDistance: 0,
        clusterSizes: [],
      };
    }

    // Calculate intra-cluster distances (how tight clusters are)
    let totalIntraDistance = 0;
    let intraCount = 0;

    for (const cluster of result.clusters) {
      const clusterSentences = sentences.filter(s => cluster.sentenceIds.includes(s.id));
      
      for (let i = 0; i < clusterSentences.length - 1; i++) {
        for (let j = i + 1; j < clusterSentences.length; j++) {
          const sentenceI = clusterSentences[i];
          const sentenceJ = clusterSentences[j];
          if (sentenceI && sentenceJ) {
            totalIntraDistance += this.cosineDistance(
              sentenceI.embedding,
              sentenceJ.embedding
            );
            intraCount++;
          }
        }
      }
    }

    const avgIntraDistance = intraCount > 0 ? totalIntraDistance / intraCount : 0;

    // Calculate inter-cluster distances (how separated clusters are)
    let totalInterDistance = 0;
    let interCount = 0;

    for (let i = 0; i < result.clusters.length - 1; i++) {
      for (let j = i + 1; j < result.clusters.length; j++) {
        const clusterI = result.clusters[i];
        const clusterJ = result.clusters[j];
        if (clusterI && clusterJ) {
          totalInterDistance += this.cosineDistance(
            clusterI.centroid,
            clusterJ.centroid
          );
          interCount++;
        }
      }
    }

    const avgInterDistance = interCount > 0 ? totalInterDistance / interCount : 0;

    // Simple silhouette score approximation
    const silhouetteScore = avgInterDistance > 0 ? 
      (avgInterDistance - avgIntraDistance) / Math.max(avgInterDistance, avgIntraDistance) : 0;

    return {
      silhouetteScore: Math.max(-1, Math.min(1, silhouetteScore)),
      intraClusterDistance: avgIntraDistance,
      interClusterDistance: avgInterDistance,
      clusterSizes: result.clusters.map(c => c.sentenceIds.length),
    };
  }
}
