# Software Design Description

> Extracted without changes from the capstone report `FA26SE210_NguyenThiCamHuong_FinalReport.docx` (saved 2026-11-09) for review BM02.
> Diagram figures are stored in `figures/`; screenshots and detailed-design images stay in the report. Editable diagrams: `docs/detailed-design/`.

[Provide final software design information follow the template as part II in the Report  4]

### 1. System Design

#### 1.1 System Architecture

![Figure 4.1.1.1 System Architecture](figures/image220.png)

*Figure 4.1.1.1 System Architecture*

#### 1.2 Package Diagram

##### 1.2.1. Backend Package Diagram

![Figure 4.1.2.1 Backend Package Diagram](figures/image126.png)

*Figure 4.1.2.1 Backend Package Diagram*

##### 1.2.2. Web Application Package Diagram

![Figure 4.1.2.2 Web Application Package Diagram](figures/image198.png)

*Figure 4.1.2.2 Web Application Package Diagram*

##### 1.2.3. AI Service Package Diagram

![Figure 4.1.2.3 AI Service Package Diagram](figures/image228.png)

*Figure 4.1.2.3 AI Service Package Diagram*

### 2. Database Design

Conceptual ERD

![Figure 4.2.1 : Conceptual ERD](figures/image61.png)

*Figure 4.2.1 : Conceptual ERD*

Logical ERD

![Figure 4.2.2 : Logical ERD](figures/image140.png)

*Figure 4.2.2 : Logical ERD*

Entities Description

Table 4.2 : Table Descriptions

| No | Table | Type | Description |
| --- | --- | --- | --- |
| 1 | USER | Collection | Stores every account (candidate, mentor, admin, platform moderator, company moderator) with credentials, role, linked organization, plan, verification and active status. |
| 2 | MENTOR | Collection | Stores the mentor profile linked to a user: title, expertise, price per session (200,000–1,000,000 VND), weekly free trial slots, availability, verification, approving admin and violation count. |
| 3 | CANDIDATE_PROFILE | Collection | Stores the single candidate profile every module reads and writes: self-declared position, experience and skills, plus the system-computed Job Readiness Score. |
| 4 | CV | Collection | Stores each CV version in a candidate's portfolio: title, file, parsed content and whether it passed CV validation. |
| 5 | CV_ANALYSIS | Collection | Stores each CV–JD analysis of one CV: JD text, mode, match score, skill and experience gaps, suggestions and status. |
| 6 | COMPETENCY | Collection | Stores the SHRM/DDI competency framework: code, name, framework, description and level descriptors (1–5). |
| 7 | COMPETENCY_SCORE | Collection | Stores a candidate's level on one competency with its source (mentor assessment, AI interview or self-declared), the producing assessment or interview, and date. |
| 8 | ORGANIZATION | Collection | Stores partner companies: name, tax code, industry, status (active or suspended) and the admin who created it. |
| 9 | JOB_POST | Collection | Stores a job post (or a platform template when no organization): position, level, description, requirements, linked approved questions, status (Draft, Published, Closed, Expired, Hidden) and visibility deadline. |
| 10 | JOB_REQUIREMENT | Collection | Stores each competency a job post requires, with target level (1–5) and weight. |
| 11 | APPLICATION | Collection | Stores a candidate's application to a job post: CV used, Job Post interview used as evidence, profile snapshot, consent time, status, weighted rubric score and HR decision. |
| 12 | INTERVIEW_SESSION | Collection | Stores an AI mock interview: candidate, target job post (optional), prompt version used, interviewer voice, status, overall score and behavioral summary. |
| 13 | INTERVIEW_ANSWER | Collection | Stores one answer to one question in a session: source question (empty for live personalized questions), question text, transcript, duration and incomplete-evaluation flag. |
| 14 | ANSWER_SCORE | Collection | Stores the score of one answer on one criterion: competency, company rubric criterion (empty for the standard SHRM/DDI score), score, quoted evidence and scorer (AI or moderator). |
| 15 | QUESTION_BANK | Collection | Stores human-reviewed interview questions by layer, seniority and role category, with source, owning organization, status and creator. |
| 16 | RUBRIC | Collection | Stores a versioned company rubric for one question: version, status, building company moderator and approving platform moderator. |
| 17 | RUBRIC_CRITERION | Collection | Stores each rubric criterion: mapped SHRM/DDI competency, weight (rubric total 100), level descriptors and anchor answers. |
| 18 | REVIEW_DECISION | Collection | Stores each moderator decision on a question (accept, edit, reject) with reason code and edited text, used as AI feedback data. |
| 19 | PROMPT_VERSION | Collection | Stores versioned prompt rules proposed by the nightly job from review decisions, with status and the approving platform moderator. |
| 20 | MENTORSHIP_REQUEST | Collection | Stores a candidate's request to a chosen mentor: target job post, profile snapshot, goals, availability, status and trial schedule. |
| 21 | TRIAL_ASSESSMENT | Collection | Stores the mentor's assessment sheet after the free trial session: strengths, gaps, accept or decline decision and comment. |
| 22 | LEARNING_PLAN | Collection | Stores the personalized plan created from an accepted request: total price, status (Draft to Completed, Paused, Cancelled), revision note and activation date. |
| 23 | PLAN_SESSION | Collection | Stores each ordered session of a plan: objective, targeted competencies, measurable pass criteria, preparation, price and status. |
| 24 | SESSION_ATTEMPT | Collection | Stores one delivery of a plan session (original or retake): mentor, attempt number, free-retake flag, schedule, per-criterion results, Passed or Not Passed verdict, feedback and confirmation time. |
| 25 | MENTOR_EARNING | Collection | Stores mentor income released for one held attempt: gross amount, 20% platform fee, net amount, status (pending, available, held, paid), clearance date and settling payout. |
| 26 | DISPUTE | Collection | Stores a dispute raised on a plan session within 48 hours: reason, status, resolution (refund or dismiss) and resolving admin. |
| 27 | PAYMENT | Collection | Stores each bank-transfer payment for a learning plan, course order or subscription: amount, provider reference, status, confirming admin and refund amount. |
| 28 | PAYOUT_REQUEST | Collection | Stores a mentor's withdrawal request: amount, bank account, status, reviewing admin, transfer reference and paid date. |
| 29 | SUBSCRIPTION | Collection | Stores a user's Pro or Elite plan: billing cycle, start and expiry dates. |
| 30 | COURSE | Collection | Stores a video course authored by a mentor: title, level, price, status and the platform moderator who approved it. |
| 31 | MODULE | Embedded in COURSE | Stores a course section with its title and display order. |
| 32 | LESSON | Embedded in MODULE | Stores a lesson: type, video URL, duration and order. |
| 33 | ENROLLMENT | Collection | Stores a candidate's access to a course: originating order, progress, completion and price paid. |
| 34 | CART | Collection | Stores the list of courses a candidate has added before checkout. |
| 35 | CART_ORDER | Collection | Stores a course checkout order: order reference (bank transfer content), total, status and payment expiry. |
| 36 | CART_ORDER_ITEM | Embedded in CART_ORDER | Stores each course line in an order with original and final price. |
| 37 | REVIEW | Collection | Stores a candidate's rating and comment on a mentor (after completing a plan) or a course, with visibility. |
| 38 | REPORT | Collection | Stores user reports on mentors, content, or AI questions and scores, with reason code, status and resolver. |
| 39 | MODERATION_ITEM | Collection | Stores the moderation queue item opened from a report: type, status, priority, content snapshot, assigned moderator and resolution. |
| 40 | NOTIFICATION | Collection | Stores in-app notifications per user with type, title, body and read flag |

