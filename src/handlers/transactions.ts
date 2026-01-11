// Phase 3: Transactions Handler
// Handles payment processing and transaction management

export class TransactionsHandler {
  constructor(private db: any) {}

  // Get all transactions
  async getTransactions(userId: number, filters: any = {}) {
    try {
      const {
        type = null, // payment, refund, withdrawal, deposit
        status = null, // pending, completed, failed, cancelled
        dateFrom = null,
        dateTo = null,
        minAmount = null,
        maxAmount = null,
        limit = 50,
        offset = 0
      } = filters;

      let query = `
        SELECT t.*, 
          u.name as user_name,
          p.title as pitch_title,
          i.amount as investment_amount
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN pitches p ON p.id = t.pitch_id
        LEFT JOIN investments i ON i.id = t.investment_id
        WHERE t.user_id = $1`;

      const conditions = [];
      const params = [userId];
      let paramCount = 1;

      // Build dynamic conditions
      if (type) {
        paramCount++;
        conditions.push(`t.type = $${paramCount}`);
        params.push(type);
      }

      if (status) {
        paramCount++;
        conditions.push(`t.status = $${paramCount}`);
        params.push(status);
      }

      if (dateFrom) {
        paramCount++;
        conditions.push(`t.created_at >= $${paramCount}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        paramCount++;
        conditions.push(`t.created_at <= $${paramCount}`);
        params.push(dateTo);
      }

      if (minAmount) {
        paramCount++;
        conditions.push(`t.amount >= $${paramCount}`);
        params.push(minAmount);
      }

      if (maxAmount) {
        paramCount++;
        conditions.push(`t.amount <= $${paramCount}`);
        params.push(maxAmount);
      }

      // Add conditions to query
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      // Add ordering and pagination
      query += ' ORDER BY t.created_at DESC';
      
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(limit);
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);

      const transactions = await this.db.query(query, params);

      // Get summary statistics
      const stats = await this.db.query(
        `SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as total_payments,
          SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as total_refunds,
          SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawals,
          SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_completed,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending
         FROM transactions
         WHERE user_id = $1`,
        [userId]
      );

      return { 
        success: true, 
        data: { 
          transactions, 
          stats: stats[0] || {},
          totalCount: parseInt(stats[0]?.total_count || 0)
        } 
      };
    } catch (error) {
      console.error('Get transactions error:', error);
      return { success: true, data: { transactions: [], stats: {}, totalCount: 0 } };
    }
  }

  // Get single transaction
  async getTransactionById(userId: number, transactionId: number) {
    try {
      const transaction = await this.db.query(
        `SELECT t.*, 
          u.name as user_name,
          p.title as pitch_title,
          i.amount as investment_amount,
          pm.card_last4,
          pm.card_brand
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN pitches p ON p.id = t.pitch_id
         LEFT JOIN investments i ON i.id = t.investment_id
         LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
         WHERE t.id = $1 AND t.user_id = $2`,
        [transactionId, userId]
      );

      if (transaction.length === 0) {
        return { success: false, error: 'Transaction not found' };
      }

      // Get related transactions
      const related = await this.db.query(
        `SELECT * FROM transactions
         WHERE (investment_id = $1 OR parent_transaction_id = $2)
           AND id != $3
         ORDER BY created_at DESC
         LIMIT 5`,
        [transaction[0].investment_id, transactionId, transactionId]
      );

      return { 
        success: true, 
        data: { 
          transaction: transaction[0],
          relatedTransactions: related
        } 
      };
    } catch (error) {
      console.error('Get transaction error:', error);
      return { success: false, error: 'Failed to fetch transaction' };
    }
  }

  // Create new transaction
  async createTransaction(userId: number, data: any) {
    try {
      const {
        type = 'payment',
        amount,
        currency = 'USD',
        pitchId = null,
        investmentId = null,
        paymentMethodId = null,
        description = '',
        metadata = {}
      } = data;

      // Validate amount
      if (!amount || amount <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      // Begin transaction
      await this.db.query('BEGIN');

      try {
        // Create transaction record
        const transaction = await this.db.query(
          `INSERT INTO transactions 
           (user_id, type, amount, currency, status, pitch_id, 
            investment_id, payment_method_id, description, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [userId, type, amount, currency, 'pending', pitchId, 
           investmentId, paymentMethodId, description, JSON.stringify(metadata)]
        );

        // Process payment (mock implementation)
        const paymentResult = await this.processPayment(transaction[0]);

        if (paymentResult.success) {
          // Update transaction status
          await this.db.query(
            `UPDATE transactions 
             SET status = 'completed', 
                 processor_response = $2,
                 completed_at = NOW()
             WHERE id = $1`,
            [transaction[0].id, JSON.stringify(paymentResult.response)]
          );

          // Update related records based on type
          if (type === 'payment' && investmentId) {
            await this.db.query(
              `UPDATE investments 
               SET status = 'active', paid_amount = paid_amount + $2
               WHERE id = $1`,
              [investmentId, amount]
            );
          }

          await this.db.query('COMMIT');

          return { 
            success: true, 
            data: { 
              transaction: { ...transaction[0], status: 'completed' },
              paymentResult: paymentResult.response
            } 
          };
        } else {
          // Update transaction as failed
          await this.db.query(
            `UPDATE transactions 
             SET status = 'failed', 
                 processor_response = $2,
                 failed_at = NOW()
             WHERE id = $1`,
            [transaction[0].id, JSON.stringify(paymentResult.error)]
          );

          await this.db.query('COMMIT');

          return { 
            success: false, 
            error: 'Payment failed', 
            data: { 
              transaction: { ...transaction[0], status: 'failed' },
              error: paymentResult.error 
            }
          };
        }
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Create transaction error:', error);
      return { success: false, error: 'Failed to create transaction' };
    }
  }

  // Update transaction status
  async updateTransactionStatus(userId: number, transactionId: number, status: string) {
    try {
      // Validate status
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: 'Invalid status' };
      }

      // Check ownership and current status
      const current = await this.db.query(
        `SELECT * FROM transactions 
         WHERE id = $1 AND user_id = $2`,
        [transactionId, userId]
      );

      if (current.length === 0) {
        return { success: false, error: 'Transaction not found' };
      }

      // Don't allow updating completed or refunded transactions
      if (['completed', 'refunded'].includes(current[0].status)) {
        return { success: false, error: `Cannot update ${current[0].status} transaction` };
      }

      // Update status
      const updated = await this.db.query(
        `UPDATE transactions 
         SET status = $1, 
             updated_at = NOW(),
             ${status === 'completed' ? 'completed_at = NOW(),' : ''}
             ${status === 'failed' ? 'failed_at = NOW(),' : ''}
             ${status === 'cancelled' ? 'cancelled_at = NOW(),' : ''}
             metadata = jsonb_set(metadata, '{status_history}', 
               COALESCE(metadata->'status_history', '[]'::jsonb) || 
               jsonb_build_object('from', $2, 'to', $1, 'at', NOW())::jsonb)
         WHERE id = $3
         RETURNING *`,
        [status, current[0].status, transactionId]
      );

      // Handle status-specific actions
      if (status === 'cancelled' && current[0].investment_id) {
        await this.db.query(
          `UPDATE investments 
           SET status = 'cancelled'
           WHERE id = $1`,
          [current[0].investment_id]
        );
      }

      return { success: true, data: { transaction: updated[0] } };
    } catch (error) {
      console.error('Update transaction status error:', error);
      return { success: false, error: 'Failed to update transaction' };
    }
  }

