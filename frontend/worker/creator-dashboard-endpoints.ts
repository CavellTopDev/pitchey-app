// Creator Dashboard Missing Endpoints
// These endpoints need to be integrated into the main Worker index.ts

export const missingEndpoints = `
    // Analytics User endpoint
    if (url.pathname === '/api/analytics/user' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const token = authHeader.slice(7);
        const payload = await verifyJWT(token, env.JWT_SECRET);
        const userId = parseInt(payload.id || payload.sub || payload.userId, 10);

        // Get user-specific analytics
        const analytics = await sql\`
          SELECT 
            COUNT(DISTINCT p.id) as total_pitches,
            COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_pitches,
            COUNT(DISTINCT pv.id) as total_views,
            COUNT(DISTINCT f.id) as total_follows,
            COUNT(DISTINCT nr.id) as total_ndas,
            COUNT(DISTINCT CASE WHEN nr.status = 'approved' THEN nr.id END) as approved_ndas,
            AVG(CASE WHEN pv.duration IS NOT NULL THEN pv.duration END) as avg_view_duration
          FROM users u
          LEFT JOIN pitches p ON u.id = p.user_id
          LEFT JOIN pitch_views pv ON p.id = pv.pitch_id
          LEFT JOIN follows f ON p.id = f.pitch_id
          LEFT JOIN nda_requests nr ON p.id = nr.pitch_id
          WHERE u.id = \${userId}
        \`;

        const recentActivity = await sql\`
          SELECT 
            'view' as type,
            pv.created_at,
            p.title as pitch_title,
            u.username as viewer_name
          FROM pitch_views pv
          INNER JOIN pitches p ON pv.pitch_id = p.id
          INNER JOIN users u ON pv.viewer_id = u.id
          WHERE p.user_id = \${userId}
          ORDER BY pv.created_at DESC
          LIMIT 10
        \`;

        return new Response(JSON.stringify({
          success: true,
          analytics: {
            totalPitches: analytics[0]?.total_pitches || 0,
            activePitches: analytics[0]?.active_pitches || 0,
            totalViews: analytics[0]?.total_views || 0,
            totalFollows: analytics[0]?.total_follows || 0,
            totalNdas: analytics[0]?.total_ndas || 0,
            approvedNdas: analytics[0]?.approved_ndas || 0,
            avgViewDuration: analytics[0]?.avg_view_duration || 0
          },
          recentActivity: recentActivity.map(activity => ({
            type: activity.type,
            createdAt: activity.created_at,
            pitchTitle: activity.pitch_title,
            viewerName: activity.viewer_name
          }))
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (error) {
        console.error('Analytics user error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch user analytics'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Creator Funding Overview endpoint
    if (url.pathname === '/api/creator/funding/overview' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const token = authHeader.slice(7);
        const payload = await verifyJWT(token, env.JWT_SECRET);
        const userId = parseInt(payload.id || payload.sub || payload.userId, 10);

        // Get funding overview for creator's pitches
        const fundingOverview = await sql\`
          SELECT 
            COUNT(DISTINCT i.id) as total_investments,
            SUM(i.amount) as total_raised,
            COUNT(DISTINCT i.investor_id) as unique_investors,
            COUNT(DISTINCT p.id) as funded_pitches,
            AVG(i.amount) as avg_investment_size
          FROM pitches p
          LEFT JOIN investments i ON p.id = i.pitch_id
          WHERE p.user_id = \${userId} AND i.status = 'completed'
        \`;

        const recentInvestments = await sql\`
          SELECT 
            i.id,
            i.amount,
            i.created_at,
            i.status,
            p.title as pitch_title,
            u.username as investor_name,
            u.company_name as investor_company
          FROM investments i
          INNER JOIN pitches p ON i.pitch_id = p.id
          INNER JOIN users u ON i.investor_id = u.id
          WHERE p.user_id = \${userId}
          ORDER BY i.created_at DESC
          LIMIT 10
        \`;

        return new Response(JSON.stringify({
          success: true,
          overview: {
            totalInvestments: fundingOverview[0]?.total_investments || 0,
            totalRaised: fundingOverview[0]?.total_raised || 0,
            uniqueInvestors: fundingOverview[0]?.unique_investors || 0,
            fundedPitches: fundingOverview[0]?.funded_pitches || 0,
            avgInvestmentSize: fundingOverview[0]?.avg_investment_size || 0
          },
          recentInvestments: recentInvestments.map(inv => ({
            id: inv.id,
            amount: inv.amount,
            createdAt: inv.created_at,
            status: inv.status,
            pitchTitle: inv.pitch_title,
            investorName: inv.investor_name,
            investorCompany: inv.investor_company
          }))
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (error) {
        console.error('Funding overview error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch funding overview'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
`;

export function insertEndpointsIntoWorker(workerContent: string): string {
  // Find the location right before the proxy section (line 2608)
  const proxyMarker = '// For all other API endpoints, proxy to the Deno backend';
  const insertPosition = workerContent.indexOf(proxyMarker);
  
  if (insertPosition === -1) {
    throw new Error('Could not find insertion point in Worker file');
  }
  
  // Insert the missing endpoints before the proxy section
  return workerContent.slice(0, insertPosition) + 
         missingEndpoints + '\n\n' +
         workerContent.slice(insertPosition);
}