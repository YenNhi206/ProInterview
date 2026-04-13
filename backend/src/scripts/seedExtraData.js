import mongoose from "mongoose";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const MOCK_MENTORS = [
  { name: "Nguyễn Văn A", email: "mentora@prointerview.vn", title: "Senior Frontend Engineer", company: "Grab", field: "Frontend Development", skills: ["React", "JavaScript", "System Design"], hourlyRate: 450000 },
  { name: "Trần Thị B", email: "mentorb@prointerview.vn", title: "Technical Product Manager", company: "Shopee", field: "Product Management", skills: ["Agile", "Product Strategy", "Roadmapping"], hourlyRate: 600000 },
  { name: "Lê Văn C", email: "mentorc@prointerview.vn", title: "Engineering Manager", company: "VNG", field: "Backend Development", skills: ["Node.js", "Microservices", "Scalability"], hourlyRate: 550000 },
  { name: "Phạm Minh D", email: "mentord@prointerview.vn", title: "HR Manager", company: "FPT Software", field: "Human Resources", skills: ["Interviewing", "Resume Review", "Career Path"], hourlyRate: 350000 },
  { name: "Đặng Thu E", email: "mentore@prointerview.vn", title: "Senior Designer", company: "Tiki", field: "UI/UX Design", skills: ["Figma", "Design Systems", "Prototyping"], hourlyRate: 400000 },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) process.exit(1);

  await connectDatabase(uri);

  console.log("Seeding extra data...");

  // Seed Mentors (Users with role mentor)
  for (const m of MOCK_MENTORS) {
    const exists = await User.findOne({ email: m.email });
    if (!exists) {
      const passwordHash = await bcrypt.hash("Dev123456", SALT_ROUNDS);
      const user = await User.create({
        email: m.email,
        name: m.name,
        role: "mentor",
        passwordHash,
        desiredPosition: m.title,
        currentCompany: m.company,
        skills: m.skills,
        hourlyRate: m.hourlyRate,
        experience: 5 + Math.floor(Math.random() * 10),
      });
      await createMentorProfileForUser(user);
      console.log(`- Seeded mentor: ${m.name}`);
    }
  }

  // Seed Courses
  const randoMentor = await Mentor.findOne();
  const mentorId = randoMentor?._id;

  if (mentorId) {
    const MOCK_COURSES = [
      { 
        title: "Lộ trình học Frontend từ Zero đến Hero", 
        description: "Học React, Next.js và kiến thức nền tảng để trở thành Frontend Dev chuyên nghiệp.", 
        price: 1200000, 
        level: "basic", 
        mentorId,
        status: "published",
        topics: ["Technical"]
      },
      { 
        title: "Kỹ năng phỏng vấn Technical tại Big Tech", 
        description: "Bí kíp ace các buổi phỏng vấn tại Grab, Shopee, VNG từ HR và EM.", 
        price: 850000, 
        level: "intermediate", 
        mentorId,
        status: "published",
        topics: ["Behavioral"]
      },
      { 
        title: "Mastering Node.js Microservices", 
        description: "Xây dựng hệ thống phân tán chịu tải cao với Node.js và Docker.", 
        price: 1500000, 
        level: "advanced", 
        mentorId,
        status: "published",
        topics: ["Technical"]
      },
    ];

    for (const c of MOCK_COURSES) {
      const exists = await Course.findOne({ title: c.title });
      if (!exists) {
        await Course.create({ ...c });
        console.log(`- Seeded course: ${c.title}`);
      }
    }
  }

  console.log("Seeding complete!");
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
