#!/bin/bash

# Fix all drizzle-orm imports
find src/ -name "*.ts" -type f -exec sed -i 's/from "drizzle-orm/from "npm:drizzle-orm/g' {} +

# Fix postgres import
find src/ -name "*.ts" -type f -exec sed -i 's/from "postgres"/from "npm:postgres"/g' {} +

# Fix bcrypt import
find src/ -name "*.ts" -type f -exec sed -i 's/from "bcrypt"/from "npm:bcrypt"/g' {} +

# Fix jsonwebtoken import  
find src/ -name "*.ts" -type f -exec sed -i 's/from "jsonwebtoken"/from "npm:jsonwebtoken"/g' {} +

# Fix stripe import
find src/ -name "*.ts" -type f -exec sed -i 's/from "stripe"/from "npm:stripe"/g' {} +

# Fix redis import
find src/ -name "*.ts" -type f -exec sed -i 's/from "redis"/from "npm:redis"/g' {} +

# Fix ioredis import
find src/ -name "*.ts" -type f -exec sed -i 's/from "ioredis"/from "npm:ioredis"/g' {} +

# Fix zod import
find src/ -name "*.ts" -type f -exec sed -i 's/from "zod"/from "npm:zod"/g' {} +

# Fix nanoid import
find src/ -name "*.ts" -type f -exec sed -i 's/from "nanoid"/from "npm:nanoid"/g' {} +

echo "Import paths fixed!"