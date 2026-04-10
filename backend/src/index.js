import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "ProInterview backend is running",
    docs: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    if (MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log("MongoDB connected");
    } else {
      console.warn("MONGO_URI is missing. Server runs without database connection.");
    }

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();
