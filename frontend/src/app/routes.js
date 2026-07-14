import { createBrowserRouter, redirect } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Home } from "./pages/home/Home";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { VerifyEmail } from "./pages/auth/VerifyEmail";
import { Checkout } from "./pages/booking/Checkout";
import { getUser } from "./utils/auth/auth.js";
import { CVAnalysisHub } from "./pages/cv/CVAnalysisHub";
import { CVAnalysis } from "./pages/cv/CVAnalysis";
import { CVAnalysisResult } from "./pages/cv/CVAnalysisResult";
import { AnalysisHistory } from "./pages/cv/AnalysisHistory";
import { CVAnalysisHistoryHub } from "./pages/cv/CVAnalysisHistoryHub";
import { Interview } from "./pages/interview/Interview";
import { AIGenderSelection } from "./pages/interview/__archived__/AIGenderSelection";
import InterviewRoom from "./pages/interview/InterviewRoom";
import { InterviewFeedback } from "./pages/interview/InterviewFeedback";
import { InterviewTrial } from "./pages/interview/InterviewTrial";
import { InterviewTrialDone } from "./pages/interview/InterviewTrialDone";
import { Mentors } from "./pages/mentors/Mentors";
import { MentorProfile } from "./pages/mentors/MentorProfile";
import { Booking } from "./pages/booking/Booking";
import { SessionDetail } from "./pages/booking/SessionDetail";
import { MyBookings } from "./pages/booking/MyBookings";
import { Profile } from "./pages/account/Profile";
import { Dashboard } from "./pages/account/Dashboard";
import { Settings } from "./pages/account/Settings";
import { PaymentReturn } from "./pages/payment/PaymentReturn";
import { SuccessPage } from "./pages/payment/SuccessPage";
import { FailurePage } from "./pages/payment/FailurePage";
import { AvatarDemo } from "./pages/interview/AvatarDemo";
import { MentorReview } from "./pages/booking/MentorReview";
import { MentorDashboard } from "./pages/mentor/MentorDashboard";
import { MentorSchedule } from "./pages/mentor/MentorSchedule";
import { MentorAnalytics } from "./pages/mentor/MentorAnalytics";
import { MentorMeetingDetail } from "./pages/mentor/MentorMeetingDetail";
import { MentorReviews } from "./pages/mentor/MentorReviews";
import { MeetingRoom } from "./pages/mentor/MeetingRoom";
import { MentorFinance } from "./pages/mentor/MentorFinance";
import { Courses } from "./pages/courses/Courses";
import { CourseDetail } from "./pages/courses/CourseDetail";
import { CourseLearning } from "./pages/courses/CourseLearning";
import { MyCourses } from "./pages/courses/MyCourses";
import { MentorCourseManagement } from "./pages/mentor/MentorCourseManagement";
import { MentorCourseEdit } from "./pages/mentor/MentorCourseEdit";
import { MentorPeerReview } from "./pages/mentor/MentorPeerReview";
import { MentorArea } from "./pages/mentor/MentorArea";
import { MentorSessionFeedback } from "./pages/mentor/MentorSessionFeedback";
import { Pricing } from "./pages/home/Pricing";
import { Terms } from "./pages/home/Terms";
import { Privacy } from "./pages/home/Privacy";
import { About } from "./pages/home/About";
import { Blog } from "./pages/home/Blog";
import { Achievements } from "./pages/home/Achievements";
import { AchievementDetail } from "./pages/home/AchievementDetail";
import { AdminLayout } from "./pages/admin/AdminLayout.jsx";
import { adminLoader } from "./pages/admin/adminLoader.js";
import { AdminDashboard } from "./pages/admin/AdminDashboard.jsx";
import { AdminMentors } from "./pages/admin/AdminMentors.jsx";
import { AdminUsers } from "./pages/admin/AdminUsers.jsx";
import { AdminImportUsers } from "./pages/admin/AdminImportUsers.jsx";
import { AdminBookings } from "./pages/admin/AdminBookings.jsx";
import { AdminCoursePayments } from "./pages/admin/AdminCoursePayments.jsx";
import { AdminSubscriptionPayments } from "./pages/admin/AdminSubscriptionPayments.jsx";
import { AdminMentorsPending } from "./pages/admin/AdminMentorsPending.jsx";
import { ProtectedOutlet } from "./components/auth/ProtectedOutlet.jsx";
import { requireAuthLoader, requireCustomerAuthLoader } from "./utils/auth/requireAuthLoader.js";
import {
  AdminUserDetail,
  AdminFinance,
  AdminTransactions,
  AdminPayouts,
  AdminContentQuestions,
  AdminSystemSettings,
} from "./pages/admin/AdminPlaceholders.jsx";
import { AdminContentCourses } from "./pages/admin/AdminContentCourses.jsx";
import { AdminAnalytics } from "./pages/admin/AdminAnalytics.jsx";
import { AdminReviews } from "./pages/admin/AdminReviews.jsx";
import { AdminSupport } from "./pages/admin/AdminSupport.jsx";
import { AdminMentorDetail } from "./pages/admin/AdminMentorDetail.jsx";
import { AdminBookingDetail } from "./pages/admin/AdminBookingDetail.jsx";
import { AdminBookingCheckIns } from "./pages/admin/AdminBookingCheckIns.jsx";
import { AdminAchievements } from "./pages/admin/AdminAchievements.jsx";