  // Export transactions
  async exportTransactions(userId: number, format: string = 'csv') {
    try {
      const transactions = await this.db.query(
        `SELECT 
          t.id,
          t.type,
          t.amount,
          t.currency,
          t.status,
          t.description,
          t.created_at,
          t.completed_at,
          p.title as pitch_title,
          u.name as user_name
         FROM transactions t
         LEFT JOIN pitches p ON p.id = t.pitch_id
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );

      let exportData;
      
      if (format === 'csv') {
        // Convert to CSV
        const headers = ['ID', 'Type', 'Amount', 'Currency', 'Status', 'Description', 'Pitch', 'Date', 'Completed'];
        const rows = transactions.map((t: any) => [
          t.id,
          t.type,
          t.amount,
          t.currency,
          t.status,
          t.description || '',
          t.pitch_title || '',
          t.created_at,
          t.completed_at || ''
        ]);
        
        exportData = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n');
      } else {
        // JSON format
        exportData = JSON.stringify(transactions, null, 2);
      }

      return { 
        success: true, 
        data: { 
          content: exportData,
          format,
          filename: `transactions_${Date.now()}.${format}`,
          mimeType: format === 'csv' ? 'text/csv' : 'application/json'
        } 
      };
    } catch (error) {
      console.error('Export transactions error:', error);
      return { success: false, error: 'Failed to export transactions' };
    }
  }

  // Helper: Process payment (mock)
  private async processPayment(transaction: any): Promise<any> {
    // Mock payment processing
    // In production, this would integrate with Stripe, PayPal, etc.
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock 90% success rate
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        response: {
          transactionId: `stripe_${transaction.id}_${Date.now()}`,
          status: 'succeeded',
          amount: transaction.amount,
          currency: transaction.currency,
          processedAt: new Date().toISOString()
        }
      };
    } else {
      return {
        success: false,
        error: {
          code: 'payment_failed',
          message: 'Your card was declined',
          declineCode: 'insufficient_funds'
        }
      };
    }
  }
}