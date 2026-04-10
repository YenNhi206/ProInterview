// ═════════════════════════════════════════════════════════════════
// MOCK DATA FOR MENTOR DASHBOARD
// Bao gồm: lịch họp (meetings), phân tích (analytics), STAR grading
// ═════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════
// FINANCE & EARNINGS SYSTEM
// ═════════════════════════════════════════════════════════════════

export const PLATFORM_COMMISSION_RATE = 20; // Platform lấy 20%, mentor nhận 80%
export const WITHDRAWAL_FEE = 0; // Phí rút tiền (miễn phí)
export const MIN_WITHDRAWAL_AMOUNT = 100000; // Tối thiểu 100k để rút
export const SETTLEMENT_DAYS = 7; // Chờ 7 ngày sau khi hoàn thành buổi học

// ═════════════════════════════════════════════════════════════════
// MENTEES
// ═════════════════════════════════════════════════════════════════

export const MENTEES = [
  {
    id: "mentee-1",
    name: "Nguyễn Tuấn Anh",
    email: "tuananh@example.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    position: "Frontend Developer",
    company: "Shopee",
    level: "Junior",
  },
  {
    id: "mentee-2",
    name: "Trần Minh Châu",
    email: "minhchau@example.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    position: "Product Manager",
    company: "Grab",
    level: "Mid",
  },
  {
    id: "mentee-3",
    name: "Lê Quang Huy",
    email: "quanghuy@example.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    position: "Backend Engineer",
    company: "Tiki",
    level: "Fresher",
  },
  {
    id: "mentee-4",
    name: "Phạm Thị Mai",
    email: "thimai@example.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    position: "Marketing Manager",
    company: "Unilever",
    level: "Senior",
  },
  {
    id: "mentee-5",
    name: "Hoàng Văn Đức",
    email: "vanduc@example.com",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    position: "Data Analyst",
    company: "VNG",
    level: "Junior",
  },
  {
    id: "mentee-6",
    name: "Vũ Thị Lan",
    email: "thilan@example.com",
    avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop",
    position: "UX Designer",
    company: "MoMo",
    level: "Mid",
  },
  {
    id: "mentee-7",
    name: "Đặng Minh Tuấn",
    email: "minhtuan@example.com",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    position: "Full Stack Developer",
    company: "FPT Software",
    level: "Mid",
  },
  {
    id: "mentee-8",
    name: "Bùi Thu Hà",
    email: "thuha@example.com",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    position: "HR Specialist",
    company: "Vingroup",
    level: "Fresher",
  },
];

// ═════════════════════════════════════════════════════════════════
// UPCOMING MEETINGS (Lịch họp sắp tới)
// ═════════════════════════════════════════════════════════════════

export const UPCOMING_MENTOR_MEETINGS = [
  {
    id: "meeting-upcoming-1",
    mentee: MENTEES[0], // Nguyễn Tuấn Anh
    scheduledDate: "2026-03-18", // Today
    scheduledTime: "16:00",
    duration: 60,
    status: "upcoming",
    joinCode: "847291",
    meetingType: "mock-interview",
    position: "Frontend Developer",
    company: "Shopee",
    cvFile: "Nguyen_Tuan_Anh_CV.pdf",
    jdFile: "Shopee_Frontend_JD.pdf",
  },
  {
    id: "meeting-upcoming-2",
    mentee: MENTEES[1], // Trần Minh Châu
    scheduledDate: "2026-03-19",
    scheduledTime: "10:00",
    duration: 60,
    status: "upcoming",
    joinCode: "523614",
    meetingType: "mock-interview",
    position: "Product Manager",
    company: "Grab",
    cvFile: "Tran_Minh_Chau_CV.pdf",
    jdFile: "Grab_PM_JD.pdf",
  },
  {
    id: "meeting-upcoming-3",
    mentee: MENTEES[2], // Lê Quang Huy
    scheduledDate: "2026-03-20",
    scheduledTime: "14:30",
    duration: 60,
    status: "upcoming",
    joinCode: "781429",
    meetingType: "cv-review",
    position: "Backend Engineer",
    company: "Tiki",
    cvFile: "Le_Quang_Huy_CV.pdf",
  },
  {
    id: "meeting-upcoming-4",
    mentee: MENTEES[4], // Hoàng Văn Đức
    scheduledDate: "2026-03-21",
    scheduledTime: "09:00",
    duration: 60,
    status: "upcoming",
    joinCode: "904521",
    meetingType: "mock-interview",
    position: "Data Analyst",
    company: "VNG",
    cvFile: "Hoang_Van_Duc_CV.pdf",
    jdFile: "VNG_DataAnalyst_JD.pdf",
  },
  {
    id: "meeting-upcoming-5",
    mentee: MENTEES[5], // Vũ Thị Lan
    scheduledDate: "2026-03-22",
    scheduledTime: "15:00",
    duration: 60,
    status: "upcoming",
    joinCode: "621847",
    meetingType: "career-coaching",
    position: "UX Designer",
    company: "MoMo",
    cvFile: "Vu_Thi_Lan_CV.pdf",
  },
];

// ═════════════════════════════════════════════════════════════════
// COMPLETED MEETINGS (Lịch sử đã hoàn thành)
// ═════════════════════════════════════════════════════════════════