### 3. Detailed Design

#### 3.1 Authentication

##### 3.1.1 Sign Up

3.1.1.1 Sign Up Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.1.1Class Diagram*

3.1.1.2 Sign Up Sequence Diagram

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.1.2 Sequence Diagram*

##### 3.1.2 Verify Email

3.1.2.1 Verify Email - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.2.1Class Diagram*

3.1.2.2 Verify Email - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.2.2 Sequence Diagram*

##### 3.1.3 Sign In

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.3.1Class Diagram*

3.1.3.2 Sign In Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.3.2 Sequence Diagram*

##### 3.1.4 Sign In with Google

3.1.4.1 Sign In with Google - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.4.1Class Diagram*

3.1.4.2 Sign In with Google - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.4.2 Sequence Diagram*

##### 3.1.5 Forgot & Reset Password

3.1.5.1 Forgot & Reset Password - Class

![Figure 3.1.5.1Class Diagram](figures/image64.png)

*Figure 3.1.5.1Class Diagram*

3.1.5.2 Forgot & Reset Password - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.5.2 Sequence Diagram*

##### 3.1.6 Refresh Access Token

3.1.6.1 Refresh Access Token - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.6.1 Class Diagram*

3.1.6.2 Refresh Access Token - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.6.2 Sequence Diagram*

##### 3.1.7 Sign Out

3.1.7.1Sign Out - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.7.1 Class Diagram*

3.1.7.2 Sign Out - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.7.2 Sequence Diagram*

##### 3.1.8 Manage Login Sessions

3.1.8.1 Manage Login Sessions - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.8.1 Class Diagram*

3.1.8.2 Manage Login Sessions - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.1.8.2 Sequence Diagram*

#### 3.2 Account Profile

##### 3.2.1 View Profile

3.2.1.1 View Profile - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.1.1 Class Diagram*

3.2.1.2 View Profile - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.1.2 Sequence Diagram*

##### 3.2.2 Update Profile

3.2.2.1 Update Profile - Class

![Figure 3.2.2.1 Class Diagram](figures/image165.png)

*Figure 3.2.2.1 Class Diagram*

3.2.2.2 Update Profile - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.2.2 Sequence Diagram*

##### 3.2.3 Update Camera Consent

3.2.3.1 Update Camera Consent - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.3.1 Class Diagram*

3.2.3.2 Update Camera Consent - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.3.2 Sequence Diagram*

##### 3.2.4 Close Account

3.2.4.1 Close Account - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.4.1 Class Diagram*

3.2.4.2 Close Account - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.2.4.2 Sequence Diagram*

##### 3.3 CV Analysis3.3.1 Upload & Analyze CV

3.3.1.1 Upload & Analyze CV - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.1.1 Class Diagram*

3.3.1.2 Upload & Analyze CV - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.1.2 Sequence Diagram*

##### 3.3.2 View CV Analysis History

3.3.2.1 View CV Analysis History - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.2.1 Class Diagram*

3.3.2.2 View CV Analysis History - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.2.2 Sequence Diagram*

##### 3.3.3 View CV Analysis History

3.3.3.1 View CV Analysis History - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.3.1 Class Diagram*

3.3.3.2 View CV Analysis History - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.3.2 Sequence Diagram*

##### 3.3.4 Delete CV Analysis

3.3.4.1 Delete CV Analysis - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.4.1 Class Diagram*

3.3.4.2 Delete CV Analysis - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.4.2 Sequence Diagram*

##### 3.3.5 Rate CV Analysis

3.3.5.1 Rate CV Analysis - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.5.1 Class Diagram*

3.3.5.2 Rate CV Analysis - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.5.2 Sequence Diagram*

##### 3.3.6 Match CV with JD

3.3.6.1 Match CV with JD - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.6.1 Class Diagram*

3.3.6.2 Match CV with JD - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.3.6.2 Sequence Diagram*

#### 3.4 AI Mock Interview

##### 3.4.1 Start Interview Session

3.4.1.1 Start Interview Session - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.1.1 Class Diagram*

3.4.1.2 Start Interview Session - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.1.2 Sequence Diagram*

##### 3.4.2 Answer Interview Question

3.4.2.1 Answer Interview Question - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.2.1 Class Diagram*

3.4.2.2 Answer Interview Question - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.2.2 Sequence Diagram*

##### 3.4.3 Complete Interview

3.4.3.1 Complete Interview - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.3.1 Class Diagram*

3.4.3.2 Complete Interview - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.3.2 Sequence Diagram*

##### 3.4.4 Evaluate Interview

3.4.4.1 Evaluate Interview - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.4.1 Class Diagram*

3.4.4.1 Evaluate Interview - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.4.2 Sequence Diagram*

##### 3.4.5 View Interview History

3.4.5.1 View Interview History - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.5.1 Class Diagram*

3.4.5.2 View Interview History - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.5.2 Sequence Diagram*

##### 3.4.6 View Interview Detail

3.4.6.1 View Interview Detail - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.6.1 Class Diagram*

3.4.6.2 View Interview Detail - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.4.6.2 Sequence Diagram*

#### 3.5 Mentor Discovery

##### 3.5.1 Search Mentors

3.5.1.1 Search Mentors - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.1.1 Class Diagram*

