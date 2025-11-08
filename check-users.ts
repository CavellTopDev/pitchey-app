// Check what users exist in the database
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";

async function checkUsers() {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType,
      username: users.username
    }).from(users);

    console.log('All users in database:');
    console.log(allUsers);
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    Deno.exit(0);
  }
}

if (import.meta.main) {
  checkUsers();
}