#!/usr/bin/env python3
"""
Performance Dashboard Visualizer
Generates HTML dashboard with interactive charts from performance logs
"""

import json
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
import statistics
from collections import defaultdict

def load_jsonl_file(filepath):
    """Load JSONL metrics file"""
    data = []
    with open(filepath, 'r') as f:
        for line in f:
            try:
                data.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return data

def generate_dashboard_html(metrics_file, output_file='performance-dashboard.html'):
    """Generate interactive HTML dashboard"""
    
    # Load metrics
    if not os.path.exists(metrics_file):
        print(f"Error: Metrics file {metrics_file} not found")
        return False
    
    metrics = load_jsonl_file(metrics_file)
    if not metrics:
        print("No metrics data found")
        return False
    
    # Process metrics by endpoint
    endpoints_data = defaultdict(lambda: {
        'times': [], 'timestamps': [], 'cache_hits': 0, 'cache_misses': 0,
        'errors': 0, 'total': 0
    })
    
    for metric in metrics:
        endpoint = metric.get('endpoint_key', 'unknown')
        endpoints_data[endpoint]['times'].append(metric.get('time_total', 0) * 1000)  # Convert to ms
        endpoints_data[endpoint]['timestamps'].append(metric.get('timestamp', ''))
        endpoints_data[endpoint]['total'] += 1
        
        if metric.get('cache_status') == 'HIT':
            endpoints_data[endpoint]['cache_hits'] += 1
        else:
            endpoints_data[endpoint]['cache_misses'] += 1
            
        if metric.get('http_code', 200) != 200:
            endpoints_data[endpoint]['errors'] += 1
    
    # Calculate statistics
    stats = {}
    for endpoint, data in endpoints_data.items():
        times = data['times']
        if times:
            stats[endpoint] = {
                'avg': statistics.mean(times),
                'median': statistics.median(times),
                'p95': sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else times[0],
                'p99': sorted(times)[int(len(times) * 0.99)] if len(times) > 1 else times[0],
                'min': min(times),
                'max': max(times),
                'cache_rate': (data['cache_hits'] / data['total'] * 100) if data['total'] > 0 else 0,
                'error_rate': (data['errors'] / data['total'] * 100) if data['total'] > 0 else 0,
                'total_requests': data['total']
            }
    
    # Generate HTML
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        h1 {{
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }}
        
        .timestamp {{
            color: rgba(255,255,255,0.9);
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.1em;
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }}
        
        .card:hover {{
            transform: translateY(-5px);
        }}
        
        .card h2 {{
            color: #333;
            margin-bottom: 15px;
            font-size: 1.3em;
        }}
        
        .metric {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }}
        
        .metric:last-child {{
            border-bottom: none;
        }}
        
        .metric-label {{
            color: #666;
            font-weight: 500;
        }}
        
        .metric-value {{
            color: #333;
            font-weight: bold;
            font-size: 1.1em;
        }}
        
        .metric-value.good {{
            color: #10b981;
        }}
        
        .metric-value.warning {{
            color: #f59e0b;
        }}
        
        .metric-value.bad {{
            color: #ef4444;
        }}
        
        .chart-container {{
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
        }}
        
        .chart-container h2 {{
            color: #333;
            margin-bottom: 20px;
        }}
        
        canvas {{
            max-height: 400px;
        }}
        
        .summary {{
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
        }}
        
        .summary h2 {{
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }}
        
        .summary-item {{
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            color: white;
        }}
        
        .summary-value {{
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        
        .summary-label {{
            font-size: 0.9em;
            opacity: 0.9;
        }}
        
        .alert {{
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }}
        
        .alert h3 {{
            color: #991b1b;
            margin-bottom: 10px;
        }}
        
        .alert p {{
            color: #7f1d1d;
        }}
        
        .recommendations {{
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}
        
        .recommendations h2 {{
            color: #333;
            margin-bottom: 20px;
        }}
        
        .recommendation {{
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 5px;
        }}
        
        .recommendation h3 {{
            color: #14532d;
            margin-bottom: 10px;
        }}
        
        .recommendation p {{
            color: #166534;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Pitchey Performance Dashboard</h1>
        <div class="timestamp">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</div>
        
        <!-- Summary Section -->
        <div class="summary">
            <h2>Overall Performance Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">{sum(s['total_requests'] for s in stats.values())}</div>
                    <div class="summary-label">Total Requests</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{sum(s['avg'] for s in stats.values()) / len(stats) if stats else 0:.0f}ms</div>
                    <div class="summary-label">Avg Response Time</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{sum(s['cache_rate'] for s in stats.values()) / len(stats) if stats else 0:.1f}%</div>
                    <div class="summary-label">Avg Cache Hit Rate</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{sum(s['error_rate'] for s in stats.values()) / len(stats) if stats else 0:.1f}%</div>
                    <div class="summary-label">Avg Error Rate</div>
                </div>
            </div>
        </div>
        
        <!-- Alerts Section -->
"""
    
    # Add alerts for issues
    issues = []
    for endpoint, stat in stats.items():
        if stat['cache_rate'] < 50:
            issues.append(f"Low cache hit rate for {endpoint}: {stat['cache_rate']:.1f}%")
        if stat['error_rate'] > 5:
            issues.append(f"High error rate for {endpoint}: {stat['error_rate']:.1f}%")
        if stat['p95'] > 500:
            issues.append(f"Slow P95 response time for {endpoint}: {stat['p95']:.0f}ms")
    
    if issues:
        html_content += """
        <div class="alert">
            <h3>⚠️ Performance Issues Detected</h3>
"""
        for issue in issues:
            html_content += f"            <p>• {issue}</p>\n"
        html_content += "        </div>\n"
    
    # Add endpoint cards
    html_content += """
        <!-- Endpoint Statistics -->
        <div class="grid">
"""
    
    for endpoint, stat in stats.items():
        cache_class = 'good' if stat['cache_rate'] > 80 else 'warning' if stat['cache_rate'] > 50 else 'bad'
        error_class = 'good' if stat['error_rate'] < 1 else 'warning' if stat['error_rate'] < 5 else 'bad'
        p95_class = 'good' if stat['p95'] < 200 else 'warning' if stat['p95'] < 500 else 'bad'
        
        html_content += f"""
            <div class="card">
                <h2>{endpoint}</h2>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value">{stat['total_requests']}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Response</span>
                    <span class="metric-value">{stat['avg']:.0f}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">P95 Response</span>
                    <span class="metric-value {p95_class}">{stat['p95']:.0f}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Hit Rate</span>
                    <span class="metric-value {cache_class}">{stat['cache_rate']:.1f}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value {error_class}">{stat['error_rate']:.1f}%</span>
                </div>
            </div>
"""
    
    html_content += """
        </div>
        
        <!-- Response Time Chart -->
        <div class="chart-container">
            <h2>Response Time Trends</h2>
            <canvas id="responseTimeChart"></canvas>
        </div>
        
        <!-- Cache Hit Rate Chart -->
        <div class="chart-container">
            <h2>Cache Performance</h2>
            <canvas id="cacheChart"></canvas>
        </div>
        
        <!-- Recommendations -->
        <div class="recommendations">
            <h2>🎯 Performance Recommendations</h2>
"""
    
    # Add recommendations based on data
    if any(s['cache_rate'] < 50 for s in stats.values()):
        html_content += """
            <div class="recommendation">
                <h3>1. Fix Cache Configuration</h3>
                <p>Cache hit rates are below 50%. Check KV namespace configuration and ensure cache keys are consistent. 
                Run the cache-diagnostic.sh script to identify specific issues.</p>
            </div>
"""
    
    if any(s['p95'] > 500 for s in stats.values()):
        html_content += """
            <div class="recommendation">
                <h3>2. Optimize Slow Endpoints</h3>
                <p>Some endpoints have P95 response times over 500ms. Consider implementing database query optimization, 
                adding indexes, or increasing cache TTL for frequently accessed data.</p>
            </div>
"""
    
    if any(s['error_rate'] > 5 for s in stats.values()):
        html_content += """
            <div class="recommendation">
                <h3>3. Investigate Errors</h3>
                <p>Error rates are above 5% for some endpoints. Check application logs and implement retry logic 
                for transient failures. Consider adding circuit breakers for failing dependencies.</p>
            </div>
"""
    
    html_content += """
        </div>
    </div>
    
    <script>
        // Prepare data for charts
        const endpoints = """ + json.dumps(list(endpoints_data.keys())) + """;
        const endpointsData = """ + json.dumps({k: {'times': v['times'][-100:], 'timestamps': v['timestamps'][-100:]} 
                                                 for k, v in endpoints_data.items()}) + """;
        const stats = """ + json.dumps(stats) + """;
        
        // Response Time Chart
        const rtCtx = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(rtCtx, {
            type: 'line',
            data: {
                datasets: endpoints.map(endpoint => ({
                    label: endpoint,
                    data: endpointsData[endpoint].times.map((time, i) => ({
                        x: i,
                        y: time
                    })),
                    borderColor: `hsl(${endpoints.indexOf(endpoint) * 60}, 70%, 50%)`,
                    backgroundColor: `hsla(${endpoints.indexOf(endpoint) * 60}, 70%, 50%, 0.1)`,
                    tension: 0.4
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Response Time Over Time (ms)'
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Request Number'
                        }
                    }
                }
            }
        });
        
        // Cache Performance Chart
        const cacheCtx = document.getElementById('cacheChart').getContext('2d');
        new Chart(cacheCtx, {
            type: 'bar',
            data: {
                labels: endpoints,
                datasets: [{
                    label: 'Cache Hit Rate (%)',
                    data: endpoints.map(e => stats[e]?.cache_rate || 0),
                    backgroundColor: endpoints.map(e => {
                        const rate = stats[e]?.cache_rate || 0;
                        return rate > 80 ? '#10b981' : rate > 50 ? '#f59e0b' : '#ef4444';
                    })
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cache Hit Rate by Endpoint'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Cache Hit Rate (%)'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>
"""
    
    # Write HTML file
    with open(output_file, 'w') as f:
        f.write(html_content)
    
    print(f"✅ Dashboard generated: {output_file}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 dashboard-visualizer.py <metrics.jsonl> [output.html]")
        print("\nExample:")
        print("  python3 dashboard-visualizer.py continuous-logs/metrics_20241214.jsonl")
        sys.exit(1)
    
    metrics_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'performance-dashboard.html'
    
    generate_dashboard_html(metrics_file, output_file)