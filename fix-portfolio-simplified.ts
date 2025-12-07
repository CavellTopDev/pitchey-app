// Simplified portfolio summary query to avoid stack overflow
// Replace the complex aggregation with simpler queries

const getPortfolioSummary = async (db: any, investorId: number) => {
  try {
    // Get all investments for the investor
    const investments = await db
      .select()
      .from(schema.investments)
      .where(eq(schema.investments.investorId, investorId));
    
    // Calculate aggregates in JavaScript to avoid SQL complexity
    const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const activeInvestments = investments.filter(inv => inv.status === 'active').length;
    const averageROI = investments.length > 0 
      ? investments.reduce((sum, inv) => sum + Number(inv.roiPercentage || 0), 0) / investments.length
      : 0;
    
    // Get top performer
    const topPerformer = investments
      .sort((a, b) => Number(b.roiPercentage || 0) - Number(a.roiPercentage || 0))[0];
    
    let topPerformerTitle = 'No investments yet';
    if (topPerformer && topPerformer.pitchId) {
      const pitch = await db
        .select()
        .from(schema.pitches)
        .where(eq(schema.pitches.id, topPerformer.pitchId))
        .limit(1);
      
      if (pitch[0]) {
        topPerformerTitle = pitch[0].title;
      }
    }
    
    return {
      totalInvested,
      activeInvestments,
      averageROI,
      topPerformer: topPerformerTitle
    };
  } catch (error) {
    console.error('Portfolio summary error:', error);
    throw error;
  }
};