export const COMPLETED_MENTOR_MEETINGS = [
  {
    id: "meeting-completed-1",
    mentee: MENTEES[0], // Nguyễn Tuấn Anh
    scheduledDate: "2026-03-15",
    scheduledTime: "14:00",
    duration: 60,
    status: "completed",
    joinCode: "392847",
    meetingType: "mock-interview",
    position: "Frontend Developer",
    company: "Shopee",
    cvFile: "Nguyen_Tuan_Anh_CV.pdf",
    jdFile: "Shopee_Frontend_JD.pdf",
    starScores: {
      situation: 4.0,
      task: 3.5,
      action: 4.5,
      result: 3.0,
    },
    overallScore: 3.75,
    feedback: "Tuấn Anh trả lời tốt phần Situation và Action, nhưng cần cải thiện cách trình bày Result. Kỹ thuật STAR đã tốt hơn so với buổi trước. Tiếp tục tập luyện thêm về định lượng kết quả (metrics, numbers).",
    strengths: [
      "Trình bày Situation rõ ràng, có context đầy đủ về dự án",
      "Action steps chi tiết, thể hiện ownership và problem-solving",
      "Thái độ tự tin, giao tiếp mắt tốt qua camera",
    ],
    improvements: [
      "Result thiếu số liệu cụ thể (%, KPI, impact)",
      "Câu trả lời Task có thể ngắn gọn hơn, tránh lặp lại Situation",
      "Cần chuẩn bị sẵn 2-3 câu chuyện STAR backup để linh hoạt",
    ],
    notes: "Đề xuất: Luyện thêm 3 câu chuyện STAR về teamwork, conflict resolution, và technical challenge. Buổi sau sẽ focus vào behavioral questions của Shopee.",
    menteeReview: {
      rating: 5,
      comment: "Thầy rất nhiệt tình và chuyên nghiệp Feedback cụ thể từng phần giúp em hiểu rõ điểm yếu của mình. Sau buổi này em tự tin hơn rất nhiều. Cảm ơn thầy đã dành thời gian và kiên nhẫn hướng dẫn em về STAR framework.",
      strengths: [
        "Feedback chi tiết, có ví dụ cụ thể cho từng phần S-T-A-R",
        "Tạo môi trường thoải mái để em dám nói và thử nghiệm",
        "Share kinh nghiệm thực tế từ vòng interview ở Shopee rất hữu ích",
      ],
      improvements: [
        "Có thể thêm một số bài tập thực hành để em làm homework",
      ],
      wouldRecommend: true,
      reviewDate: "2026-03-15T18:30:00Z",
      isPublic: true,
    },
  },
  {
    id: "meeting-completed-2",
    mentee: MENTEES[1], // Trần Minh Châu
    scheduledDate: "2026-03-12",
    scheduledTime: "10:00",
    duration: 60,
    status: "completed",
    joinCode: "184729",
    meetingType: "mock-interview",
    position: "Product Manager",
    company: "Grab",
    cvFile: "Tran_Minh_Chau_CV.pdf",
    jdFile: "Grab_PM_JD.pdf",
    starScores: {
      situation: 4.5,
      task: 4.5,
      action: 4.0,
      result: 4.5,
    },
    overallScore: 4.38,
    feedback: "Xuất sắc Minh Châu đã áp dụng STAR rất tốt. Câu trả lời c cấu trúc, dễ theo dõi và đầy đủ thông tin. Result phần được định lượng rõ ràng với metrics. Sẵn sàng cho vòng phỏng vấn thật với Grab.",
    strengths: [
      "Cấu trúc STAR hoàn chỉnh, mạch lạc từ S → T → A → R",
      "Result có số liệu cụ thể: 30% tăng conversion, 50K users",
      "Communication skills tuyệt vời, trả lời súc tích và tự tin",
      "Cho thấy product thinking mạnh qua cách phân tích problem",
    ],
    improvements: [
      "Có thể thêm 'lesson learned' vào cuối mỗi câu trả lời STAR",
      "Khi bị follow-up question, hãy pause 2-3s để organize thought",
    ],
    notes: "Top performer Khuyến nghị apply ngay cho Grab PM role. Có thể tham khảo case study về Grab business model để chuẩn bị thêm.",
    menteeReview: {
      rating: 5,
      comment: "Mentor giỏi nhất mà em từng học Mỗi buổi đều học được điều mới, từ STAR framework đến product thinking. Feedback cực kỳ chi tiết và actionable. Em cảm ơn thầy rất nhiều vì đã giúp em tự tin apply vào Grab!",
      strengths: [
        "Kiến thức sâu về PM role và product frameworks",
        "Feedback rất cụ thể và practical, không generic",
        "Khích lệ và motivate em rất tốt",
        "Share insider tips về Grab interview process",
      ],
      improvements: [],
      wouldRecommend: true,
      reviewDate: "2026-03-12T12:30:00Z",
      isPublic: true,
    },
  },
  {
    id: "meeting-completed-3",
    mentee: MENTEES[2], // Lê Quang Huy
    scheduledDate: "2026-03-10",
    scheduledTime: "14:00",
    duration: 60,
    status: "completed",
    joinCode: "627384",
    meetingType: "mock-interview",
    position: "Backend Engineer",
    company: "Tiki",
    cvFile: "Le_Quang_Huy_CV.pdf",
    jdFile: "Tiki_Backend_JD.pdf",
    starScores: {
      situation: 3.0,
      task: 2.5,
      action: 3.5,
      result: 2.0,
    },
    overallScore: 2.75,
    feedback: "Quang Huy có nền tảng kỹ thuật tốt nhưng chưa thành thạo STAR framework. Phần Situation và Task bị lẫn lộn, Result thiếu numbers. Cần luyện tập thêm 5-7 buổi để cải thiện rõ rệt.",
    strengths: [
      "Hiểu biết kỹ thuật sâu về backend (Node.js, PostgreSQL, Redis)",
      "Thái độ học hỏi, tiếp thu feedback tốt",
    ],
    improvements: [
      "Tách bạch Situation và Task — đừng lặp lại thông tin",
      "Action cần chi tiết hơn: bạn đã làm GÌ cụ thể, BẰNG CÁCH NÀO",
      "Result phải có số liệu — latency giảm bao nhiêu? throughput tăng bao nhiêu?",
      "Tránh dùng thuật ngữ kỹ thuật quá sâu khi interviewer là HR",
    ],
    notes: "Homework: Viết ra 5 câu chuyện STAR về technical challenges và send qua email để review trước buổi sau.",
  },
  {
    id: "meeting-completed-4",
    mentee: MENTEES[3], // Phạm Thị Mai
    scheduledDate: "2026-03-08",
    scheduledTime: "09:30",
    duration: 60,
    status: "completed",
    joinCode: "847291",
    meetingType: "mock-interview",
    position: "Marketing Manager",
    company: "Unilever",
    cvFile: "Pham_Thi_Mai_CV.pdf",
    jdFile: "Unilever_Marketing_JD.pdf",
    starScores: {
      situation: 5.0,
      task: 4.5,
      action: 5.0,
      result: 5.0,
    },
    overallScore: 4.88,
    feedback: "Perfect STAR execution Mai đã master được framework và trả lời như một senior marketer thực thụ. Mỗi câu trả lời đều có story, data, và impact. Sẵn sàng cho bất kỳ vòng phỏng vấn nào.",
    strengths: [
      "STAR framework hoàn hảo, storytelling hấp dẫn",
      "Result đầy đủ metrics: ROI, conversion rate, brand awareness",
      "Thể hiện leadership và strategic thinking xuất sắc",
      "Confidence level cao, body language chuyên nghiệp",
    ],
    improvements: [
      "Có thể prepare thêm câu chuyện về failure/setback để đa dạng",
    ],
    notes: "Mai đã ready 100% cho Unilever. Recommend focus vào prepare culture fit questions và case study về FMCG market trends.",
  },
  {
    id: "meeting-completed-5",
    mentee: MENTEES[4], // Hoàng Văn Đức
    scheduledDate: "2026-03-05",
    scheduledTime: "15:00",
    duration: 60,
    status: "completed",
    joinCode: "529148",
    meetingType: "cv-review",
    position: "Data Analyst",
    company: "VNG",
    cvFile: "Hoang_Van_Duc_CV.pdf",
    starScores: {
      situation: 3.5,
      task: 3.0,
      action: 3.5,
      result: 3.0,
    },
    overallScore: 3.25,
    feedback: "CV của Đức khá tốt, nhưng phần mô tả kinh nghiệm chưa theo STAR. Đã suggest rewrite toàn bộ phần Experience theo format S.T.A.R để tăng tỷ lệ qua ATS và gây ấn tượng với HR.",
    strengths: [
      "Có technical skills phù hợp: SQL, Python, Tableau",
      "Projects thực tế liên quan đến data analysis",
    ],
    improvements: [
      "Rewrite CV theo STAR format cho mỗi bullet point",
      "Thêm metrics vào mọi achievement (%, numbers, scale)",
      "Highlight business impact, không chỉ technical tasks",
    ],
    notes: "Đã gửi template CV theo STAR format. Đức sẽ revise và gửi lại để review vào tuần sau.",
  },
  {
    id: "meeting-completed-6",
    mentee: MENTEES[5], // Vũ Thị Lan
    scheduledDate: "2026-03-03",
    scheduledTime: "11:00",
    duration: 60,
    status: "completed",
    joinCode: "392018",
    meetingType: "mock-interview",
    position: "UX Designer",
    company: "MoMo",
    cvFile: "Vu_Thi_Lan_CV.pdf",
    jdFile: "MoMo_UXDesigner_JD.pdf",
    starScores: {
      situation: 4.0,
      task: 4.0,
      action: 4.5,
      result: 3.5,
    },
    overallScore: 4.0,
    feedback: "Lan trả lời tốt về design process và user research. STAR structure ổn, nhưng Result cần thêm user metrics (adoption rate, satisfaction score, A/B test results).",
    strengths: [
      "Action phần rất chi tiết về design process và iterations",
      "Thể hiện user-centric mindset và empathy tốt",
      "Portfolio showcase trong câu trả lời rất impressive",
    ],
    improvements: [
      "Result cần quantify user impact — adoption rate, NPS, usage metrics",
      "Thêm business metrics vào Result để show design ROI",
      "Practice thêm câu hỏi về collaboration với PM/Dev",
    ],
    notes: "Suggest Lan prepare case study về fintech UX (relevant cho MoMo). Next session sẽ focus vào design critique và portfolio presentation.",
  },
  {
    id: "meeting-completed-7",
    mentee: MENTEES[6], // Đặng Minh Tuấn
    scheduledDate: "2026-02-28",
    scheduledTime: "16:30",
    duration: 60,
    status: "completed",
    joinCode: "748291",
    meetingType: "mock-interview",
    position: "Full Stack Developer",
    company: "FPT Software",
    cvFile: "Dang_Minh_Tuan_CV.pdf",
    jdFile: "FPT_FullStack_JD.pdf",
    starScores: {
      situation: 3.5,
      task: 3.5,
      action: 4.0,
      result: 2.5,
    },
    overallScore: 3.38,
    feedback: "Tuấn có technical skills mạnh nhưng communication cần improve. STAR structure còn lỏng lẻo, đặc biệt phần Result rất yếu (không có metrics). Cần luyện thêm storytelling.",
    strengths: [
      "Technical knowledge vững về cả frontend và backend",
      "Action steps thể hiện problem-solving tốt",
    ],
    improvements: [
      "Result PHẢI CÓ SỐ LIỆU — performance improvement %, user growth, etc.",
      "Situation quá dài, nên rút gọn lại 30-40% để focus vào A và R",
      "Tránh dive quá sâu vào technical details, giữ high-level cho HR round",
      "Practice speaking slower và pause để organize thoughts",
    ],
    notes: "Recommend Tuấn record lại câu trả lời và tự review để improve delivery. Next session focus vào behavioral questions.",
  },
  {
    id: "meeting-completed-8",
    mentee: MENTEES[7], // Bùi Thu Hà
    scheduledDate: "2026-02-25",
    scheduledTime: "10:00",
    duration: 60,
    status: "completed",
    joinCode: "621093",
    meetingType: "mock-interview",
    position: "HR Specialist",
    company: "Vingroup",
    cvFile: "Bui_Thu_Ha_CV.pdf",
    jdFile: "Vingroup_HR_JD.pdf",
    starScores: {
      situation: 4.5,
      task: 4.0,
      action: 4.0,
      result: 4.0,
    },
    overallScore: 4.13,
    feedback: "Thu Hà có STAR structure rất tốt và communication skills ấn tượng. Câu trả lời có empathy và professionalism. Chỉ cần refine một chút về metrics trong HR context là perfect.",
    strengths: [
      "STAR storytelling tự nhiên, không bị mechanical",
      "Thể hiện HR mindset: people-first, empathy, problem-solving",
      "Communication rõ ràng, confident nhưng không aggressive",
    ],
    improvements: [
      "Thêm HR metrics vào Result: time-to-hire, retention rate, employee satisfaction",
      "Có thể mention tools/systems used (ATS, HRIS) trong Action",
    ],
    notes: "Thu Hà rất sẵn sàng cho Vingroup HR role. Suggest prepare thêm về culture fit questions và Vingroup's values.",
  },
  {
    id: "meeting-completed-9",
    mentee: MENTEES[0], // Nguyễn Tuấn Anh (buổi trước)
    scheduledDate: "2026-02-20",
    scheduledTime: "14:00",
    duration: 60,
    status: "completed",
    joinCode: "384921",
    meetingType: "mock-interview",
    position: "Frontend Developer",
    company: "Shopee",
    cvFile: "Nguyen_Tuan_Anh_CV.pdf",
    starScores: {
      situation: 3.0,
      task: 2.5,
      action: 3.5,
      result: 2.0,
    },
    overallScore: 2.75,
    feedback: "Buổi đầu tiên của Tuấn Anh — chưa quen với STAR framework. Đã hướng dẫn chi tiết cách structure câu trả lời và assign homework viết 5 STAR stories.",
    strengths: [
      "Technical skills tốt, có project experience thực tế",
      "Thái độ học hỏi và receptive to feedback",
    ],
    improvements: [
      "Học và practice STAR framework từ cơ bản",
      "Result cần có số liệu định lượng",
      "Tránh rambling — keep answers concise và structured",
    ],
    notes: "First timer. Đã assign STAR template và 5 homework stories. Next session sẽ review homework.",
  },
  {
    id: "meeting-completed-10",
    mentee: MENTEES[1], // Trần Minh Châu (buổi trước)
    scheduledDate: "2026-02-18",
    scheduledTime: "10:00",
    duration: 60,
    status: "completed",
    joinCode: "729384",
    meetingType: "career-coaching",
    position: "Product Manager",
    company: "Grab",
    cvFile: "Tran_Minh_Chau_CV.pdf",
    starScores: {
      situation: 4.0,
      task: 4.0,
      action: 3.5,
      result: 4.0,
    },
    overallScore: 3.88,
    feedback: "Session focus vào career transition từ Business Analyst sang PM. Đã coach về PM mindset và cách reframe experiences theo product lens.",
    strengths: [
      "Analytical thinking mạnh từ BA background",
      "Đã có exposure về product metrics và user research",
    ],
    improvements: [
      "Practice product case studies (design a feature, improve a product)",
      "Học product frameworks: AARRR, Jobs-to-be-Done, etc.",
    ],
    notes: "Coaching session. Recommend đọc 'Cracking the PM Interview' và practice case studies trước khi apply.",
  },
];

