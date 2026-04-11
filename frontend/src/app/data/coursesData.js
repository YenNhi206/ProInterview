/**
 * Shared course data with full lessons and peer reviews
 * Used across CourseDetail, Courses listing, and recommendation components
 */

// ── Peer Reviewers (Mentors who cross-review other mentors' courses) ──────────
export const MENTOR_REVIEWERS = [
  {
    id: "m1",
    name: "Nguyễn Văn Minh",
    avatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    title: "Senior Software Engineer",
    company: "Shopee",
  },
  {
    id: "m2",
    name: "Trần Thị Hương",
    avatar: "https://images.unsplash.com/photo-1736939678218-bd648b5ef3bb?w=200&q=80",
    title: "Engineering Manager",
    company: "Grab Vietnam",
  },
  {
    id: "m3",
    name: "Lê Quang Đức",
    avatar: "https://images.unsplash.com/photo-1766066014773-0074bf4911de?w=200&q=80",
    title: "Tech Lead",
    company: "VNG Corporation",
  },
  {
    id: "m4",
    name: "Phạm Minh Tuấn",
    avatar: "https://images.unsplash.com/photo-1770363760820-b871452de45f?w=200&q=80",
    title: "Staff Engineer",
    company: "Tiki",
  },
  {
    id: "m5",
    name: "Võ Thị Lan Anh",
    avatar: "https://images.unsplash.com/photo-1770364020204-102331b625ea?w=200&q=80",
    title: "Senior Frontend Engineer",
    company: "MoMo",
  },
];

// ── Course 1: STAR Method ──────────────────────────────────────────────────────
const course1Lessons = [
  { id: "1-1", title: "Giới thiệu khóa học & STAR Method là gì?", duration: 12, order: 1, isPreview: true, content: "Overview of STAR: Situation, Task, Action, Result" },
  { id: "1-2", title: "Situation — Đặt bối cảnh hiệu quả", duration: 18, order: 2, isPreview: true, content: "How to set up the situation clearly and concisely" },
  { id: "1-3", title: "Task — Nêu nhiệm vụ của bạn", duration: 15, order: 3, isPreview: false, content: "Defining your role and responsibility in the story" },
  { id: "1-4", title: "Action — Chi tiết hành động bạn đã thực hiện", duration: 22, order: 4, isPreview: false, content: "Detailing the specific actions you took" },
  { id: "1-5", title: "Result — Kết quả có số liệu", duration: 20, order: 5, isPreview: false, content: "Quantifying results for impact" },
  { id: "1-6", title: "15 câu hỏi behavioral phổ biến nhất", duration: 25, order: 6, isPreview: false, content: "Top 15 behavioral questions with STAR templates" },
  { id: "1-7", title: "Lỗi thường gặp khi áp dụng STAR", duration: 16, order: 7, isPreview: false, content: "Common mistakes and how to avoid them" },
  { id: "1-8", title: "Practice: Câu hỏi về teamwork", duration: 20, order: 8, isPreview: false, content: "Practice STAR with teamwork scenarios" },
  { id: "1-9", title: "Practice: Câu hỏi về leadership", duration: 18, order: 9, isPreview: false, content: "Practice STAR with leadership scenarios" },
  { id: "1-10", title: "Practice: Câu hỏi về failure & learning", duration: 16, order: 10, isPreview: false, content: "Handling failure questions with STAR" },
  { id: "1-11", title: "Template bank: 20+ câu trả lời sẵn có", duration: 15, order: 11, isPreview: false, content: "Ready-made STAR answer templates" },
  { id: "1-12", title: "Tổng kết & Mock Interview session", duration: 23, order: 12, isPreview: false, content: "Final practice with full mock interview" },
];