/** Đã đăng nhập mentor/admin → hub riêng, không xem landing customer. */
function roleHomeLoader() {
  const user = getUser();
  if (user?.role === "mentor") throw redirect("/mentor/dashboard");
  if (user?.role === "admin") throw redirect("/admin");
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, loader: roleHomeLoader, Component: Home },
      { path: "mentors", Component: Mentors },
      { path: "mentors/:id", Component: MentorProfile },
      { path: "courses", Component: Courses },
      { path: "courses/:id", Component: CourseDetail },
      { path: "pricing", Component: Pricing },
      { path: "about", Component: About },
      { path: "achievements", Component: Achievements },
      { path: "achievements/:id", Component: AchievementDetail },
      { path: "blog", Component: Blog },
      { path: "terms", Component: Terms },
      { path: "privacy", Component: Privacy },
      { path: "cv-analysis", Component: CVAnalysisHub },
      { path: "cv-analysis/jd/history", Component: AnalysisHistory },
      { path: "cv-analysis/jd/result/:analysisId", Component: CVAnalysisResult },
      { path: "cv-analysis/jd/result", Component: CVAnalysisResult },
      { path: "cv-analysis/jd", Component: CVAnalysis },
      { path: "cv-analysis/field/history", Component: AnalysisHistory },
      { path: "cv-analysis/field/result/:analysisId", Component: CVAnalysisResult },
      { path: "cv-analysis/field/result", Component: CVAnalysisResult },
      { path: "cv-analysis/field", Component: CVAnalysis },
      { path: "cv-analysis/history", Component: CVAnalysisHistoryHub },
      { path: "interview", Component: Interview },
      { path: "interview/gender", loader: requireCustomerAuthLoader, Component: AIGenderSelection },
      { path: "interview/room", loader: requireCustomerAuthLoader, Component: InterviewRoom },
      { path: "interview/feedback", loader: requireCustomerAuthLoader, Component: InterviewFeedback },
      { path: "interview/trial", loader: requireCustomerAuthLoader, Component: InterviewTrial },
      { path: "interview/trial/done", loader: requireCustomerAuthLoader, Component: InterviewTrialDone },
      {
        loader: requireAuthLoader,
        Component: ProtectedOutlet,
        children: [
          {
            path: "dashboard",
            loader: () => {
              const user = getUser();
              if (user?.role === "admin") throw redirect("/admin");
              if (user?.role === "mentor") throw redirect("/mentor/dashboard");
              return null;
            },
            Component: Dashboard,
          },
          { path: "my-bookings", Component: MyBookings },
          { path: "my-courses", Component: MyCourses },
          { path: "booking/:id", Component: Booking },
          { path: "booking", Component: Booking },
          { path: "session/:id", Component: SessionDetail },
          { path: "review/:sessionId", Component: MentorReview },
          { path: "profile", Component: Profile },
          { path: "settings", Component: Settings },
          {
            path: "mentor",
            Component: MentorArea,
            children: [
              { path: "dashboard", Component: MentorDashboard },
              { path: "schedule", Component: MentorSchedule },
              { path: "finance", Component: MentorFinance },
              { path: "analytics", Component: MentorAnalytics },
              { path: "reviews", Component: MentorReviews },
              { path: "meeting-detail/:sessionId", Component: MentorMeetingDetail },
              { path: "courses", Component: MentorCourseManagement },
              { path: "courses/:id/edit", Component: MentorCourseEdit },
              { path: "peer-review", Component: MentorPeerReview },
              { path: "meeting/:sessionId", loader: ({ params }) => redirect(`/meeting/${params.sessionId}`) },
            ],
          },
          { path: "mentor/session-feedback/:sessionId", Component: MentorSessionFeedback },
        ],
      },
    ],
  },
  { path: "/login", Component: Login },
  { path: "/register", Component: Register },
  { path: "/forgot-password", Component: ForgotPassword },
  { path: "/reset-password", Component: ResetPassword },
  { path: "/verify-email", Component: VerifyEmail },
  { path: "/checkout", loader: requireAuthLoader, Component: Checkout },
  { path: "/payment-return", Component: PaymentReturn },
  { path: "/payment-success", Component: SuccessPage },
  { path: "/payment-failure", Component: FailurePage },
  { path: "/avatar-demo", Component: AvatarDemo },
  { path: "/courses/:id/learn", loader: requireAuthLoader, Component: CourseLearning },
  { path: "/meeting/:sessionId", loader: requireAuthLoader, Component: MeetingRoom },
  {
    path: "/admin",
    Component: AdminLayout,
    loader: adminLoader,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "analytics", Component: AdminAnalytics },
      { path: "users", Component: AdminUsers },
      { path: "users/import", Component: AdminImportUsers },
      { path: "users/:id", Component: AdminUserDetail },
      { path: "mentors/pending", Component: AdminMentorsPending },
      { path: "mentors/:id", Component: AdminMentorDetail },
      { path: "mentors", Component: AdminMentors },
      { path: "finance", Component: AdminFinance },
      { path: "transactions", Component: AdminTransactions },
      { path: "payouts", Component: AdminPayouts },
      { path: "bookings", Component: AdminBookings },
      { path: "bookings/check-ins", Component: AdminBookingCheckIns },
      { path: "bookings/:id", Component: AdminBookingDetail },
      { path: "course-payments", Component: AdminCoursePayments },
      { path: "subscription-payments", Component: AdminSubscriptionPayments },
      { path: "content/questions", Component: AdminContentQuestions },
      {
        path: "content/videos",
        loader: () => redirect("/admin/content/courses?view=incomplete"),
      },
      { path: "content/courses", Component: AdminContentCourses },
      { path: "settings", Component: AdminSystemSettings },
      { path: "reviews", Component: AdminReviews },
      { path: "support", Component: AdminSupport },
      { path: "achievements", Component: AdminAchievements },
      { path: "interview-metrics", loader: () => redirect("/admin/content/questions") },
    ],
  },
  { path: "*", loader: () => redirect("/") },
]);