// ═════════════════════════════════════════════════════════════════
// ANALYTICS DATA (Phân tích)
// ═════════════════════════════════════════════════════════════════

export const MENTEE_ANALYTICS = [
  {
    menteeId: "mentee-1",
    menteeName: "Nguyễn Tuấn Anh",
    menteeAvatar: MENTEES[0].avatar,
    totalSessions: 2,
    avgStarScore: 3.25, // (2.75 + 3.75) / 2
    progressTrend: "improving",
    starHistory: [
      {
        date: "2026-02-20",
        situation: 3.0,
        task: 2.5,
        action: 3.5,
        result: 2.0,
        overall: 2.75,
      },
      {
        date: "2026-03-15",
        situation: 4.0,
        task: 3.5,
        action: 4.5,
        result: 3.0,
        overall: 3.75,
      },
    ],
    strengths: [
      "Cải thiện nhanh từ 2.75 → 3.75 chỉ sau 3 tuần",
      "Action scores luôn cao (3.5 → 4.5)",
      "Receptive to feedback, làm homework đầy đủ",
    ],
    weaknesses: [
      "Result vẫn là điểm yếu lớn nhất (2.0 → 3.0)",
      "Thiếu metrics và quantification",
      "Cần luyện thêm về storytelling",
    ],
    lastSessionDate: "2026-03-15",
  },
  {
    menteeId: "mentee-2",
    menteeName: "Trần Minh Châu",
    menteeAvatar: MENTEES[1].avatar,
    totalSessions: 2,
    avgStarScore: 4.13, // (3.88 + 4.38) / 2
    progressTrend: "improving",
    starHistory: [
      {
        date: "2026-02-18",
        situation: 4.0,
        task: 4.0,
        action: 3.5,
        result: 4.0,
        overall: 3.88,
      },
      {
        date: "2026-03-12",
        situation: 4.5,
        task: 4.5,
        action: 4.0,
        result: 4.5,
        overall: 4.38,
      },
    ],
    strengths: [
      "Top performer — đạt 4.38/5 trong buổi cuối",
      "STAR framework mastery, storytelling tuyệt vời",
      "Communication skills và confidence xuất sắc",
    ],
    weaknesses: [
      "Đã rất tốt, chỉ cần maintain và practice thêm edge cases",
    ],
    lastSessionDate: "2026-03-12",
  },
  {
    menteeId: "mentee-3",
    menteeName: "Lê Quang Huy",
    menteeAvatar: MENTEES[2].avatar,
    totalSessions: 1,
    avgStarScore: 2.75,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-03-10",
        situation: 3.0,
        task: 2.5,
        action: 3.5,
        result: 2.0,
        overall: 2.75,
      },
    ],
    strengths: [
      "Technical knowledge rất tốt",
      "Thái độ học hỏi tích cực",
    ],
    weaknesses: [
      "STAR framework còn yếu — cần luyện nhiều hơn",
      "Result không có số liệu, thiếu impact",
      "Situation và Task bị overlap",
    ],
    lastSessionDate: "2026-03-10",
  },
  {
    menteeId: "mentee-4",
    menteeName: "Phạm Thị Mai",
    menteeAvatar: MENTEES[3].avatar,
    totalSessions: 1,
    avgStarScore: 4.88,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-03-08",
        situation: 5.0,
        task: 4.5,
        action: 5.0,
        result: 5.0,
        overall: 4.88,
      },
    ],
    strengths: [
      "Perfect STAR execution — top score 4.88/5",
      "Metrics và storytelling xuất sắc",
      "Leadership và strategic thinking ấn tượng",
    ],
    weaknesses: [
      "Không có điểm yếu đáng kể — đã ready cho interview",
    ],
    lastSessionDate: "2026-03-08",
  },
  {
    menteeId: "mentee-5",
    menteeName: "Hoàng Văn Đức",
    menteeAvatar: MENTEES[4].avatar,
    totalSessions: 1,
    avgStarScore: 3.25,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-03-05",
        situation: 3.5,
        task: 3.0,
        action: 3.5,
        result: 3.0,
        overall: 3.25,
      },
    ],
    strengths: [
      "CV có technical skills phù hợp",
      "Projects có potential để viết thành STAR stories",
    ],
    weaknesses: [
      "CV chưa theo STAR format",
      "Thiếu metrics trong mọi achievement",
      "Business impact chưa được highlight",
    ],
    lastSessionDate: "2026-03-05",
  },
  {
    menteeId: "mentee-6",
    menteeName: "Vũ Thị Lan",
    menteeAvatar: MENTEES[5].avatar,
    totalSessions: 1,
    avgStarScore: 4.0,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-03-03",
        situation: 4.0,
        task: 4.0,
        action: 4.5,
        result: 3.5,
        overall: 4.0,
      },
    ],
    strengths: [
      "Design process và Action phần rất chi tiết",
      "User-centric mindset tốt",
      "Portfolio showcase impressive",
    ],
    weaknesses: [
      "Result cần thêm user metrics (adoption, NPS, A/B test)",
      "Business ROI của design chưa được quantify",
    ],
    lastSessionDate: "2026-03-03",
  },
  {
    menteeId: "mentee-7",
    menteeName: "Đặng Minh Tuấn",
    menteeAvatar: MENTEES[6].avatar,
    totalSessions: 1,
    avgStarScore: 3.38,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-02-28",
        situation: 3.5,
        task: 3.5,
        action: 4.0,
        result: 2.5,
        overall: 3.38,
      },
    ],
    strengths: [
      "Full-stack technical skills vững",
      "Problem-solving approach tốt",
    ],
    weaknesses: [
      "Communication và storytelling cần improve",
      "Result không có metrics",
      "Situation quá dài và wordy",
    ],
    lastSessionDate: "2026-02-28",
  },
  {
    menteeId: "mentee-8",
    menteeName: "Bùi Thu Hà",
    menteeAvatar: MENTEES[7].avatar,
    totalSessions: 1,
    avgStarScore: 4.13,
    progressTrend: "stable",
    starHistory: [
      {
        date: "2026-02-25",
        situation: 4.5,
        task: 4.0,
        action: 4.0,
        result: 4.0,
        overall: 4.13,
      },
    ],
    strengths: [
      "STAR storytelling tự nhiên, không mechanical",
      "HR mindset và empathy xuất sắc",
      "Communication professional và confident",
    ],
    weaknesses: [
      "Có thể thêm HR-specific metrics vào Result",
    ],
    lastSessionDate: "2026-02-25",
  },
];