const course1Reviews = [
  {
    id: "r1-1",
    mentorId: "2",
    mentorName: "Trần Thị Hương",
    mentorAvatar: "https://images.unsplash.com/photo-1736939678218-bd648b5ef3bb?w=200&q=80",
    mentorTitle: "Engineering Manager @ Grab Vietnam",
    rating: 5,
    comment: "Là một recruiter đã phỏng vấn 500+ ứng viên, tôi xác nhận nội dung khóa học này cực kỳ chính xác và thực tế. Đặc biệt phần 'Result có số liệu' — đây là điểm 90% ứng viên bỏ qua. Khóa học của chị Linh đã giải quyết đúng vấn đề này.",
    createdAt: "2024-03-01",
    verified: true,
  },
  {
    id: "r1-2",
    mentorId: "5",
    mentorName: "Võ Thị Lan Anh",
    mentorAvatar: "https://images.unsplash.com/photo-1770364020204-102331b625ea?w=200&q=80",
    mentorTitle: "Senior Frontend Engineer @ MoMo",
    rating: 5,
    comment: "Tôi thường xuyên phỏng vấn cho các vị trí Senior/Lead tại Grab. Khóa học này dạy đúng những gì chúng tôi tìm kiếm ở ứng viên. Phần về Leadership STAR stories đặc biệt valuable. Highly recommend cho ai target vị trí Senior trở lên.",
    createdAt: "2024-03-10",
    verified: true,
  },
];

// ── Course 2: CV Writing ───────────────────────────────────────────────────────
const course2Lessons = [
  { id: "2-1", title: "CV Anatomy: Cấu trúc CV chuyên nghiệp 2024", duration: 15, order: 1, isPreview: true, content: "Modern CV structure for 2024" },
  { id: "2-2", title: "ATS là gì và tại sao CV của bạn bị lọc?", duration: 18, order: 2, isPreview: true, content: "Understanding ATS and how to pass it" },
  { id: "2-3", title: "Action Verbs: 100 từ mạnh nhất trong CV", duration: 20, order: 3, isPreview: false, content: "Power action verbs that recruiters love" },
  { id: "2-4", title: "Highlight thành tích với số liệu KPI", duration: 22, order: 4, isPreview: false, content: "STAR for CV: quantifying achievements" },
  { id: "2-5", title: "Phần Summary/Objective ấn tượng", duration: 16, order: 5, isPreview: false, content: "Writing a compelling professional summary" },
  { id: "2-6", title: "Skills section: kỹ năng nào nên để?", duration: 14, order: 6, isPreview: false, content: "Selecting and presenting relevant skills" },
  { id: "2-7", title: "Customize CV theo từng JD cụ thể", duration: 25, order: 7, isPreview: false, content: "Tailoring your CV for specific job descriptions" },
  { id: "2-8", title: "10 Templates CV miễn phí (Google Docs)", duration: 12, order: 8, isPreview: false, content: "Access to 10 free CV templates" },
  { id: "2-9", title: "Lỗi format CV thường gặp", duration: 18, order: 9, isPreview: false, content: "Common CV formatting mistakes to avoid" },
  { id: "2-10", title: "Review CV thực tế từ mentor", duration: 30, order: 10, isPreview: false, content: "Real CV review session with mentor feedback" },
];

const course2Reviews = [
  {
    id: "r2-1",
    mentorId: "1",
    mentorName: "Nguyễn Văn Minh",
    mentorAvatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    mentorTitle: "Senior Software Engineer @ Shopee",
    rating: 5,
    comment: "Mỗi ngày tôi đọc hàng chục CV khi hiring tại Google. Khóa học của anh Quân cover đúng những gì HR thực sự tìm kiếm. Phần ATS optimization rất quan trọng — nhiều ứng viên tốt bị lọc oan chỉ vì không biết điều này. Tôi sẽ recommend khóa học này cho tất cả ứng viên của mình.",
    createdAt: "2024-03-05",
    verified: true,
  },
  {
    id: "r2-2",
    mentorId: "4",
    mentorName: "Phạm Minh Tuấn",
    mentorAvatar: "https://images.unsplash.com/photo-1770363760820-b871452de45f?w=200&q=80",
    mentorTitle: "Staff Engineer @ Tiki",
    rating: 4,
    comment: "Nội dung solid và thực tế. Tôi đặc biệt thích phần 'Customize CV theo JD' — đây là kỹ năng cực kỳ quan trọng mà ít khóa học nào dạy. Có thể thêm phần về LinkedIn profile sẽ hoàn hảo hơn. Overall rất đáng đầu tư.",
    createdAt: "2024-03-12",
    verified: true,
  },
];

