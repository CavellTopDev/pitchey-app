/**
 * CostTrackerDO - Real-time cost tracking and budget enforcement
 * Monitors resource usage costs and enforces budget limits across all services
 */

import type { Env } from '../worker-integrated';

export interface CostEntry {
  id: string;
  timestamp: Date;
  resource: string; // container, storage, compute, network, etc.
  resourceId: string;
  operation: string;
  amount: number; // cost in USD
  currency: string;
  unit: string; // per hour, per GB, per request, etc.
  usage: number; // quantity used
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

export interface Budget {
  id: string;
  name: string;
  limit: number; // maximum allowed cost
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  spent: number;
  remaining: number;
  percentage: number;
  resources: string[]; // which resources this budget covers
  alerts: BudgetAlert[];
  status: 'active' | 'exceeded' | 'suspended' | 'inactive';
  enforcement: 'warn' | 'throttle' | 'stop';
}

export interface BudgetAlert {
  id: string;
  threshold: number; // percentage of budget
  triggered: boolean;
  triggeredAt?: Date;
  type: 'warning' | 'critical';
  actions: ('email' | 'webhook' | 'slack' | 'throttle' | 'stop')[];
}

export interface CostOptimization {
  resourceId: string;
  resource: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercentage: number;
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: 'rightsizing' | 'scheduling' | 'storage' | 'network' | 'reserved';
}

export interface CostAnalytics {
  totalCost: number;
  periodCost: number;
  projectedCost: number;
  topResources: Array<{
    resource: string;
    cost: number;
    percentage: number;
  }>;
  costTrends: Array<{
    date: string;
    cost: number;
    usage: number;
  }>;
  budgetStatus: Array<{
    budgetId: string;
    name: string;
    spent: number;
    limit: number;
    status: string;
  }>;
  optimizations: CostOptimization[];
}

/**
 * Cost Tracker Durable Object
 * Real-time cost tracking and budget enforcement system
 */
export class CostTrackerDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // In-memory caches
  private costCache: Map<string, CostEntry[]> = new Map();
  private budgets: Map<string, Budget> = new Map();
  private dailyTotals: Map<string, number> = new Map();
  
  // Rate limiting for cost updates
  private lastUpdate: Map<string, Date> = new Map();
  private updateInterval = 60000; // 1 minute minimum between updates
  