// ═════════════════════════════════════════════════════════════════
// WEEKLY STATS (for chart/overview)
// ═════════════════════════════════════════════════════════════════

export const WEEKLY_STATS = [
  {
    week: "Tuần 1 T2",
    totalMeetings: 2,
    avgStarScore: 3.44, // (4.13 + 2.75) / 2
    topStrength: "Communication",
    topWeakness: "Result quantification",
  },
  {
    week: "Tuần 2 T2",
    totalMeetings: 3,
    avgStarScore: 3.67, // (3.38 + 3.88 + 3.75 estimate)
    topStrength: "Action clarity",
    topWeakness: "STAR structure",
  },
  {
    week: "Tuần 3 T2",
    totalMeetings: 2,
    avgStarScore: 3.69, // (3.25 + 4.13 estimate)
    topStrength: "Technical depth",
    topWeakness: "Metrics in Result",
  },
  {
    week: "Tuần 1 T3",
    totalMeetings: 3,
    avgStarScore: 4.0,
    topStrength: "STAR framework",
    topWeakness: "Storytelling speed",
  },
  {
    week: "Tuần 2 T3",
    totalMeetings: 4,
    avgStarScore: 3.95,
    topStrength: "Result metrics",
    topWeakness: "Situation brevity",
  },
  {
    week: "Tuần 3 T3",
    totalMeetings: 3,
    avgStarScore: 4.1,
    topStrength: "Overall STAR execution",
    topWeakness: "Follow-up answers",
  },
];

