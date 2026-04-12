import { createHashRouter, redirect } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Home } from "./pages/home/Home";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { Checkout } from "./pages/booking/Checkout";
import { Dashboard } from "./pages/account/Dashboard";
import { CVAnalysis } from "./pages/cv/CVAnalysis";
import { AnalysisHistory } from "./pages/cv/AnalysisHistory";
import { Interview } from "./pages/interview/Interview";
import { AIGenderSelection } from "./pages/interview/AIGenderSelection";
import InterviewRoom from "./pages/interview/InterviewRoom";
import { InterviewFeedback } from "./pages/interview/InterviewFeedback";
import { Mentors } from "./pages/mentors/Mentors";
import { MentorProfile } from "./pages/mentors/MentorProfile";
import { Booking } from "./pages/booking/Booking";
import { SessionDetail } from "./pages/booking/SessionDetail";
import { Profile } from "./pages/account/Profile";
import { Settings } from "./pages/account/Settings";
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
import { MentorCourseManagement } from "./pages/mentor/MentorCourseManagement";
import { MentorCourseEdit } from "./pages/mentor/MentorCourseEdit";
import { MentorPeerReview } from "./pages/mentor/MentorPeerReview";
import { Pricing } from "./pages/home/Pricing";

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