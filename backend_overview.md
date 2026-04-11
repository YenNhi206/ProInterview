# Backend (BE) - Project Overview

## 🛠 Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (JsonWebToken) + Bcrypt
- **API Integration**: Google Auth Library

## ✨ Implemented API Endpoints
### 1. Authentication (`/api/auth`)
- `POST /register`: Create new account (Customer/Mentor)
- `POST /login`: Standard email/password login
- `POST /google`: One-tap sign-in with Google
- `GET /me`: Get current user info (requires JWT)
- `PATCH /me`: Update user profile (requires JWT)

### 2. Mentors (`/api/mentors`)
- `GET /`: List all mentors (automatically seeds data if empty)
- `GET /:id`: Get specific mentor details by ID

## 📂 Key Directory Structure
- `src/index.js`: App entry point & middleware configuration
- `src/routes`: API route definitions (`auth.js`, `mentors.js`)
- `src/models`: Mongoose schemas (`User.js`, `Mentor.js`)
- `src/db`: Database connection logic
- `src/data`: Seed data (e.g., `mentorsSeed.json`)

## ⚙️ Development Tools
- **Nodemon**: Auto-restarts server during development
- **Seed Script**: `npm run seed` to populate mentors in the database
- **Environment**: Configured via `.env` (contains `MONGO_URI`, `JWT_SECRET`, etc.)
