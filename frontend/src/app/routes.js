import { createHashRouter, redirect } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Checkout } from "./pages/Checkout";
import { Dashboard } from "./pages/Dashboard";
import { CVAnalysis } from "./pages/CVAnalysis";
import { AnalysisHistory } from "./pages/AnalysisHistory";
import { Interview } from "./pages/Interview";
import { AIGenderSelection } from "./pages/AIGenderSelection";
import InterviewRoom from "./pages/InterviewRoom";
import { InterviewFeedback } from "./pages/InterviewFeedback";
import { Mentors } from "./pages/Mentors";
import { MentorProfile } from "./pages/MentorProfile";
import { Booking } from "./pages/Booking";
import { SessionDetail } from "./pages/SessionDetail";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { AvatarDemo } from "./pages/AvatarDemo";
import { MentorReview } from "./pages/MentorReview";
// Mentor routes
import { MentorDashboard } from "./pages/MentorDashboard";
import { MentorSchedule } from "./pages/MentorSchedule";
import { MentorAnalytics } from "./pages/MentorAnalytics";
import { MentorMeetingDetail } from "./pages/MentorMeetingDetail";
import { MentorReviews } from "./pages/MentorReviews";
import { MeetingRoom } from "./pages/MeetingRoom";
import { MentorFinance } from "./pages/MentorFinance";
import { Courses } from "./pages/Courses";
import { CourseDetail } from "./pages/CourseDetail";
import { CourseLearning } from "./pages/CourseLearning";
import { MentorCourseManagement } from "./pages/MentorCourseManagement";
import { MentorCourseEdit } from "./pages/MentorCourseEdit";
import { MentorPeerReview } from "./pages/MentorPeerReview";
import { Pricing } from "./pages/Pricing";

export const router = createHashRouter([
  { path: "/", Component: Home },
  { path: "/login", Component: Login },
  { path: "/register", Component: Register },
  { path: "/checkout", Component: Checkout },
  { path: "/pricing", Component: Pricing },
  { path: "/avatar-demo", Component: AvatarDemo },
  // Course learning — full-screen, no sidebar
  { path: "/courses/:id/learn", Component: CourseLearning },
  {
    Component: AppLayout,
    children: [
      { path: "dashboard", Component: Dashboard },
      { path: "cv-analysis", Component: CVAnalysis },
      { path: "cv-analysis/history", Component: AnalysisHistory },
      { path: "interview", Component: Interview },
      { path: "interview/gender", Component: AIGenderSelection },
      { path: "interview/room", Component: InterviewRoom },
      { path: "interview/feedback", Component: InterviewFeedback },
      { path: "mentors", Component: Mentors },
      { path: "mentors/:id", Component: MentorProfile },
      { path: "booking/:id", Component: Booking },
      { path: "booking", Component: Booking },
      { path: "session/:id", Component: SessionDetail },
      { path: "review/:sessionId", Component: MentorReview },
      { path: "profile", Component: Profile },
      { path: "settings", Component: Settings },
      // Mentor routes
      { path: "mentor/dashboard", Component: MentorDashboard },
      { path: "mentor/schedule", Component: MentorSchedule },
      { path: "mentor/finance", Component: MentorFinance },
      { path: "mentor/analytics", Component: MentorAnalytics },
      { path: "mentor/reviews", Component: MentorReviews },
      { path: "mentor/meeting/:sessionId", Component: MeetingRoom },
      { path: "mentor/meeting-detail/:sessionId", Component: MentorMeetingDetail },
      { path: "courses", Component: Courses },
      { path: "courses/:id", Component: CourseDetail },
      { path: "mentor/courses", Component: MentorCourseManagement },
      { path: "mentor/courses/:id/edit", Component: MentorCourseEdit },
      { path: "mentor/peer-review", Component: MentorPeerReview },
    ],
  },
  // Wildcard route outside AppLayout to catch all unmatched routes
  { path: "*", loader: () => redirect("/") },
]);