// ═════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY STATS
// ═════════════════════════════════════════════════════════════════

export const MENTOR_DASHBOARD_STATS = {
  totalSessions: COMPLETED_MENTOR_MEETINGS.length,
  upcomingMeetings: UPCOMING_MENTOR_MEETINGS.length,
  avgStarScore: 3.72, // Average of all completed meetings
  totalMentees: MENTEE_ANALYTICS.length,
  totalEarnings: COMPLETED_MENTOR_MEETINGS.length * 500000, // 500k per session
  thisMonthSessions: 8,
  thisMonthEarnings: 8 * 500000,
  avgRating: 4.9,
  totalReviews: 127,
};

// ═════════════════════════════════════════════════════════════════
// FINANCIAL DATA (Thu nhập & Giao dịch)
// ═════════════════════════════════════════════════════════════════

const SESSION_PRICES = {
  "mock-interview": 500000,
  "cv-review": 300000,
  "career-coaching": 400000,
};

// Generate earnings từ completed meetings
export const EARNINGS_TRANSACTIONS = COMPLETED_MENTOR_MEETINGS.map((meeting) => {
  const sessionPrice = SESSION_PRICES[meeting.meetingType];
  const platformFeeAmount = Math.round(sessionPrice * (PLATFORM_COMMISSION_RATE / 100));
  const mentorEarnings = sessionPrice - platformFeeAmount;
  
  const completedDate = new Date(meeting.scheduledDate);
  const availableDate = new Date(completedDate);
  availableDate.setDate(availableDate.getDate() + SETTLEMENT_DAYS);
  
  const now = new Date("2026-03-21"); // Current date in mock context
  let status = "available";
  
  if (availableDate > now) {
    status = "pending";
  } else if (Math.random() > 0.6) { // 40% đã rút
    status = "withdrawn";
  }
  
  return {
    id: `earning-${meeting.id}`,
    meetingId: meeting.id,
    menteeName: meeting.mentee.name,
    meetingType: meeting.meetingType,
    completedDate: meeting.scheduledDate,
    sessionPrice,
    platformFee: PLATFORM_COMMISSION_RATE,
    platformFeeAmount,
    mentorEarnings,
    status,
    availableDate: availableDate.toISOString().split('T')[0],
  };
});

