import mongoose from "mongoose";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = __dirname;

// Load env
let envPath = join(backendRoot, ".env");
if (!existsSync(envPath)) {
  const alt = join(backendRoot, "env");
  if (existsSync(alt)) envPath = alt;
}
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

async function checkDB() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("--- DATABASE CHECK ---");
    console.log(`Connected to: ${db.databaseName}`);
    console.log(`Collections found: ${collections.length}\n`);

    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`- ${coll.name}: ${count} records`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Connection error:", err);
    process.exit(1);
  }
}

checkDB();
