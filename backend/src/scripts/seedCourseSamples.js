import "./_devOnlyGuard.js";
/**
 * Thêm 5 khóa học mẫu, gắn với 5 mentor từ seedMentorSamples.
 * Chạy: npm run seed:course-samples (từ thư mục backend)
 * Nên chạy seed:mentor-samples trước nếu chưa có mentor mẫu.
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";

const SEED_TAG = "sample-v1";

function addDays(date, offset) {
  const out = new Date(date);
  out.setDate(out.getDate() + offset);
  return out;
}

function totalLessons(modules) {
  return (modules || []).reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0);
}

function totalDuration(modules) {
  return (modules || []).reduce(
    (sum, mod) =>
      sum + (mod.lessons || []).reduce((lessonSum, lesson) => lessonSum + Number(lesson.durationMinutes || 0), 0),
    0,
  );
}

/** Video Cloudinary đã host sẵn — phát được trong CourseLearning (thẻ <video>). */
const CLOUDINARY_VIDEOS = [
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/FQ1vid_rdw1xo.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340833/FQ2vid_vmp7ae.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/FQ3vid_glpon5.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/MQ1vid_hngp8o.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340832/MQ2vid_xaioj6.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/MQ3vid_h7t02k.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
  "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
];

function buildModules(prefix, videos = {}) {
  const previewUrl = videos.previewMp4 || CLOUDINARY_VIDEOS[0];
  const practiceUrl = videos.practiceMp4 || CLOUDINARY_VIDEOS[1];
  const deepDiveUrl = videos.deepDiveMp4 || CLOUDINARY_VIDEOS[2];

  return [
    {
      title: `${prefix} — Nền tảng`,
      order: 1,
      lessons: [
        {
          title: `Giới thiệu ${prefix}`,
          type: "video",
          videoUrl: previewUrl,
          durationMinutes: 15,
          description: `Tổng quan lộ trình và kỳ vọng sau khóa ${prefix}`,
          transcript: "",
          resources: [],
          order: 1,
          isFree: true,
        },
        {
          title: `Câu hỏi thường gặp — ${prefix}`,
          type: "video",
          videoUrl: practiceUrl,
          durationMinutes: 22,
          description: "Phân tích dạng câu hỏi phỏng vấn và cách trả lời có cấu trúc",
          transcript: "",
          resources: [],
          order: 2,
          isFree: false,
        },
      ],
    },
    {
      title: `${prefix} — Thực hành`,
      order: 2,
      lessons: [
        {
          title: `Mock drill — ${prefix}`,
          type: "video",
          videoUrl: deepDiveUrl,
          durationMinutes: 28,
          description: "Buổi luyện tập mô phỏng phỏng vấn có hướng dẫn",
          transcript: "",
          resources: [],
          order: 1,
          isFree: false,
        },
        {
          title: `Tự đánh giá — ${prefix}`,
          type: "quiz",
          durationMinutes: 8,
          description: "Bài kiểm tra nhanh sau phần thực hành",
          transcript: "",
          resources: [],
          order: 2,
          isFree: false,
        },
      ],
    },
  ];
}