export const WITHDRAWAL_HISTORY = [
  {
    id: "withdraw-1",
    requestDate: "2026-03-15T10:30:00Z",
    amount: 1600000, // 4 buổi đã rút
    status: "completed",
    bankName: "Techcombank",
    bankAccount: "19036******789",
    accountHolder: "NGUYEN VAN MENTOR",
    processedDate: "2026-03-16T14:20:00Z",
    notes: "Thanh toán thành công",
    transactionFee: WITHDRAWAL_FEE,
    netAmount: 1600000,
  },
  {
    id: "withdraw-2",
    requestDate: "2026-03-01T09:15:00Z",
    amount: 2000000,
    status: "completed",
    bankName: "Techcombank",
    bankAccount: "19036******789",
    accountHolder: "NGUYEN VAN MENTOR",
    processedDate: "2026-03-02T11:45:00Z",
    notes: "Thanh toán thành công",
    transactionFee: WITHDRAWAL_FEE,
    netAmount: 2000000,
  },
  {
    id: "withdraw-3",
    requestDate: "2026-02-15T14:00:00Z",
    amount: 1200000,
    status: "completed",
    bankName: "Vietcombank",
    bankAccount: "00711******456",
    accountHolder: "NGUYEN VAN MENTOR",
    processedDate: "2026-02-16T16:30:00Z",
    notes: "Thanh toán thành công",
    transactionFee: WITHDRAWAL_FEE,
    netAmount: 1200000,
  },
];

// Calculate financial summary
const totalEarnings = EARNINGS_TRANSACTIONS.reduce((sum, t) => sum + t.mentorEarnings, 0);
const availableBalance = EARNINGS_TRANSACTIONS.filter(t => t.status === "available").reduce((sum, t) => sum + t.mentorEarnings, 0);
const pendingBalance = EARNINGS_TRANSACTIONS.filter(t => t.status === "pending").reduce((sum, t) => sum + t.mentorEarnings, 0);
const withdrawnTotal = WITHDRAWAL_HISTORY.filter(w => w.status === "completed").reduce((sum, w) => sum + w.amount, 0);
const platformFeeTotal = EARNINGS_TRANSACTIONS.reduce((sum, t) => sum + t.platformFeeAmount, 0);