  // Alert management
  private alertCooldown: Map<string, Date> = new Map();
  private cooldownPeriod = 300000; // 5 minutes

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    this.initializeCostTracker();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (true) {
        case method === 'POST' && path === '/costs':
          return this.recordCost(request);
        
        case method === 'POST' && path === '/costs/batch':
          return this.recordCostBatch(request);
        
        case method === 'GET' && path === '/costs':
          return this.getCosts(url.searchParams);
        
        case method === 'GET' && path === '/costs/summary':
          return this.getCostSummary(url.searchParams);
        
        case method === 'POST' && path === '/budgets':
          return this.createBudget(request);
        
        case method === 'GET' && path.startsWith('/budgets/'):
          return this.getBudget(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/budgets/'):
          return this.updateBudget(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/budgets/'):
          return this.deleteBudget(path.split('/')[2]);
        
        case method === 'GET' && path === '/budgets':
          return this.listBudgets();
        
        case method === 'POST' && path === '/budgets/check':
          return this.checkBudgetLimits(request);
        
        case method === 'GET' && path === '/analytics':
          return this.getCostAnalytics(url.searchParams);
        
        case method === 'GET' && path === '/optimizations':
          return this.getCostOptimizations();
        
        case method === 'POST' && path === '/alerts/test':
          return this.testAlert(request);
        
        case method === 'GET' && path === '/health':
          return this.getHealth();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('CostTrackerDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Record a cost entry
   */
  private async recordCost(request: Request): Promise<Response> {
    const data = await request.json() as {
      resourceId?: string;
      resource?: string;
      operation?: string;
      amount?: string | number;
      currency?: string;
      unit?: string;
      usage?: string | number;
      tags?: Record<string, string>;
      metadata?: Record<string, any>;
    };

    // Rate limiting check
    const now = new Date();
    const resourceId = data.resourceId || 'unknown';
    const lastUpdate = this.lastUpdate.get(resourceId);
    if (lastUpdate && (now.getTime() - lastUpdate.getTime()) < this.updateInterval) {
      // Aggregate with previous entry instead of creating new one
      return this.aggregateCost(data);
    }

    const costEntry: CostEntry = {
      id: crypto.randomUUID(),
      timestamp: now,
      resource: data.resource || 'unknown',
      resourceId: resourceId,
      operation: data.operation || 'unknown',
      amount: parseFloat(String(data.amount || '0')),
      currency: data.currency || 'USD',
      unit: data.unit || 'units',
      usage: parseFloat(String(data.usage || '0')),
      tags: data.tags || {},
      metadata: data.metadata || {}
    };

    await this.saveCostEntry(costEntry);
    this.lastUpdate.set(resourceId, now);

    // Check budget limits
    const budgetCheck = await this.checkResourceBudgets(costEntry);
    
    // Update daily totals
    await this.updateDailyTotals(costEntry);

    return Response.json({
      success: true,
      costId: costEntry.id,
      totalCost: costEntry.amount,
      budgetStatus: budgetCheck
    });
  }

  /**
   * Record multiple cost entries in batch
   */
  private async recordCostBatch(request: Request): Promise<Response> {
    const { costs = [] } = await request.json() as { costs?: any[] };
    const results = [];
    let totalAmount = 0;

    for (const costData of costs) {
      const costEntry: CostEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        resource: costData.resource,
        resourceId: costData.resourceId,
        operation: costData.operation,
        amount: parseFloat(costData.amount),
        currency: costData.currency || 'USD',
        unit: costData.unit,
        usage: parseFloat(costData.usage),
        tags: costData.tags || {},
        metadata: costData.metadata || {}
      };

      await this.saveCostEntry(costEntry);
      totalAmount += costEntry.amount;
      results.push(costEntry.id);
    }

    // Batch budget check
    const budgetCheck = await this.checkAllBudgets();

    return Response.json({
      success: true,
      costIds: results,
      totalCost: totalAmount,
      count: costs.length,
      budgetStatus: budgetCheck
    });
  }

  /**
   * Get cost entries with filtering
   */
  private async getCosts(params: URLSearchParams): Promise<Response> {
    const resource = params.get('resource') || undefined;
    const resourceId = params.get('resourceId') || undefined;
    const startDate = params.get('startDate') ? new Date(params.get('startDate')!) : undefined;
    const endDate = params.get('endDate') ? new Date(params.get('endDate')!) : undefined;
    const limit = parseInt(params.get('limit') || '100');

    const costs = await this.loadCosts({
      resource,
      resourceId,
      startDate,
      endDate,
      limit
    });

    const totalCost = costs.reduce((sum, cost) => sum + cost.amount, 0);

    return Response.json({
      success: true,
      costs,
      totalCost,
      count: costs.length
    });
  }

  /**
   * Get cost summary
   */
  private async getCostSummary(params: URLSearchParams): Promise<Response> {
    const period = params.get('period') || 'daily';
    const resource = params.get('resource') || undefined;

    const summary = await this.generateCostSummary(period, resource);

    return Response.json({
      success: true,
      summary
    });
  }

  /**
   * Create a budget
   */
  private async createBudget(request: Request): Promise<Response> {
    const data = await request.json() as {
      id?: string;
      name?: string;
      limit?: string | number;
      period?: string;
      startDate?: string;
      endDate?: string;
      resource?: string;
      resourceId?: string;
      thresholds?: { percentage: number; notifyEmail?: string }[];
    };

    const budget: Budget = {
      id: data.id || crypto.randomUUID(),
      name: data.name || 'Unnamed Budget',
      limit: parseFloat(String(data.limit || '0')),
      period: (data.period || 'monthly') as Budget['period'],
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      spent: 0,
      remaining: parseFloat(String(data.limit || '0')),
      percentage: 0,
      resources: (data as any).resources || [],
      alerts: (data as any).alerts || [],
      status: 'active',
      enforcement: ((data as any).enforcement || 'warn') as Budget['enforcement']
    };

    await this.saveBudget(budget);

    return Response.json({
      success: true,
      budget: this.sanitizeBudget(budget),
      message: `Budget '${budget.name}' created`
    });
  }

  /**
   * Get budget details
   */
  private async getBudget(budgetId: string): Promise<Response> {
    const budget = await this.loadBudget(budgetId);
    
    if (!budget) {
      return new Response('Budget not found', { status: 404 });
    }

    // Refresh budget calculations
    await this.refreshBudgetCalculations(budget);

    return Response.json({
      success: true,
      budget: this.sanitizeBudget(budget)
    });
  }

  /**
   * Update budget
   */
  private async updateBudget(budgetId: string, request: Request): Promise<Response> {
    const budget = await this.loadBudget(budgetId);
    
    if (!budget) {
      return new Response('Budget not found', { status: 404 });
    }

    const updates = await request.json() as Partial<Budget>;

    if (updates.limit !== undefined) {
      budget.limit = updates.limit;
      budget.remaining = budget.limit - budget.spent;
      budget.percentage = (budget.spent / budget.limit) * 100;
    }

    if (updates.alerts) budget.alerts = updates.alerts;
    if (updates.enforcement) budget.enforcement = updates.enforcement;
    if (updates.resources) budget.resources = updates.resources;
    if (updates.status) budget.status = updates.status;

    await this.saveBudget(budget);

    return Response.json({
      success: true,
      budget: this.sanitizeBudget(budget),
      message: 'Budget updated'
    });
  }

  /**
   * Delete budget
   */
  private async deleteBudget(budgetId: string): Promise<Response> {
    const budget = await this.loadBudget(budgetId);
    
    if (!budget) {
      return new Response('Budget not found', { status: 404 });
    }

    await this.storage.delete(`budget:${budgetId}`);
    this.budgets.delete(budgetId);

    return Response.json({
      success: true,
      message: `Budget '${budget.name}' deleted`
    });
  }

  /**
   * List all budgets
   */
  private async listBudgets(): Promise<Response> {
    const budgetList = Array.from(this.budgets.values()).map(budget => 
      this.sanitizeBudget(budget)
    );

    return Response.json({
      success: true,
      budgets: budgetList,
      count: budgetList.length
    });
  }

  /**
   * Check if operation would exceed budget limits
   */
  private async checkBudgetLimits(request: Request): Promise<Response> {
    const { resource, resourceId, estimatedCost } = await request.json() as {
      resource?: string;
      resourceId?: string;
      estimatedCost?: number;
    };
    
    const relevantBudgets = Array.from(this.budgets.values()).filter(budget =>
      budget.status === 'active' &&
      (budget.resources.length === 0 || (resource && budget.resources.includes(resource)))
    );

    const checks = [];
    let allowOperation = true;
    const estCost = estimatedCost || 0;

    for (const budget of relevantBudgets) {
      await this.refreshBudgetCalculations(budget);

      const projectedSpend = budget.spent + estCost;
      const wouldExceed = projectedSpend > budget.limit;
      
      checks.push({
        budgetId: budget.id,
        budgetName: budget.name,
        currentSpent: budget.spent,
        limit: budget.limit,
        estimatedCost,
        projectedSpend,
        wouldExceed,
        enforcement: budget.enforcement
      });

      if (wouldExceed && budget.enforcement === 'stop') {
        allowOperation = false;
      }
    }

    return Response.json({
      success: true,
      allowOperation,
      checks,
      message: allowOperation ? 'Operation within budget limits' : 'Operation would exceed budget'
    });
  }

  /**
   * Get cost analytics
   */
  private async getCostAnalytics(params: URLSearchParams): Promise<Response> {
    const period = params.get('period') || 'monthly';
    const analytics = await this.generateCostAnalytics(period);

    return Response.json({
      success: true,
      analytics
    });
  }

  /**
   * Get cost optimization recommendations
   */
  private async getCostOptimizations(): Promise<Response> {
    const optimizations = await this.generateOptimizationRecommendations();

    return Response.json({
      success: true,
      optimizations,
      totalPotentialSavings: optimizations.reduce((sum, opt) => sum + opt.savings, 0)
    });
  }

  /**
   * Initialize cost tracker
   */
  private async initializeCostTracker(): Promise<void> {
    // Load existing budgets
    const storedBudgets = await this.storage.list({ prefix: 'budget:' });
    
    for (const [, budget] of storedBudgets) {
      const b = budget as Budget;
      this.budgets.set(b.id, b);
    }

    // Load daily totals
    const dailyTotals = await this.storage.get<Record<string, number>>('daily_totals');
    if (dailyTotals) {
      this.dailyTotals = new Map(Object.entries(dailyTotals));
    }

    // Refresh all budget calculations
    for (const budget of this.budgets.values()) {
      await this.refreshBudgetCalculations(budget);
    }
  }

  /**
   * Save cost entry to storage
   */
  private async saveCostEntry(costEntry: CostEntry): Promise<void> {
    const key = `cost:${costEntry.timestamp.toISOString().split('T')[0]}:${costEntry.id}`;
    await this.storage.put(key, costEntry);
    
    // Update cache
    const dayKey = costEntry.timestamp.toISOString().split('T')[0];
    if (!this.costCache.has(dayKey)) {
      this.costCache.set(dayKey, []);
    }
    this.costCache.get(dayKey)!.push(costEntry);
  }

  /**
   * Load costs with filtering
   */
  private async loadCosts(filters: {
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<CostEntry[]> {
    const costs: CostEntry[] = [];
    const startKey = filters.startDate ? `cost:${filters.startDate.toISOString().split('T')[0]}` : 'cost:';
    const endKey = filters.endDate ? `cost:${filters.endDate.toISOString().split('T')[0]}z` : 'cost:z';
    
    const entries = await this.storage.list({ start: startKey, end: endKey });
    
    for (const [key, cost] of entries) {
      const costEntry = cost as CostEntry;
      
      // Apply filters
      if (filters.resource && costEntry.resource !== filters.resource) continue;
      if (filters.resourceId && costEntry.resourceId !== filters.resourceId) continue;
      
      costs.push(costEntry);
      
      if (filters.limit && costs.length >= filters.limit) break;
    }

    return costs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Aggregate cost with previous entry
   */
  private async aggregateCost(data: any): Promise<Response> {
    // Find recent entry for the same resource
    const recentEntry = await this.findRecentCostEntry(data.resourceId, data.resource);
    
    if (recentEntry) {
      // Update the existing entry
      recentEntry.amount += parseFloat(data.amount);
      recentEntry.usage += parseFloat(data.usage);
      recentEntry.timestamp = new Date();
      
      await this.updateCostEntry(recentEntry);
      
      return Response.json({
        success: true,
        costId: recentEntry.id,
        aggregated: true,
        totalCost: recentEntry.amount
      });
    }
    
    // If no recent entry, create new one
    return this.recordCost(new Request('', {
      method: 'POST',
      body: JSON.stringify(data)
    }));
  }

  /**
   * Find recent cost entry for aggregation
   */
  private async findRecentCostEntry(resourceId: string, resource: string): Promise<CostEntry | null> {
    const now = new Date();
    const dayKey = now.toISOString().split('T')[0];
    const dayCache = this.costCache.get(dayKey);
    
    if (dayCache) {
      const recent = dayCache.find(entry => 
        entry.resourceId === resourceId && 
        entry.resource === resource &&
        (now.getTime() - entry.timestamp.getTime()) < this.updateInterval
      );
      
      if (recent) return recent;
    }

    // Search in storage if not in cache
    const entries = await this.storage.list({ prefix: `cost:${dayKey}` });
    
    for (const [key, cost] of entries) {
      const costEntry = cost as CostEntry;
      if (costEntry.resourceId === resourceId && 
          costEntry.resource === resource &&
          (now.getTime() - costEntry.timestamp.getTime()) < this.updateInterval) {
        return costEntry;
      }
    }

    return null;
  }

  /**
   * Update existing cost entry
   */
  private async updateCostEntry(costEntry: CostEntry): Promise<void> {
    const key = `cost:${costEntry.timestamp.toISOString().split('T')[0]}:${costEntry.id}`;
    await this.storage.put(key, costEntry);
  }

  /**
   * Check budgets for a specific resource
   */
  private async checkResourceBudgets(costEntry: CostEntry): Promise<any[]> {
    const relevantBudgets = Array.from(this.budgets.values()).filter(budget => 
      budget.status === 'active' && 
      (budget.resources.length === 0 || budget.resources.includes(costEntry.resource))
    );

    const results = [];

    for (const budget of relevantBudgets) {
      budget.spent += costEntry.amount;
      budget.remaining = Math.max(0, budget.limit - budget.spent);
      budget.percentage = (budget.spent / budget.limit) * 100;

      // Check alerts
      await this.checkBudgetAlerts(budget);

      // Check for budget exceeded
      if (budget.percentage >= 100) {
        budget.status = 'exceeded';
        await this.handleBudgetExceeded(budget);
      }

      await this.saveBudget(budget);

      results.push({
        budgetId: budget.id,
        name: budget.name,
        spent: budget.spent,
        remaining: budget.remaining,
        percentage: budget.percentage,
        status: budget.status
      });
    }

    return results;
  }

  /**
   * Check all budget limits
   */
  private async checkAllBudgets(): Promise<any[]> {
    const results = [];

    for (const budget of this.budgets.values()) {
      await this.refreshBudgetCalculations(budget);
      
      results.push({
        budgetId: budget.id,
        name: budget.name,
        spent: budget.spent,
        remaining: budget.remaining,
        percentage: budget.percentage,
        status: budget.status
      });
    }

    return results;
  }

  /**
   * Refresh budget calculations based on current period
   */
  private async refreshBudgetCalculations(budget: Budget): Promise<void> {
    const { startDate, endDate } = this.getBudgetPeriod(budget);
    
    const costs = await this.loadCosts({
      startDate,
      endDate: endDate || new Date()
    });

    // Filter costs for budget resources
    const relevantCosts = costs.filter(cost => 
      budget.resources.length === 0 || budget.resources.includes(cost.resource)
    );

    budget.spent = relevantCosts.reduce((sum, cost) => sum + cost.amount, 0);
    budget.remaining = Math.max(0, budget.limit - budget.spent);
    budget.percentage = (budget.spent / budget.limit) * 100;

    // Update status
    if (budget.percentage >= 100) {
      budget.status = 'exceeded';
    } else if (budget.percentage >= 90) {
      budget.status = 'active'; // But close to limit
    }

    await this.checkBudgetAlerts(budget);
  }

  /**
   * Get budget period dates
   */
  private getBudgetPeriod(budget: Budget): { startDate: Date; endDate?: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date | undefined;

    switch (budget.period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = budget.startDate;
        endDate = budget.endDate;
    }

    return { startDate, endDate };
  }

  /**
   * Check budget alerts
   */
  private async checkBudgetAlerts(budget: Budget): Promise<void> {
    for (const alert of budget.alerts) {
      const shouldTrigger = budget.percentage >= alert.threshold && !alert.triggered;
      
      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        
        await this.sendBudgetAlert(budget, alert);
      } else if (budget.percentage < alert.threshold && alert.triggered) {
        // Reset alert if budget goes back below threshold
        alert.triggered = false;
        delete alert.triggeredAt;
      }
    }
  }

  /**
   * Send budget alert
   */
  private async sendBudgetAlert(budget: Budget, alert: BudgetAlert): Promise<void> {
    const alertKey = `${budget.id}:${alert.id}`;
    const lastAlert = this.alertCooldown.get(alertKey);
    
    // Check cooldown
    if (lastAlert && (Date.now() - lastAlert.getTime()) < this.cooldownPeriod) {
      return;
    }

    for (const action of alert.actions) {
      switch (action) {
        case 'email':
          await this.sendEmailAlert(budget, alert);
          break;
        case 'webhook':
          await this.sendWebhookAlert(budget, alert);
          break;
        case 'slack':
          await this.sendSlackAlert(budget, alert);
          break;
        case 'throttle':
          await this.throttleResources(budget);
          break;
        case 'stop':
          await this.stopResources(budget);
          break;
      }
    }

    this.alertCooldown.set(alertKey, new Date());
  }

  /**
   * Handle budget exceeded
   */
  private async handleBudgetExceeded(budget: Budget): Promise<void> {
    switch (budget.enforcement) {
      case 'warn':
        await this.sendBudgetExceededWarning(budget);
        break;
      case 'throttle':
        await this.throttleResources(budget);
        break;
      case 'stop':
        await this.stopResources(budget);
        break;
    }
  }

  /**
   * Generate cost summary
   */
  private async generateCostSummary(period: string, resource?: string): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const costs = await this.loadCosts({ startDate, resource });
    
    const summary = {
      totalCost: costs.reduce((sum, cost) => sum + cost.amount, 0),
      totalUsage: costs.reduce((sum, cost) => sum + cost.usage, 0),
      entryCount: costs.length,
      averageCost: 0,
      byResource: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      dailyBreakdown: {} as Record<string, number>
    };

    if (costs.length > 0) {
      summary.averageCost = summary.totalCost / costs.length;
    }

    // Group by resource
    for (const cost of costs) {
      summary.byResource[cost.resource] = (summary.byResource[cost.resource] || 0) + cost.amount;
      summary.byOperation[cost.operation] = (summary.byOperation[cost.operation] || 0) + cost.amount;
      
      const day = cost.timestamp.toISOString().split('T')[0];
      summary.dailyBreakdown[day] = (summary.dailyBreakdown[day] || 0) + cost.amount;
    }

    return summary;
  }

  /**
   * Generate cost analytics
   */
  private async generateCostAnalytics(period: string): Promise<CostAnalytics> {
    const summary = await this.generateCostSummary(period);
    const optimizations = await this.generateOptimizationRecommendations();
    
    // Calculate projected cost based on current trend
    const dailyCosts = Object.values(summary.dailyBreakdown) as number[];
    const avgDailyCost = dailyCosts.length > 0 ? 
      dailyCosts.reduce((sum, cost) => sum + cost, 0) / dailyCosts.length : 0;
    
    let projectionDays = 30; // Default to monthly projection
    if (period === 'daily') projectionDays = 1;
    else if (period === 'weekly') projectionDays = 7;
    
    const projectedCost = avgDailyCost * projectionDays;

    const analytics: CostAnalytics = {
      totalCost: summary.totalCost,
      periodCost: summary.totalCost,
      projectedCost,
      topResources: Object.entries(summary.byResource)
        .map(([resource, cost]) => ({
          resource,
          cost: cost as number,
          percentage: ((cost as number) / summary.totalCost) * 100
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10),
      costTrends: Object.entries(summary.dailyBreakdown)
        .map(([date, cost]) => ({
          date,
          cost: cost as number,
          usage: 0 // Would need to calculate usage separately
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      budgetStatus: Array.from(this.budgets.values()).map(budget => ({
        budgetId: budget.id,
        name: budget.name,
        spent: budget.spent,
        limit: budget.limit,
        status: budget.status
      })),
      optimizations
    };

    return analytics;
  }

  /**
   * Generate optimization recommendations
   */
  private async generateOptimizationRecommendations(): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];
    const costs = await this.loadCosts({ limit: 1000 });
    
    // Group by resource for analysis
    const resourceCosts: Record<string, CostEntry[]> = {};
    for (const cost of costs) {
      if (!resourceCosts[cost.resourceId]) {
        resourceCosts[cost.resourceId] = [];
      }
      resourceCosts[cost.resourceId].push(cost);
    }

    // Analyze each resource
    for (const [resourceId, resourceCostEntries] of Object.entries(resourceCosts)) {
      const totalCost = resourceCostEntries.reduce((sum, cost) => sum + cost.amount, 0);
      const avgUsage = resourceCostEntries.reduce((sum, cost) => sum + cost.usage, 0) / resourceCostEntries.length;
      
      // Simple optimization rules (in production, these would be more sophisticated)
      if (avgUsage < 50 && totalCost > 100) {
        // Under-utilized resource
        optimizations.push({
          resourceId,
          resource: resourceCostEntries[0].resource,
          currentCost: totalCost,
          optimizedCost: totalCost * 0.6, // 40% savings
          savings: totalCost * 0.4,
          savingsPercentage: 40,
          recommendation: 'Downsize resource - current utilization is low',
          effort: 'low',
          impact: 'medium',
          category: 'rightsizing'
        });
      }
      
      if (resourceCostEntries.some(cost => cost.tags.environment === 'dev') && totalCost > 50) {
        // Development resources running outside business hours
        optimizations.push({
          resourceId,
          resource: resourceCostEntries[0].resource,
          currentCost: totalCost,
          optimizedCost: totalCost * 0.3, // 70% savings
          savings: totalCost * 0.7,
          savingsPercentage: 70,
          recommendation: 'Schedule development resources to run only during business hours',
          effort: 'medium',
          impact: 'high',
          category: 'scheduling'
        });
      }
    }

    return optimizations.sort((a, b) => b.savings - a.savings);
  }

  /**
   * Update daily totals
   */
  private async updateDailyTotals(costEntry: CostEntry): Promise<void> {
    const dateKey = costEntry.timestamp.toISOString().split('T')[0];
    const current = this.dailyTotals.get(dateKey) || 0;
    this.dailyTotals.set(dateKey, current + costEntry.amount);
    
    // Persist daily totals
    await this.storage.put('daily_totals', Object.fromEntries(this.dailyTotals));
  }

  /**
   * Alert action implementations (stubs for external services)
   */
  private async sendEmailAlert(budget: Budget, alert: BudgetAlert): Promise<void> {
    console.log(`Email alert for budget ${budget.name}: ${alert.threshold}% threshold reached`);
    // Implementation would integrate with email service
  }

  private async sendWebhookAlert(budget: Budget, alert: BudgetAlert): Promise<void> {
    console.log(`Webhook alert for budget ${budget.name}: ${alert.threshold}% threshold reached`);
    // Implementation would call webhook URL
  }

  private async sendSlackAlert(budget: Budget, alert: BudgetAlert): Promise<void> {
    console.log(`Slack alert for budget ${budget.name}: ${alert.threshold}% threshold reached`);
    // Implementation would post to Slack
  }

  private async sendBudgetExceededWarning(budget: Budget): Promise<void> {
    console.log(`WARNING: Budget ${budget.name} exceeded!`);
  }

  private async throttleResources(budget: Budget): Promise<void> {
    console.log(`Throttling resources for budget ${budget.name}`);
    // Implementation would reduce resource allocation
  }

  private async stopResources(budget: Budget): Promise<void> {
    console.log(`Stopping resources for budget ${budget.name}`);
    // Implementation would stop non-critical resources
  }

  /**
   * Test alert functionality
   */
  private async testAlert(request: Request): Promise<Response> {
    const { budgetId, alertType } = await request.json() as { budgetId?: string; alertType?: string };
    
    if (!budgetId) {
      return new Response('Budget ID required', { status: 400 });
    }
    const budget = await this.loadBudget(budgetId);
    if (!budget) {
      return new Response('Budget not found', { status: 404 });
    }

    const testAlert: BudgetAlert = {
      id: 'test',
      threshold: 50,
      triggered: true,
      type: (alertType === 'critical' ? 'critical' : 'warning') as BudgetAlert['type'],
      actions: ['email', 'webhook']
    };

    await this.sendBudgetAlert(budget, testAlert);

    return Response.json({
      success: true,
      message: 'Test alert sent'
    });
  }

  /**
   * Get health status
   */
  private async getHealth(): Promise<Response> {
    const activeBudgets = Array.from(this.budgets.values()).filter(b => b.status === 'active');
    const exceededBudgets = Array.from(this.budgets.values()).filter(b => b.status === 'exceeded');
    
    const health = {
      status: exceededBudgets.length === 0 ? 'healthy' : 'warning',
      activeBudgets: activeBudgets.length,
      exceededBudgets: exceededBudgets.length,
      totalCostToday: this.dailyTotals.get(new Date().toISOString().split('T')[0]) || 0,
      issues: [] as string[]
    };

    if (exceededBudgets.length > 0) {
      health.issues.push(`${exceededBudgets.length} budgets exceeded`);
    }

    return Response.json({
      success: true,
      health
    });
  }

  /**
   * Cleanup old cost entries
   */
  private async cleanup(): Promise<Response> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    const cutoffKey = `cost:${cutoffDate.toISOString().split('T')[0]}`;
    
    const oldEntries = await this.storage.list({ end: cutoffKey });
    let cleanedCount = 0;

    for (const [key] of oldEntries) {
      await this.storage.delete(key);
      cleanedCount++;
    }

    return Response.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old cost entries`
    });
  }

  /**
   * Load budget from storage
   */
  private async loadBudget(budgetId: string): Promise<Budget | null> {
    if (this.budgets.has(budgetId)) {
      return this.budgets.get(budgetId)!;
    }

    const budget = await this.storage.get<Budget>(`budget:${budgetId}`);
    if (budget) {
      this.budgets.set(budgetId, budget);
      return budget;
    }

    return null;
  }

  /**
   * Save budget to storage
   */
  private async saveBudget(budget: Budget): Promise<void> {
    await this.storage.put(`budget:${budget.id}`, budget);
    this.budgets.set(budget.id, budget);
  }

  /**
   * Sanitize budget for external access
   */
  private sanitizeBudget(budget: Budget): Partial<Budget> {
    return {
      id: budget.id,
      name: budget.name,
      limit: budget.limit,
      period: budget.period,
      spent: budget.spent,
      remaining: budget.remaining,
      percentage: budget.percentage,
      status: budget.status,
      alerts: budget.alerts.map(alert => ({
        ...alert,
        // Remove internal tracking data
      }))
    };
  }
}