// ── Course 3: DSA Technical ────────────────────────────────────────────────────
const course3Lessons = [
  { id: "3-1", title: "Roadmap phỏng vấn kỹ thuật 2024", duration: 15, order: 1, isPreview: true, content: "Technical interview roadmap and study plan" },
  { id: "3-2", title: "Big-O Notation: Phân tích complexity", duration: 20, order: 2, isPreview: true, content: "Time and space complexity analysis" },
  { id: "3-3", title: "Array & String manipulation", duration: 25, order: 3, isPreview: false, content: "Arrays and string problems with solutions" },
  { id: "3-4", title: "Two Pointers & Sliding Window", duration: 22, order: 4, isPreview: false, content: "Two pointer and sliding window techniques" },
  { id: "3-5", title: "LinkedList: Singly & Doubly", duration: 28, order: 5, isPreview: false, content: "Linked list operations and problems" },
  { id: "3-6", title: "Stack & Queue patterns", duration: 20, order: 6, isPreview: false, content: "Stack and queue problem patterns" },
  { id: "3-7", title: "Tree: BFS & DFS traversal", duration: 30, order: 7, isPreview: false, content: "Tree traversal and related problems" },
  { id: "3-8", title: "Binary Search deep dive", duration: 25, order: 8, isPreview: false, content: "Binary search and its variations" },
  { id: "3-9", title: "Graph: BFS/DFS/Union Find", duration: 35, order: 9, isPreview: false, content: "Graph algorithms and problem patterns" },
  { id: "3-10", title: "Dynamic Programming fundamentals", duration: 40, order: 10, isPreview: false, content: "DP patterns: memoization and tabulation" },
  { id: "3-11", title: "Heap & Priority Queue", duration: 22, order: 11, isPreview: false, content: "Heap operations and applications" },
  { id: "3-12", title: "50 bài LeetCode Easy-Medium đã giải", duration: 60, order: 12, isPreview: false, content: "Walkthrough of 50 essential LeetCode problems" },
  { id: "3-13", title: "Mock Technical Interview session", duration: 45, order: 13, isPreview: false, content: "Full technical interview simulation" },
  { id: "3-14", title: "Chiến lược khi bị stuck trong interview", duration: 18, order: 14, isPreview: false, content: "How to handle being stuck in a technical interview" },
];

const course3Reviews = [
  {
    id: "r3-1",
    mentorId: "5",
    mentorName: "Võ Thị Lan Anh",
    mentorAvatar: "https://images.unsplash.com/photo-1770364020204-102331b625ea?w=200&q=80",
    mentorTitle: "Senior Frontend Engineer @ MoMo",
    rating: 5,
    comment: "Là người thường xuyên phỏng vấn candidates cho các vị trí Backend tại Grab, tôi thấy khóa học này cover đúng và đủ những gì chúng tôi expect. Đặc biệt phần 'Chiến lược khi bị stuck' rất valuable — đây là điểm differentiation giữa ứng viên tốt và ứng viên xuất sắc.",
    createdAt: "2024-03-08",
    verified: true,
  },
  {
    id: "r3-2",
    mentorId: "2",
    mentorName: "Trần Thị Hương",
    mentorAvatar: "https://images.unsplash.com/photo-1736939678218-bd648b5ef3bb?w=200&q=80",
    mentorTitle: "Engineering Manager @ Grab Vietnam",
    rating: 5,
    comment: "Tôi recommend khóa học này cho tất cả ứng viên Technical mà tôi đang support. Nội dung của anh Đức rất practical và có độ khó phù hợp — không quá dễ cũng không làm người học nản lòng. 10/10 sẽ giới thiệu tiếp.",
    createdAt: "2024-03-15",
    verified: true,
  },
];