const thisMonth = new Date("2026-03-21");
const lastMonth = new Date(thisMonth);
lastMonth.setMonth(lastMonth.getMonth() - 1);

const thisMonthEarnings = EARNINGS_TRANSACTIONS.filter(t => {
  const date = new Date(t.completedDate);
  return date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear();
}).reduce((sum, t) => sum + t.mentorEarnings, 0);

const lastMonthEarnings = EARNINGS_TRANSACTIONS.filter(t => {
  const date = new Date(t.completedDate);
  return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
}).reduce((sum, t) => sum + t.mentorEarnings, 0);

export const MENTOR_FINANCIAL_SUMMARY = {
  totalEarnings,
  availableBalance,
  pendingBalance,
  withdrawnTotal,
  platformFeeTotal,
  thisMonthEarnings,
  lastMonthEarnings,
  averageSessionRate: totalEarnings / EARNINGS_TRANSACTIONS.length,
};

export const MENTOR_BANK_ACCOUNTS = [
  {
    id: "bank-1",
    bankName: "Techcombank",
    accountNumber: "19036******789",
    accountHolder: "NGUYEN VAN MENTOR",
    isPrimary: true,
    addedDate: "2025-12-01",
  },
  {
    id: "bank-2",
    bankName: "Vietcombank",
    accountNumber: "00711******456",
    accountHolder: "NGUYEN VAN MENTOR",
    isPrimary: false,
    addedDate: "2026-01-15",
  },
];

// ═════════════════════════════════════════════════════════════════
// RESCHEDULE REQUESTS DATA
// ═════════════════════════════════════════════════════════════════

export const RESCHEDULE_REQUESTS = [
  {
    id: "reschedule-1",
    originalMeetingId: "meeting-upcoming-2",
    originalDate: "2026-03-19T10:00:00Z",
    newDate: "2026-03-20T14:00:00Z",
    reason: "Xin lỗi em, thầy có cuộc họp quan trọng với khách hàng vào đúng giờ này. Thầy sẽ compensate thêm 15 phút cho buổi học để bù đắp sự bất tiện này.",
    status: "pending",
    requestedBy: "mentor",
    requestDate: "2026-03-18T15:30:00Z",
  },
  {
    id: "reschedule-2",
    originalMeetingId: "meeting-completed-3",
    originalDate: "2026-03-10T14:00:00Z",
    newDate: "2026-03-11T10:00:00Z",
    reason: "Em có lịch thi đột xuất vào giờ này. Em rất mong thầy thông cảm và dời lại buổi học.",
    status: "accepted",
    requestedBy: "mentee",
    requestDate: "2026-03-09T18:00:00Z",
    responseDate: "2026-03-09T19:15:00Z",
    menteeResponse: "Được em, thầy OK với thời gian mới.",
  },
  {
    id: "reschedule-3",
    originalMeetingId: "meeting-upcoming-5",
    originalDate: "2026-03-22T15:00:00Z",
    newDate: "2026-03-23T10:00:00Z",
    reason: "Thầy có việc gia đình đột xuất cần xử lý. Thầy xin phép dời sang ngày mai được không em?",
    status: "accepted",
    requestedBy: "mentor",
    requestDate: "2026-03-21T08:00:00Z",
    responseDate: "2026-03-21T09:30:00Z",
    menteeResponse: "Dạ được em, thầy OK với thời gian mới. Chúc thầy mọi việc hanh thông.",
  },
  {
    id: "reschedule-4",
    originalMeetingId: "meeting-completed-5",
    originalDate: "2026-03-05T15:00:00Z",
    newDate: "2026-03-05T17:00:00Z",
    reason: "Thầy bị delay cuộc họp trước, có thể dời lại 2 tiếng được không em?",
    status: "rejected",
    requestedBy: "mentor",
    requestDate: "2026-03-05T14:30:00Z",
    responseDate: "2026-03-05T14:45:00Z",
    menteeResponse: "Xin lỗi thầy, em có lịch khác lúc 18h nên không thể dời được. Vậy thầy có thể giữ nguyên giờ cũ không ạ?",
  },
  {
    id: "reschedule-5",
    originalMeetingId: "meeting-completed-7",
    originalDate: "2026-02-28T16:30:00Z",
    newDate: "2026-03-01T10:00:00Z",
    reason: "Công ty thầy có incident khẩn cấp cần xử lý ngay. Thầy rất xin lỗi vì sự bất tiện này.",
    status: "accepted",
    requestedBy: "mentor",
    requestDate: "2026-02-28T14:00:00Z",
    responseDate: "2026-02-28T14:30:00Z",
    menteeResponse: "Dạ không sao ạ, em hiểu. Em OK với thời gian mới.",
  },
];

// Reschedule Policy & Limits
export const RESCHEDULE_POLICY = {
  maxReschedulesPerMonth: 3, // Tối đa 3 lần dời lịch/tháng
  warningThreshold: 2, // Cảnh báo khi dời >= 2 lần
  minHoursBeforeReschedule: 24, // Nên dời ít nhất 24h trước
  penaltyAfterLimit: "Mentor có thể bị giảm độ ưu tiên hiển thị và nhận report từ hệ thống",
};

