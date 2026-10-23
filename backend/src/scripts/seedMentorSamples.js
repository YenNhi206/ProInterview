import "./_devOnlyGuard.js";
/**
 * Thêm 5 mentor mẫu (user + hồ sơ đầy đủ) và chỉ giữ dịch vụ mock interview.
 * Chạy: npm run seed:mentor-samples (từ thư mục backend)
 */
import "../config/loadEnv.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";

const PASSWORD = "Dev123456";
const SALT_ROUNDS = 10;
const TZ_HCM = "Asia/Ho_Chi_Minh";
const TZ_HN = "Asia/Hanoi";

function isoDaysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function workJson(role, company, note, yearsAgo = 2) {
  const now = new Date();
  const start = new Date(now.getFullYear() - yearsAgo, now.getMonth(), 1);
  const sm = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return JSON.stringify({
    version: 1,
    entries: [
      {
        role,
        company,
        startMonth: sm,
        endMonth: "",
        isCurrent: true,
        note,
      },
    ],
  });
}

function mockSessionOnly(pricePerHour) {
  const price = Math.round(Number(pricePerHour) || 350_000);
  return [{ type: "mock_interview", durationMinutes: 60, price }];
}

const SAMPLE_MENTORS = [
  {
    email: "mentor.frontend@dev.local",
    name: "Nguyễn Minh An",
    title: "Senior Frontend Engineer",
    company: "Momo",
    timezone: TZ_HCM,
    experienceYears: 6,
    pricePerHour: 380_000,
    rating: 4.8,
    reviewCount: 12,
    sessionCount: 28,
    bio: "6+ năm xây dựng sản phẩm React/TypeScript quy mô lớn. Hỗ trợ mock interview vị trí Frontend, review cấu trúc câu trả lời và case study UI.",
    profileWorkExperience: workJson(
      "Senior Frontend Engineer",
      "Momo",
      "- Phát triển ví điện tử và trang merchant.\n- Mock interview: React, TypeScript, system design UI.",
      6,
    ),
    profileEducation: "Đại học Bách Khoa TP.HCM — Công nghệ thông tin",
    specialties: ["React", "TypeScript", "System Design"],
    fields: ["IT", "Frontend"],
    skills: ["React", "TypeScript", "Next.js", "System Design"],
  },
  {
    email: "mentor.product@dev.local",
    name: "Trần Thị Hương",
    title: "Lead Product Manager",
    company: "Shopee",
    timezone: TZ_HCM,
    experienceYears: 8,
    pricePerHour: 420_000,
    rating: 4.9,
    reviewCount: 18,
    sessionCount: 35,
    bio: "8 năm PM tại sàn thương mại điện tử. Mentor mock interview PM: metric, prioritization, stakeholder và case sản phẩm thực tế.",
    profileWorkExperience: workJson(
      "Lead Product Manager",
      "Shopee",
      "- Ownership roadmap seller growth.\n- Coaching case interview PM và metric.",
      8,
    ),
    specialties: ["Product Strategy", "Metrics", "Stakeholder"],
    fields: ["Quản lý sản phẩm", "Product"],
    skills: ["Product Strategy", "A/B Testing", "Roadmap"],
  },
  {
    email: "mentor.devops@dev.local",
    name: "Lê Quốc Bảo",
    title: "Senior DevOps Engineer",
    company: "Zalo",
    timezone: TZ_HN,
    experienceYears: 7,
    pricePerHour: 400_000,
    rating: 4.7,
    reviewCount: 9,
    sessionCount: 22,
    bio: "DevOps tại Zalo, chuyên CI/CD, Kubernetes và cloud AWS. Mock interview cho vị trí DevOps/SRE, tập trung scenario vận hành hệ thống.",
    profileWorkExperience: workJson(
      "Senior DevOps Engineer",
      "Zalo",
      "- Vận hành Kubernetes production.\n- Mock interview: CI/CD, incident response.",
      7,
    ),
    specialties: ["Kubernetes", "AWS", "CI/CD"],
    fields: ["IT", "DevOps"],
    skills: ["Docker", "Kubernetes", "AWS", "Terraform"],
  },
  {
    email: "mentor.fullstack@dev.local",
    name: "Phạm Đức Khánh",
    title: "Fullstack Engineer",
    company: "Tiki",
    timezone: TZ_HCM,
    experienceYears: 5,
    pricePerHour: 350_000,
    rating: 4.6,
    reviewCount: 7,
    sessionCount: 15,
    bio: "Fullstack Node.js + React tại Tiki. Hỗ trợ ứng viên fresher–mid chuẩn bị phỏng vấn technical và behavioral cho startup/scale-up.",
    profileWorkExperience: workJson(
      "Fullstack Engineer",
      "Tiki",
      "- API order & catalog service.\n- Mock interview fullstack và REST design.",
      5,
    ),
    specialties: ["Node.js", "React", "PostgreSQL"],
    fields: ["IT", "Fullstack"],
    skills: ["Node.js", "React", "PostgreSQL", "REST API"],
  },
  {
    email: "mentor.data@dev.local",
    name: "Hoàng Văn Nam",
    title: "Lead Data Engineer",
    company: "FPT Software",
    timezone: TZ_HCM,
    experienceYears: 10,
    pricePerHour: 520_000,
    rating: 5.0,
    reviewCount: 14,
    sessionCount: 40,
    bio: "10+ năm data pipeline và analytics. Mock interview Data Engineer: SQL, Spark, thiết kế pipeline và cách trình bày project data thực tế.",
    profileWorkExperience: workJson(
      "Lead Data Engineer",
      "FPT Software",
      "- Data warehouse và batch pipeline.\n- Mock interview SQL, Spark, data modeling.",
      10,
    ),
    specialties: ["SQL", "Spark", "Data Pipeline"],
    fields: ["IT", "Data"],
    skills: ["Python", "SQL", "Apache Spark", "Airflow"],
  },
];