// ── Course 4: Soft Skills ──────────────────────────────────────────────────────
const course4Lessons = [
  { id: "4-1", title: "Multicultural workplace: Mindset cần có", duration: 15, order: 1, isPreview: true, content: "Mindset for working in multicultural environments" },
  { id: "4-2", title: "Cross-cultural communication fundamentals", duration: 20, order: 2, isPreview: true, content: "Communication across cultures" },
  { id: "4-3", title: "Active Listening & Empathy trong team", duration: 18, order: 3, isPreview: false, content: "Active listening and empathy in teams" },
  { id: "4-4", title: "Feedback culture: Give & Receive như pro", duration: 22, order: 4, isPreview: false, content: "Giving and receiving feedback professionally" },
  { id: "4-5", title: "Conflict resolution: Giải quyết mâu thuẫn", duration: 25, order: 5, isPreview: false, content: "Conflict resolution strategies" },
  { id: "4-6", title: "Presentation skills cho Tech professionals", duration: 28, order: 6, isPreview: false, content: "Technical presentation skills" },
  { id: "4-7", title: "Stakeholder management & Influence", duration: 20, order: 7, isPreview: false, content: "Managing and influencing stakeholders" },
  { id: "4-8", title: "Personal branding trong organization", duration: 22, order: 8, isPreview: false, content: "Building your personal brand internally" },
  { id: "4-9", title: "Leadership: Dẫn dắt không cần chức danh", duration: 30, order: 9, isPreview: false, content: "Leadership without formal authority" },
  { id: "4-10", title: "English communication tips cho non-native", duration: 18, order: 10, isPreview: false, content: "English communication for Vietnamese professionals" },
  { id: "4-11", title: "Remote work: Collaboration hiệu quả", duration: 20, order: 11, isPreview: false, content: "Effective remote collaboration" },
  { id: "4-12", title: "Case study: Từ IC lên Team Lead tại Big Tech", duration: 25, order: 12, isPreview: false, content: "Real case study from IC to Team Lead" },
];

const course4Reviews = [
  {
    id: "r4-1",
    mentorId: "4",
    mentorName: "Phạm Minh Tuấn",
    mentorAvatar: "https://images.unsplash.com/photo-1770363760820-b871452de45f?w=200&q=80",
    mentorTitle: "Staff Engineer @ Tiki",
    rating: 5,
    comment: "Tôi đã coach hàng trăm professionals ở Meta và phải nói rằng phần Soft Skills thường bị underestimate. Khóa học của chị Linh đã packaged đúng những kỹ năng quan trọng nhất. Đặc biệt phần 'Leadership as IC' — đây là key differentiator để lên Senior.",
    createdAt: "2024-03-20",
    verified: true,
  },
  {
    id: "r4-2",
    mentorId: "3",
    mentorName: "Lê Quang Đức",
    mentorAvatar: "https://images.unsplash.com/photo-1766066014773-0074bf4911de?w=200&q=80",
    mentorTitle: "Tech Lead @ VNG Corporation",
    rating: 4,
    comment: "Là một engineer, tôi hay focus vào technical skills mà neglect soft skills. Sau khi review khóa học này của chị Linh, tôi nhận ra mình đã missing rất nhiều. Content về stakeholder management và feedback culture rất applicable trong môi trường Shopee.",
    createdAt: "2024-03-18",
    verified: true,
  },
];

// ── Course 5: System Design ────────────────────────────────────────────────────
const course5Lessons = [
  { id: "5-1", title: "System Design interview: Cấu trúc 45 phút", duration: 18, order: 1, isPreview: true, content: "How to structure your system design interview" },
  { id: "5-2", title: "Scalability 101: Vertical vs Horizontal scaling", duration: 22, order: 2, isPreview: true, content: "Scaling strategies and when to use each" },
  { id: "5-3", title: "Load Balancer & API Gateway", duration: 25, order: 3, isPreview: false, content: "Load balancing strategies and API gateway patterns" },
  { id: "5-4", title: "Caching: Redis, CDN, và các strategies", duration: 28, order: 4, isPreview: false, content: "Caching patterns and when to use them" },
  { id: "5-5", title: "Database: SQL vs NoSQL & Sharding", duration: 30, order: 5, isPreview: false, content: "Database selection and sharding strategies" },
  { id: "5-6", title: "Message Queue: Kafka, RabbitMQ, SQS", duration: 25, order: 6, isPreview: false, content: "Async communication with message queues" },
  { id: "5-7", title: "Microservices vs Monolith: Trade-offs", duration: 22, order: 7, isPreview: false, content: "Architectural trade-offs between microservices and monolith" },
  { id: "5-8", title: "Case: Design URL Shortener (Bitly)", duration: 35, order: 8, isPreview: false, content: "Full system design walkthrough: URL shortener" },
  { id: "5-9", title: "Case: Design Instagram Feed", duration: 40, order: 9, isPreview: false, content: "Full system design: social media feed" },
  { id: "5-10", title: "Case: Design Uber/Grab", duration: 45, order: 10, isPreview: false, content: "Full system design: ride-sharing platform" },
  { id: "5-11", title: "Capacity Estimation & Back-of-envelope", duration: 20, order: 11, isPreview: false, content: "Estimation techniques for system design" },
  { id: "5-12", title: "Mock System Design Interview", duration: 45, order: 12, isPreview: false, content: "Full mock system design interview session" },
];

