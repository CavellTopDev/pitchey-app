import { neon } from 'npm:@neondatabase/serverless@0.9.5';

const client = neon(Deno.env.get('DATABASE_URL')!);

try {
  console.log('Checking estimated_budget column type...');
  
  const result = await client`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = 'pitches' AND column_name = 'estimated_budget';
  `;
  
  if (result.length === 0) {
    console.log('❌ estimated_budget column does not exist');
  } else {
    console.log('estimated_budget column info:');
    result.forEach(row => console.log(`- ${row.column_name}: ${row.data_type} (${row.character_maximum_length})`));
  }
} catch (error) {
  console.error('Error:', error);
}