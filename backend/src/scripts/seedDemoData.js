import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Review } from "../models/Review.js";

export async function seedDemoData() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/prointerview");
      console.log("Connected to MongoDB for Demo Seed");
    }

    // 1. Create a Demo Mentor User
    const mentorEmail = "demomentor@prointerview.vn";
    let mentorUser = await User.findOne({ email: mentorEmail });
    if (!mentorUser) {
      mentorUser = await User.create({
        email: mentorEmail,
        name: "Lê Nguyễn Anh Tú",
        passwordHash: "$2b$10$dummyHashString",
        role: "mentor",
        isActive: true,
        isEmailVerified: true,
        avatar: "https://i.pravatar.cc/150?u=demomentor"
      });
    }

    // 2. Create the Mentor profile
    let mentorProfile = await Mentor.findOne({ userId: mentorUser._id });
    if (!mentorProfile) {
      mentorProfile = await Mentor.create({
        userId: mentorUser._id,
        name: mentorUser.name,
        slug: "le-nguyen-anh-tu-demo",
        headline: "Senior Software Engineer tại VNG",
        about: "Tôi có hơn 6 năm kinh nghiệm làm việc tại các công ty công nghệ lớn, sẵn sàng hỗ trợ các bạn vượt qua vòng phỏng vấn kỹ thuật.",
        expertise: ["React", "Node.js", "System Design"],
        pricing: {
          session1on1: 350000,
          cvReview: 200000,
          mockInterview: 500000
        },
        languages: ["Tiếng Việt", "Tiếng Anh"],
        stats: { rating: 5, reviewCount: 3 }
      });
    }

    // 3. Create 3 Demo Reviewer Users
    const reviewers = [];
    const reviewerData = [
      { email: "demoreviewer1@test.local", name: "Nguyễn Thị Phương", avatar: "https://i.pravatar.cc/150?u=demoreviewer1" },
      { email: "demoreviewer2@test.local", name: "Lê Minh Tuấn", avatar: "https://i.pravatar.cc/150?u=demoreviewer2" },
      { email: "demoreviewer3@test.local", name: "Phạm Hương Giang", avatar: "https://i.pravatar.cc/150?u=demoreviewer3" }
    ];

    for (const rd of reviewerData) {
      let u = await User.findOne({ email: rd.email });
      if (!u) {
        u = await User.create({
          email: rd.email,
          name: rd.name,
          passwordHash: "$2b$10$dummyHashString",
          role: "customer",
          isActive: true,
          isEmailVerified: true,
          avatar: rd.avatar
        });
      }
      reviewers.push(u);
    }

    // 4. Create Reviews (if they don't exist yet)
    const existingReviews = await Review.find({ targetType: "mentor", targetId: mentorProfile._id });
    if (existingReviews.length === 0) {
      const reviewContents = [
        "Mentor hướng dẫn rất tận tình, chỉ ra được những thiếu sót trong cách trả lời phỏng vấn của mình.",
        "Buổi mock interview quá tuyệt vời. Mình học được rất nhiều tips hay để deal lương.",
        "Cách truyền đạt rất dễ hiểu, thân thiện và nhiệt tình hỗ trợ sau buổi học. 10 điểm!"
      ];

      for (let i = 0; i < reviewContents.length; i++) {
        const review = new Review({
          userId: reviewers[i]._id,
          targetType: "mentor",
          targetId: mentorProfile._id,
          rating: 5,
          comment: reviewContents[i],
          isVerified: true,
          isVisible: true
        });
        await review.save(); // This will trigger the mongoose post-save hook to update Mentor stats
      }
      console.log("✅ Seeded 1 Demo Mentor and 3 real reviews for them.");
    } else {
      console.log("✅ Demo Mentor and Reviews already exist. No action needed.");
    }

    return true;
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    return false;
  }
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDemoData().then(success => process.exit(success ? 0 : 1));
}