const course5Reviews = [
  {
    id: "r5-1",
    mentorId: "5",
    mentorName: "Võ Thị Lan Anh",
    mentorAvatar: "https://images.unsplash.com/photo-1770364020204-102331b625ea?w=200&q=80",
    mentorTitle: "Senior Frontend Engineer @ MoMo",
    rating: 5,
    comment: "Ở Grab chúng tôi design systems quy mô hàng triệu users mỗi ngày. Khóa học của anh Đức capture đúng mental model mà chúng tôi expect từ Senior candidates. Case study Uber/Grab đặc biệt realistic — đây là chính xác những gì xảy ra trong vòng phỏng vấn tại Grab.",
    createdAt: "2024-02-28",
    verified: true,
  },
  {
    id: "r5-2",
    mentorId: "1",
    mentorName: "Nguyễn Văn Minh",
    mentorAvatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    mentorTitle: "Senior Software Engineer @ Shopee",
    rating: 5,
    comment: "Dù không phải technical background, tôi đã review khóa học này để hiểu những gì ứng viên Senior Engineer cần biết. Ấn tượng với cách anh Đức breakdown complex topics thành digestible content. Candidates học xong khóa này sẽ significantly outperform trong vòng system design.",
    createdAt: "2024-03-02",
    verified: true,
  },
];

// ── Course 6: Salary Negotiation ───────────────────────────────────────────────
const course6Lessons = [
  { id: "6-1", title: "Mindset: Negotiate là quyền lợi, không phải tham lam", duration: 12, order: 1, isPreview: true, content: "The right mindset for salary negotiation" },
  { id: "6-2", title: "Market Research: Tìm mức lương thực tế", duration: 18, order: 2, isPreview: true, content: "How to research market salary ranges" },
  { id: "6-3", title: "\"Expected Salary\" — trả lời như thế nào?", duration: 20, order: 3, isPreview: false, content: "Answering salary expectation questions strategically" },
  { id: "6-4", title: "5 tactics đàm phán lương proven", duration: 25, order: 4, isPreview: false, content: "5 proven salary negotiation tactics" },
  { id: "6-5", title: "Email & Negotiation script templates", duration: 15, order: 5, isPreview: false, content: "Email templates for salary negotiation" },
  { id: "6-6", title: "Counter-offer: Khi nào và cách làm", duration: 18, order: 6, isPreview: false, content: "How to handle and make counter-offers" },
  { id: "6-7", title: "Tổng compensation package: Không chỉ là lương", duration: 20, order: 7, isPreview: false, content: "Understanding and negotiating total compensation" },
  { id: "6-8", title: "Role play: Tình huống negotiate thực tế", duration: 32, order: 8, isPreview: false, content: "Practice role-playing negotiation scenarios" },
];

const course6Reviews = [
  {
    id: "r6-1",
    mentorId: "1",
    mentorName: "Nguyễn Văn Minh",
    mentorAvatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    mentorTitle: "Senior Software Engineer @ Shopee",
    rating: 5,
    comment: "Góc nhìn từ phía HR: những tactics anh Quân dạy là hoàn toàn hợp lý và effective. Chúng tôi actually prefer ứng viên biết negotiate — điều đó cho thấy họ biết value bản thân. Khóa học này sẽ giúp ứng viên tự tin hơn mà không làm phật lòng HR.",
    createdAt: "2024-03-14",
    verified: true,
  },
  {
    id: "r6-2",
    mentorId: "4",
    mentorName: "Phạm Minh Tuấn",
    mentorAvatar: "https://images.unsplash.com/photo-1770363760820-b871452de45f?w=200&q=80",
    mentorTitle: "Staff Engineer @ Tiki",
    rating: 5,
    comment: "Tôi đã coach nhiều clients tăng lương 20-40% sau khi apply các techniques này. Phần về 'Total Compensation Package' đặc biệt quan trọng — nhiều người chỉ focus vào base salary mà miss stock, bonus, và benefits. Đây là ROI tốt nhất từ bất kỳ khóa học nào.",
    createdAt: "2024-03-16",
    verified: true,
  },
];

