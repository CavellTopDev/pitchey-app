import { neon } from '@neondatabase/serverless';

// Test the investor dashboard endpoint logic locally
const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testInvestorDashboard() {
  const sql = neon(DATABASE_URL);
  
  try {
    // Simulate no auth
    const userId = null;
    
    console.log('Testing with userId:', userId);
    
    // Get portfolio summary
    const investments = userId ? await sql`
      SELECT COUNT(*) as count, SUM(amount) as total 
      FROM investments 
      WHERE investor_id = ${userId} AND status = 'active'
    ` : [{ count: 0, total: 0 }];
    
    console.log('Investments result:', investments);

    // Get recent activity
    const recentActivity = userId ? await sql`
      SELECT * FROM investments 
      WHERE investor_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 5
    ` : [];
    
    console.log('Recent activity result:', recentActivity);

    // Get investment opportunities (featured pitches)
    const opportunities = await sql`
      SELECT p.*, u.username as creator_name 
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active' AND p.is_featured = true
      LIMIT 6
    `;
    
    console.log('Opportunities count:', opportunities.length);
    console.log('First opportunity:', opportunities[0]?.title);

    const response = {
      success: true,
      portfolio: {
        totalInvested: investments[0]?.total || 0,
        activeInvestments: investments[0]?.count || 0,
        roi: 0
      },
      recentActivity: recentActivity || [],
      opportunities: opportunities || []
    };
    
    console.log('Response structure:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testInvestorDashboard();