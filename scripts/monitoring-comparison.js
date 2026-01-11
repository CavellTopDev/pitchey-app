#!/usr/bin/env node

/**
 * Console Monitoring Comparison Tool
 * Tracks error reduction and improvement metrics over time
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../logs/console-monitoring/monitoring-config.json');
const LOGS_DIR = path.join(__dirname, '../logs/console-monitoring');

class MonitoringComparison {
  constructor() {
    this.config = null;
    this.baseline = null;
    this.reports = [];
  }

  async initialize() {
    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf8');
      this.config = JSON.parse(configData);
      this.baseline = this.config.monitoring.baseline_metrics;
    } catch (error) {
      console.error('Failed to load monitoring config:', error.message);
      throw error;
    }
  }

  async loadReports() {
    try {
      const files = await fs.readdir(LOGS_DIR);
      const reportFiles = files.filter(f => f.startsWith('report-') && f.endsWith('.json'));
      
      for (const file of reportFiles) {
        const reportData = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
        const report = JSON.parse(reportData);
        this.reports.push({
          filename: file,
          timestamp: report.timestamp,
          data: report
        });
      }

      // Sort by timestamp
      this.reports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
    } catch (error) {
      console.warn('No previous reports found, using baseline only');
    }
  }

  analyzeErrorTrends() {
    if (this.reports.length === 0) {
      return {
        status: 'baseline_only',
        message: 'No comparison data available yet'
      };
    }

    const latest = this.reports[this.reports.length - 1].data.summary;
    const previous = this.reports.length > 1 
      ? this.reports[this.reports.length - 2].data.summary 
      : this.baseline;

    const comparison = {
      errors: {
        current: latest.totalErrors,
        previous: previous.totalErrors || previous.total_routes_tested * previous.average_errors_per_route,
        change: latest.totalErrors - (previous.totalErrors || previous.total_routes_tested * previous.average_errors_per_route),
        improvement: latest.totalErrors < (previous.totalErrors || previous.total_routes_tested * previous.average_errors_per_route)
      },
      warnings: {
        current: latest.totalWarnings,
        previous: previous.totalWarnings || 0,
        change: latest.totalWarnings - (previous.totalWarnings || 0)
      },
      networkErrors: {
        current: latest.networkErrors,
        previous: previous.networkErrors || 0,
        change: latest.networkErrors - (previous.networkErrors || 0)
      }
    };

    return comparison;
  }

  generateComparisonReport() {
    const trends = this.analyzeErrorTrends();
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      comparison_type: 'error_trend_analysis',
      baseline_date: this.config.monitoring.baseline_date,
      reports_analyzed: this.reports.length,
      trends,
      recommendations: this.generateRecommendations(trends),
      thresholds: this.config.thresholds,
      status: this.calculateOverallStatus(trends)
    };

    return report;
  }

  generateRecommendations(trends) {
    const recommendations = [];

    if (trends.status === 'baseline_only') {
      recommendations.push({
        priority: 'INFO',
        action: 'Run monitoring script to generate comparison data',
        reason: 'No trend data available yet'
      });
      return recommendations;
    }

    // Error count recommendations
    if (trends.errors.change > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Investigate error increase',
        reason: `Error count increased by ${trends.errors.change}`,
        details: `Current: ${trends.errors.current}, Previous: ${trends.errors.previous}`
      });
    } else if (trends.errors.change < 0) {
      recommendations.push({
        priority: 'POSITIVE',
        action: 'Continue current approach',
        reason: `Error count decreased by ${Math.abs(trends.errors.change)}`,
        details: `Improvement from ${trends.errors.previous} to ${trends.errors.current}`
      });
    }

    // Network error recommendations
    if (trends.networkErrors.change > 5) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Check network connectivity and API endpoints',
        reason: `Network errors increased by ${trends.networkErrors.change}`
      });
    }

    // Threshold checks
    if (trends.errors.current > this.config.thresholds.error_count.critical) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Immediate intervention required',
        reason: `Error count (${trends.errors.current}) exceeds critical threshold (${this.config.thresholds.error_count.critical})`
      });
    }

    return recommendations;
  }

  calculateOverallStatus(trends) {
    if (trends.status === 'baseline_only') return 'BASELINE';
    
    const errorThreshold = this.config.thresholds.error_count;
    
    if (trends.errors.current > errorThreshold.critical) return 'CRITICAL';
    if (trends.errors.current > errorThreshold.warning) return 'WARNING';
    if (trends.errors.improvement) return 'IMPROVING';
    
    return 'STABLE';
  }

  async saveComparisonReport(report) {
    const filename = `comparison-${Date.now()}.json`;
    const filepath = path.join(LOGS_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    // Also save as latest
    const latestPath = path.join(LOGS_DIR, 'latest-comparison.json');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
    
    return { filename, filepath };
  }

  printSummary(report) {
    console.log('\\n' + '='.repeat(60));
    console.log('📊 CONSOLE MONITORING COMPARISON REPORT');
    console.log('='.repeat(60));
    
    console.log(`🕒 Generated: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`📈 Baseline Date: ${report.baseline_date}`);
    console.log(`📊 Reports Analyzed: ${report.reports_analyzed}`);
    console.log(`🎯 Overall Status: ${this.getStatusEmoji(report.status)} ${report.status}`);

    if (report.trends.status !== 'baseline_only') {
      console.log('\\n📈 TREND ANALYSIS:');
      console.log(`   Errors: ${report.trends.errors.previous} → ${report.trends.errors.current} (${report.trends.errors.change >= 0 ? '+' : ''}${report.trends.errors.change})`);
      console.log(`   Warnings: ${report.trends.warnings.previous} → ${report.trends.warnings.current} (${report.trends.warnings.change >= 0 ? '+' : ''}${report.trends.warnings.change})`);
      console.log(`   Network: ${report.trends.networkErrors.previous} → ${report.trends.networkErrors.current} (${report.trends.networkErrors.change >= 0 ? '+' : ''}${report.trends.networkErrors.change})`);
    }

    if (report.recommendations.length > 0) {
      console.log('\\n🎯 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, idx) => {
        const emoji = this.getPriorityEmoji(rec.priority);
        console.log(`   ${idx + 1}. ${emoji} [${rec.priority}] ${rec.action}`);
        console.log(`      ${rec.reason}`);
        if (rec.details) {
          console.log(`      ${rec.details}`);
        }
      });
    }

    console.log('\\n📊 THRESHOLDS:');
    console.log(`   Error Warning: ${report.thresholds.error_count.warning}`);
    console.log(`   Error Critical: ${report.thresholds.error_count.critical}`);
    console.log(`   Component Crash Critical: ${report.thresholds.component_crashes.critical}`);

    console.log('\\n' + '='.repeat(60));
  }

  getStatusEmoji(status) {
    const emojis = {
      'CRITICAL': '🚨',
      'WARNING': '⚠️',
      'IMPROVING': '📈',
      'STABLE': '✅',
      'BASELINE': '📊'
    };
    return emojis[status] || '❓';
  }

  getPriorityEmoji(priority) {
    const emojis = {
      'CRITICAL': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '⚡',
      'POSITIVE': '✅',
      'INFO': 'ℹ️'
    };
    return emojis[priority] || '📝';
  }

  async run() {
    try {
      await this.initialize();
      await this.loadReports();
      
      const report = this.generateComparisonReport();
      const { filename } = await this.saveComparisonReport(report);
      
      this.printSummary(report);
      
      console.log(`\\n💾 Report saved: ${filename}`);
      
      return report;
      
    } catch (error) {
      console.error('Comparison analysis failed:', error);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const comparison = new MonitoringComparison();
  comparison.run().catch(console.error);
}

module.exports = MonitoringComparison;