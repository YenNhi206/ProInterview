import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Review } from "../models/Review.js";
import { Notification } from "../models/Notification.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";
import { Report } from "../models/Report.js";
import { Activity } from "../models/Activity.js";
import { CourseQA } from "../models/CourseQA.js";
import { MentorPeerReview } from "../models/MentorPeerReview.js";
import { CVAnalysis } from "../models/CVAnalysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { createMentorProfileForUser, syncMentorProfileFromUser } from "../services/mentorProfileService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..", "..");
const OUTPUT_FILE = join(backendRoot, "endpoint-test-data.json");

const PASSWORD = "Dev123456";
const SALT_ROUNDS = 10;
const SEED_VERSION = "endpoint-seed-v1";
const TZ = "Asia/Ho_Chi_Minh";

function startOfDay(date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(date, offset) {
  const out = new Date(date);
  out.setDate(out.getDate() + offset);
  return out;
}

function addMonths(date, offset) {
  const out = new Date(date);
  out.setMonth(out.getMonth() + offset);
  return out;
}

function p2(value) {
  return String(value).padStart(2, "0");
}

function dmy(date) {
  return `${p2(date.getDate())}/${p2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function iso(date) {
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
}

function uniq(values) {
  return [...new Set((values || []).map((v) => String(v).trim()).filter(Boolean))];
}

function quota({ cvUsed = 0, cvLimit = 3, interviewUsed = 0, interviewLimit = 1, questions = 3, resetAt = new Date() } = {}) {
  return {
    cvAnalysisUsed: cvUsed,
    cvAnalysisLimit: cvLimit,
    interviewUsed,
    interviewLimit,
    interviewQuestionsAllowed: questions,
    resetAt,
  };
}

function money(price) {
  const amount = Math.round(Number(price || 0));
  const vat = Math.round(amount * 0.1);
  return {
    price: amount,
    platformFee: Math.round(amount * 0.15),
    vat,
    totalAmount: amount + vat,
  };
}

function totalLessons(modules) {
  return (modules || []).reduce((sum, module) => sum + (module.lessons?.length || 0), 0);
}

function totalDuration(modules) {
  return (modules || []).reduce(
    (sum, module) =>
      sum +
      (module.lessons || []).reduce((lessonSum, lesson) => lessonSum + Number(lesson.durationMinutes || 0), 0),
    0,
  );
}

function lessonRefs(course) {
  const refs = [];
  for (const module of course.modules || []) {
    for (const lesson of module.lessons || []) {
      refs.push({
        id: String(lesson._id),
        title: lesson.title,
        moduleTitle: module.title,
      });
    }
  }
  return refs;
}

async function upsertDoc(Model, query, createData, updateData = createData) {
  let doc = await Model.findOne(query);
  if (!doc) {
    doc = new Model(createData);
  } else {
    doc.set(updateData);
  }
  await doc.save();
  return doc;
}

async function ensureUser(definition, passwordHash) {
  const email = String(definition.email).trim().toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, passwordHash });
  }
  user.name = definition.name;
  user.role = definition.role;
  user.plan = definition.plan ?? "free";
  user.planExpiresAt = definition.planExpiresAt ?? null;
  user.quota = definition.quota ?? quota();
  user.phone = definition.phone ?? "";
  user.school = definition.school ?? "";
  user.bio = definition.bio ?? "";
  user.avatar = definition.avatar ?? "";
  user.desiredPosition = definition.desiredPosition ?? "";
  user.position = definition.desiredPosition ?? "";
  user.currentCompany = definition.currentCompany ?? "";
  user.skills = uniq(definition.skills);
  user.expertise = uniq(definition.skills);
  user.experience = Number(definition.experience || 0);
  user.hourlyRate = definition.hourlyRate;
  user.journeyProgress = {
    uploadedCV: Boolean(definition.journeyProgress?.uploadedCV),
    analyzedCVJD: Boolean(definition.journeyProgress?.analyzedCVJD),
    completedInterview: Boolean(definition.journeyProgress?.completedInterview),
    bookedMentor: Boolean(definition.journeyProgress?.bookedMentor),
    receivedOffer: Boolean(definition.journeyProgress?.receivedOffer),
  };
  user.isActive = true;
  user.isEmailVerified = true;
  await user.save();
  if (user.role === "mentor") {
    await createMentorProfileForUser(user);
    await syncMentorProfileFromUser(user);
  }
  return user;
}

function buildModules(prefix) {
  return [
    {
      title: `${prefix} Foundations`,
      order: 1,
      lessons: [
        {
          title: `${prefix} Overview`,
          type: "video",
          videoUrl: "https://example.com/video/overview",
          durationMinutes: 12,
          description: `${prefix} intro`,
          transcript: `${prefix} overview transcript`,
          resources: [{ name: "Slides", url: "https://example.com/resource/slides" }],
          order: 1,
          isFree: true,
        },
        {
          title: `${prefix} Checklist`,
          type: "document",
          documentUrl: "https://example.com/docs/checklist.pdf",
          durationMinutes: 8,
          description: `${prefix} checklist`,
          transcript: "",
          resources: [{ name: "Checklist", url: "https://example.com/resource/checklist" }],
          order: 2,
          isFree: false,
        },
      ],
    },
    {
      title: `${prefix} Practice`,
      order: 2,
      lessons: [
        {
          title: `${prefix} Drill`,
          type: "video",
          videoUrl: "https://example.com/video/drill",
          durationMinutes: 18,
          description: `${prefix} practice drill`,
          transcript: `${prefix} practice transcript`,
          resources: [{ name: "Template", url: "https://example.com/resource/template" }],
          order: 1,
          isFree: false,
        },
        {
          title: `${prefix} Quiz`,
          type: "quiz",
          durationMinutes: 6,
          description: `${prefix} quiz`,
          transcript: "",
          resources: [],
          order: 2,
          isFree: false,
        },
      ],
    },
  ];
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Missing MONGO_URI in backend/.env");
  }

  const today = startOfDay(new Date());
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  await connectDatabase(uri);

  const users = {};
  const mentors = {};
  const courses = {};
  const bookings = {};
  const enrollments = {};
  const reviews = {};
  const payments = {};
  const notifications = {};
  const reports = {};

  users.adminDev = await ensureUser(
    { email: "admin@dev.local", name: "Admin Dev", role: "admin", plan: "free", quota: quota() },
    passwordHash,
  );
  users.customerDev = await ensureUser(
    {
      email: "customer@dev.local",
      name: "Khach hang Dev",
      role: "customer",
      plan: "free",
      quota: quota({ cvUsed: 2, interviewUsed: 1, resetAt: addDays(today, -3) }),
      desiredPosition: "Backend Developer",
      currentCompany: "Freelance",
      skills: ["Node.js", "SQL", "REST API"],
      experience: 2,
      bio: "Seed customer with dashboard, booking and review data.",
      school: "FPT University",
      phone: "0901000001",
      journeyProgress: { uploadedCV: true, analyzedCVJD: true, completedInterview: true, bookedMentor: true },
    },
    passwordHash,
  );
  users.customerReviewer = await ensureUser(
    {
      email: "customer2@dev.local",
      name: "Khach hang Reviewer",
      role: "customer",
      plan: "free",
      quota: quota({ cvUsed: 1, resetAt: addDays(today, -2) }),
      desiredPosition: "Product Manager",
      currentCompany: "Shopee",
      skills: ["Product", "Communication", "Presentation"],
      experience: 3,
      bio: "Second customer used for extra reviews and enrollments.",
      school: "NEU",
      phone: "0901000002",
      journeyProgress: { uploadedCV: true, analyzedCVJD: true, bookedMentor: true },
    },
    passwordHash,
  );
  users.customerStarter = await ensureUser(
    {
      email: "starter.customer@dev.local",
      name: "Starter Customer",
      role: "customer",
      plan: "starter_pro",
      planExpiresAt: addMonths(today, 2),
      quota: quota({ cvUsed: 4, cvLimit: 20, interviewUsed: 2, interviewLimit: 10, questions: 5, resetAt: addDays(today, -1) }),
      desiredPosition: "Business Analyst",
      currentCompany: "Techcombank",
      skills: ["Business Analysis", "SQL", "Stakeholder Management"],
      experience: 4,
      bio: "Starter plan user for plans, payments and reports tests.",
      school: "UEH",
      phone: "0901000003",
      journeyProgress: { uploadedCV: true, analyzedCVJD: true, completedInterview: true, bookedMentor: true, receivedOffer: true },
    },
    passwordHash,
  );
  users.mentorDev = await ensureUser(
    {
      email: "mentor@dev.local",
      name: "Mentor Dev",
      role: "mentor",
      desiredPosition: "Senior Backend Engineer",
      currentCompany: "VNG",
      skills: ["Node.js", "MongoDB", "System Design"],
      experience: 7,
      hourlyRate: 450000,
      bio: "Primary mentor with booking, course and review data.",
      school: "HCMUT",
      phone: "0902000001",
    },
    passwordHash,
  );
  users.mentorCareer = await ensureUser(
    {
      email: "mentor2@dev.local",
      name: "Mentor Career",
      role: "mentor",
      desiredPosition: "Talent Acquisition Lead",
      currentCompany: "FPT Software",
      skills: ["Interviewing", "CV Review", "Behavioral"],
      experience: 6,
      hourlyRate: 320000,
      bio: "Secondary mentor for HR and CV review scenarios.",
      school: "FTU",
      phone: "0902000002",
    },
    passwordHash,
  );

  mentors.primary = await upsertDoc(
    Mentor,
    { userId: users.mentorDev._id },
    {
      userId: users.mentorDev._id,
      publicId: `u${users.mentorDev._id}`,
      name: "Mentor Dev",
      title: "Senior Backend Engineer",
      company: "VNG",
      bio: "Primary mentor with booking, course and review data.",
      specialties: ["Node.js", "MongoDB", "System Design"],
      fields: ["Node.js"],
      companies: ["VNG"],
      linkedinUrl: "https://linkedin.com/in/mentor-dev-seed",
      experienceYears: 7,
      pricePerHour: 450000,
      sessionTypes: [
        { type: "mock_interview", durationMinutes: 60, price: 450000 },
        { type: "cv_review", durationMinutes: 45, price: 300000 },
        { type: "career_consulting", durationMinutes: 60, price: 350000 },
      ],
      available: true,
      responseTime: "< 2h",
      timezone: TZ,
      availableSlots: {
        [iso(addDays(today, 3))]: ["09:00", "14:00", "16:00"],
        [iso(addDays(today, 5))]: ["10:00", "15:00"],
        [iso(addDays(today, 7))]: ["10:00", "17:00"],
      },
      blockedDates: [iso(addDays(today, 4))],
      recurringSchedule: [
        { dayOfWeek: 1, slots: ["09:00", "10:00", "14:00"] },
        { dayOfWeek: 3, slots: ["13:00", "15:00", "17:00"] },
        { dayOfWeek: 5, slots: ["09:00", "11:00"] },
      ],
      finance: {
        availableBalance: 1700000,
        pendingBalance: 800000,
        totalEarned: 2590000,
        bankAccount: { bankName: "Vietcombank", accountNumber: "001122334455", accountName: "Mentor Dev" },
        momoPhone: "0902000001",
        zalopayPhone: "0902000001",
        autoPayoutThreshold: 600000,
      },
      isVerified: true,
      isActive: true,
      verifiedAt: addDays(today, -30),
    },
  );
  mentors.secondary = await upsertDoc(
    Mentor,
    { userId: users.mentorCareer._id },
    {
      userId: users.mentorCareer._id,
      publicId: `u${users.mentorCareer._id}`,
      name: "Mentor Career",
      title: "Talent Acquisition Lead",
      company: "FPT Software",
      bio: "Secondary mentor for HR and CV review scenarios.",
      specialties: ["Interviewing", "CV Review", "Behavioral"],
      fields: ["Interviewing"],
      companies: ["FPT Software"],
      linkedinUrl: "https://linkedin.com/in/mentor-career-seed",
      experienceYears: 6,
      pricePerHour: 320000,
      sessionTypes: [
        { type: "mock_interview", durationMinutes: 60, price: 320000 },
        { type: "cv_review", durationMinutes: 45, price: 250000 },
        { type: "career_consulting", durationMinutes: 60, price: 280000 },
      ],
      available: true,
      responseTime: "< 4h",
      timezone: TZ,
      availableSlots: {
        [iso(addDays(today, 2))]: ["09:00", "13:00"],
        [iso(addDays(today, 6))]: ["15:00", "17:00"],
      },
      blockedDates: [iso(addDays(today, 8))],
      recurringSchedule: [
        { dayOfWeek: 2, slots: ["09:00", "10:00", "11:00"] },
        { dayOfWeek: 4, slots: ["14:00", "15:00"] },
      ],
      finance: {
        availableBalance: 520000,
        pendingBalance: 320000,
        totalEarned: 1210000,
        bankAccount: { bankName: "ACB", accountNumber: "556677889900", accountName: "Mentor Career" },
        momoPhone: "0902000002",
        zalopayPhone: "0902000002",
        autoPayoutThreshold: 400000,
      },
      isVerified: true,
      isActive: true,
      verifiedAt: addDays(today, -30),
    },
  );

  courses.backend = await upsertDoc(
    Course,
    { title: `[Seed ${SEED_VERSION}] Backend Interview Mastery` },
    {
      mentorId: mentors.primary._id,
      title: `[Seed ${SEED_VERSION}] Backend Interview Mastery`,
      description: "Backend mock interview course with API, database and system design practice.",
      shortDescription: "Backend interview prep with Node.js, SQL and system design.",
      level: "intermediate",
      tags: ["backend", "nodejs", "interview"],
      topics: ["Technical", "Behavioral"],
      whatYoullLearn: ["Answer backend interview questions with structure", "Explain database tradeoffs clearly", "Practice system design under time pressure"],
      requirements: ["Basic Node.js knowledge", "Comfort with REST APIs"],
      modules: buildModules("Backend Interview"),
      settings: { autoEnroll: true, certificateEnabled: true, qaEnabled: true },
      isFree: false,
      price: 990000,
      discountPrice: 790000,
      discountEndsAt: addDays(today, 14),
      status: "published",
      publishedAt: addDays(today, -14),
      totalLessons: totalLessons(buildModules("Backend Interview")),
      totalDurationMinutes: totalDuration(buildModules("Backend Interview")),
    },
  );
  courses.systemDesign = await upsertDoc(
    Course,
    { title: `[Seed ${SEED_VERSION}] Node.js System Design Clinic` },
    {
      mentorId: mentors.primary._id,
      title: `[Seed ${SEED_VERSION}] Node.js System Design Clinic`,
      description: "Scalability, caching, queues and production tradeoffs for Node.js interviews.",
      shortDescription: "System design drills tailored to Node.js candidates.",
      level: "advanced",
      tags: ["system-design", "nodejs", "architecture"],
      topics: ["Technical"],
      whatYoullLearn: ["Frame distributed system answers", "Discuss data consistency and throughput", "Present tradeoffs clearly"],
      requirements: ["Experience building backend services"],
      modules: buildModules("System Design"),
      settings: { autoEnroll: true, certificateEnabled: true, qaEnabled: true },
      isFree: false,
      price: 1290000,
      discountPrice: 1090000,
      discountEndsAt: addDays(today, 21),
      status: "published",
      publishedAt: addDays(today, -12),
      totalLessons: totalLessons(buildModules("System Design")),
      totalDurationMinutes: totalDuration(buildModules("System Design")),
    },
  );
  courses.cvCareer = await upsertDoc(
    Course,
    { title: `[Seed ${SEED_VERSION}] CV And Behavioral Interview Bootcamp` },
    {
      mentorId: mentors.secondary._id,
      title: `[Seed ${SEED_VERSION}] CV And Behavioral Interview Bootcamp`,
      description: "Improve CV writing and behavioral interview responses with HR-focused feedback.",
      shortDescription: "CV review and behavioral interview prep from a recruiter perspective.",
      level: "basic",
      tags: ["cv", "behavioral", "career"],
      topics: ["Resume", "Behavioral"],
      whatYoullLearn: ["Rewrite CV bullet points for impact", "Use STAR for behavioral answers", "Handle recruiter screening confidently"],
      requirements: ["A current CV draft"],
      modules: buildModules("CV Bootcamp"),
      settings: { autoEnroll: true, certificateEnabled: true, qaEnabled: true },
      isFree: false,
      price: 690000,
      discountPrice: 590000,
      discountEndsAt: addDays(today, 10),
      status: "published",
      publishedAt: addDays(today, -8),
      totalLessons: totalLessons(buildModules("CV Bootcamp")),
      totalDurationMinutes: totalDuration(buildModules("CV Bootcamp")),
    },
  );

  const backendLessons = lessonRefs(courses.backend);
  const cvLessons = lessonRefs(courses.cvCareer);

  bookings.completedReviewed = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-completed-reviewed` },
    {
      userId: users.customerDev._id,
      mentorId: mentors.primary._id,
      date: dmy(addDays(today, -7)),
      timeSlot: "09:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "mock_interview",
      notes: `Seed booking ${SEED_VERSION} completed-reviewed`,
      meetingLink: "https://meet.google.com/seed-completed-reviewed",
      status: "completed",
      paymentStatus: "paid",
      paymentMethod: "card",
      paymentRef: `seed-booking-${SEED_VERSION}-completed-reviewed`,
      paidAt: addDays(today, -8),
      mentorNotes: "Candidate answered well. Focus next on system design depth.",
      completedAt: addDays(today, -7),
      ...money(450000),
    },
  );
  bookings.confirmedUpcoming = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-confirmed-upcoming` },
    {
      userId: users.customerDev._id,
      mentorId: mentors.primary._id,
      date: dmy(addDays(today, 3)),
      timeSlot: "14:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "mock_interview",
      notes: `Seed booking ${SEED_VERSION} confirmed-upcoming`,
      meetingLink: "https://meet.google.com/seed-confirmed-upcoming",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "momo",
      paymentRef: `seed-booking-${SEED_VERSION}-confirmed-upcoming`,
      paidAt: addDays(today, -1),
      mentorNotes: "Prepare API design question set.",
      ...money(450000),
    },
  );
  bookings.pendingRequest = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-pending-request` },
    {
      userId: users.customerDev._id,
      mentorId: mentors.primary._id,
      date: dmy(addDays(today, 5)),
      timeSlot: "16:00",
      durationMinutes: 45,
      timezone: TZ,
      sessionType: "cv_review",
      notes: `Seed booking ${SEED_VERSION} pending-request`,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "zalopay",
      paymentRef: `seed-booking-${SEED_VERSION}-pending-request`,
      ...money(300000),
    },
  );
  bookings.rescheduledConfirmed = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-rescheduled-confirmed` },
    {
      userId: users.customerStarter._id,
      mentorId: mentors.primary._id,
      date: dmy(addDays(today, 7)),
      timeSlot: "10:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "career_consulting",
      notes: `Seed booking ${SEED_VERSION} rescheduled-confirmed`,
      meetingLink: "https://meet.google.com/seed-rescheduled-confirmed",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "transfer",
      paymentRef: `seed-booking-${SEED_VERSION}-rescheduled-confirmed`,
      paidAt: addDays(today, -2),
      rescheduleHistory: [{
        oldDate: dmy(addDays(today, 6)),
        oldTimeSlot: "10:00",
        newDate: dmy(addDays(today, 7)),
        newTimeSlot: "10:00",
        reason: "Customer needed one more day to prepare.",
        changedBy: "user",
        changedAt: addDays(today, -1),
      }],
      ...money(350000),
    },
  );
  bookings.cancelledBooking = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-cancelled-booking` },
    {
      userId: users.customerDev._id,
      mentorId: mentors.secondary._id,
      date: dmy(addDays(today, 4)),
      timeSlot: "11:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "mock_interview",
      notes: `Seed booking ${SEED_VERSION} cancelled-booking`,
      status: "cancelled",
      paymentStatus: "refunded",
      paymentMethod: "card",
      paymentRef: `seed-booking-${SEED_VERSION}-cancelled-booking`,
      paidAt: addDays(today, -3),
      cancelledBy: "user",
      cancelReason: "Schedule conflict on customer side.",
      cancelledAt: addDays(today, -2),
      ...money(320000),
    },
  );
  bookings.completedSecondReview = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-completed-second-review` },
    {
      userId: users.customerReviewer._id,
      mentorId: mentors.primary._id,
      date: dmy(addDays(today, -4)),
      timeSlot: "15:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "mock_interview",
      notes: `Seed booking ${SEED_VERSION} completed-second-review`,
      meetingLink: "https://meet.google.com/seed-completed-second-review",
      status: "completed",
      paymentStatus: "paid",
      paymentMethod: "card",
      paymentRef: `seed-booking-${SEED_VERSION}-completed-second-review`,
      paidAt: addDays(today, -5),
      mentorNotes: "Good communication. Need more concise structure.",
      completedAt: addDays(today, -4),
      ...money(450000),
    },
  );
  bookings.completedReadyForReview = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-completed-ready-for-review` },
    {
      userId: users.customerStarter._id,
      mentorId: mentors.secondary._id,
      date: dmy(addDays(today, -2)),
      timeSlot: "13:00",
      durationMinutes: 45,
      timezone: TZ,
      sessionType: "cv_review",
      notes: `Seed booking ${SEED_VERSION} completed-ready-for-review`,
      meetingLink: "https://meet.google.com/seed-completed-ready-for-review",
      status: "completed",
      paymentStatus: "paid",
      paymentMethod: "momo",
      paymentRef: `seed-booking-${SEED_VERSION}-completed-ready-for-review`,
      paidAt: addDays(today, -3),
      mentorNotes: "Strong achievements. Add more quantified impact.",
      completedAt: addDays(today, -2),
      ...money(250000),
    },
  );
  bookings.confirmedMentorSecondary = await upsertDoc(
    Booking,
    { paymentRef: `seed-booking-${SEED_VERSION}-confirmed-mentor-secondary` },
    {
      userId: users.customerStarter._id,
      mentorId: mentors.secondary._id,
      date: dmy(addDays(today, 2)),
      timeSlot: "09:00",
      durationMinutes: 60,
      timezone: TZ,
      sessionType: "mock_interview",
      notes: `Seed booking ${SEED_VERSION} confirmed-mentor-secondary`,
      meetingLink: "https://meet.google.com/seed-confirmed-mentor-secondary",
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "zalopay",
      paymentRef: `seed-booking-${SEED_VERSION}-confirmed-mentor-secondary`,
      paidAt: addDays(today, -1),
      ...money(320000),
    },
  );

  enrollments.customerBackend = await upsertDoc(
    Enrollment,
    { userId: users.customerDev._id, courseId: courses.backend._id },
    {
      userId: users.customerDev._id,
      courseId: courses.backend._id,
      completedLessons: backendLessons.slice(0, 2).map((item) => item.id),
      lastLessonId: backendLessons[1]?.id,
      progressPercent: 50,
      lastAccessedAt: addDays(today, -1),
      isCompleted: false,
      pricePaid: courses.backend.discountPrice,
      paymentRef: `seed-course-${SEED_VERSION}-customer-backend`,
    },
  );
  enrollments.reviewerBackend = await upsertDoc(
    Enrollment,
    { userId: users.customerReviewer._id, courseId: courses.backend._id },
    {
      userId: users.customerReviewer._id,
      courseId: courses.backend._id,
      completedLessons: backendLessons.map((item) => item.id),
      lastLessonId: backendLessons[backendLessons.length - 1]?.id,
      progressPercent: 100,
      lastAccessedAt: addDays(today, -1),
      isCompleted: true,
      completedAt: addDays(today, -1),
      certificateUrl: "https://example.com/certificates/backend-seed.pdf",
      certificateIssuedAt: addDays(today, -1),
      pricePaid: courses.backend.price,
      paymentRef: `seed-course-${SEED_VERSION}-reviewer-backend`,
    },
  );
  enrollments.starterCv = await upsertDoc(
    Enrollment,
    { userId: users.customerStarter._id, courseId: courses.cvCareer._id },
    {
      userId: users.customerStarter._id,
      courseId: courses.cvCareer._id,
      completedLessons: cvLessons.slice(0, 1).map((item) => item.id),
      lastLessonId: cvLessons[0]?.id,
      progressPercent: 25,
      lastAccessedAt: today,
      isCompleted: false,
      pricePaid: courses.cvCareer.discountPrice,
      paymentRef: `seed-course-${SEED_VERSION}-starter-cv`,
    },
  );

  reviews.mentorPrimary = await upsertDoc(
    Review,
    { userId: users.customerDev._id, targetType: "mentor", targetId: mentors.primary._id },
    {
      userId: users.customerDev._id,
      targetType: "mentor",
      targetId: mentors.primary._id,
      bookingId: bookings.completedReviewed._id,
      rating: 5,
      comment: "Clear feedback, practical examples and a very realistic mock interview.",
      tags: ["feedback", "technical", "communication"],
      reply: {
        content: "Thanks. Keep practicing system design structure and you will level up fast.",
        repliedAt: addDays(today, -6),
      },
      isVerified: true,
      isVisible: true,
    },
  );
  reviews.mentorSecondary = await upsertDoc(
    Review,
    { userId: users.customerReviewer._id, targetType: "mentor", targetId: mentors.primary._id },
    {
      userId: users.customerReviewer._id,
      targetType: "mentor",
      targetId: mentors.primary._id,
      bookingId: bookings.completedSecondReview._id,
      rating: 4,
      comment: "Strong session and useful comments on how to tighten my answers.",
      tags: ["mock-interview", "structure"],
      isVerified: true,
      isVisible: true,
    },
  );
  reviews.courseBackend = await upsertDoc(
    Review,
    { userId: users.customerDev._id, targetType: "course", targetId: courses.backend._id },
    {
      userId: users.customerDev._id,
      targetType: "course",
      targetId: courses.backend._id,
      rating: 5,
      comment: "The course is concise and very relevant for backend interview prep.",
      tags: ["course", "backend"],
      isVerified: false,
      isVisible: true,
    },
  );

  bookings.completedReviewed = await upsertDoc(
    Booking,
    { _id: bookings.completedReviewed._id },
    { ...bookings.completedReviewed.toObject(), reviewId: reviews.mentorPrimary._id },
  );
  bookings.completedSecondReview = await upsertDoc(
    Booking,
    { _id: bookings.completedSecondReview._id },
    { ...bookings.completedSecondReview.toObject(), reviewId: reviews.mentorSecondary._id },
  );

  payments.bookingCompletedReviewed = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-booking-completed-reviewed` },
    {
      userId: users.customerDev._id,
      type: "booking",
      referenceId: bookings.completedReviewed._id,
      referenceModel: "Booking",
      amount: bookings.completedReviewed.totalAmount,
      currency: "VND",
      provider: "card",
      providerRef: `seed-payment-${SEED_VERSION}-booking-completed-reviewed`,
      status: "success",
      paidAt: addDays(today, -8),
      invoiceEmail: users.customerDev.email,
      invoiceName: users.customerDev.name,
      invoiceAddress: "District 9, HCMC",
    },
  );
  payments.bookingConfirmedUpcoming = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-booking-confirmed-upcoming` },
    {
      userId: users.customerDev._id,
      type: "booking",
      referenceId: bookings.confirmedUpcoming._id,
      referenceModel: "Booking",
      amount: bookings.confirmedUpcoming.totalAmount,
      currency: "VND",
      provider: "momo",
      providerRef: `seed-payment-${SEED_VERSION}-booking-confirmed-upcoming`,
      status: "success",
      paidAt: addDays(today, -1),
      invoiceEmail: users.customerDev.email,
      invoiceName: users.customerDev.name,
      invoiceAddress: "District 9, HCMC",
    },
  );
  payments.bookingPendingRequest = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-booking-pending-request` },
    {
      userId: users.customerDev._id,
      type: "booking",
      referenceId: bookings.pendingRequest._id,
      referenceModel: "Booking",
      amount: bookings.pendingRequest.totalAmount,
      currency: "VND",
      provider: "zalopay",
      providerRef: `seed-payment-${SEED_VERSION}-booking-pending-request`,
      status: "pending",
      invoiceEmail: users.customerDev.email,
      invoiceName: users.customerDev.name,
      invoiceAddress: "District 9, HCMC",
    },
  );
  payments.bookingCancelled = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-booking-cancelled` },
    {
      userId: users.customerDev._id,
      type: "booking",
      referenceId: bookings.cancelledBooking._id,
      referenceModel: "Booking",
      amount: bookings.cancelledBooking.totalAmount,
      currency: "VND",
      provider: "card",
      providerRef: `seed-payment-${SEED_VERSION}-booking-cancelled`,
      status: "refunded",
      paidAt: addDays(today, -3),
      refundedAt: addDays(today, -2),
      refundAmount: bookings.cancelledBooking.totalAmount,
      invoiceEmail: users.customerDev.email,
      invoiceName: users.customerDev.name,
      invoiceAddress: "District 9, HCMC",
    },
  );
  payments.subscriptionStarter = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-subscription-starter` },
    {
      userId: users.customerStarter._id,
      type: "subscription",
      referenceId: users.customerStarter._id,
      referenceModel: "Subscription",
      amount: 299000,
      currency: "VND",
      provider: "momo",
      providerRef: `seed-payment-${SEED_VERSION}-subscription-starter`,
      providerResponse: { plan: "starter_pro" },
      status: "success",
      paidAt: addDays(today, -10),
      invoiceEmail: users.customerStarter.email,
      invoiceName: users.customerStarter.name,
      invoiceAddress: "District 1, HCMC",
    },
  );
  payments.courseBackend = await upsertDoc(
    Payment,
    { providerRef: `seed-payment-${SEED_VERSION}-course-backend` },
    {
      userId: users.customerReviewer._id,
      type: "course",
      referenceId: enrollments.reviewerBackend._id,
      referenceModel: "Enrollment",
      amount: enrollments.reviewerBackend.pricePaid,
      currency: "VND",
      provider: "transfer",
      providerRef: `seed-payment-${SEED_VERSION}-course-backend`,
      status: "success",
      paidAt: addDays(today, -5),
      invoiceEmail: users.customerReviewer.email,
      invoiceName: users.customerReviewer.name,
      invoiceAddress: "Thu Duc, HCMC",
    },
  );

  await upsertDoc(
    Subscription,
    { userId: users.customerStarter._id },
    {
      userId: users.customerStarter._id,
      plan: "starter_pro",
      billingCycle: "monthly",
      startedAt: addDays(today, -10),
      expiresAt: addMonths(today, 2),
      history: [
        {
          plan: "starter_pro",
          billingCycle: "monthly",
          startedAt: addDays(today, -10),
          expiresAt: addMonths(today, 2),
          paymentRef: payments.subscriptionStarter.providerRef,
          amount: 299000,
        },
      ],
      discountCode: "STARTER10",
      discountPercent: 10,
      isAutoRenew: true,
    },
  );

  notifications.customerBookingConfirmed = await upsertDoc(
    Notification,
    { userId: users.customerDev._id, title: `[Seed ${SEED_VERSION}] Booking confirmed with Mentor Dev` },
    {
      userId: users.customerDev._id,
      type: "booking_confirmed",
      title: `[Seed ${SEED_VERSION}] Booking confirmed with Mentor Dev`,
      body: "Your backend mock interview is confirmed for the upcoming slot.",
      isRead: false,
      metadata: { bookingId: bookings.confirmedUpcoming._id, mentorId: mentors.primary._id, actionUrl: `/booking/${bookings.confirmedUpcoming._id}` },
    },
  );
  notifications.customerCourseEnrolled = await upsertDoc(
    Notification,
    { userId: users.customerDev._id, title: `[Seed ${SEED_VERSION}] Enrolled in Backend Interview Mastery` },
    {
      userId: users.customerDev._id,
      type: "course_enrolled",
      title: `[Seed ${SEED_VERSION}] Enrolled in Backend Interview Mastery`,
      body: "You can continue learning from the backend interview course.",
      isRead: true,
      readAt: addDays(today, -1),
      metadata: { courseId: courses.backend._id, actionUrl: `/courses/${courses.backend._id}` },
    },
  );
  notifications.customerPaymentSuccess = await upsertDoc(
    Notification,
    { userId: users.customerDev._id, title: `[Seed ${SEED_VERSION}] Payment captured for booking` },
    {
      userId: users.customerDev._id,
      type: "payment_success",
      title: `[Seed ${SEED_VERSION}] Payment captured for booking`,
      body: "The payment for your confirmed mentor booking was captured successfully.",
      isRead: false,
      metadata: { bookingId: bookings.confirmedUpcoming._id, actionUrl: `/payments/${payments.bookingConfirmedUpcoming._id}` },
    },
  );
  notifications.customerSystem = await upsertDoc(
    Notification,
    { userId: users.customerDev._id, title: `[Seed ${SEED_VERSION}] Weekly prep reminder` },
    {
      userId: users.customerDev._id,
      type: "system",
      title: `[Seed ${SEED_VERSION}] Weekly prep reminder`,
      body: "Keep practicing and update your CV before the next interview round.",
      isRead: false,
      metadata: { actionUrl: "/dashboard" },
    },
  );
  notifications.mentorBookingRequest = await upsertDoc(
    Notification,
    { userId: users.mentorDev._id, title: `[Seed ${SEED_VERSION}] New booking request` },
    {
      userId: users.mentorDev._id,
      type: "new_booking_request",
      title: `[Seed ${SEED_VERSION}] New booking request`,
      body: "A customer requested a CV review session.",
      isRead: false,
      metadata: { bookingId: bookings.pendingRequest._id, mentorId: mentors.primary._id, actionUrl: `/mentor/bookings/${bookings.pendingRequest._id}` },
    },
  );
  notifications.mentorNewReview = await upsertDoc(
    Notification,
    { userId: users.mentorDev._id, title: `[Seed ${SEED_VERSION}] New mentor review` },
    {
      userId: users.mentorDev._id,
      type: "new_review",
      title: `[Seed ${SEED_VERSION}] New mentor review`,
      body: "You received a new review from a customer.",
      isRead: false,
      metadata: { bookingId: bookings.completedReviewed._id, mentorId: mentors.primary._id, actionUrl: "/mentor/reviews" },
    },
  );
  notifications.starterPlan = await upsertDoc(
    Notification,
    { userId: users.customerStarter._id, title: `[Seed ${SEED_VERSION}] Starter plan activated` },
    {
      userId: users.customerStarter._id,
      type: "plan_upgraded",
      title: `[Seed ${SEED_VERSION}] Starter plan activated`,
      body: "Your Starter Pro plan is active and more quota is available now.",
      isRead: true,
      readAt: addDays(today, -9),
      metadata: { actionUrl: "/pricing" },
    },
  );

  reports.mentorComplaint = await upsertDoc(
    Report,
    { reportedBy: users.customerStarter._id, targetType: "mentor", targetId: mentors.secondary._id, reason: "other" },
    {
      reportedBy: users.customerStarter._id,
      targetType: "mentor",
      targetId: mentors.secondary._id,
      reason: "other",
      description: "[Seed report] Customer requested clarification about a last-minute change in session agenda.",
      evidenceUrls: [],
      status: "pending",
    },
  );
  reports.courseComplaint = await upsertDoc(
    Report,
    { reportedBy: users.customerDev._id, targetType: "course", targetId: courses.systemDesign._id, reason: "other" },
    {
      reportedBy: users.customerDev._id,
      targetType: "course",
      targetId: courses.systemDesign._id,
      reason: "other",
      description: "[Seed report] One lesson resource link should be updated because the old version is outdated.",
      evidenceUrls: ["https://example.com/evidence/course-resource"],
      status: "resolved",
      resolvedBy: users.adminDev._id,
      resolution: "Course resources were refreshed and the link was replaced.",
      resolvedAt: addDays(today, -1),
    },
  );

  await upsertDoc(Activity, { userId: users.customerDev._id, description: `[Seed ${SEED_VERSION}] CV match analysis completed` }, {
    userId: users.customerDev._id,
    type: "cv_analyzed",
    description: `[Seed ${SEED_VERSION}] CV match analysis completed`,
    metadata: { matchScore: 82 },
  });
  await upsertDoc(Activity, { userId: users.customerDev._id, description: `[Seed ${SEED_VERSION}] AI interview session completed` }, {
    userId: users.customerDev._id,
    type: "interview_completed",
    description: `[Seed ${SEED_VERSION}] AI interview session completed`,
    metadata: { score: 84 },
  });
  await upsertDoc(Activity, { userId: users.customerDev._id, description: `[Seed ${SEED_VERSION}] Mentor booking created` }, {
    userId: users.customerDev._id,
    type: "booking_created",
    description: `[Seed ${SEED_VERSION}] Mentor booking created`,
    metadata: { mentorName: mentors.primary.name, refId: bookings.confirmedUpcoming._id, refModel: "Booking" },
  });

  await upsertDoc(CVAnalysis, { userId: users.customerDev._id, cvFileName: `seed-${SEED_VERSION}-backend-basic.pdf` }, {
    userId: users.customerDev._id,
    cvText: "Backend engineer with Node.js, SQL and REST API experience.",
    cvFileName: `seed-${SEED_VERSION}-backend-basic.pdf`,
    cvFileUrl: "https://example.com/files/backend-basic.pdf",
    jdText: "Hiring backend developer with Node.js and database design experience.",
    jdFileName: "backend-jd.txt",
    analysisType: "match",
    jdSource: "text",
    result: {
      overallSummary: "Good backend profile with solid API experience.",
      experienceLevel: "junior-mid",
      topStrengths: ["Node.js", "REST APIs", "SQL"],
      areasToImprove: ["Testing depth", "System design vocabulary"],
      matchScore: 82,
      matchStrengths: ["API delivery", "Database fundamentals"],
      matchWeaknesses: ["Scalability examples"],
      missingKeywords: ["queue", "caching", "event-driven"],
      recommendations: ["Add measurable impact", "Mention performance tuning"],
      questions: [],
      starAnswers: [],
    },
    planAtTime: "free",
    processingMs: 1850,
  });
  await upsertDoc(CVAnalysis, { userId: users.customerStarter._id, cvFileName: `seed-${SEED_VERSION}-starter-questions.pdf` }, {
    userId: users.customerStarter._id,
    cvText: "Business analyst with SQL, reporting and stakeholder management skills.",
    cvFileName: `seed-${SEED_VERSION}-starter-questions.pdf`,
    cvFileUrl: "https://example.com/files/starter-questions.pdf",
    jdText: "Business analyst role with SQL and communication requirements.",
    jdFileName: "ba-jd.txt",
    analysisType: "questions",
    jdSource: "text",
    result: {
      overallSummary: "Profile aligns well with analyst screening rounds.",
      experienceLevel: "mid",
      topStrengths: ["SQL", "Stakeholder communication"],
      areasToImprove: ["Impact metrics"],
      recommendations: ["Prepare two project stories with outcomes"],
      questions: [
        { question: "How do you gather ambiguous stakeholder requirements?", category: "behavioral" },
        { question: "How would you validate a KPI dashboard before release?", category: "technical" },
      ],
      starAnswers: [],
    },
    planAtTime: "starter_pro",
    processingMs: 1760,
  });

  await upsertDoc(InterviewSession, { shareToken: `seed-${SEED_VERSION}-interview-customer-1` }, {
    userId: users.customerDev._id,
    hrGender: "female",
    planAtTime: "free",
    questionsAllowed: 3,
    answers: [
      { questionIndex: 0, questionText: "Tell me about yourself.", transcript: "I am a backend developer focused on APIs and databases.", wordCount: 18, durationSeconds: 58, recordedAt: addDays(today, -6) },
      { questionIndex: 1, questionText: "Describe a difficult bug you solved.", transcript: "I traced a race condition in an order sync job and fixed retry logic.", wordCount: 24, durationSeconds: 86, recordedAt: addDays(today, -6) },
    ],
    feedback: {
      overallScore: 84,
      communication: 82,
      confidence: 80,
      structure: 85,
      content: 86,
      timing: 83,
      generalComment: "Good clarity and solid examples. Add more measurable impact.",
      perQuestion: [
        { questionIndex: 0, score: 84, badge: "Tốt", strengths: ["Clear intro", "Relevant summary"], improvements: ["Mention metrics sooner"] },
        { questionIndex: 1, score: 85, badge: "Tốt", strengths: ["Good ownership", "Logical breakdown"], improvements: ["Close with business result"] },
      ],
      isLockedForFree: false,
    },
    status: "completed",
    totalDurationSeconds: 144,
    completedAt: addDays(today, -6),
    feedbackGeneratedAt: addDays(today, -6),
    reportPdfUrl: "https://example.com/reports/interview-customer-1.pdf",
    shareToken: `seed-${SEED_VERSION}-interview-customer-1`,
    shareTokenExpiresAt: addMonths(today, 1),
  });
  await upsertDoc(InterviewSession, { shareToken: `seed-${SEED_VERSION}-interview-customer-2` }, {
    userId: users.customerDev._id,
    hrGender: "male",
    planAtTime: "free",
    questionsAllowed: 3,
    answers: [
      { questionIndex: 0, questionText: "How do you design a scalable API?", transcript: "I start with use cases, capacity, data flow and failure handling.", wordCount: 20, durationSeconds: 72, recordedAt: addDays(today, -3) },
    ],
    feedback: {
      overallScore: 88,
      communication: 86,
      confidence: 85,
      structure: 90,
      content: 89,
      timing: 84,
      generalComment: "Very solid structure and better technical framing than the previous run.",
      perQuestion: [{ questionIndex: 0, score: 88, badge: "Xuất sắc", strengths: ["Strong framework", "Good tradeoffs"], improvements: ["Use one concrete production example"] }],
      isLockedForFree: false,
    },
    status: "completed",
    totalDurationSeconds: 72,
    completedAt: addDays(today, -3),
    feedbackGeneratedAt: addDays(today, -3),
    reportPdfUrl: "https://example.com/reports/interview-customer-2.pdf",
    shareToken: `seed-${SEED_VERSION}-interview-customer-2`,
    shareTokenExpiresAt: addMonths(today, 1),
  });

  await upsertDoc(CourseQA, { courseId: courses.backend._id, question: `[Seed ${SEED_VERSION}] How should I explain database indexing tradeoffs in interviews?` }, {
    courseId: courses.backend._id,
    lessonId: backendLessons[0]?.id,
    userId: users.customerDev._id,
    question: `[Seed ${SEED_VERSION}] How should I explain database indexing tradeoffs in interviews?`,
    isAnswered: true,
    answers: [{ userId: users.mentorDev._id, isMentor: true, content: "Frame the answer around read latency, write cost, storage overhead and your actual query pattern.", upvotes: 3, createdAt: addDays(today, -1) }],
    upvotes: 5,
    isPinned: true,
  });
  await upsertDoc(MentorPeerReview, { reviewerId: mentors.secondary._id, courseId: courses.backend._id }, {
    reviewerId: mentors.secondary._id,
    courseId: courses.backend._id,
    contentRating: 5,
    qualityRating: 4,
    priceValueRating: 4,
    feedback: "Very practical backend interview course. Consider adding one more distributed systems case study.",
    isCompleted: true,
    isVisibleToOwner: true,
  });

  for (const courseId of [courses.backend._id, courses.systemDesign._id, courses.cvCareer._id]) {
    const course = await Course.findById(courseId);
    const courseEnrollments = await Enrollment.find({ courseId }).lean();
    const courseReviews = await Review.find({ targetType: "course", targetId: courseId, isVisible: { $ne: false } }).lean();
    course.stats = {
      enrollmentCount: courseEnrollments.length,
      rating: courseReviews.length ? Math.round((courseReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / courseReviews.length) * 10) / 10 : 0,
      reviewCount: courseReviews.length,
      completionRate: courseEnrollments.length ? Math.round((courseEnrollments.filter((item) => item.isCompleted).length / courseEnrollments.length) * 100) : 0,
      totalRevenue: courseEnrollments.reduce((sum, item) => sum + Number(item.pricePaid || 0), 0),
    };
    course.totalLessons = totalLessons(course.modules);
    course.totalDurationMinutes = totalDuration(course.modules);
    await course.save();
  }

  for (const [key, profileViews] of [["primary", 126], ["secondary", 74]]) {
    const mentor = await Mentor.findById(mentors[key]._id);
    const mentorBookings = await Booking.find({ mentorId: mentor._id }).lean();
    const mentorReviews = await Review.find({ targetType: "mentor", targetId: mentor._id, isVisible: { $ne: false } }).lean();
    const mentorCourses = await Course.find({ mentorId: mentor._id }).lean();
    const mentorEnrollments = mentorCourses.length ? await Enrollment.find({ courseId: { $in: mentorCourses.map((item) => item._id) } }).lean() : [];
    const completedBookings = mentorBookings.filter((item) => item.status === "completed");
    const activeBookings = mentorBookings.filter((item) => ["pending", "confirmed", "in_progress", "rescheduled"].includes(item.status));
    const totalRevenue = completedBookings.reduce((sum, item) => sum + Number(item.price || 0), 0) + mentorCourses.reduce((sum, item) => sum + Number(item.stats?.totalRevenue || 0), 0);
    mentor.stats = {
      rating: mentorReviews.length ? Math.round((mentorReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / mentorReviews.length) * 10) / 10 : 0,
      reviewCount: mentorReviews.length,
      sessionCount: mentorBookings.length,
      totalStudents: new Set([...mentorBookings.map((item) => String(item.userId)), ...mentorEnrollments.map((item) => String(item.userId))]).size,
      totalRevenue,
      completionRate: mentorBookings.length ? Math.round((completedBookings.length / mentorBookings.length) * 100) : 100,
      profileViews,
      acceptanceRate: mentorBookings.length ? Math.round((mentorBookings.filter((item) => ["confirmed", "completed", "in_progress"].includes(item.status)).length / mentorBookings.length) * 100) : 100,
      rebookingRate: 33,
    };
    const financeBase = mentor.finance?.toObject ? mentor.finance.toObject() : mentor.finance || {};
    mentor.finance = {
      availableBalance: Number(financeBase.availableBalance || 0),
      pendingBalance: activeBookings.reduce((sum, item) => sum + Number(item.price || 0), 0),
      totalEarned: totalRevenue,
      bankAccount: financeBase.bankAccount || { bankName: "", accountNumber: "", accountName: mentor.name },
      momoPhone: financeBase.momoPhone || "",
      zalopayPhone: financeBase.zalopayPhone || "",
      autoPayoutThreshold: Number(financeBase.autoPayoutThreshold || 500000),
    };
    await mentor.save();
  }

  const summary = {
    seedVersion: SEED_VERSION,
    generatedAt: new Date().toISOString(),
    password: PASSWORD,
    accounts: {
      adminDev: { id: String(users.adminDev._id), email: users.adminDev.email, role: users.adminDev.role },
      customerDev: { id: String(users.customerDev._id), email: users.customerDev.email, role: users.customerDev.role, plan: users.customerDev.plan },
      customerReviewer: { id: String(users.customerReviewer._id), email: users.customerReviewer.email, role: users.customerReviewer.role, plan: users.customerReviewer.plan },
      customerStarter: { id: String(users.customerStarter._id), email: users.customerStarter.email, role: users.customerStarter.role, plan: users.customerStarter.plan },
      mentorDev: { id: String(users.mentorDev._id), email: users.mentorDev.email, role: users.mentorDev.role, mentorPublicId: mentors.primary.publicId, mentorDocId: String(mentors.primary._id) },
      mentorCareer: { id: String(users.mentorCareer._id), email: users.mentorCareer.email, role: users.mentorCareer.role, mentorPublicId: mentors.secondary.publicId, mentorDocId: String(mentors.secondary._id) },
    },
    mentors: {
      primary: { id: String(mentors.primary._id), publicId: mentors.primary.publicId, pricePerHour: mentors.primary.pricePerHour },
      secondary: { id: String(mentors.secondary._id), publicId: mentors.secondary.publicId, pricePerHour: mentors.secondary.pricePerHour },
    },
    courses: {
      backend: { id: String(courses.backend._id), title: courses.backend.title, lessonIds: lessonRefs(await Course.findById(courses.backend._id)) },
      systemDesign: { id: String(courses.systemDesign._id), title: courses.systemDesign.title },
      cvCareer: { id: String(courses.cvCareer._id), title: courses.cvCareer.title, lessonIds: lessonRefs(await Course.findById(courses.cvCareer._id)) },
    },
    bookings: {
      completedReviewed: { id: String(bookings.completedReviewed._id), paymentRef: bookings.completedReviewed.paymentRef, status: bookings.completedReviewed.status },
      confirmedUpcoming: { id: String(bookings.confirmedUpcoming._id), paymentRef: bookings.confirmedUpcoming.paymentRef, status: bookings.confirmedUpcoming.status },
      pendingRequest: { id: String(bookings.pendingRequest._id), paymentRef: bookings.pendingRequest.paymentRef, status: bookings.pendingRequest.status },
      rescheduledConfirmed: { id: String(bookings.rescheduledConfirmed._id), paymentRef: bookings.rescheduledConfirmed.paymentRef, status: bookings.rescheduledConfirmed.status },
      cancelledBooking: { id: String(bookings.cancelledBooking._id), paymentRef: bookings.cancelledBooking.paymentRef, status: bookings.cancelledBooking.status },
      completedSecondReview: { id: String(bookings.completedSecondReview._id), paymentRef: bookings.completedSecondReview.paymentRef, status: bookings.completedSecondReview.status },
      completedReadyForReview: { id: String(bookings.completedReadyForReview._id), paymentRef: bookings.completedReadyForReview.paymentRef, status: bookings.completedReadyForReview.status },
      confirmedMentorSecondary: { id: String(bookings.confirmedMentorSecondary._id), paymentRef: bookings.confirmedMentorSecondary.paymentRef, status: bookings.confirmedMentorSecondary.status },
    },
    reviews: {
      mentorPrimary: { id: String(reviews.mentorPrimary._id), targetId: String(reviews.mentorPrimary.targetId), bookingId: String(reviews.mentorPrimary.bookingId || "") },
      mentorSecondary: { id: String(reviews.mentorSecondary._id), targetId: String(reviews.mentorSecondary.targetId), bookingId: String(reviews.mentorSecondary.bookingId || "") },
      courseBackend: { id: String(reviews.courseBackend._id), targetId: String(reviews.courseBackend.targetId) },
    },
    enrollments: {
      customerBackend: { id: String(enrollments.customerBackend._id), courseId: String(enrollments.customerBackend.courseId), progressPercent: enrollments.customerBackend.progressPercent },
      reviewerBackend: { id: String(enrollments.reviewerBackend._id), courseId: String(enrollments.reviewerBackend.courseId), progressPercent: enrollments.reviewerBackend.progressPercent },
      starterCv: { id: String(enrollments.starterCv._id), courseId: String(enrollments.starterCv.courseId), progressPercent: enrollments.starterCv.progressPercent },
    },
    notifications: {
      customerDevUnreadExampleId: String(notifications.customerBookingConfirmed._id),
      mentorDevUnreadExampleId: String(notifications.mentorBookingRequest._id),
    },
    reports: {
      mentorComplaint: { id: String(reports.mentorComplaint._id), targetId: String(reports.mentorComplaint.targetId) },
      courseComplaint: { id: String(reports.courseComplaint._id), targetId: String(reports.courseComplaint.targetId) },
    },
    endpointFixtures: {
      auth: {
        loginAccounts: [
          { email: users.adminDev.email, password: PASSWORD },
          { email: users.customerDev.email, password: PASSWORD },
          { email: users.customerReviewer.email, password: PASSWORD },
          { email: users.customerStarter.email, password: PASSWORD },
          { email: users.mentorDev.email, password: PASSWORD },
          { email: users.mentorCareer.email, password: PASSWORD },
        ],
      },
      mentors: {
        listIds: [mentors.primary.publicId, mentors.secondary.publicId],
        reviewTarget: mentors.primary.publicId,
      },
      bookings: {
        createExample: { mentorId: mentors.primary.publicId, date: dmy(addDays(today, 10)), timeSlot: "13:00", sessionType: "mock_interview", price: mentors.primary.pricePerHour, notes: "Live booking test from endpoint seed" },
        getById: String(bookings.confirmedUpcoming._id),
        getByPaymentRef: bookings.confirmedUpcoming.paymentRef,
        cancelTarget: String(bookings.pendingRequest._id),
        rescheduleTarget: String(bookings.confirmedUpcoming._id),
        mentorConfirmTarget: String(bookings.pendingRequest._id),
        mentorCompleteTarget: String(bookings.confirmedUpcoming._id),
      },
      courses: {
        getById: String(courses.backend._id),
        enrollTargetForCustomerDev: String(courses.systemDesign._id),
      },
      enrollments: {
        updateProgressExample: { enrollmentId: String(enrollments.customerBackend._id), lessonId: backendLessons[2]?.id ?? backendLessons[0]?.id, isCompleted: true },
      },
      reviews: {
        createMentorReviewExample: { targetType: "mentor", targetId: mentors.secondary.publicId, bookingId: String(bookings.completedReadyForReview._id), rating: 5, comment: "Live review test from seeded completed booking.", tags: ["seed-test", "cv-review"] },
        createCourseReviewExample: { targetType: "course", targetId: String(courses.cvCareer._id), rating: 4, comment: "Live course review test.", tags: ["seed-test", "course"] },
        mentorReplyTarget: String(reviews.mentorSecondary._id),
        deleteTargetOwnedByCustomerDev: String(reviews.courseBackend._id),
      },
      reports: {
        mentorTargetId: mentors.secondary.publicId,
        courseTargetId: String(courses.systemDesign._id),
      },
      notifications: {
        markReadTargetForCustomerDev: String(notifications.customerBookingConfirmed._id),
      },
      payments: {
        bookingIdForInitiate: String(bookings.pendingRequest._id),
        historyAccounts: [users.customerDev.email, users.customerStarter.email],
      },
      plans: {
        freeAccount: users.customerDev.email,
        starterAccount: users.customerStarter.email,
      },
      admin: {
        patchUserRoleTarget: String(users.customerReviewer._id),
        mentorStatusTarget: String(mentors.secondary._id),
        userStatusTarget: String(users.customerReviewer._id),
      },
    },
    collectionCounts: {
      users: await User.countDocuments(),
      mentors: await Mentor.countDocuments(),
      bookings: await Booking.countDocuments(),
      courses: await Course.countDocuments(),
      enrollments: await Enrollment.countDocuments(),
      reviews: await Review.countDocuments(),
      payments: await Payment.countDocuments(),
      notifications: await Notification.countDocuments(),
      reports: await Report.countDocuments(),
      cvAnalyses: await CVAnalysis.countDocuments(),
      interviewSessions: await InterviewSession.countDocuments(),
      subscriptions: await Subscription.countDocuments(),
      activities: await Activity.countDocuments(),
      courseQAs: await CourseQA.countDocuments(),
      mentorPeerReviews: await MentorPeerReview.countDocuments(),
    },
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Seeded endpoint data successfully. Summary written to ${OUTPUT_FILE}`);
  console.log(JSON.stringify(summary.collectionCounts, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors after failure
  }
  process.exit(1);
});