3.5.1.2 Search Mentors - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.1.2 Sequence Diagram*

##### 3.5.2 View Mentor Profile

3.5.2.1 View Mentor Profile - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.2.1 Class Diagram*

3.5.2.2 View Mentor Profile

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.2.2 Sequence Diagram*

##### 3.5.3 View Mentor Availability

3.5.3.1 View Mentor Availability - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.3.1 Class Diagram*

3.5.3.2 View Mentor Availability - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.3.2 Sequence Diagram*

##### 3.5.4 View Mentor Reviews

3.5.4.1 View Mentor Reviews - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.4.1 Class Diagram*

3.5.4.2 View Mentor Reviews - Class- Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.5.4.2 Sequence Diagram*

#### 3.6 Booking Customer

##### 3.6.1 Book Mentor

3.6.1.1 Book Mentor - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.1.1 Class Diagram*

3.6.1.1 Book Mentor - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.1.2 Sequence Diagram*

##### 3.6.2 Submit Bank Transfer for Booking

3.6.2.1 Submit Bank Transfer for Booking - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.2.1 Class Diagram*

3.6.2.2 Submit Bank Transfer for Booking - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.2.2 Sequence Diagram*

##### 3.6.3 View My Bookings

3.6.3.1 View My Bookings - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.3.1 Class Diagram*

3.6.3.2 View My Bookings - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.3.2 Sequence Diagram*

##### 3.6.4 Reschedule Booking

3.6.4.1 Reschedule Booking - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.4.1 Class Diagram*

3.6.4.2 Reschedule Booking - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.4.2 Sequence Diagram*

##### 3.6.5 Cancel Booking

3.6.5.1 Cancel Booking - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.5.1 Class Diagram*

3.6.5.2 Cancel Booking - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.5.2 Sequence Diagram*

##### 3.6.6 Join Meeting Room

3.6.6.1 Join Meeting Room - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.6.1 Class Diagram*

3.6.6.2 Join Meeting Room - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.6.2 Sequence Diagram*

##### 3.6.7 Report Mentor No-Show

3.6.7.1 Report Mentor No-Show - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.7.1 Class Diagram*

3.6.7.2 Report Mentor No-Show- Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.7.2 Sequence Diagram*

##### 3.6.8 Download Booking Invoice

3.6.8.1 Download Booking Invoice - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.8.1 Class Diagram*

3.6.8.2 Download Booking Invoice - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.6.8.2 Sequence Diagram*

#### 3.7 Booking Mentor

##### 3.7.1 View Mentor Bookings

3.7.1.1 View Mentor Bookings - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.1.1 Class Diagram*

3.7.1.2 View Mentor Bookings - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.1.2 Sequence Diagram*

##### 3.7.2 Confirm Booking

3.7.2.1 Confirm Booking - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.2.1 Class Diagram*

3.7.2.2 Confirm Booking - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.2.2 Sequence Diagram*

##### 3.7.3 Start & Check-in Meeting

3.7.3.1 Start & Check-in Meeting - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.3.1 Class Diagram*

3.7.3.2 Start & Check-in Meeting - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.3.2 Sequence Diagram*

##### 3.7.4 Complete Booking & Save Notes

3.7.4.1 Complete Booking & Save Notes - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.4.1 Class Diagram*

3.7.4.2 Complete Booking & Save Notes - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.4.2 Sequence Diagram*

##### 3.7.5 Save Mentor Knowledge

3.7.5.1 Save Mentor Knowledge - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.5.1 Class Diagram*

3.7.5.2 Save Mentor Knowledge - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.7.5.2 Sequence Diagram*

#### 3.8 Mentorship Request

##### 3.8.1 Post Mentorship Request

3.8.1.1 Post Mentorship Request - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.1.1 Class Diagram*

3.8.1.2 Post Mentorship Request - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.1.2 Sequence Diagram*

##### 3.8.2 View Mentorship Requests

3.8.2.1 View Mentorship Requests - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.2.1 Class Diagram*

3.8.2.2 View Mentorship Requests - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.2.2 Sequence Diagram*

##### 3.8.3 Send Offer

##### 3.8.3.1 Send Offer - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.3.1 Class Diagram*

##### 3.8.3.2 Send Offer - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.3.2 Sequence Diagram*

##### 3.8.4 Withdraw Offer

3.8.4.1 Withdraw Offer - Class

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.4.1 Class Diagram*

3.8.4.2 Withdraw Offer - Sequence

*(Image kept in the report, not stored in this repository.)*

*Figure 3.8.4.2 Sequence Diagram*

3.9 Subscription Payment

3.10 Course Learning

3.11 Cart Checkout

3.12 Review Report

3.13 Notification

\

3.14 Mentor Profile

3.15 Course Management Mentor

3.16 Mentor Finance

3.17 Moderation

3.18 Admin Users Mentors

3.19 Admin Finance

3.21 Achievement

#### 3.22 Candidate Profile (Hồ sơ ứng viên & Năng lực xác thực)

##### 3.22.1 Sequence Diagram: Tự động khởi tạo & Cập nhật Hồ sơ ứng viên
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Ứng viên (Frontend)
    participant Controller as candidateProfileController
    participant Service as candidateProfileService
    participant DB as MongoDB (CandidateProfile / CVDocument / User)

    Note over Candidate, DB: Lần đầu truy cập - Tự động khởi tạo
    Candidate->>Controller: GET /api/profile/me (Bearer Token)
    Controller->>Service: getOrCreateCandidateProfile(userId)
    Service->>DB: CandidateProfile.findOne({ userId })
    alt Chưa có profile
        Service->>DB: User.findById(userId)
        Service->>DB: CVDocument.findOne({ userId, isDefault: true })
        Service->>DB: CandidateProfile.create({ userId, headline, targetRole, competencies })
    end
    Service-->>Controller: profile
    Controller-->>Candidate: 200 OK { success: true, profile }

    Note over Candidate, DB: Cập nhật thông tin hồ sơ
    Candidate->>Controller: PATCH /api/profile/me (headline, targetRoles, summary)
    Controller->>Service: updateCandidateProfile(userId, updateData)
    Service->>DB: CandidateProfile.findOneAndUpdate({ userId }, updateData, { new: true })
    Service-->>Controller: updatedProfile
    Controller-->>Candidate: 200 OK { success: true, profile: updatedProfile }
