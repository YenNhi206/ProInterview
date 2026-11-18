# Detailed Design – Function List

Each function = Class Diagram + Sequence Diagram + Class Specification.
Derived from backend/src/routes (262 endpoints grouped into use-case level functions).

## 3.1 Authentication
1. Sign Up
2. Verify Email
3. Sign In
4. Sign In with Google
5. Forgot & Reset Password
6. Refresh Access Token
7. Sign Out
8. Manage Login Sessions

## 3.2 Account & Profile
1. View Profile
2. Update Profile
3. Update Camera Consent
4. Close Account

## 3.3 CV Analysis
1. Upload & Analyze CV
2. View CV Analysis History
3. View CV Analysis Detail
4. Delete CV Analysis
5. Rate CV Analysis
6. Match CV with JD

## 3.4 AI Mock Interview
1. Start Interview Session
2. Answer Interview Question
3. Complete Interview
4. Evaluate Interview (Generate Feedback)
5. View Interview History
6. View Interview Detail

## 3.5 Mentor Discovery
1. Search Mentors
2. View Mentor Profile
3. View Mentor Availability
4. View Mentor Reviews

## 3.6 Booking (Customer)
1. Book Mentor
2. Submit Bank Transfer for Booking
3. View My Bookings
4. Reschedule Booking
5. Cancel Booking
6. Join Meeting Room
7. Report Mentor No-Show
8. Download Booking Invoice

## 3.7 Booking (Mentor)
1. View Mentor Bookings
2. Confirm Booking
3. Start & Check-in Meeting
4. Complete Booking & Save Notes
5. Save Mentor Knowledge
6. Reschedule / Cancel Booking by Mentor

## 3.8 Mentorship Request
1. Post Mentorship Request
2. View Mentorship Requests
3. Send Offer
4. Withdraw Offer
5. Select Offer
6. Close Mentorship Request

## 3.9 Subscription & Payment
1. View Plan Catalog
2. Upgrade Plan by Bank Transfer
3. Cancel Plan
4. Confirm Payment via SePay Webhook
5. View Payment History
6. Check Transfer Status

## 3.10 Course Learning
1. Browse Courses
2. View Course Detail
3. Enroll Free Course
4. View My Courses
5. Learn Lesson & Update Progress
6. Get Certificate

## 3.11 Cart & Checkout
1. Add Course to Cart
2. Remove Course from Cart
3. Validate Coupon
4. Checkout Cart
5. Cancel Order

## 3.12 Review & Report
1. Write Review
2. Reply to Review
3. Delete Review
4. Submit Report

## 3.13 Notification
1. View Notifications
2. Mark Notification as Read
3. Mark All as Read
4. Delete Notification

## 3.14 Mentor Profile
1. Apply as Mentor
2. Update Mentor Profile
3. Manage Availability
4. Request Price Change

## 3.15 Course Management (Mentor)
1. Create Course
2. Update Course
3. Submit Course for Review
4. Delete Course
5. Upload Course Video

## 3.16 Mentor Finance
1. View Mentor Dashboard
2. View Earnings
3. Update Payout Account
4. Request Payout
5. Peer Review Course

## 3.17 Moderation
1. Approve / Reject Course
2. Archive Course
3. Create / Import Questions
4. Update Question
5. Approve / Deprecate Question
6. Claim Moderation Item
7. Resolve Moderation Item

## 3.18 Admin – Users & Mentors
1. View Users
2. Lock / Unlock User
3. Change User Role
4. Close User Account
5. Approve / Reject Mentor
6. Set Mentor Commission
7. Approve / Reject Price Change

## 3.19 Admin – Finance
1. Confirm Bank Transfer
2. Confirm Booking Refund
3. Refund Held Payment
4. Approve / Reject Payout
5. Mark Payout as Paid
6. Release Mentor Earnings

## 3.20 Admin – Monitoring
1. Resolve Report
2. Toggle Review Visibility
3. View System Statistics
4. View AI Cost Dashboard
5. View User Behavior Analytics
6. View Audit Log

## 3.21 Achievement
1. Manage Achievements
