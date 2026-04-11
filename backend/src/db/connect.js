import mongoose from "mongoose";

/**
 * @param {string} uri - Full MongoDB connection string (database name is the path after host, e.g. .../prointerview)
 */
export async function connectDatabase(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    appName: "prointerview-backend",
  });
}