```

##### 3.22.2 Sequence Diagram: Tổng hợp Bằng chứng Năng lực (Competency Aggregation)
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Ứng viên (Frontend)
    participant Controller as candidateProfileController
    participant Service as candidateProfileService
    participant Interview as InterviewSession
    participant Booking as Booking
    participant DB as MongoDB (CandidateProfile)

    Candidate->>Controller: GET /api/profile/me/competencies
    Controller->>Service: getProfileCompetencies(userId)
    Service->>DB: getOrCreateCandidateProfile(userId)
    Service->>Interview: find({ userId, status: "completed" }) (Bỏ qua abandoned)
    Service->>Booking: find({ menteeId: userId, status: "completed" })
    Note over Service: Tính điểm trung bình & cấp độ (1-5)<br/>Cập nhật evidenceCount và danh sách nguồn bằng chứng
    Service->>DB: profile.save() (Cập nhật isVerified = true)
    Service-->>Controller: { competencies, snapshot }
    Controller-->>Candidate: 200 OK { success: true, competencies, snapshot }
```

#### 3.23 CV Portfolio (Kho CV, Nhân bản, Validate & Xuất PDF)

##### 3.23.1 Sequence Diagram: Tải lên & Validate CV (Kiểm tra định dạng & Hóa đơn)
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Ứng viên (Frontend)
    participant UploadCtrl as uploadController
    participant Validator as cvValidator
    participant Service as cvDocumentService
    participant DB as MongoDB (CVDocument)

    Candidate->>UploadCtrl: POST /api/upload/cv (Multipart File)
    UploadCtrl->>Validator: validateUploadedCvBuffer(file.buffer, file.originalname)
    Note over Validator: Kiểm tra magic bytes (PNG/JPEG header) & Text hóa đơn VAT
    alt File không hợp lệ (Ảnh hoặc Hóa đơn)
        Validator-->>UploadCtrl: { isValid: false, reason: "..." }
        UploadCtrl-->>Candidate: 400 Bad Request { success: false, error: "..." }
    else File CV hợp lệ
        Validator-->>UploadCtrl: { isValid: true }
        UploadCtrl->>Service: createCVDocument({ userId, fileUrl, ... })
        Service->>DB: CVDocument.create() (Tự động isDefault nếu là CV đầu tiên)
        Service-->>UploadCtrl: cvDocument
        UploadCtrl-->>Candidate: 201 Created { success: true, cv: cvDocument }
    end
```

##### 3.23.2 Sequence Diagram: Nhân bản CV & Quản lý Version
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Ứng viên (Frontend)
    participant Controller as cvDocumentController
    participant Service as cvDocumentService
    participant DB as MongoDB (CVDocument)

    Candidate->>Controller: POST /api/cvs/:id/duplicate
    Controller->>Service: duplicateCV(cvId, userId)
    Service->>DB: CVDocument.findOne({ _id: cvId, userId })
    Service->>DB: CVDocument.create({ title: "[Bản sao] " + title, isDefault: false, parentCvId: cvId })
    Service-->>Controller: duplicatedCv
    Controller-->>Candidate: 201 Created { success: true, cv: duplicatedCv }
```

##### 3.23.3 Sequence Diagram: Xuất PDF tiếng Việt chuẩn ATS
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Ứng viên (Frontend)
    participant Controller as cvDocumentController
    participant PDFService as cvExportPdfService
    participant PDFKit as PDFKit Engine (DejaVuSans.ttf)

    Candidate->>Controller: POST /api/cvs/:id/export-pdf
    Controller->>PDFService: generateCvPdf(cvDocument)
    PDFService->>PDFKit: Khởi tạo Document & nạp font tiếng Việt DejaVuSans
    PDFService->>PDFKit: Vẽ bố cục ATS 1 cột (Header, Kinh nghiệm, Học vấn, Kỹ năng)
    PDFKit-->>PDFService: PDF Stream / Buffer
    PDFService-->>Controller: pdfBuffer
    Controller-->>Candidate: 200 OK (Content-Type: application/pdf, Content-Disposition: attachment)
```

#### 3.24 Job Posts & Applications (Tin tuyển dụng và Ứng tuyển)

> DOC-02. Sequence khớp code nhánh `main` ngày 24/11/2026: `routes/company.js`, `routes/jobs.js`, `services/jobPostsService.js`, `services/publicJobsService.js`, `services/recentJobsService.js`, `services/jobPostModerationService.js`, `services/moderationQueueService.js`, `jobs/bookingStaleSweepJob.js`. File `docs/detailed-design/3.24_Job_Posts_Applications.drawio` vẽ theo thiết kế cũ (`/api/job-posts`, `PartnerCompany`, `CompanyRole`) không còn đúng; dùng các sequence dưới đây.

State machine `JobPost.status`: `draft → published → closed`; `published ⇄ hidden` (Platform Moderator); `published | hidden → closed` (Company Moderator đóng, hoặc quá `closesAt`). Tin `hidden` và `closed` không hiện ở API công khai.

##### 3.24.1 Sequence Diagram: Company Moderator soạn, đăng, sửa và đóng tin (JB-01, JB-02, JB-15)
```mermaid
sequenceDiagram
    autonumber
    actor HR as Company Moderator
    participant FE as /company/jobs (CompanyJobs)
    participant MW as authJwt + requireCompanyModerator + companyModeratorAuditLog
    participant Ctrl as CompanyJobsController
    participant Svc as jobPostsService
    participant DB as MongoDB (JobPost, CompanyRubric)

    HR->>FE: Điền form (tiêu đề, roleCategory, cấp độ, mô tả, năng lực, kỹ năng, rubric, closesAt)
    FE->>MW: POST /api/company/jobs
    MW->>Ctrl: req.companyId = công ty của người gọi
    Ctrl->>Svc: createCompanyJob(companyId, userId, body)
    Note over Svc: Joi validate, roleCategory theo config/roleCategories.json,<br/>năng lực theo config/competencies.json, closesAt ở tương lai
    opt Có rubricId
        Svc->>DB: CompanyRubric.findOne({ _id, companyId })
        Note over Svc: assertRubricAttachable: cùng công ty, status approved, cùng roleCategory với job
    end
    Svc->>DB: JobPost.create({ ...input, companyId, status: "draft" })
    Svc-->>FE: 201 { success, job }

    HR->>FE: Bấm "Đăng tin"
    FE->>Ctrl: PATCH /api/company/jobs/:id/status { status: "published" }
    Ctrl->>Svc: changeCompanyJobStatus(companyId, userId, id, body)
    Note over Svc: assertPublishable: mô tả ≥ 50 ký tự, ≥ 1 năng lực,<br/>kiểm lại rubric (có thể đã bị lưu trữ)
    Svc->>DB: findOneAndUpdate({ _id, companyId, status: "draft" }, { status: "published", publishedAt })
    alt Không cập nhật được (đổi trạng thái song song)
        Svc-->>FE: 409 "Tin tuyển dụng vừa đổi trạng thái"
    else Thành công
        Svc-->>FE: 200 { success, job }
    end

    HR->>FE: Sửa tin đang đăng
    FE->>Ctrl: PATCH /api/company/jobs/:id
    Ctrl->>Svc: updateCompanyJob(...)
    Note over Svc: Tin hidden hoặc closed → 409,<br/>đổi rubricId/roleCategory → kiểm lại rubric
    Svc->>DB: findOneAndUpdate({ _id, companyId, status, updatedAt }, { $set })
    Svc-->>FE: 200 { success, job }

    HR->>FE: Bấm "Đóng tin"
    FE->>Ctrl: PATCH /api/company/jobs/:id/status { status: "closed" }
    Svc->>DB: findOneAndUpdate({ status ∈ [published, hidden] }, { status: "closed", closedReason: "company" })
    Svc-->>FE: 200 { success, job }

    Note over DB: bookingStaleSweepJob (20 phút) → closeExpiredJobPosts():<br/>updateMany({ status ∈ [published, hidden], closesAt ≤ now }, { status: "closed", closedReason: "expired" })
