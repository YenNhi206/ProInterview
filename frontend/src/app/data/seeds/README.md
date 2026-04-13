# Mock data — `seeds/`

Tách theo **miền dữ liệu**; `mockData.js` ở cấp trên chỉ **re-export** để mọi `import … from "../data/mockData"` giữ nguyên.

Tổng quan thư mục `data/` (mock vs courses vs mentor): xem [**`../README.md`**](../README.md).

| File | Export |
|:--|:--|
| `mentors.js` | `MENTORS`, `FIELDS` |
| `bookingSessions.js` | `UPCOMING_SESSIONS` |
| `interviewHistory.js` | `INTERVIEW_HISTORY` |
| `interviewQuestions.js` | `MOCK_INTERVIEW_QUESTIONS` |
| `cvAnalysisHistory.js` | `CV_ANALYSIS_HISTORY` |
| `dashboard.js` | `PROGRESS_DATA`, `SKILLS_DATA` |
| `notifications.js` | `NOTIFICATIONS` |

Dữ liệu khóa học tĩnh vẫn nằm trong `coursesData.js`; mock mentor dashboard trong `mentorMockData.js`.
