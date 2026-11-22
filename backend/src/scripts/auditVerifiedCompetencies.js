/**
 * PR-07: audit dữ liệu "năng lực đã xác thực" bị lưu sai.
 *
 * Mặc định DRY-RUN, chỉ đọc. Không dùng loadEnv (tự ghép URI Atlas từ .env): phải truyền URI tường minh.
 * Không import model để Mongoose không tự tạo collection / index trên DB đang audit.
 *
 *   AUDIT_MONGO_URI="mongodb://..." node src/scripts/auditVerifiedCompetencies.js [--details]
 *
 * Dọn dữ liệu CHỈ chạy trên MongoDB local, cần đủ 3 cờ; DB từ xa luôn bị từ chối:
 *   ... --apply --confirm-db=<tên db> --backup=<file json chưa tồn tại>
 * Lưu ý: tunnel về localhost trông như DB local, không dùng --apply qua tunnel.
 * File backup chứa dữ liệu người dùng, không commit.
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { interviewEvidenceFilter } from "../services/competencyEvidence.js";

const USER_FIELDS = ["isCompetencyVerified", "verifiedReadinessScore", "verifiedProfileSummary", "lastVerifiedAt", "verifiedCompetencies"];

export function parseArgs(argv) {
  const options = { apply: false, details: false, confirmDb: "", backup: "" };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--details") options.details = true;
    else if (arg === "--dry-run") continue;
    else if (arg.startsWith("--confirm-db=")) options.confirmDb = arg.slice("--confirm-db=".length);
    else if (arg.startsWith("--backup=")) options.backup = arg.slice("--backup=".length);
    else throw new Error("Tham số không hợp lệ.");
  }
  if (options.apply && argv.includes("--dry-run")) throw new Error("--apply và --dry-run không dùng cùng nhau.");
  return options;
}

export function assertApplyAllowed(uri, options, env = process.env) {
  if (String(env.NODE_ENV || "").trim().toLowerCase() === "production") throw new Error("Không --apply khi NODE_ENV=production.");
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("--apply chỉ nhận URI MongoDB local một host.");
  }
  if (url.protocol !== "mongodb:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("--apply chỉ chạy trên MongoDB local, không sửa DB từ xa.");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || options.confirmDb !== name) throw new Error("--confirm-db phải trùng tên database trong URI.");
  if (!options.backup) throw new Error("--apply cần --backup=<file>.");
}

/** Chỉ đọc. `db` là Db của driver MongoDB. */
export async function auditVerifiedData(db) {
  const summary = {
    profilesScanned: 0,
    profilesAffected: 0,
    profilesWithOtherUsersBooking: 0,
    bookingOwnersExposed: 0,
    otherUsersBookingSources: 0,
    ownBookingFakeScoreSources: 0,
    orphanMentorSources: 0,
    invalidOtherSources: 0,
    verifiedProfilesWithoutEvidence: 0,
    usersWithUntrustedVerified: 0,
    usersVerifiedWithoutEvidence: 0,
  };
  const profiles = [];
  const exposed = new Set();
  const sessions = db.collection("interview_sessions");
  const evidenceIds = async (userId) =>
    new Set((await sessions.find(interviewEvidenceFilter(userId), { projection: { _id: 1 } }).toArray()).map((s) => String(s._id)));

  for await (const profile of db.collection("candidateprofiles").find({})) {
    summary.profilesScanned += 1;
    const competencies = Array.isArray(profile.competencies) ? profile.competencies : [];
    const sources = competencies.flatMap((c) => c?.sources || []);
    const claimed = profile.isVerified === true || competencies.some((c) => c?.evidenceCount > 0 || c?.score > 0);
    if (!claimed && !sources.length) continue;

    const valid = await evidenceIds(profile.userId);
    const reasons = new Set();
    for (const source of sources) {
      if (source.type === "mentor_session") {
        const booking = source.refId
          ? await db.collection("bookings").findOne({ _id: source.refId }, { projection: { userId: 1 } })
          : null;
        if (!booking) {
          summary.orphanMentorSources += 1;
          reasons.add("orphan_mentor_source");
        } else if (String(booking.userId) !== String(profile.userId)) {
          summary.otherUsersBookingSources += 1;
          exposed.add(String(booking.userId));
          reasons.add("other_users_booking");
        } else {
          summary.ownBookingFakeScoreSources += 1;
          reasons.add("own_booking_fake_score");
        }
      } else if (source.type !== "ai_interview" || !valid.has(String(source.refId))) {
        summary.invalidOtherSources += 1;
        reasons.add("invalid_source");
      }
    }
    if (claimed && !valid.size) {
      summary.verifiedProfilesWithoutEvidence += 1;
      reasons.add("no_evidence");
    }
    if (!reasons.size) continue;
    summary.profilesAffected += 1;
    if (reasons.has("other_users_booking")) summary.profilesWithOtherUsersBooking += 1;
    profiles.push({ doc: profile, reasons: [...reasons] });
  }
  summary.bookingOwnersExposed = exposed.size;

  const users = [];
  const projection = Object.fromEntries(USER_FIELDS.map((field) => [field, 1]));
  const stored = {
    $or: [
      { isCompetencyVerified: true },
      { verifiedReadinessScore: { $gt: 0 } },
      { "verifiedCompetencies.0": { $exists: true } },
    ],
  };
  for await (const user of db.collection("users").find(stored, { projection })) {
    summary.usersWithUntrustedVerified += 1;
    const withoutEvidence = !(await evidenceIds(user._id)).size;
    if (withoutEvidence) summary.usersVerifiedWithoutEvidence += 1;
    users.push({ doc: user, reasons: [withoutEvidence ? "no_evidence" : "legacy_formula"] });
  }

  return { summary, profiles, users };
}