```

##### 3.24.2 Sequence Diagram: Ứng viên xem tin công khai và job xem gần đây (JB-03, JB-20)
```mermaid
sequenceDiagram
    autonumber
    actor C as Ứng viên (hoặc khách)
    participant FE as /jobs (Jobs), /jobs/:id (JobDetail)
    participant R as jobsRouter (/api/jobs)
    participant Pub as publicJobsService
    participant Rec as recentJobsService
    participant DB as MongoDB (JobPost, Company, CandidateProfile)

    C->>FE: Mở danh sách job (lọc vị trí, công ty, cấp độ)
    FE->>R: GET /api/jobs?roleCategory&company&level&page
    R->>Pub: listPublicJobs(query)
    Pub->>DB: Company.find({ status: "suspended" }) → loại công ty bị khóa
    Pub->>DB: JobPost.find(openJobFilter: status "published", closesAt null hoặc > now)
    Pub-->>FE: 200 { success, jobs, pagination }

    C->>FE: Mở chi tiết job
    FE->>R: GET /api/jobs/:id (optionalAuth)
    R->>Pub: getPublicJob(id)
    alt Job không mở (draft, hidden, closed, quá hạn, công ty bị khóa)
        Pub-->>FE: 404
    else Job đang mở
        opt Có token ứng viên
            R->>Rec: recordJobView(userId, jobId)
            Note over Rec: Chỉ ghi khi user role customer
            Rec->>DB: CandidateProfile.recentJobViews: $pull job cũ (upsert), rồi $push lên đầu, $slice 5
            Note over R: Lỗi ghi lượt xem chỉ log warn, không làm hỏng trang
        end
        R-->>FE: 200 { success, job }
    end

    C->>FE: Màn cài đặt phỏng vấn AI (thẻ "job bạn quan tâm")
    FE->>R: GET /api/jobs/recent (authJwt, role customer)
    R->>Rec: listRecentJobs(userId)
    Rec->>DB: Chỉ job còn mở, công ty không bị khóa, có câu doanh nghiệp hợp lệ
    R-->>FE: 200 { success, jobs }
```

##### 3.24.3 Sequence Diagram: Báo cáo tin tuyển dụng và Platform Moderator ẩn tin (JB-04, JB-17)
```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng đã đăng nhập
    actor Mod as Platform Moderator
    participant RepAPI as POST /api/reports
    participant JMS as jobPostModerationService
    participant ModAPI as /api/moderator (queue, jobs)
    participant MQS as moderationQueueService
    participant DB as MongoDB (Report, ModerationItem, JobPost)
    participant N as deliverNotification

    U->>RepAPI: { targetType: "job_post", targetId, reason, description }
    RepAPI->>JMS: createJobPostReport(userId, body)
    Note over JMS: reason thuộc JOB_POST_REPORT_REASONS, mô tả ≥ 10 ký tự,<br/>job phải đang mở (findPublicJob),<br/>Company Mod không báo cáo tin công ty mình,<br/>mỗi người 1 báo cáo đang chờ cho mỗi tin (409)
    JMS->>DB: Report.create(...)
    JMS->>DB: ModerationItem.create({ type: "job_post_report", priority: high nếu fraud/discriminatory })
    Note over JMS: Tạo item lỗi → xóa Report vừa tạo (không để báo cáo mồ côi)
    JMS-->>U: 201 { reportId, moderationItemId }

    Mod->>ModAPI: GET /api/moderator/queue?type=job_post_report (màn /moderator/job-reports)
    Mod->>ModAPI: PATCH /api/moderator/queue/:id/resolve { action: "hide_job" | "dismiss", note }
    ModAPI->>MQS: resolveItem → resolveJobItem(item, action, note)
    alt action = hide_job
        MQS->>JMS: setJobVisibility(jobId, { hidden: true, reason: note }, exceptItemId)
        Note over MQS: Tin đã bị ẩn trước đó → vẫn đóng item, tin đã đóng → 409, moderator dùng dismiss
        JMS->>DB: findOneAndUpdate({ status: "published" }, { status: "hidden", hiddenAt, hiddenBy, hiddenReason })
        JMS->>DB: resolveOpenJobReports: đóng các item + Report đang mở khác của tin
        JMS->>N: Người báo cáo của các báo cáo đó: "feedback"
        JMS->>N: Company Moderator của công ty: "job_post_hidden"
    end
    MQS->>DB: ModerationItem này → resolved / dismissed (cập nhật có điều kiện, xử lý trùng → 409)
    MQS->>JMS: closeJobReport(reportId) → Report resolved / dismissed
    JMS->>N: Người báo cáo: "feedback" (báo cáo đã xử lý)
    MQS-->>Mod: 200 { success, item }

    Mod->>ModAPI: PATCH /api/moderator/jobs/:id/visibility { hidden: false }
    ModAPI->>JMS: setJobVisibility(jobId, { hidden: false })
    Note over JMS: Chỉ bỏ ẩn khi chưa quá closesAt, quá hạn → 409
    JMS->>DB: { status: "hidden" } → "published"
    JMS->>N: Company Moderator: "system" (tin hiển thị lại)
