// Test script to check auth
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTY5NTkwMDAwMH0.test";

// The frontend is using user.id = 1 from localStorage
// But in database, alex.creator@demo.com has id = 1001

console.log("Frontend thinks user ID is: 1");
console.log("Database has user ID as: 1001");
console.log("\nThis mismatch is causing the foreign key constraint error!");
console.log("\nSolution: Update the auth endpoint to return the correct user ID from database");
