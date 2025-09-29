import { drizzle } from 'npm:drizzle-orm/postgres-js';
import postgres from 'npm:postgres';
import { ndaRequests, ndas } from './src/db/schema.ts';

const sql = postgres(Deno.env.get('DATABASE_URL') || 'postgresql://postgres:password@localhost:5432/pitchey');
const db = drizzle(sql);

console.log('🌱 Seeding NDA data...');

try {
  // Create some NDA requests for the creator (user ID 1001)
  const ndaRequestsData = [
    {
      id: 1,
      pitchId: 1,
      requesterId: 1002, // investor
      ownerId: 1001,     // creator
      pitchTitle: "Quantum Echoes",
      ndaType: "basic",
      requesterName: "Jordan Investor",
      requesterEmail: "jordan@investors.com",
      requesterCompany: "Investment Corp",
      status: "pending",
      createdAt: new Date(Date.now() - 86400000), // 1 day ago
    },
    {
      id: 2,
      pitchId: 2,
      requesterId: 1003, // production company
      ownerId: 1001,     // creator
      pitchTitle: "The Last Performance",
      ndaType: "enhanced",
      requesterName: "Stellar Productions",
      requesterEmail: "contact@stellar.com",
      requesterCompany: "Stellar Entertainment",
      status: "approved",
      createdAt: new Date(Date.now() - 172800000), // 2 days ago
      approvedAt: new Date(Date.now() - 86400000), // 1 day ago
    }
  ];

  // Insert NDA requests
  await db.insert(ndaRequests).values(ndaRequestsData);
  console.log('✅ Created NDA requests');

  // Create a signed NDA (this would typically be created when someone signs)
  const signedNDAData = {
    id: 1,
    pitchId: 2,
    signerId: 1003,    // production company signed
    ownerId: 1001,     // creator owns the pitch
    ndaRequestId: 2,   // references the approved request
    accessGranted: true,
    signedAt: new Date(Date.now() - 86400000), // 1 day ago
    expiresAt: new Date(Date.now() + 31536000000), // 1 year from now
  };

  await db.insert(ndas).values(signedNDAData);
  console.log('✅ Created signed NDA');

  console.log('🎉 NDA data seeded successfully!');
  console.log('📊 Created:');
  console.log('  - 2 NDA requests (1 pending, 1 approved)');
  console.log('  - 1 signed NDA');
  
} catch (error) {
  console.error('❌ Error seeding NDA data:', error);
} finally {
  await sql.end();
}