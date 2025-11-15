// Generate bcrypt hash for demo accounts
import bcrypt from "npm:bcryptjs@2.4.3";

const password = "Demo123!";
console.log("Generating hash for:", password);

try {
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Generated hash:", hashedPassword);
  
  // Also test that it works for verification
  const isValid = await bcrypt.compare(password, hashedPassword);
  console.log("Hash verification:", isValid);
} catch (error) {
  console.error("Error:", error);
}