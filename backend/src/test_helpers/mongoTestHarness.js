import jwt from "jsonwebtoken";

const TEST_JWT_SECRET = "prointerview-cv-integration-test-secret";

export function applyTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.CV_ANALYZER_URL = process.env.CV_ANALYZER_URL || "http://127.0.0.1:8000";
}

export async function startMongoHarness() {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongoose = (await import("mongoose")).default;
  const mongod = await MongoMemoryServer.create();
  // Kết nối như app (strictQuery: true), nếu không lỗi sai tên field trong filter sẽ pass giả.
  const { connectDatabase } = await import("../db/connect.js");
  await connectDatabase(mongod.getUri());
  return { mongod, mongoose };
}

export async function stopMongoHarness({ mongod, mongoose }) {
  await mongoose.disconnect();
  await mongod.stop();
}

export function mintAccessToken(userId) {
  return jwt.sign({ sub: userId.toString(), tv: 0 }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

export function startHttpServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

export async function stopHttpServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