```

##### 3.24.4 Sequence Diagram: Ứng tuyển (JB-08, JB-09, JB-10)

Chưa vẽ: `Application`, `POST /api/jobs/:id/apply`, `GET /api/applications/me` và API công ty xem đơn chưa có trong code (JB-08 chờ JB-07, JB-19). DOC-02 bổ sung mục này sau khi JB-10 xong để sequence khớp code.

#### 3.25 Partner Companies (Quản lý Công ty & Lời mời HR)

##### 3.25.1 Sequence Diagram: Admin tạo Công ty & Gửi Lời mời Company Moderator
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản trị viên (Admin)
    participant CompanyCtrl as adminCompanyController
    participant InviteCtrl as companyInviteController
    participant Mail as emailService
    participant DB as MongoDB (Company / CompanyInvite)

    Admin->>CompanyCtrl: POST /api/admin/companies (name, taxCode, industry)
    CompanyCtrl->>DB: Company.create({ name, taxCode, industry, status: "active" })
    CompanyCtrl-->>Admin: 201 Created { success: true, company }

    Admin->>InviteCtrl: POST /api/admin/companies/:id/invites (email)
    InviteCtrl->>DB: Kiểm tra email chưa có role customer/mentor (Quyết định 14)
    InviteCtrl->>DB: CompanyInvite.create({ email, companyId, tokenHash, expiresAt: +7 days })
    InviteCtrl->>Mail: sendCompanyInviteEmail(email, inviteUrl)
    InviteCtrl-->>Admin: 201 Created { success: true, message: "Đã gửi lời mời" }
```

##### 3.25.2 Sequence Diagram: HR nhận Lời mời & Truy cập Phân quyền Cách ly
```mermaid
sequenceDiagram
    autonumber
    actor HR as Đại diện Doanh nghiệp (HR)
    participant InviteCtrl as companyInviteController
    participant Middleware as requireCompanyModerator
    participant CompanyRouter as /api/company/*
    participant DB as MongoDB (User / CompanyInvite / Company)

    HR->>InviteCtrl: GET /api/company-invites/verify/:token
    InviteCtrl-->>HR: { invite, terms { version, title, points } }
    HR->>InviteCtrl: POST /api/company-invites/accept (token, name, password, acceptRubricTerms, termsVersion)
    InviteCtrl->>DB: CompanyInvite.findOne({ tokenHash, status: "pending" }) + kiểm expiresAt
    Note over InviteCtrl: acceptRubricTerms !== true → 400<br/>termsVersion khác bản hiện tại → 409 (CO-02)
    InviteCtrl->>DB: findOneAndUpdate({ _id, status: "pending" } → accepted, rubricTermsAcceptedAt, rubricTermsVersion)
    InviteCtrl->>DB: User.create({ email, name, role: "company_moderator", companyId })
    InviteCtrl->>DB: Company.rubricSharingConsent (chỉ ghi lần đồng ý đầu tiên)
    InviteCtrl-->>HR: 201 Created { success: true, user, token }

    HR->>CompanyRouter: GET /api/company/questions (Bearer Token)
    CompanyRouter->>Middleware: requireCompanyModerator(req, res, next)
    Middleware->>DB: User.findById(userId) & Company.findById(companyId)
    Note over Middleware: Kiểm tra company status === "active"<br/>Gán req.companyId = user.companyId
    Middleware-->>CompanyRouter: next() (Cách ly dữ liệu, chặn 403 nếu truy cập chéo)
    CompanyRouter-->>HR: 200 OK { questions: [...] }
```

#### 3.26 Company Evaluation & Rubrics (Ngân hàng câu hỏi & Duyệt Rubric)

##### 3.26.1 Sequence Diagram: Soạn Rubric, Kiểm tra 100% trọng số & Duyệt Platform Mod
```mermaid
sequenceDiagram
    autonumber
    actor HR as Company Moderator
    actor Mod as Platform Moderator
    participant RubricCtrl as companyWorkspaceController
    participant ModCtrl as moderatorRubricController
    participant DB as MongoDB (CompanyRubric)

    HR->>RubricCtrl: POST /api/company/rubrics (roleCategory, criteria)
    Note over RubricCtrl: Kiểm tra sum(weights) === 100%
    RubricCtrl->>DB: CompanyRubric.create({ companyId, criteria, status: "draft" })
    RubricCtrl-->>HR: 201 Created { rubric }

    HR->>RubricCtrl: POST /api/company/rubrics/:id/submit
    RubricCtrl->>DB: CompanyRubric.findByIdAndUpdate(id, { status: "pending_review" })
    RubricCtrl-->>HR: 200 OK { message: "Đã gửi duyệt rubric" }

    Mod->>ModCtrl: GET /api/moderator/rubrics/pending
    ModCtrl->>DB: CompanyRubric.find({ status: "pending_review" }).populate("companyId")
    ModCtrl-->>Mod: 200 OK { rubrics: [...] }

    Mod->>ModCtrl: POST /api/moderator/rubrics/:id/approve (moderatorNotes)
    ModCtrl->>DB: Lưu version cũ cùng roleCategory -> "archived"
    ModCtrl->>DB: Cập nhật rubric hiện tại -> "approved" (Đảm bảo mỗi roleCategory chỉ 1 bản approved)
    ModCtrl-->>Mod: 200 OK { success: true, message: "Đã phê duyệt rubric" }
```

#### 3.28 Learning Path (Lộ trình luyện phỏng vấn với Mentor)

> DOC-02. Sequence khớp code nhánh `main` ngày 24/11/2026: `routes/learningPaths.js`, `services/learningPathsService.js`, `services/learningPathPaymentService.js`, `services/learningPathSessionsService.js`, `services/sepayWebhookService.js`, `services/bookingsService.js`, `services/mentorEarningsService.js`, `utils/learningPathMoney.js`, `utils/learningPathBookingMoney.js`, `utils/learningPathOutcome.js`. Quyết định nghiệp vụ: `docs/plan/DECISIONS.md` (1: trả trọn gói, 2: học lại, 4: chụp phí nền tảng, 13: buổi đánh giá 0đ).

Điều kiện trước: ứng viên đã gửi yêu cầu mentor (`/api/mentorship-requests`), chọn mentor, và buổi đánh giá 0đ (Booking `sessionType: "assessment"`) đã `completed` (mục 3.8, LP-05, LP-06).

