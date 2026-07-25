# Full-Stack Google OAuth 2.0 Authentication System

A production-ready, full-stack Google OAuth 2.0 authentication module built with **Node.js**, **Express.js**, **MongoDB Atlas (Mongoose)**, **Passport.js**, and **JWT** stored in secure `HttpOnly` cookies. Features a modern dark-mode vanilla frontend with glassmorphic UI cards and micro-animations.

Designed with **Dual-Deployment Architecture** to run seamlessly on both **Vercel** (Serverless Functions) and **Render** (Standalone Node Server).

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Mongoose ORM)
- **Authentication:** Passport.js (`passport-google-oauth20`), JSON Web Tokens (`jsonwebtoken`), `cookie-parser`
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism design system), JavaScript (ES6 fetch API)
- **Deployment:** Vercel (`vercel.json` rewrites) & Render (`npm start`)

---

## 📁 Repository Structure

```
.
├── api/
│   └── index.js              # Express server entry point (Dual-Deployment compatible)
├── config/
│   ├── db.js                 # Mongoose MongoDB Atlas connection module
│   └── passport.js           # Passport Google OAuth 2.0 strategy setup
├── models/
│   └── User.js               # Mongoose User Schema
├── middleware/
│   └── authMiddleware.js     # JWT verification middleware for protected routes
├── routes/
│   └── authRoutes.js         # /auth/google, /auth/google/callback, /auth/me, /auth/logout
├── public/
│   ├── index.html            # Login page with Google Sign-In button
│   ├── dashboard.html        # Protected user dashboard
│   ├── css/
│   │   └── style.css         # Modern styling & animations
│   └── js/
│       ├── login.js          # Login page handler & session check
│       └── dashboard.js      # Dashboard data fetcher
├── .env.example              # Environment variables template
├── vercel.json               # Vercel serverless function routing rules
├── package.json              # Project dependencies and scripts
└── README.md                 # Complete Cloud Setup Guide
```

---

## ☁️ Complete Cloud Setup & Configuration Guide

Follow these step-by-step instructions to configure Google Cloud, MongoDB Atlas, Vercel, and Render.

---

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (e.g., `Google-Auth-Module`).
3. Navigate to **APIs & Services** > **OAuth Consent Screen**:
   - Select **External** as the User Type and click **Create**.
   - Fill in the App Name, User Support Email, and Developer Contact Information.
   - Save and continue through the Scopes step (ensure `userinfo.email` and `userinfo.profile` are added).
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **+ Create Credentials** and select **OAuth client ID**.
   - Select **Web application** as the Application type.
   - **Authorized JavaScript origins**:
     - Local: `http://localhost:5000`
     - Vercel: `https://<your-vercel-app-name>.vercel.app`
     - Render: `https://<your-render-app-name>.onrender.com`
   - **Authorized redirect URIs**:
     - Local: `http://localhost:5000/auth/google/callback`
     - Vercel: `https://<your-vercel-app-name>.vercel.app/auth/google/callback`
     - Render: `https://<your-render-app-name>.onrender.com/auth/google/callback`
5. Click **Create** and copy your **Client ID** (`GOOGLE_CLIENT_ID`) and **Client Secret** (`GOOGLE_CLIENT_SECRET`).

---

### 2. MongoDB Atlas Database Setup

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new **Free (M0) Cluster**.
3. Configure **Network Access**:
   - Go to **Network Access** under Security.
   - Click **Add IP Address** and select **Allow Access from Anywhere** (`0.0.0.0/0`) so Vercel and Render serverless instances can connect.
4. Configure **Database Access**:
   - Go to **Database Access** under Security.
   - Click **Add New Database User**. Choose Password authentication, enter a username and strong password, and assign **Read and write to any database** privileges.
5. Obtain the Connection String:
   - Click **Database** > **Connect** > **Drivers**.
   - Copy the MongoDB connection string (`MONGO_URI`). Format:
     ```env
     mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/google_auth_db?retryWrites=true&w=majority
     ```

---

### 3. Vercel Deployment Instructions

1. Push your repository to **GitHub**.
2. Sign in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. Ensure the **Root Directory** is set to `./` (Root).
5. In **Environment Variables**, add:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `MONGO_URI`: Your MongoDB Atlas Connection String
   - `JWT_SECRET`: A long random secret key
   - `CLIENT_URL`: `https://<your-vercel-app-name>.vercel.app`
   - `NODE_ENV`: `production`
6. Click **Deploy**. Vercel will build the project and execute `api/index.js` via `vercel.json` rewrites.

---

### 4. Render Deployment Instructions

1. Sign in to [Render](https://render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `google-auth-module` (or custom name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (Runs `node api/index.js`)
4. In the **Environment Variables** section, add:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `MONGO_URI`: Your MongoDB Atlas Connection String
   - `JWT_SECRET`: A long random secret key
   - `CLIENT_URL`: `https://<your-render-app-name>.onrender.com`
   - `NODE_ENV`: `production`
5. Click **Create Web Service**. Render will install dependencies and start the Node.js HTTP server.

---

## 💻 Local Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd google_login
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your credentials:
   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/google_auth_db?retryWrites=true&w=majority
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   JWT_SECRET=your_jwt_secret_key_here
   ```
5. Start the local server:
   ```bash
   npm start
   ```
6. Open your browser at `http://localhost:5000` to test Google Sign-In and the protected dashboard.

---

## 🔒 Security Highlights

- **HttpOnly Cookies:** JWT tokens are stored in `HttpOnly` cookies, shielding session tokens from client-side XSS attacks.
- **Auto-Registration:** User authentication queries MongoDB by `googleId` and automatically registers new users upon initial Google sign-in.
- **Middleware Guard:** `authMiddleware.js` enforces token verification on all protected endpoints (`/auth/me`).
- **Clean Logout:** `GET /auth/logout` explicitly clears the JWT cookie before redirecting the client.