/**
 * Xóa phần cache sai. API tự tính lại từ bằng chứng thật nên không cần ghi điểm mới.
 * Chỉ sửa bản ghi còn nguyên như lúc audit.
 */
export async function applyCleanup(db, { profiles, users }) {
  let profilesUpdated = 0;
  let usersUpdated = 0;
  for (const { doc } of profiles) {
    const competencies = (doc.competencies || []).map((c) => ({ ...c, level: 1, score: 0, evidenceCount: 0, sources: [] }));
    const result = await db.collection("candidateprofiles").updateOne(
      { _id: doc._id, updatedAt: doc.updatedAt ?? null },
      { $set: { competencies, isVerified: false, verifiedAt: null, updatedAt: new Date() } },
    );
    profilesUpdated += result.modifiedCount;
  }
  for (const { doc } of users) {
    const result = await db.collection("users").updateOne(
      { _id: doc._id, lastVerifiedAt: doc.lastVerifiedAt ?? null },
      { $set: { isCompetencyVerified: false, verifiedReadinessScore: 0, verifiedProfileSummary: "", lastVerifiedAt: null, verifiedCompetencies: [] } },
    );
    usersUpdated += result.modifiedCount;
  }
  return { profilesUpdated, usersUpdated };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = process.env.AUDIT_MONGO_URI?.trim();
  if (!uri) throw new Error("Thiếu AUDIT_MONGO_URI (script cố ý không đọc .env).");
  if (options.apply) assertApplyAllowed(uri, options);

  const connection = await mongoose.createConnection(uri, { autoCreate: false, autoIndex: false }).asPromise();
  try {
    const { db } = connection;
    console.log(`[audit PR-07] db=${db.databaseName} mode=${options.apply ? "APPLY" : "DRY-RUN (chỉ đọc)"}`);
    const report = await auditVerifiedData(db);
    console.log(JSON.stringify(report.summary, null, 2));
    if (options.details) {
      for (const { doc, reasons } of report.profiles) console.log(`profile user=${doc.userId} ${reasons.join(",")}`);
      for (const { doc, reasons } of report.users) console.log(`user=${doc._id} ${reasons.join(",")}`);
    }
    if (!options.apply) return;

    // EJSON giữ ObjectId / Date để khôi phục được; "wx" không ghi đè backup cũ.
    const backup = mongoose.mongo.BSON.EJSON.stringify(
      { profiles: report.profiles.map((p) => p.doc), users: report.users.map((u) => u.doc) },
      { relaxed: false },
    );
    writeFileSync(options.backup, backup, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(await applyCleanup(db, report)));
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[audit PR-07] ${err.message}`);
    process.exitCode = 1;
  });
}