State machine `LearningPath.status`: `draft → proposed ⇄ revision_requested`; `proposed → pending_payment → active → completed`. `LearningPathSession.status`: `planned → scheduled → done` (hủy hoặc vắng buổi đưa `scheduled` về `planned`).

**Chia tiền (LP-09).** Giá trọn gói `T`, `n` buổi gốc, tỉ lệ phí nền tảng `r` chụp từ Mentor lúc gửi đề xuất:

| Đại lượng | Công thức | Ghi ở |
| --- | --- | --- |
| Phần tiền buổi gốc `i` | `floor(T / n)`, buổi cuối nhận phần dư (tổng đúng bằng `T`) | `LearningPathSession.shareAmount` (`splitLearningPathShares`) |
| Phí nền tảng buổi `i` | `round(shareAmount × r)` | `Booking.platformFee` (`learningPathBookingMoney`) |
| Mentor nhận buổi `i` | `shareAmount − platformFee`, ghi có khi buổi `completed` | `Mentor.finance.clearingBalance` (`tryCreditMentorForCompletedBooking`) |
| Học lại lần đầu (`attempt` 2) | `shareAmount = 0`, mentor không nhận thêm | `retakeShareAmount` |
| Buổi bổ sung (`attempt` ≥ 3) | Giá mentor đề xuất, thu riêng ngoài `T` | `proposeSupplementarySession` |

##### 3.28.1 Sequence Diagram: Mentor soạn và gửi lộ trình, ứng viên chấp nhận hoặc yêu cầu sửa (LP-07, LP-08, LP-09)
```mermaid
sequenceDiagram
    autonumber
    actor M as Mentor
    actor C as Ứng viên
    participant R as learningPathsRouter (/api/learning-paths, authJwt + requestActor)
    participant S as learningPathsService
    participant DB as MongoDB (LearningPath, LearningPathSession, MentorshipRequest, Booking)
    participant N as deliverNotification

    M->>R: POST / { mentorshipRequestId, goal, totalAmount, sessions[] }
    R->>S: createLearningPathDraft(actor, body)
    Note over S: Chỉ Mentor đã duyệt, yêu cầu phải chọn đúng mentor này, status selected | assessing,<br/>≤ 12 buổi, shrmKeys hợp lệ theo LP-01
    S->>DB: LearningPath.create({ status: "draft" }) — unique theo mentorshipRequestId (trùng → 409)
    S->>DB: LearningPathSession.insertMany(sessions, attempt 1, status planned)
    S-->>M: 201 { learningPath }

    M->>R: POST /:id/propose
    R->>S: proposeLearningPath(actor, id)
    Note over S: status draft | revision_requested, ≥ 1 buổi, 10.000đ ≤ T,<br/>buổi đánh giá 0đ đã completed (thiếu → 400)
    S->>S: rate = resolveBookingPlatformFeeRate(mentor)
    S->>S: shares = splitLearningPathShares(T, n)
    S->>DB: LearningPathSession.bulkWrite(shareAmount từng buổi gốc)
    S->>DB: findOneAndUpdate({ status, version }, { status: "proposed", platformFeeRate: rate }, gửi lại thì version + 1)
    S->>DB: MentorshipRequest.status → "path_proposed"
    S->>N: Ứng viên: "learning_path_proposed"
    S-->>M: 200 { learningPath }

    C->>R: GET /:id (xem lộ trình, giá, buổi, phần tiền)
    alt Ứng viên chấp nhận
        C->>R: POST /:id/accept { version }
        R->>S: acceptLearningPath(actor, id, body)
        Note over S: version khác bản đang xem → 409 (mentor vừa gửi bản mới)
        S->>DB: findOneAndUpdate({ status: "proposed", version }, { status: "pending_payment", acceptedAt })
        S->>N: Mentor: "learning_path_accepted"
        S-->>C: 200 { learningPath }
    else Ứng viên yêu cầu sửa
        C->>R: POST /:id/request-revision { note }
        R->>S: requestLearningPathRevision(actor, id, body)
        S->>DB: findOneAndUpdate({ status: "proposed", version }, { status: "revision_requested", revisionNote })
        S->>N: Mentor: "learning_path_revision_requested"
        S-->>C: 200 { learningPath }
        Note over M,S: Mentor sửa (PATCH /:id) rồi gửi lại (POST /:id/propose) → chia tiền lại, version + 1
    end
```

##### 3.28.2 Sequence Diagram: Thanh toán trọn gói bằng chuyển khoản, SePay hoặc admin xác nhận (LP-10, LP-11)
```mermaid
sequenceDiagram
    autonumber
    actor C as Ứng viên
    actor A as Admin
    participant R as learningPathsRouter
    participant P as learningPathPaymentService
    participant Bank as Ngân hàng + SePay
    participant W as sepayWebhookService
    participant DB as MongoDB (LearningPath, Payment, SepayWebhookEvent)
    participant N as deliverNotification

    C->>R: POST /:id/checkout
    R->>P: checkoutLearningPath(actor, id)
    Note over P: Chỉ khi pending_payment, Payment pending còn hạn cùng mã → trả lại giao dịch cũ
    P->>DB: LearningPath.updateOne({ paymentRef cũ }, { paymentRef: generatePiOrderRef() }) — giành mã, bấm 2 lần không sinh 2 mã
    P->>DB: recordTransferPending(Payment { type: "learning_path", amount: T, providerRef: PI…, paymentExpiresAt })
    P-->>C: 200 { learningPath, payment (mã PI…, số tiền, hạn) }
    C->>R: PATCH /:id/submit-transfer (bấm "Đã chuyển khoản")
    R->>P: submitLearningPathTransfer → recordTransferSubmitted (providerResponse.submittedAt)

    C->>Bank: Chuyển khoản nội dung chứa PI…
    Bank->>W: POST /api/payments/webhook/sepay (Authorization: Apikey)
    W->>W: receivedAt = now, verifySepayAuthorization
    W->>DB: SepayWebhookEvent: sepayId đã processed → trả idempotent
    W->>W: parsePiOrderFromText(content) → findPendingTargets(orderRef)
    W->>P: findPendingLearningPathTargets(orderRef) (bỏ giao dịch hết hạn, mã cũ)
    alt Không có mã, sai tiền hoặc nhiều đơn khớp
        W->>DB: SepayWebhookEvent.status = "unmatched"
    else Khớp 1 đơn, đúng tiền
        W->>P: confirmLearningPathTransfer(pathId, { force, forceNote, amount })
        P->>DB: Transaction: Payment → "success" (recordAdminTransferSuccess) + LearningPath "pending_payment" → "active", paidAt
        P->>N: Ứng viên + Mentor: "learning_path_paid"
        W->>DB: SepayWebhookEvent "processed" + receivedAt, processedAt, processingMs (QA-04)
    end
    W-->>Bank: 200 { success }
    C->>R: GET /api/payments/transfer-status?orderRef=PI… (poll) → "paid", redirectTo /learning-paths/:id

    Note over A,P: Đối soát tay (LP-11): GET /api/admin/payments/learning-path-transfers
    A->>P: PATCH /api/admin/payments/:id/confirm-learning-path-transfer { force, forceNote, amount }
    Note over P: Không force: ứng viên phải đã báo "Đã chuyển khoản",<br/>force + lý do ≥ 3 ký tự: nhận cả giao dịch đã hết hạn (tiền đến muộn),<br/>amount khác T → 400
    P->>P: confirmLearningPathTransfer(...) — cùng hàm, idempotent (đã active thì không báo lần 2)
```

