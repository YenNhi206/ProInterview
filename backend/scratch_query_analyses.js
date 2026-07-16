import mongoose from "mongoose";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const MONGO_URI = process.env.MONGO_URI;

async function check() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is missing");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const list = await db.collection("cv_analyses").find({}).sort({ createdAt: -1 }).limit(1).toArray();
  
  console.log("=== LATEST DOCUMENT FULL DUMP ===");
  console.log(JSON.stringify(list[0], null, 2));
  process.exit(0);
}

check();
