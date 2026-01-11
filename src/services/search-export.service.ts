/**
 * Search Export Service
 * Handles exporting search results to various formats (CSV, PDF, Excel, JSON)
 */

import { sql } from '../lib/db';

export interface ExportRequest {
  user_id: number;
  export_format: 'csv' | 'pdf' | 'excel' | 'json';
  search_query: string;
  filters?: any;
  results_count: number;
  file_size?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  expires_at?: Date;
  created_at: Date;
}

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel' | 'json';
  includeFields?: string[];
  excludeFields?: string[];
  customHeaders?: Record<string, string>;
  sorting?: { field: string; direction: 'asc' | 'desc' };
  groupBy?: string;
  includeMetadata?: boolean;
  includeMarketIntelligence?: boolean;
  maxRows?: number;
}

export interface ExportResult {
  id: string;
  format: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
  metadata: {
    totalResults: number;
    exportedResults: number;
    generatedAt: Date;
    queryUsed: string;
    filtersApplied: any;
  };
}

export class SearchExportService {
  private static instance: SearchExportService;
  
  private constructor() {}

  public static getInstance(): SearchExportService {
    if (!SearchExportService.instance) {
      SearchExportService.instance = new SearchExportService();
    }
    return SearchExportService.instance;
  }

  /**
   * Export search results to specified format
   */
  async exportSearchResults(
    userId: number,
    searchResults: any[],
    query: string,
    filters: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Create export request record
      const exportId = await this.createExportRequest(userId, query, filters, options, searchResults.length);
      
      // Process the export based on format
      let exportData: string | Buffer;
      let contentType: string;
      let fileExtension: string;

      switch (options.format) {
        case 'csv':
          exportData = await this.exportToCSV(searchResults, options);
          contentType = 'text/csv';
          fileExtension = '.csv';
          break;
        case 'json':
          exportData = await this.exportToJSON(searchResults, options);
          contentType = 'application/json';
          fileExtension = '.json';
          break;
        case 'pdf':
          exportData = await this.exportToPDF(searchResults, options);
          contentType = 'application/pdf';
          fileExtension = '.pdf';
          break;
        case 'excel':
          exportData = await this.exportToExcel(searchResults, options);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = '.xlsx';
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Calculate file size
      const fileSize = Buffer.isBuffer(exportData) ? exportData.length : Buffer.byteLength(exportData);
      
      // Generate download URL (In production, this would upload to R2 and return URL)
      const downloadUrl = await this.generateDownloadUrl(exportId, exportData, contentType, fileExtension);
      
      // Update export request with completion
      await this.updateExportRequest(exportId, 'completed', downloadUrl, fileSize);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      return {
        id: exportId,
        format: options.format,
        fileSize,
        downloadUrl,
        expiresAt,
        metadata: {
          totalResults: searchResults.length,
          exportedResults: Math.min(searchResults.length, options.maxRows || searchResults.length),
          generatedAt: new Date(),
          queryUsed: query,
          filtersApplied: filters
        }
      };
    } catch (error) {
      console.error('Error exporting search results:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Get export history for a user
   */
  async getExportHistory(userId: number, limit: number = 20): Promise<ExportRequest[]> {
    try {
      const exports = await sql`
        SELECT 
          id,
          user_id,
          export_format,
          search_query,
          filters,
          results_count,
          file_size,
          status,
          download_url,
          expires_at,
          created_at
        FROM search_exports
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      ` as ExportRequest[];

      return exports;
    } catch (error) {
      console.error('Error fetching export history:', error);
      return [];
    }
  }

  /**
   * Create export request record
   */
  private async createExportRequest(
    userId: number,
    query: string,
    filters: any,
    options: ExportOptions,
    resultCount: number
  ): Promise<string> {
    const result = await sql`
      INSERT INTO search_exports (
        user_id,
        export_format,
        search_query,
        filters,
        results_count,
        status,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'processing', NOW()
      )
      RETURNING id
    `;

    return result[0].id;
  }

  /**
   * Update export request status
   */
  private async updateExportRequest(
    exportId: string,
    status: string,
    downloadUrl?: string,
    fileSize?: number
  ): Promise<void> {
    await sql`
      UPDATE search_exports 
      SET 
        status = $2,
        download_url = $3,
        file_size = $4,
        expires_at = CASE 
          WHEN $2 = 'completed' THEN NOW() + INTERVAL '24 hours'
          ELSE expires_at
        END
      WHERE id = $1
    `;
  }

  /**
   * Export search results to CSV format
   */
  private async exportToCSV(results: any[], options: ExportOptions): Promise<string> {
    const fields = options.includeFields || this.getDefaultFields(results[0]);
    const headers = fields.map(field => options.customHeaders?.[field] || field);
    
    let csv = headers.join(',') + '\n';
    
    const limitedResults = results.slice(0, options.maxRows || results.length);
    
    for (const result of limitedResults) {
      const row = fields.map(field => {
        let value = this.getNestedValue(result, field);
        
        // Handle special formatting
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        
        // Escape CSV special characters
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""');
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`;
          }
        }
        
        return value || '';
      });
      
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  /**
   * Export search results to JSON format
   */
  private async exportToJSON(results: any[], options: ExportOptions): Promise<string> {
    const limitedResults = results.slice(0, options.maxRows || results.length);
    
    let exportData: any = limitedResults;
    
    // Filter fields if specified
    if (options.includeFields?.length) {
      exportData = limitedResults.map(result => {
        const filtered: any = {};
        options.includeFields!.forEach(field => {
          filtered[field] = this.getNestedValue(result, field);
        });
        return filtered;
      });
    }
    
    // Add metadata if requested
    if (options.includeMetadata) {
      exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          totalResults: results.length,
          exportedResults: limitedResults.length,
          format: 'json'
        },
        results: exportData
      };
    }
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export search results to PDF format
   */
  private async exportToPDF(results: any[], options: ExportOptions): Promise<Buffer> {
    // This is a simplified PDF generation - in production, you'd use a library like puppeteer or jsPDF
    const limitedResults = results.slice(0, options.maxRows || results.length);
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Search Results Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .result { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
          .title { font-weight: bold; font-size: 18px; color: #333; }
          .meta { color: #666; font-size: 12px; margin: 5px 0; }
          .description { margin: 10px 0; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Search Results Export</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Total Results: ${limitedResults.length}</p>
        </div>
    `;
    
    limitedResults.forEach(result => {
      htmlContent += `
        <div class="result">
          <div class="title">${result.title || 'Untitled'}</div>
          <div class="meta">Genre: ${result.genre || 'N/A'} | Budget: ${result.budget_range || 'N/A'}</div>
          <div class="description">${result.description || ''}</div>
          ${options.includeMarketIntelligence && result.market_intelligence ? `
            <div class="meta">Market Score: ${result.market_intelligence.trend_score}/100</div>
          ` : ''}
        </div>
      `;
    });
    
    htmlContent += '</body></html>';
    
    // Convert HTML to PDF (simplified - would use actual PDF library in production)
    return Buffer.from(htmlContent, 'utf-8');
  }

  /**
   * Export search results to Excel format
   */
  private async exportToExcel(results: any[], options: ExportOptions): Promise<Buffer> {
    // This is a placeholder - in production, you'd use a library like xlsx or exceljs
    const limitedResults = results.slice(0, options.maxRows || results.length);
    const fields = options.includeFields || this.getDefaultFields(results[0]);
    
    // Create simple Excel-like CSV format with tabs
    const headers = fields.map(field => options.customHeaders?.[field] || field);
    let content = headers.join('\t') + '\n';
    
    limitedResults.forEach(result => {
      const row = fields.map(field => {
        const value = this.getNestedValue(result, field);
        return typeof value === 'object' ? JSON.stringify(value) : (value || '');
      });
      content += row.join('\t') + '\n';
    });
    
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate download URL for exported file
   */
  private async generateDownloadUrl(
    exportId: string,
    data: string | Buffer,
    contentType: string,
    extension: string
  ): Promise<string> {
    // In production, this would upload to R2 and return the URL
    // For now, return a placeholder URL
    const filename = `search_export_${exportId}${extension}`;
    return `/api/exports/download/${exportId}/${filename}`;
  }

  /**
   * Get default fields for export
   */
  private getDefaultFields(sampleResult: any): string[] {
    if (!sampleResult) return [];
    
    const defaultFields = ['title', 'genre', 'description', 'budget_range', 'created_at'];
    const availableFields = Object.keys(sampleResult);
    
    return defaultFields.filter(field => availableFields.includes(field));
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    try {
      const result = await sql`
        DELETE FROM search_exports
        WHERE expires_at < NOW()
        AND status = 'completed'
        RETURNING id
      `;

      console.log(`Cleaned up ${result.length} expired exports`);
      return result.length;
    } catch (error) {
      console.error('Error cleaning up expired exports:', error);
      return 0;
    }
  }
}

export const searchExportService = SearchExportService.getInstance();