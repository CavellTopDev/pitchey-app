import { Pool } from 'pg';
import { AnalyticsEvent } from './event-tracking';

export class DataWarehouseService {
  private static instance: DataWarehouseService;
  private pgPool: Pool;

  private constructor() {
    // Configure PostgreSQL connection
    this.pgPool = new Pool({
      host: process.env.DATA_WAREHOUSE_HOST,
      port: parseInt(process.env.DATA_WAREHOUSE_PORT || '5432'),
      database: process.env.DATA_WAREHOUSE_DB,
      user: process.env.DATA_WAREHOUSE_USER,
      password: process.env.DATA_WAREHOUSE_PASSWORD,
    });
  }

  public static getInstance(): DataWarehouseService {
    if (!DataWarehouseService.instance) {
      DataWarehouseService.instance = new DataWarehouseService();
    }
    return DataWarehouseService.instance;
  }

  // Insert events into data warehouse
  public async insertEvents(events: AnalyticsEvent[]): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      
      for (const event of events) {
        await client.query(
          `INSERT INTO analytics_events 
            (id, timestamp, user_id, user_type, category, type, properties) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.id, 
            new Date(event.timestamp), 
            event.userId, 
            event.userType, 
            event.category, 
            event.type, 
            JSON.stringify(event.properties)
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to insert events', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Run complex analytical queries
  public async runAnalyticalQuery(query: string, params?: any[]): Promise<any[]> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Analytical query failed', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Sample analytical queries
  public async getUserRetentionQuery(days: number): Promise<any[]> {
    const query = `
      WITH user_first_event AS (
        SELECT 
          user_id, 
          MIN(timestamp) AS first_event_date
        FROM analytics_events
        GROUP BY user_id
      ),
      user_retention AS (
        SELECT 
          first_event_date,
          COUNT(DISTINCT user_id) AS total_users,
          COUNT(DISTINCT CASE 
            WHEN timestamp >= first_event_date + INTERVAL '${days} days' 
            THEN user_id 
          END) AS retained_users
        FROM user_first_event
        JOIN analytics_events ON user_first_event.user_id = analytics_events.user_id
        GROUP BY first_event_date
      )
      SELECT 
        first_event_date,
        total_users,
        retained_users,
        (retained_users * 1.0 / total_users) AS retention_rate
      FROM user_retention;
    `;

    return this.runAnalyticalQuery(query);
  }

  // Method to export data for external analysis
  public async exportData(startDate: Date, endDate: Date, format: 'csv' | 'json'): Promise<string> {
    // TODO: Implement data export logic
    // This could generate a file or provide a download link
    return 'export_path_or_url';
  }
}