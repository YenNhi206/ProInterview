import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import { CVAnalysis } from "../models/CVAnalysis.js";
import { Booking } from "../models/Booking.js";
import { httpError } from "../utils/apiErrors.js";

const MAX_BYTES = 5 * 1024 * 1024;
const uploadRoot = fileURLToPath(new URL("../../public/uploads/", import.meta.url));
const extensions = /\.(pdf|doc|docx|txt)$/i;
const errorMissing = () => httpError(410, "Tệp cũ không còn khả dụng. Vui lòng tải lại từ máy tính.");

export async function listOwnedDocuments(userId) {
  const [requests, analyses, bookings] = await Promise.all([
    MentorshipRequest.find({ userId }).select("cvName jdName createdAt").sort({ createdAt: -1 }).limit(50).lean(),
    CVAnalysis.find({ userId }).select("cvFileName cvFileId cvFileUrl jdFileName jdFileId jdFileUrl createdAt").sort({ createdAt: -1 }).limit(100).lean(),
    Booking.find({ userId, $or: [{ cvFileUrl: { $gt: "" } }, { jdFileUrl: { $gt: "" } }] }).select("cvFileName cvFileUrl jdFileName jdFileUrl createdAt").sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  const documents = [], seen = new Set();
  for (const [source, label, rows] of [["request", "Yêu cầu Mentor", requests], ["analysis", "Phân tích CV", analyses], ["booking", "Lịch hẹn Mentor", bookings]]) {
    for (const row of rows) for (const kind of ["cv", "jd"]) {
      const name = row[source === "request" ? `${kind}Name` : `${kind}FileName`];
      const location = source === "request" ? String(row._id) : row[`${kind}FileUrl`] || row[`${kind}FileId`];
      if (!name || !extensions.test(name) || !location) continue;
      const key = `${kind}:${location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push({ id: `${source}:${row._id}`, kind, name, source: label, createdAt: row.createdAt });
    }
  }
  return documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function readLocalFile(fileName) {
  // Only a flat, named file inside the upload directory; never an arbitrary path.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(pdf|doc|docx|txt)$/i.test(fileName) || fileName.includes("..")) throw errorMissing();
  let real;
  try {
    real = await fs.realpath(path.join(uploadRoot, fileName));
    const root = await fs.realpath(uploadRoot);
    if (path.dirname(real) !== root) throw errorMissing();
    const stat = await fs.stat(real);
    if (!stat.isFile()) throw errorMissing();
    if (!stat.size || stat.size > MAX_BYTES) throw httpError(400, "Tệp cũ phải có nội dung và không quá 5MB. Vui lòng chọn bản khác.");
    return await fs.readFile(real);
  } catch (error) {
    if (error.status) throw error;
    throw errorMissing();
  }
}

async function readStoredFile(url, fileId, kind) {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return readLocalFile(String(fileId || ""));
  let parsed;
  try { parsed = new URL(raw, "http://stored-upload.local"); } catch { throw errorMissing(); }
  if (parsed.pathname.startsWith("/uploads/")) {
    let name;
    try { name = decodeURIComponent(parsed.pathname.slice("/uploads/".length)); } catch { throw errorMissing(); }
    return readLocalFile(name);
  }
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const prefix = cloud ? `/${cloud}/raw/upload/` : "";
  // Do not fetch user-supplied hosts, redirects, alternate Cloudinary accounts or unrelated folders.
  if (!cloud || parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.port || parsed.username || parsed.password || !parsed.pathname.startsWith(prefix)) throw errorMissing();
  const resource = parsed.pathname.slice(prefix.length).replace(/^v\d+\//, "");
  if (!resource.startsWith(`prointerview/${kind}-files/`)) throw errorMissing();
  let response;
  try { response = await fetch(parsed.href, { redirect: "error", signal: AbortSignal.timeout(10000) }); } catch { throw errorMissing(); }
  if (!response.ok || !response.body) throw errorMissing();
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw httpError(400, "Tệp cũ vượt quá 5MB. Vui lòng chọn bản khác.");
      chunks.push(Buffer.from(value));
    }
  } catch (error) { if (error.status) throw error; throw errorMissing(); }
  finally { await reader.cancel().catch(() => {}); }
  if (!size) throw errorMissing();
  return Buffer.concat(chunks);
}

export async function readOwnedDocument(userId, token, kind) {
  const [source, documentId, extra] = String(token).split(":");
  if (extra || !mongoose.isValidObjectId(documentId) || !["cv", "jd"].includes(kind)) throw httpError(400, "Tài liệu đã lưu không hợp lệ.");
  let row, originalname, buffer;
  if (source === "request") {
    row = await MentorshipRequest.findOne({ _id: documentId, userId }).select(`+${kind}Data`);
    if (row) { originalname = row[`${kind}Name`]; buffer = Buffer.from(row[`${kind}Data`]); }
  } else if (source === "analysis" || source === "booking") {
    const Model = source === "analysis" ? CVAnalysis : Booking;
    row = await Model.findOne({ _id: documentId, userId }).select(`${kind}FileName ${kind}FileId ${kind}FileUrl`).lean();
    if (row) {
      originalname = row[`${kind}FileName`];
      if (!originalname || !extensions.test(originalname)) throw errorMissing();
      buffer = await readStoredFile(row[`${kind}FileUrl`], row[`${kind}FileId`], kind);
    }
  }
  if (!row) throw httpError(404, "Không tìm thấy tài liệu trong tài khoản của bạn.");
  if (!originalname || !extensions.test(originalname) || !buffer?.length) throw errorMissing();
  if (buffer.length > MAX_BYTES) throw httpError(400, "Tệp cũ vượt quá 5MB. Vui lòng chọn bản khác.");
  return { originalname, buffer };
}
