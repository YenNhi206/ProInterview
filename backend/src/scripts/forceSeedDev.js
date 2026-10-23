import "./_devOnlyGuard.js";
import "../config/loadEnv.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";

const SALT_ROUNDS = 10;

async function main() {
  const uri = process.env.MONGO_URI;
  await connectDatabase(uri);

  const devUsers = [
    { email: "admin@dev.local", name: "Admin Dev", role: "admin", password: "Dev123456" },
    { email: "mentor@dev.local", name: "Mentor Dev", role: "mentor", password: "Dev123456" },
    { email: "customer@dev.local", name: "Khách hàng Dev", role: "customer", password: "Dev123456" }
  ];

  for (const row of devUsers) {
    const exists = await User.findOne({ email: row.email });
    if (!exists) {
      const passwordHash = await bcrypt.hash(row.password, SALT_ROUNDS);
      const newUser = await User.create({
        email: row.email,
        name: row.name,
        role: row.role,
        passwordHash,
        isEmailVerified: true
      });
      console.log(`Created dev user: ${row.email}`);
      if (row.role === "mentor") {
        await createMentorProfileForUser(newUser).catch(e => console.error("Mentor profile error:", e));
      }
    } else if (row.role === "mentor") {
      const mentorProfile = await Mentor.findOne({ userId: exists._id });
      if (!mentorProfile) {
        await createMentorProfileForUser(exists).catch((e) =>
          console.error("Mentor profile error:", e),
        );
      } else if (
        mentorProfile.isActive !== true ||
        mentorProfile.available !== true ||
        mentorProfile.isVerified !== true
      ) {
        await Mentor.updateOne(
          { _id: mentorProfile._id },
          {
            $set: {
              isActive: true,
              available: true,
              isVerified: true,
              verifiedAt: mentorProfile.verifiedAt || new Date(),
              "adminReview.status": "approved",
              "adminReview.reason": "",
              "adminReview.reviewedAt": new Date(),
            },
          },
        );
        console.log(`Repaired mentor flags for ${row.email}`);
      } else {
        console.log(`User ${row.email} already exists`);
      }
    } else {
      console.log(`User ${row.email} already exists`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
