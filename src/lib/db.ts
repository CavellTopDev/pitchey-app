// Database stub for Worker environment
// This should use the actual database connection from worker-database.ts

export const sql = async (query: any, ...params: any[]) => {
  // This is a stub - in production, use the actual database
  console.warn('Database query stub called:', query);
  return [];
};