const SAMPLE_COURSES = [
  {
    mentorEmail: "mentor.frontend@dev.local",
    title: "React & TypeScript — Chuẩn bị phỏng vấn Frontend",
    shortDescription: "Luyện React, TypeScript và system design UI cho vị trí Frontend mid–senior.",
    description:
      "Khóa học tập trung vào câu hỏi phỏng vấn Frontend thực tế: hooks, performance, state management, TypeScript patterns và cách trình bày case study UI.",
    level: "intermediate",
    tags: ["frontend", "react", "typescript", SEED_TAG],
    topics: ["Technical"],
    whatYoullLearn: [
      "Trả lời câu hỏi React/TypeScript có cấu trúc",
      "Giải thích trade-off performance và rendering",
      "Trình bày system design UI rõ ràng",
    ],
    requirements: ["Biết JavaScript cơ bản", "Đã làm ít nhất 1 project React"],
    modulePrefix: "Frontend Interview",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80",
    videos: {
      previewMp4: CLOUDINARY_VIDEOS[0],
      practiceMp4: CLOUDINARY_VIDEOS[1],
      deepDiveMp4: CLOUDINARY_VIDEOS[2],
    },
    price: 490_000,
    stats: { enrollmentCount: 24, rating: 4.8, reviewCount: 11, completionRate: 82 },
  },
  {
    mentorEmail: "mentor.product@dev.local",
    title: "Product Manager — Case Interview & Metrics",
    shortDescription: "Luyện case PM, metric, prioritization và stakeholder cho phỏng vấn sản phẩm.",
    description:
      "Khóa dành cho ứng viên PM: framework case interview, đo lường metric, roadmap và cách trả lời behavioral trong môi trường scale-up.",
    level: "intermediate",
    tags: ["product", "pm", "case-interview", SEED_TAG],
    topics: ["Behavioral", "Technical"],
    whatYoullLearn: [
      "Phân tích case sản phẩm theo framework",
      "Chọn metric phù hợp và giải thích trade-off",
      "Trình bày prioritization với stakeholder",
    ],
    requirements: ["Có kinh nghiệm làm sản phẩm hoặc BA 1+ năm"],
    modulePrefix: "PM Interview",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    videos: {
      previewMp4: CLOUDINARY_VIDEOS[2],
      practiceMp4: CLOUDINARY_VIDEOS[3],
      deepDiveMp4: CLOUDINARY_VIDEOS[4],
    },
    price: 550_000,
    stats: { enrollmentCount: 18, rating: 4.9, reviewCount: 9, completionRate: 88 },
  },
  {
    mentorEmail: "mentor.devops@dev.local",
    title: "DevOps & SRE — Phỏng vấn vận hành hệ thống",
    shortDescription: "CI/CD, Kubernetes, incident response và cloud cho vị trí DevOps/SRE.",
    description:
      "Thực hành scenario vận hành production: deploy pipeline, observability, scaling và cách trả lời câu hỏi incident trong phỏng vấn.",
    level: "advanced",
    tags: ["devops", "sre", "kubernetes", SEED_TAG],
    topics: ["Technical"],
    whatYoullLearn: [
      "Thiết kế CI/CD pipeline an toàn",
      "Giải thích Kubernetes và cloud trade-off",
      "Trình bày incident response có cấu trúc",
    ],
    requirements: ["Biết Linux và Docker cơ bản"],
    modulePrefix: "DevOps Interview",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    videos: {
      previewMp4: CLOUDINARY_VIDEOS[4],
      practiceMp4: CLOUDINARY_VIDEOS[5],
      deepDiveMp4: CLOUDINARY_VIDEOS[6],
    },
    price: 650_000,
    stats: { enrollmentCount: 15, rating: 4.7, reviewCount: 7, completionRate: 79 },
  },
  {
    mentorEmail: "mentor.fullstack@dev.local",
    title: "Fullstack Node.js + React — Từ Fresher đến Mid",
    shortDescription: "API design, React patterns và behavioral cho ứng viên fullstack startup.",
    description:
      "Lộ trình ngắn gọn cho fresher–mid: REST API, auth, React component design và cách kể project fullstack trong phỏng vấn.",
    level: "basic",
    tags: ["fullstack", "nodejs", "react", SEED_TAG],
    topics: ["Technical", "Behavioral"],
    whatYoullLearn: [
      "Thiết kế REST API rõ ràng",
      "Kể project fullstack theo STAR",
      "Trả lời câu hỏi React/Node phổ biến",
    ],
    requirements: ["Biết HTML/CSS/JS", "Đã học qua Node hoặc React"],
    modulePrefix: "Fullstack Interview",
    thumbnail: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
    videos: {
      previewMp4: CLOUDINARY_VIDEOS[6],
      practiceMp4: CLOUDINARY_VIDEOS[7],
      deepDiveMp4: CLOUDINARY_VIDEOS[0],
    },
    price: 390_000,
    stats: { enrollmentCount: 32, rating: 4.6, reviewCount: 14, completionRate: 85 },
  },
  {
    mentorEmail: "mentor.data@dev.local",
    title: "Data Engineer — SQL, Spark & Pipeline Design",
    shortDescription: "Luyện phỏng vấn Data Engineer: SQL, Spark, modeling và pipeline thực tế.",
    description:
      "Khóa nâng cao cho data engineer: query optimization, batch/stream pipeline, data modeling và cách trình bày project data warehouse.",
    level: "advanced",
    tags: ["data", "sql", "spark", SEED_TAG],
    topics: ["Technical"],
    whatYoullLearn: [
      "Viết và tối ưu SQL cho interview",
      "Giải thích Spark và pipeline batch",
      "Trình bày data modeling và trade-off",
    ],
    requirements: ["Biết SQL cơ bản", "Có project data hoặc analytics"],
    modulePrefix: "Data Engineer Interview",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    videos: {
      previewMp4: CLOUDINARY_VIDEOS[3],
      practiceMp4: CLOUDINARY_VIDEOS[5],
      deepDiveMp4: CLOUDINARY_VIDEOS[7],
    },
    price: 690_000,
    stats: { enrollmentCount: 12, rating: 5.0, reviewCount: 6, completionRate: 91 },
  },
];

async function resolveMentorByEmail(email) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) return null;
  return Mentor.findOne({ userId: user._id });
}

async function upsertCourseSample(definition, mentor, today) {
  const modules = buildModules(definition.modulePrefix, definition.videos);
  const courseData = {
    mentorId: mentor._id,
    title: definition.title,
    description: definition.description,
    shortDescription: definition.shortDescription,
    thumbnail: definition.thumbnail ?? "",
    level: definition.level,
    tags: definition.tags,
    topics: definition.topics,
    whatYoullLearn: definition.whatYoullLearn,
    requirements: definition.requirements,
    modules,
    settings: { autoEnroll: true, certificateEnabled: true, qaEnabled: true },
    isFree: false,
    price: definition.price,
    discountPrice: 0,
    discountEndsAt: null,
    stats: definition.stats,
    status: "published",
    publishedAt: addDays(today, -7),
    totalLessons: totalLessons(modules),
    totalDurationMinutes: totalDuration(modules),
  };

  let course = await Course.findOne({ title: definition.title });
  if (!course) {
    course = await Course.create(courseData);
  } else {
    course.set(courseData);
    await course.save();
  }
  return course;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);
  const today = new Date();

  console.log("Thêm / cập nhật 5 khóa học mẫu…");
  let created = 0;
  for (const def of SAMPLE_COURSES) {
    const mentor = await resolveMentorByEmail(def.mentorEmail);
    if (!mentor) {
      console.warn(`  ⚠ Bỏ qua "${def.title}" — chưa có mentor ${def.mentorEmail}. Chạy: npm run seed:mentor-samples`);
      continue;
    }
    const course = await upsertCourseSample(def, mentor, today);
    console.log(`  ✓ ${course.title} → mentor ${def.mentorEmail}`);
    created += 1;
  }

  const published = await Course.countDocuments({ status: "published", tags: SEED_TAG });
  console.log(`\nĐã xử lý ${created}/${SAMPLE_COURSES.length} khóa. Tổng published (tag ${SEED_TAG}): ${published}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
