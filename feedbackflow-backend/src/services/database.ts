import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '@/config';
import { DatabaseError } from '@/utils/errors';

export class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string, 
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    try {
      const result = await this.pool.query<T>(text, params);
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      throw new DatabaseError(
        `Failed to get database client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows.length > 0 && result.rows[0]?.health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      throw new DatabaseError(
        `Failed to close database pool: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // Utility methods for common operations
  public async findById<T extends QueryResultRow = QueryResultRow>(
    table: string, 
    id: number | string
  ): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  public async findMany<T extends QueryResultRow = QueryResultRow>(
    table: string,
    conditions: Record<string, unknown> = {},
    orderBy?: string,
    limit?: number,
    offset?: number
  ): Promise<T[]> {
    let query = `SELECT * FROM ${table}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Add WHERE conditions
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => {
          params.push(conditions[key]);
          return `${key} = $${paramIndex++}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    // Add LIMIT
    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }

    // Add OFFSET
    if (offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    const result = await this.query<T>(query, params);
    return result.rows;
  }

  public async insert<T extends QueryResultRow = QueryResultRow>(
    table: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.query<T>(query, values);
    return result.rows[0]!;
  }

  public async update<T extends QueryResultRow = QueryResultRow>(
    table: string,
    id: number | string,
    data: Record<string, unknown>
  ): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query<T>(query, [id, ...values]);
    return result.rows[0] || null;
  }

  public async delete(
    table: string,
    id: number | string
  ): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM ${table} WHERE id = $1`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async count(
    table: string,
    conditions: Record<string, unknown> = {}
  ): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => {
          params.push(conditions[key]);
          return `${key} = $${paramIndex++}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    const result = await this.query<{ count: string }>(query, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  // FeedbackFlow specific methods
  public async createFeedbackSource(data: {
    name: string;
    type: string;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const result = await this.insert('feedback_sources', {
      name: data.name,
      type: data.type,
      metadata: JSON.stringify(data.metadata || {}),
    });
    return result.id as number;
  }

  public async createFeedbackEntries(entries: Array<{
    sourceId: number;
    rawText: string;
    author: string;
    timestamp: Date;
    metadata: Record<string, unknown>;
  }>): Promise<number[]> {
    const ids: number[] = [];
    
    for (const entry of entries) {
      const result = await this.insert('feedback_entries', {
        source_id: entry.sourceId,
        raw_text: entry.rawText,
        author: entry.author,
        timestamp: entry.timestamp,
        metadata: JSON.stringify(entry.metadata),
      });
      ids.push(result.id as number);
    }
    
    return ids;
  }

  public async createSentences(sentences: Array<{
    entryId: number;
    text: string;
    sentimentScore: number;
    sentimentLabel: string;
    embedding: number[];
    categories: string[];
  }>): Promise<number[]> {
    const ids: number[] = [];
    
    for (const sentence of sentences) {
      const result = await this.insert('sentences', {
        entry_id: sentence.entryId,
        text: sentence.text,
        sentiment_score: sentence.sentimentScore,
        sentiment_label: sentence.sentimentLabel,
        categories: sentence.categories, // PostgreSQL array, not JSON
        embedding: sentence.embedding, // PostgreSQL array, not JSON
      });
      ids.push(result.id as number);
    }
    
    return ids;
  }

  public async createFeedbackGroups(groups: Array<{
    name: string;
    description: string;
    sentenceIds: readonly number[];
    trendScore: number;
    metadata?: Record<string, unknown>;
  }>): Promise<number[]> {
    const ids: number[] = [];
    
    for (const group of groups) {
      const result = await this.insert('feedback_groups', {
        name: group.name,
        description: group.description,
        sentence_ids: group.sentenceIds,
        trend_score: group.trendScore,
      });
      ids.push(result.id as number);
    }
    
    return ids;
  }

  public async getFeedbackSourceCount(): Promise<number> {
    return this.count('feedback_sources');
  }

  public async getFeedbackEntryCount(): Promise<number> {
    return this.count('feedback_entries');
  }

  public async getSentenceCount(): Promise<number> {
    return this.count('sentences');
  }

  public async getFeedbackGroupCount(): Promise<number> {
    return this.count('feedback_groups');
  }

  public async getSentimentDistribution(timeframe: string): Promise<Record<string, number>> {
    // Mock implementation - would need actual date filtering
    const result = await this.query(`
      SELECT 
        sentiment_label,
        COUNT(*) as count
      FROM sentences 
      GROUP BY sentiment_label
    `);
    
    const distribution: Record<string, number> = {};
    result.rows.forEach(row => {
      const label = row.sentiment_label as string;
      const count = row.count as string;
      if (label && count) {
        distribution[label] = parseInt(count, 10);
      }
    });
    
    return distribution;
  }

  public async getSentimentTrends(timeframe: string): Promise<Array<{
    date: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>> {
    try {
      // Calculate date range based on timeframe
      let daysBack = 7;
      switch (timeframe) {
        case '1d':
          daysBack = 1;
          break;
        case '7d':
          daysBack = 7;
          break;
        case '30d':
          daysBack = 30;
          break;
        case '90d':
          daysBack = 90;
          break;
        default:
          daysBack = 7;
      }

      const query = `
        SELECT 
          TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD') as date,
          COUNT(CASE WHEN s.sentiment_label = 'positive' THEN 1 END) as positive,
          COUNT(CASE WHEN s.sentiment_label = 'negative' THEN 1 END) as negative,
          COUNT(CASE WHEN s.sentiment_label = 'neutral' THEN 1 END) as neutral,
          COUNT(*) as total
        FROM sentences s
        WHERE s.created_at >= NOW() - INTERVAL '${daysBack} days'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at) ASC
      `;

      const result = await this.query(query);
      
      if (result.rows.length === 0) {
        // Return current date with zero values if no data
        const dateStr = new Date().toISOString().split('T')[0] || '2025-07-20';
        return [
          {
            date: dateStr,
            positive: 0,
            negative: 0,
            neutral: 0,
            total: 0,
          },
        ];
      }

      return result.rows.map(row => {
        const fallbackDate = new Date().toISOString().split('T')[0] || '2025-07-20';
        return {
          date: String(row.date || fallbackDate),
          positive: parseInt(String(row.positive || '0')) || 0,
          negative: parseInt(String(row.negative || '0')) || 0,
          neutral: parseInt(String(row.neutral || '0')) || 0,
          total: parseInt(String(row.total || '0')) || 0,
        };
      });
    } catch (error) {
      console.error('Failed to get sentiment trends:', error);
      // Fallback to current date with zero values
      const dateStr = new Date().toISOString().split('T')[0] || '2025-07-20';
      return [
        {
          date: dateStr,
          positive: 0,
          negative: 0,
          neutral: 0,
          total: 0,
        },
      ];
    }
  }

  public async getTopFeedbackGroups(limit: number): Promise<Array<{
    id: number;
    name: string;
    description: string;
    sentenceIds: readonly number[];
    trendScore: number;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const result = await this.query(`
      SELECT * FROM feedback_groups 
      ORDER BY trend_score DESC 
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => ({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string,
      sentenceIds: Array.isArray(row.sentence_ids) ? row.sentence_ids as number[] : [],
      trendScore: row.trend_score as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
