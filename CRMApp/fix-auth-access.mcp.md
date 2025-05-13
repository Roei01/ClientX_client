# MCP Prompt – Fix Auth Flow and App Access Issues

The app currently blocks access to most routes because the user is not authenticated correctly.  
Even as a registered user, logout doesn't work, and the frontend fails to show any pages.

---

## 🔍 Please investigate and fix the following issues:

### 1. API Access

- `/api/users` and other routes return 401 Unauthorized
- Check if auth middleware (e.g. `authenticate`) is blocking access
- For now, allow all routes to return mock data even without real auth
  - Temporarily disable auth or fallback to `req.user = { id: "mockUserId" }`

### 2. Logout Handling

- Ensure logout endpoint clears the session or token properly
- If you're using Firebase or JWT, implement a simple `POST /api/auth/logout` that clears auth state
- Frontend should update UI accordingly after logout

### 3. Auth Middleware

- In the backend, modify the `authenticate` middleware to:
  - Allow bypassing real checks when in "mock mode"
  - If no token is found, inject a fake user so the app loads for testing

Example:

```js
if (!req.headers.authorization && process.env.MOCK_MODE === "true") {
  req.user = { id: "mock-user", role: "admin" };
  return next();
}
```