##### 3.28.3 Sequence Diagram: Đặt lịch buổi, hoàn thành, ghi kết quả và thu nhập mentor (LP-12, LP-13, LP-14)
```mermaid
sequenceDiagram
    autonumber
    actor C as Ứng viên
    actor M as Mentor
    participant R as learningPathsRouter
    participant SS as learningPathSessionsService
    participant B as bookingsService
    participant E as mentorEarningsService
    participant DB as MongoDB (LearningPathSession, Booking, Mentor)
    participant N as deliverNotification

    C->>R: POST /:id/sessions/:sid/schedule { date, timeSlot, durationMinutes }
    R->>SS: scheduleLearningPathSession(actor, id, sid, body)
    Note over SS: checkSessionSchedulable: lộ trình active, buổi là buổi đang mở<br/>(buổi trước đã passed), giờ tương lai, slot mentor mở và trống,<br/>findCandidateBookingConflict (ứng viên không trùng giờ)
    SS->>DB: LearningPathSession: planned → scheduled, gắn bookingId (cập nhật có điều kiện)
    SS->>DB: Booking.create({ learningPathId, learningPathSessionId, status: "confirmed", ...learningPathBookingMoney(shareAmount, platformFeeRate) })
    Note over SS: paymentStatus "paid", paymentMethod "learning_path", platformFee ghi sẵn,<br/>tạo Booking lỗi → trả buổi về planned
    SS->>N: Mentor: "booking_confirmed"
    SS-->>C: 201 { learningPath, booking }

    M->>B: PATCH /api/bookings/:id/complete (sau buổi học)
    B->>DB: Booking.status = "completed", completedAt
    B->>E: tryCreditMentorForCompletedBooking(bookingId)
    E->>DB: Booking.mentorEarningsCreditedAt, earningsClearAt, earningsNetAmount = totalAmount − platformFee
    E->>DB: Mentor.finance.clearingBalance += net (buổi học lại 0đ → net 0)
    Note over E: earningsClearanceJob chuyển clearingBalance → availableBalance khi đủ ngày giữ tiền

    M->>R: PATCH /:id/sessions/:sid/outcome { outcome, feedback, scores[] }
    R->>SS: recordLearningPathSessionOutcome(actor, id, sid, body)
    Note over SS: lộ trình active, buổi scheduled, Booking của buổi completed
    SS->>SS: suggestOutcome(scores, shrmKeys) (gợi ý, mentor quyết định)
    SS->>DB: LearningPathSession: scheduled → done, outcome, feedback
    SS->>SS: resolveOutcomeNextStep(session, outcome, sessions)
    alt passed và mọi buổi đã passed
        SS->>DB: LearningPath: active → completed
    else passed
        Note over SS: Mở buổi tiếp theo để đặt lịch
    else not_passed, attempt 1
        SS->>DB: Tạo buổi học lại attempt 2, shareAmount 0, planned (đặt lịch được ngay)
    else not_passed, attempt ≥ 2
        Note over SS,M: Mentor đề xuất buổi bổ sung có phí:<br/>POST /:id/sessions/:sid/supplementary → buổi mới pending_payment
    end
    SS->>N: Ứng viên: "learning_path_session_result"
    SS-->>M: 200 { learningPath, nextStep, suggestedOutcome }
```

##### 3.28.4 Sequence Diagram: Hủy hoặc vắng buổi lộ trình, chặn luồng hoàn tiền theo buổi (LP-22)
```mermaid
sequenceDiagram
    autonumber
    actor U as Ứng viên / Mentor / Admin
    participant B as bookingsService
    participant G as isLearningPathOrAssessmentBooking
    participant DB as MongoDB (Booking, LearningPathSession)
    participant N as Thông báo

    U->>B: DELETE /api/bookings/:id (ứng viên hủy) · PATCH /api/bookings/mentor/:id/cancel (mentor hủy) · POST /api/bookings/:id/report-no-show (báo vắng)
    B->>G: Booking có learningPathId, hoặc sessionType "assessment", hoặc paymentMethod "learning_path"?
    alt Booking thường
        B->>B: Luồng cũ: hoàn tiền theo % / rebook credit / đổi mentor
    else Booking lộ trình hoặc buổi đánh giá 0đ
        B->>DB: closeLearningPathOrAssessmentBooking: findOneAndUpdate({ status ∉ cancelled, completed, no_show },<br/>{ status: cancelled | no_show, cancelledBy, cancelRefundAmountVnd: 0, cancelRefundPercent: 0 })
        Note over B: Không hoàn tiền, không sinh rebook credit (tiền đã thu trọn gói,<br/>hoàn tiền chỉ qua hủy cả lộ trình, LP-15)
        opt Booking của một buổi lộ trình
            B->>DB: LearningPathSession: scheduled → planned, bookingId = null (đặt lại đúng buổi đó)
        end
        Note over B: Buổi 0đ: cancelledBy dùng để tính lượt theo quyết định 13 (LP-06)
        B->>N: "booking_cancelled" cho ứng viên và mentor (nêu rõ không hoàn tiền theo buổi)
    end
    U->>B: PATCH /api/bookings/:id/mentor-cancel-resolution (chọn đổi mentor / hoàn tiền)
    B->>G: Booking lộ trình hoặc buổi 0đ → 400 "đặt lại buổi trên trang lộ trình"
```
