# Frontend (FE) - Project Overview

## 🛠 Technology Stack
- **Core**: React 18 + Vite 6
- **Styling**: Tailwind CSS 4, Material UI (MUI), Radix UI
- **Animations**: Framer Motion (Motion)
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Routing**: React Router 7
- **Backend Integration**: Supabase & Custom Fetch API utilities

## ✨ Implemented Features
- **Authentication**:
  - Email/Password Register & Login
  - Google Identity Services (GIS) Integration
  - Profile Management (View & Edit)
- **Mentorship System**:
  - Mentor Browsing & Details
  - Booking Flow
- **AI & Interview**:
  - AI Mock Interview Flow (detailed in `src/imports`)
  - CV Analysis & Feedback
  - Interview Room logic
- **Dashboard**: User & Mentor Dashboards with analytics
- **UI/UX**: Responsive design, Glassmorphism elements, Dark/Light modes

## 📂 Key Directory Structure
- `src/app/pages`: Contains 34+ page components (Home, Dashboard, Interview, Mentors, etc.)
- `src/app/utils`: API service layer (`auth.js`, `mentorApi.js`, `api.js`)
- `src/app/hooks`: Custom hooks (e.g., `useDIDStream.js`)
- `src/app/components`: Reusable UI components

## 🚀 Environment Variables
- `VITE_API_URL`: Points to the Backend API (default `http://localhost:5000`)
- `VITE_GOOGLE_CLIENT_ID`: Used for Google Authentication
