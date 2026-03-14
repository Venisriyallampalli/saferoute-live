# Safe Route Backend (Express + MongoDB)

This backend provides authentication APIs used by the mobile app:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## 1. Setup

1. Install dependencies:

npm install

2. Copy environment file:

cp .env.example .env

3. Update `.env` values.

4. Start server:

npm run dev

The default server URL is http://localhost:3001.

## 2. Development Password Reset Flow

When NODE_ENV is not production, `/api/auth/forgot-password` returns a `resetToken` in response for testing.
Use this token in `/api/auth/reset-password`.

## 3. Production Notes

- Set a strong JWT_SECRET.
- Restrict CORS_ORIGIN to known clients.
- Integrate email provider to send reset links instead of returning token.
- Keep MongoDB secured and network-restricted.
