# Đơn đăng ký đề tài V2 (bản Markdown cho agent)

> Chép nguyên văn phần nội dung từ `V2_FA26_Capstone_ProInterview_Registration.docx`. Không sửa file này; đơn đổi thì chép lại bản mới.
> Đây là **phạm vi đã đăng ký với hội đồng**. Mã REQ nằm trong `REQUIREMENTS.md`.

**Tên đề tài:** ProInterview - AI-Powered Interview Coaching & Mentor Platform (GFA26SE160)

## Context

Candidates, especially recent graduates, often enter real interviews with very few opportunities for quality feedback and practice. Platforms like Pramp or Interviewing.io offer peer mock interviews, but feedback quality is inconsistent and not readily available for the Vietnamese market; mass-market courses (Udemy) are one-sided and not personalized; and one-on-one mentoring is often based on personal connections, sold session by session, without a clear learning path or transparent scheduling, payment and evaluation. In addition, each company evaluates candidates for the same position by its own criteria, which generic practice tools cannot reflect. No platform in Vietnam connects AI practice, structured mentoring and real employers' evaluation criteria on one standardized competency framework.

## Proposed Solutions

A unified web platform that connects interview practice, personalized mentoring, CV preparation and real job opportunities into one end-to-end journey, built around a single Candidate Profile. Five core components:

- **AI Avatar Interview Module**: simulates a real interview and adjusts follow-up questions based on the candidate's CV, the target job and previous answers.
- **Personalized Mentorship Program**: verified mentors assess the candidate in a free first session, then build a personalized learning path session by session toward the target job. After each session the mentor gives feedback; sessions that are not passed are retaught before moving on.
- **Multi-CV Portfolio & JD Best-Fit Engine**: stores multiple tailored CV versions, analyzes a target job description to recommend the best-fit CV, highlights skill and experience gaps and suggests improvements.
- **Video Course Library**: courses created by the platform's mentors to help candidates close gaps found during mock interviews, mentoring or CV analysis.
- **Enterprise Collaboration & Job Posts**: HR representatives of partner companies act as Company Moderators: they review AI-generated interview questions, define company-specific scoring rubrics, publish job posts, and review applicants together with how they answered against the company's rubric.

Key differentiator: performance is measured against the SHRM and DDI competency frameworks, enriched by company-specific criteria from real employers. Two-tier Human-in-the-loop: platform moderators and company moderators review AI-generated content, and their review decisions are fed back to continuously improve AI question generation and scoring. The Candidate Profile records all verified results (AI interviews, mentor assessments, learning progress) and connects them to real job posts.

## Functional requirements

### 1. Candidate (Job seeker)

1. Register & Login: Sign up / log in via email or Google OAuth
2. Manage Candidate Profile: Manage personal information, target roles and multiple CVs; view verified competency results recorded by the system
3. Practice AI Interview: Answer questions from an AI avatar, get scored against the SHRM/DDI framework and company-specific criteria
4. JD Best-Fit Matcher & CV Editor: Match CVs to a job description, view gaps, refine the CV with AI suggestions and export as PDF
5. Browse Job Posts & Apply: View job posts from partner companies, see personal gaps against each post, practice for the post and apply with a CV
6. Request Mentorship: Choose a mentor and a target job post, send the profile for a free assessment session
7. Follow Learning Path: Review and pay for the mentor's learning path, attend sessions, view feedback and track progress
8. Enroll in Courses: Purchase and watch video courses created by mentors
9. Track Progress & Recommendations: View interview history, progress dashboard and suggested mentors, courses and job posts
10. Rate, Review & Report: Rate the mentor, flag a mentor, inappropriate content or inaccurate AI results

### 2. Mentor

1. Manage Availability: Set available time slots and session pricing
2. Assess Candidate: Handle mentorship requests and evaluate the candidate in a free assessment session
3. Build Learning Path: Create a personalized session-by-session plan based on the candidate's profile and target job post
4. Session Feedback & Retake: Give feedback after each session, mark it passed or not passed, and reteach sessions not passed
5. Create & Manage Courses: Create and edit video course content
6. View Earnings: Track income, submit payout requests

### 3. Admin