async function upsertMentorSample(definition, passwordHash) {
  const email = definition.email.trim().toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, passwordHash });
  }
  user.name = definition.name;
  user.role = "mentor";
  user.isActive = true;
  user.isEmailVerified = true;
  user.bio = definition.bio;
  user.desiredPosition = definition.title;
  user.position = definition.title;
  user.currentCompany = definition.company;
  user.skills = definition.skills;
  user.expertise = definition.skills;
  user.experience = definition.experienceYears;
  user.hourlyRate = definition.pricePerHour;
  await user.save();

  const publicId = `u${String(user._id)}`;
  const slots = {
    [isoDaysFromToday(3)]: ["09:00", "14:00"],
    [isoDaysFromToday(5)]: ["10:00", "16:00"],
    [isoDaysFromToday(8)]: ["13:00", "17:00"],
  };

  const mentorData = {
    userId: user._id,
    publicId,
    name: definition.name,
    title: definition.title,
    company: definition.company,
    bio: definition.bio,
    profileWorkExperience: definition.profileWorkExperience ?? "",
    profileEducation: definition.profileEducation ?? "",
    specialties: definition.specialties,
    fields: definition.fields,
    companies: [definition.company],
    experienceYears: definition.experienceYears,
    pricePerHour: definition.pricePerHour,
    sessionTypes: mockSessionOnly(definition.pricePerHour),
    available: true,
    responseTime: "< 24 giờ",
    timezone: definition.timezone,
    availableSlots: slots,
    isVerified: true,
    isActive: true,
    verifiedAt: new Date(),
    adminReview: {
      status: "approved",
      reason: "",
      reviewedAt: new Date(),
      reviewedBy: null,
    },
    stats: {
      rating: definition.rating,
      reviewCount: definition.reviewCount,
      sessionCount: definition.sessionCount,
      totalStudents: Math.max(definition.sessionCount - 5, 0),
      completionRate: 98,
      profileViews: definition.sessionCount * 4,
    },
  };

  let mentor = await Mentor.findOne({ userId: user._id });
  if (!mentor) {
    mentor = await Mentor.create(mentorData);
  } else {
    mentor.set(mentorData);
    await mentor.save();
  }
  return { user, mentor };
}

/** Bỏ cv_review khỏi mọi mentor hiện có — chỉ mock interview. */
/** Cập nhật fields cho mentor seed cũ (Node.js / Interviewing → thêm nhãn lĩnh vực). */
async function patchLegacyMentorFields() {
  const patches = [
    { name: "Mentor Dev", fields: ["IT", "Node.js"] },
    { name: "Mentor Career", fields: ["Nhân sự", "Interviewing"] },
  ];
  for (const p of patches) {
    await Mentor.updateMany({ name: p.name }, { $set: { fields: p.fields } });
  }
}

async function stripCvReviewFromAllMentors() {
  const mentors = await Mentor.find({}).select("sessionTypes pricePerHour").lean();
  let updated = 0;
  for (const m of mentors) {
    const hourly = m.pricePerHour ?? 350_000;
    const hasOnlyMock =
      Array.isArray(m.sessionTypes) &&
      m.sessionTypes.length === 1 &&
      m.sessionTypes[0]?.type === "mock_interview";
    if (hasOnlyMock) continue;
    await Mentor.updateOne(
      { _id: m._id },
      { $set: { sessionTypes: mockSessionOnly(hourly) } },
    );
    updated += 1;
  }
  return updated;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  console.log("Thêm / cập nhật 5 mentor mẫu…");
  for (const def of SAMPLE_MENTORS) {
    const { mentor } = await upsertMentorSample(def, passwordHash);
    console.log(`  ✓ ${def.name} (${def.email}) → ${mentor.publicId}`);
  }

  await patchLegacyMentorFields();

  const stripped = await stripCvReviewFromAllMentors();
  if (stripped > 0) {
    console.log(`\nĐã chuẩn hóa sessionTypes (chỉ mock interview) cho ${stripped} mentor cũ.`);
  }

  const total = await Mentor.countDocuments({ isActive: true, isVerified: true });
  console.log(`\nTổng mentor active + verified: ${total}`);
  console.log(`Mật khẩu đăng nhập (dev): ${PASSWORD}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