// Calculate current month reschedules for warning
export function getMentorRescheduleCount(mentorId, year, month) {
  return RESCHEDULE_REQUESTS.filter(req => {
    const requestDate = new Date(req.requestDate);
    return (
      req.requestedBy === "mentor" &&
      requestDate.getFullYear() === year &&
      requestDate.getMonth() === month
    );
  }).length;
}

// ═════════════════════════════════════════════════════════════════
// MENTOR REPORTS DATA (Báo cáo từ users về mentor)
// ═════════════════════════════════════════════════════════════════

export const MENTOR_REPORTS = [
  {
    id: "report-1",
    reporterId: "mentee-3", // Lê Quang Huy
    reporterName: "Lê Quang Huy",
    reporterAvatar: MENTEES[2].avatar,
    mentorId: "mentor-1",
    mentorName: "Nguyễn Văn Mentor",
    relatedMeetingId: "meeting-completed-3",
    reportDate: "2026-03-11T16:20:00Z",
    category: "quality",
    title: "Chất lượng buổi học không đạt kỳ vọng",
    description: "Buổi mock interview hôm 10/3 thầy hơi vội vàng, feedback không chi tiết như mong đợi. Em cảm giác thầy chưa xem kỹ CV và JD của em trước buổi học. Phần STAR framework thầy giải thích khá nhanh, em chưa hiểu rõ lắm.",
    status: "resolved",
    priority: "low",
    adminNotes: "Đã liên hệ mentor để nhắc nhở về việc chuẩn bị kỹ trước buổi học. Mentor đã xin lỗi và cam kết cải thiện.",
    resolvedDate: "2026-03-13T10:00:00Z",
    resolution: "Mentor đã nhận feedback và xin lỗi mentee. Đề xuất mentor dành 15-20 phút review CV/JD trước mỗi buổi học.",
  },
  {
    id: "report-2",
    reporterId: "mentee-6", // Vũ Thị Lan
    reporterName: "Vũ Thị Lan",
    reporterAvatar: MENTEES[5].avatar,
    mentorId: "mentor-1",
    mentorName: "Nguyễn Văn Mentor",
    relatedMeetingId: "meeting-upcoming-5",
    reportDate: "2026-03-21T09:45:00Z",
    category: "reschedule-abuse",
    title: "Mentor dời lịch quá nhiều lần",
    description: "Đây là lần thứ 3 trong tháng này thầy dời lịch. Em hiểu thầy bận nhưng việc này ảnh hưởng đến lịch học và công việc của em rất nhiều. Buổi ngày 22/3 thầy vừa dời sang 23/3 mà em cũng phải sắp xếp lại lịch cá nhân.",
    status: "reviewing",
    priority: "medium",
    adminNotes: "Đang kiểm tra lịch sử reschedule của mentor. Thực tế mentor đã reschedule 3 lần trong tháng 3, vượt ngưỡng cho phép.",
  },
  {
    id: "report-3",
    reporterId: "mentee-7", // Đặng Minh Tuấn
    reporterName: "Đặng Minh Tuấn",
    reporterAvatar: MENTEES[6].avatar,
    mentorId: "mentor-1",
    mentorName: "Nguyễn Văn Mentor",
    relatedMeetingId: "meeting-completed-7",
    reportDate: "2026-03-01T18:00:00Z",
    category: "attitude",
    title: "Thái độ không chuyên nghiệp khi dời lịch gấp",
    description: "Ngày 28/2 đến 2h chiều thầy mới báo dời lịch (buổi học 4:30 chiều). Thầy không xin lỗi rõ ràng, chỉ nói 'có incident khẩn cấp'. Em đã bỏ công việc để sắp xếp thời gian và cảm thấy bị thiếu tôn trọng.",
    status: "resolved",
    priority: "medium",
    adminNotes: "Mentor đã vi phạm chính sách reschedule tối thiểu 24h. Đã gửi warning và yêu cầu mentor cải thiện.",
    resolvedDate: "2026-03-03T14:00:00Z",
    resolution: "Mentor đã nhận cảnh báo về việc reschedule quá gần giờ học. Sẽ theo dõi trong 2 tháng tới.",
  },
];

export const REPORT_CATEGORIES = {
  quality: { label: "Chất lượng không đạt", color: "#FF8C42" },
  attitude: { label: "Thái độ không chuyên nghiệp", color: "#EF4444" },
  "reschedule-abuse": { label: "Lạm dụng dời lịch", color: "#FFD600" },
  unprofessional: { label: "Hành vi thiếu chuyên nghiệp", color: "#EF4444" },
  harassment: { label: "Quấy rối", color: "#DC2626" },
  other: { label: "Khác", color: "#9CA3AF" },
};

export const MENTOR_FINANCIALS = {
  summary: MENTOR_FINANCIAL_SUMMARY,
  earnings: EARNINGS_TRANSACTIONS,
  withdrawals: WITHDRAWAL_HISTORY,
  // Combined history for the table
  history: [
    ...EARNINGS_TRANSACTIONS.map(t => ({
      id: t.id,
      date: t.completedDate,
      description: `Thu nhập: ${t.meetingType === 'mock-interview' ? 'Phỏng vấn thử' : t.meetingType === 'cv-review' ? 'Review CV' : 'Coaching'} - ${t.menteeName}`,
      amount: t.mentorEarnings,
      type: 'income',
      status: t.status === 'pending' ? 'pending' : 'completed'
    })),
    ...WITHDRAWAL_HISTORY.map(w => ({
      id: w.id,
      date: w.requestDate,
      description: `Rút tiền về ${w.bankName}`,
      amount: w.amount,
      type: 'withdraw',
      status: w.status
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))
};