1. Manage Users & Mentors: Approve new mentors, suspend/reactivate accounts
2. Manage Partner Companies: Create partner companies and invite their Company Moderators
3. Moderate Reviews & Reports: Hide/show reviews, handle abuse reports
4. Reconcile Payments & Refunds: Confirm bank transfers (auto via webhook, manual when the gateway fails), handle refunds, disputes and mentor payouts
5. Monitor Platform Finance: Track revenue from learning paths, courses and subscription plans

### 4. Platform Moderator (Internal Quality Auditor)

1. Review Question Bank: Inspect, edit, approve or deprecate AI-generated questions
2. Approve Company Rubrics: Validate company-specific criteria against the SHRM/DDI framework before use
3. Review Queue: Process flagged or inaccurate AI questions and evaluation results
4. Approve AI Improvements: Approve improvements to AI question generation and scoring derived from review feedback
5. Approve Courses & Job Posts: Final approval of AI-prescreened courses; hide reported job posts
6. Quality Dashboard: Monitor AI quality indicators and moderator review results

### 5. Company Moderator (HR representative of a partner company)

1. Review Interview Questions: Approve, edit or reject AI-generated questions for the company's job roles
2. Build Company Rubric: Define company-specific scoring criteria for approved questions
3. Manage Job Posts: Publish and close job posts with required competencies
4. Review Applications: View applicants' CV, verified profile and how they answered against the company rubric; shortlist or reject

### 6. AI System

1. Generate Interview Questions: Generate questions grounded in the SHRM/DDI framework, personalized from CV and job post
2. Evaluate Answers: Score answers against the SHRM/DDI framework and company rubrics with supporting evidence
3. Multi-modal Behavioral Analysis: Analyze voice, eye contact, head stability and facial expression in real time
4. AI Avatar Pipeline: Text-to-speech and lip-sync video for the virtual interviewer
5. CV Validation & CV-JD Matching: Verify uploaded files are CVs, extract skills and score CV-to-JD fit
6. Learning from Reviews: Use moderator review decisions to improve question generation and scoring
7. Profile Aggregation & Recommendations: Update the candidate's competency profile and suggest mentors, courses and job posts
8. Course Pre-screening & Cost Monitoring: Pre-screen submitted courses before moderator approval; track AI cost and alert on anomalies

## Non-functional requirements

1. CV/JD analysis returns a result in ≤ 60 seconds
2. Personalized avatar video generation ≤ 130 seconds; cached videos return almost instantly
3. Bank transfers are auto-reconciled within seconds of the transaction
4. Support at least 100 concurrent users (MVP target)
5. No user facial video is stored; only behavioral analysis metrics are kept
6. Candidate data is shared with a company only when the candidate applies and gives consent

## Theory and practice (3.2a)

RESTful API, JWT authentication, role-based access control (RBAC), NoSQL database design, LLM prompt engineering and human-in-the-loop AI evaluation, text-to-speech and lip-sync API integration, computer vision for behavioral analysis, NLP for CV/JD matching, webhook-based payment reconciliation, caching, Web Audio/Web Speech API.

## Products

- Web Application: unified platform serving Candidate, Mentor, Admin, Platform Moderator and Company Moderator portals with RBAC.
- Backend API System: RESTful API covering authentication, profile, mentorship, job posts and applications, payment and notification services.
- AI Services Module: question generation, answer evaluation, behavioral analysis and CV-JD matching.
- AI Avatar Pipeline: text-to-speech and lip-sync integration for the AI mock-interview avatar.

## Proposed Tasks (3.2c)

- Task package 1: Deploy Candidate features (profile, AI interview, CV/JD, job posts and applications, courses, dashboard)
- Task package 2: Deploy Personalized Mentorship Program (mentor assessment, learning path, session feedback, payment and payout)
- Task package 3: Deploy Admin, Platform Moderator and Company Moderator features (administration, payment reconciliation, question and rubric review, job posts, application review)
- Task package 4: Deploy AI module (question generation, evaluation, learning from reviews, behavioral analysis, avatar pipeline, recommendations)

## Other comments

Most of the backend and the main frontend flows were already built before this capstone registration; the capstone will focus on the Personalized Mentorship Program, the Candidate Profile and job post connection, enterprise collaboration, and completing the remaining items.