// ── Full Course Data ──────────────────────────────────────────────────────────
export const COURSES_DATA = [
  {
    id: "1",
    title: "Làm chủ STAR Method trong phỏng vấn hành vi",
    description: "Học cách trả lời câu hỏi hành vi một cách có cấu trúc và thuyết phục với phương pháp STAR. Khóa học bao gồm 15+ ví dụ thực tế, templates và mock interview practice session với mentor từ Google Vietnam.",
    thumbnail: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    mentorId: "1",
    mentorName: "Nguyễn Văn Minh",
    mentorAvatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    mentorTitle: "Senior Software Engineer",
    mentorCompany: "Shopee",
    category: "Interview Skills",
    level: "Intermediate",
    duration: 220,
    lessonsCount: 12,
    lessons: course1Lessons,
    price: 299000,
    currency: "VND",
    studentsCount: 486,
    rating: 4.8,
    reviewsCount: 89,
    reviews: course1Reviews,
    learningOutcomes: [
      "Hiểu và áp dụng STAR method trong phỏng vấn hành vi",
      "Chuẩn bị 20+ câu trả lời STAR sẵn sàng cho mọi tình huống",
      "Tránh các lỗi phổ biến nhất khi kể chuyện trong phỏng vấn",
      "Thực hành với 15+ case study và nhận feedback cụ thể",
      "Xây dựng library câu chuyện cá nhân để dùng lâu dài",
    ],
    requirements: ["Đã có CV cơ bản", "Đã tham gia ít nhất 1 buổi phỏng vấn"],
    targetAudience: ["Người đi làm 1-3 năm kinh nghiệm", "Người chuyển đổi nghề nghiệp", "Ai muốn target Big Tech"],
    createdAt: "2024-01-15",
    updatedAt: "2024-03-20",
    published: true,
    tags: ["star-method", "behavioral-interview", "interview-skills"],
  },
  {
    id: "2",
    title: "Viết CV tạo ấn tượng với nhà tuyển dụng",
    description: "Từ Zero đến Hero với CV chuyên nghiệp. Học cách highlight thành tích, dùng action verbs hiệu quả và tối ưu ATS để vượt qua vòng lọc tự động. Có 10+ templates CV miễn phí và session review CV cá nhân.",
    thumbnail: "https://images.unsplash.com/photo-1737729991003-521d47240eb3?w=800&q=80",
    mentorId: "2",
    mentorName: "Trần Thị Hương",
    mentorAvatar: "https://images.unsplash.com/photo-1736939678218-bd648b5ef3bb?w=200&q=80",
    mentorTitle: "Engineering Manager",
    mentorCompany: "Grab Vietnam",
    category: "CV Writing",
    level: "Beginner",
    duration: 198,
    lessonsCount: 10,
    lessons: course2Lessons,
    price: 249000,
    currency: "VND",
    studentsCount: 1203,
    rating: 4.9,
    reviewsCount: 234,
    reviews: course2Reviews,
    learningOutcomes: [
      "Viết CV ATS-friendly để vượt qua vòng lọc tự động",
      "Highlight thành tích với con số KPI cụ thể và impactful",
      "Tùy chỉnh CV theo từng JD một cách nhanh chóng (< 20 phút)",
      "Truy cập 10+ templates CV được thiết kế chuyên nghiệp",
      "Nhận feedback trực tiếp từ recruiter về CV của bạn",
    ],
    requirements: ["Không cần kiến thức nền", "Có LinkedIn account (optional)"],
    targetAudience: ["Sinh viên chuẩn bị tốt nghiệp", "Fresh graduate 0-1 năm kinh nghiệm", "Người chưa có CV hoặc CV chưa được cập nhật"],
    createdAt: "2024-02-01",
    updatedAt: "2024-03-25",
    published: true,
    tags: ["cv-writing", "cv-structure", "ats-optimization"],
  },
  {
    id: "3",
    title: "Tech Interview: Data Structures & Algorithms cơ bản",
    description: "Chinh phục phỏng vấn kỹ thuật với kiến thức nền tảng về DSA. Cover Array, LinkedList, Stack, Queue, Tree, Graph với 50+ bài tập LeetCode Easy-Medium được giải thích chi tiết và chiến lược riêng.",
    thumbnail: "https://images.unsplash.com/photo-1738255654134-1877cb984a8f?w=800&q=80",
    mentorId: "3",
    mentorName: "Lê Quang Đức",
    mentorAvatar: "https://images.unsplash.com/photo-1766066014773-0074bf4911de?w=200&q=80",
    mentorTitle: "Tech Lead",
    mentorCompany: "VNG Corporation",
    category: "Technical Skills",
    level: "Intermediate",
    duration: 488,
    lessonsCount: 14,
    lessons: course3Lessons,
    price: 599000,
    currency: "VND",
    studentsCount: 678,
    rating: 4.7,
    reviewsCount: 156,
    reviews: course3Reviews,
    learningOutcomes: [
      "Nắm vững 8 data structures quan trọng nhất trong phỏng vấn",
      "Giải được 80% bài LeetCode Easy-Medium một cách tự tin",
      "Phân tích time/space complexity nhanh chóng và chính xác",
      "Chiến lược giải quyết vấn đề khi bị stuck trong phỏng vấn",
      "Hiểu pattern recognition để apply vào bài mới",
    ],
    requirements: ["Biết 1 ngôn ngữ lập trình (Python/Java/JavaScript/C++)", "Hiểu basic programming (loops, conditions, functions)"],
    targetAudience: ["Developer 0-2 năm kinh nghiệm target FAANG/Top tech", "Người chuyển sang lập trình", "CS graduate chưa có kinh nghiệm phỏng vấn"],
    createdAt: "2024-01-20",
    updatedAt: "2024-03-22",
    published: true,
    tags: ["technical-interview", "data-structures", "algorithms", "coding-interview"],
  },
  {
    id: "4",
    title: "Soft Skills trong môi trường làm việc đa văn hóa",
    description: "Phát triển kỹ năng giao tiếp, làm việc nhóm và leadership trong công ty đa quốc gia. Đặc biệt hữu ích cho những ai làm việc tại Big Tech hoặc Startup quốc tế, muốn lên Senior/Lead.",
    thumbnail: "https://images.unsplash.com/photo-1621533463397-f292bd0745f9?w=800&q=80",
    mentorId: "1",
    mentorName: "Nguyễn Văn Minh",
    mentorAvatar: "https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?w=200&q=80",
    mentorTitle: "Senior Software Engineer",
    mentorCompany: "Shopee",
    category: "Interview Skills",
    level: "Advanced",
    duration: 283,
    lessonsCount: 12,
    lessons: course4Lessons,
    price: 399000,
    currency: "VND",
    studentsCount: 312,
    rating: 4.9,
    reviewsCount: 67,
    reviews: course4Reviews,
    learningOutcomes: [
      "Giao tiếp tự tin và hiệu quả với đồng nghiệp quốc tế",
      "Xử lý conflict và feedback theo phong cách chuyên nghiệp",
      "Build personal brand trong tổ chức một cách tự nhiên",
      "Develop leadership mindset từ vị trí IC",
      "Remote work collaboration hiệu quả với team global",
    ],
    requirements: ["Có ít nhất 1 năm kinh nghiệm làm việc", "English giao tiếp cơ bản (B1+)"],
    targetAudience: ["IC muốn lên Senior/Lead", "Người làm trong môi trường đa văn hóa", "Ai target Big Tech hoặc Startup quốc tế"],
    createdAt: "2024-02-10",
    updatedAt: "2024-03-18",
    published: true,
    tags: ["soft-skills", "communication", "leadership", "workplace"],
  },
  {
    id: "5",
    title: "System Design Interview cho Senior Engineer",
    description: "Học cách thiết kế hệ thống phân tán scalable từ con số không. Cover từ Load Balancer, Caching, Database sharding đến Microservices với 10+ real case studies từ các hệ thống như Uber, Instagram, YouTube.",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    mentorId: "3",
    mentorName: "Lê Quang Đức",
    mentorAvatar: "https://images.unsplash.com/photo-1766066014773-0074bf4911de?w=200&q=80",
    mentorTitle: "Tech Lead",
    mentorCompany: "VNG Corporation",
    category: "Technical Skills",
    level: "Advanced",
    duration: 375,
    lessonsCount: 12,
    lessons: course5Lessons,
    price: 799000,
    currency: "VND",
    studentsCount: 234,
    rating: 4.8,
    reviewsCount: 52,
    reviews: course5Reviews,
    learningOutcomes: [
      "Thiết kế được hệ thống quy mô hàng triệu users như Uber, Instagram, YouTube",
      "Trade-off analysis giữa các kiến trúc khác nhau một cách confident",
      "Ước lượng capacity và performance với back-of-envelope calculation",
      "Ace system design round trong Big Tech interview (FAANG level)",
      "Hiểu sâu về distributed systems concepts",
    ],
    requirements: ["3+ năm kinh nghiệm backend/fullstack", "Hiểu database, REST API, networking cơ bản", "Đã giải được LeetCode Medium regularly"],
    targetAudience: ["Senior engineer chuẩn bị phỏng vấn Big Tech", "Tech lead muốn nâng cấp architectural thinking", "Backend developer target Staff/Principal level"],
    createdAt: "2024-02-15",
    updatedAt: "2024-03-21",
    published: true,
    tags: ["system-design", "technical-interview", "architecture", "scalability"],
  },
  {
    id: "6",
    title: "Salary Negotiation: Đàm phán lương hiệu quả",
    description: "Học cách đàm phán lương thông minh để tối đa hóa thu nhập. Cover market research, timing, tactics và real negotiation role-play scenarios từ mentor recruiter 10+ năm kinh nghiệm tại các công ty Fortune 500.",
    thumbnail: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    mentorId: "2",
    mentorName: "Trần Thị Hương",
    mentorAvatar: "https://images.unsplash.com/photo-1736939678218-bd648b5ef3bb?w=200&q=80",
    mentorTitle: "Engineering Manager",
    mentorCompany: "Grab Vietnam",
    category: "Interview Skills",
    level: "Intermediate",
    duration: 160,
    lessonsCount: 8,
    lessons: course6Lessons,
    price: 199000,
    currency: "VND",
    studentsCount: 892,
    rating: 4.9,
    reviewsCount: 178,
    reviews: course6Reviews,
    learningOutcomes: [
      "Research mức lương market-rate chính xác cho vị trí và seniority của bạn",
      "Áp dụng 5+ tactics đàm phán lương đã được proven hiệu quả",
      "Xử lý tất cả các câu hỏi khó về expected salary một cách tự tin",
      "Tăng 20-40% mức lương offer thông qua negotiation đúng cách",
      "Negotiate được toàn bộ compensation package (lương + bonus + stock)",
    ],
    requirements: ["Đang trong quá trình tìm việc hoặc vừa nhận offer"],
    targetAudience: ["Người chuẩn bị chuyển việc", "Fresh grad nhận offer đầu tiên", "Người chưa bao giờ negotiate lương"],
    createdAt: "2024-01-25",
    updatedAt: "2024-03-19",
    published: true,
    tags: ["salary-negotiation", "interview-skills", "career-development"],
  },
];

// Helper: get course by ID
export function getCourseById(id) {
  return COURSES_DATA.find((c) => c.id === id);
}

// Helper: get courses by mentor
export function getCoursesByMentor(mentorId) {
  return COURSES_DATA.filter((c) => c.mentorId === mentorId);
}

// Helper: get related courses (same category, exclude current)
export function getRelatedCourses(courseId, category, limit = 3) {
  return COURSES_DATA.filter((c) => c.id !== courseId && c.category === category).slice(0, limit);
}

// Helper: get recommended courses based on tags/issues
export function getRecommendedCourses(tags, limit = 3) {
  const scored = COURSES_DATA.map((course) => ({
    course,
    score: course.tags.filter((t) => tags.includes(t)).length,
  }));
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.course);
}