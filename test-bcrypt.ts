import * as bcrypt from 'bcryptjs';

const testPassword = "Demo123";
// This is the hash stored in the database for Demo123
const storedHash = "$2b$10$GQZ7Y5Q7PXKqYv5V9qXZaO3Kh6Q5V9qXZaO3Kh6Q5";

async function testBcrypt() {
  try {
    console.log('Testing bcrypt...');
    
    // Generate a new hash
    const newHash = await bcrypt.hash(testPassword, 10);
    console.log('New hash generated:', newHash);
    
    // Verify against new hash
    const valid1 = await bcrypt.compare(testPassword, newHash);
    console.log('Verification against new hash:', valid1);
    
    // Generate another hash and verify
    const hash2 = bcrypt.hashSync(testPassword, 10);
    const valid2 = bcrypt.compareSync(testPassword, hash2);
    console.log('Sync verification:', valid2);
    
  } catch (error) {
    console.error('Bcrypt error:', error);
  }
}

testBcrypt();
