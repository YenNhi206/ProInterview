/** Lọc chuyên môn IT trên trang danh sách mentor (`Mentors.jsx`). */
export const MENTOR_FILTER_FIELDS = [
  "Frontend",
  "Backend",
  "Fullstack",
  "DevOps / Cloud",
  "AI & Data",
  "Mobile App",
  "System Design",
  "QA / Testing",
];

/**
 * Từ khóa khớp chuyên môn IT — mentor có thể lưu skill (React, Node.js, AWS...) thay vì nhãn.
 */
const MENTOR_FIELD_FILTER_MAP = {
  Frontend: [
    "frontend",
    "front-end",
    "react",
    "vue",
    "angular",
    "next.js",
    "nextjs",
    "typescript",
    "javascript",
    "tailwind",
    "html",
    "css",
    "web ui",
  ],
  Backend: [
    "backend",
    "back-end",
    "node.js",
    "nodejs",
    "express",
    "nest",
    "nestjs",
    "golang",
    "go",
    "java",
    "spring",
    "python",
    "django",
    "fastapi",
    "c#",
    ".net",
    "php",
    "laravel",
    "sql",
    "postgresql",
    "mongodb",
    "mysql",
    "redis",
    "database",
  ],
  Fullstack: [
    "fullstack",
    "full-stack",
    "mern",
    "mean",
    "t3 stack",
  ],
  "DevOps / Cloud": [
    "devops",
    "cloud",
    "aws",
    "gcp",
    "azure",
    "docker",
    "kubernetes",
    "k8s",
    "ci/cd",
    "terraform",
    "linux",
    "infrastructure",
    "ansible",
  ],
  "AI & Data": [
    "ai",
    "machine learning",
    "deep learning",
    "data",
    "data engineer",
    "data science",
    "data scientist",
    "nlp",
    "llm",
    "spark",
    "hadoop",
    "pytorch",
    "tensorflow",
    "computer vision",
    "big data",
  ],
  "Mobile App": [
    "mobile",
    "ios",
    "android",
    "flutter",
    "react native",
    "swift",
    "kotlin",
  ],
  "System Design": [
    "system design",
    "architecture",
    "microservices",
    "high availability",
    "scalability",
    "tech lead",
    "architect",
    "distributed systems",
  ],
  "QA / Testing": [
    "qa",
    "qc",
    "tester",
    "testing",
    "automation test",
    "selenium",
    "cypress",
    "playwright",
    "manual test",
    "quality assurance",
  ],
};

/** Gom chuỗi lĩnh vực / kỹ năng của mentor để so khớp bộ lọc. */
function mentorFieldBlob(mentor) {
  return [
    mentor.field,
    ...(Array.isArray(mentor.fields) ? mentor.fields : []),
    ...(Array.isArray(mentor.tags) ? mentor.tags : []),
    ...(Array.isArray(mentor.specialties) ? mentor.specialties : []),
    mentor.title,
    mentor.bio,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(" | ");
}

/** Mentor có thuộc chuyên môn IT đã chọn không. */
export function mentorMatchesFilterField(mentor, selectedField) {
  if (!selectedField) return true;

  const blob = mentorFieldBlob(mentor);
  const aliases = MENTOR_FIELD_FILTER_MAP[selectedField];
  if (!aliases?.length) {
    return blob.includes(String(selectedField).toLowerCase());
  }

  return aliases.some((alias) => blob.includes(alias));
}
