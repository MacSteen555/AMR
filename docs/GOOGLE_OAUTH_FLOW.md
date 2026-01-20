# Google OAuth Flow

Clean, well-tested implementation of Google OAuth with PKCE for secure authentication.

## Flow Overview

```
User clicks "Sign in with Google"
    ↓
GET /api/auth/google/start
    - Generates PKCE code verifier & challenge
    - Generates state for CSRF protection
    - Stores verifier & state in httpOnly cookies
    - Returns Google authorization URL
    ↓
User redirected to Google
    - User sees Google login/consent screen
    - User authorizes the app
    ↓
Google redirects to /api/auth/google/callback?code=...&state=...
    - Validates state parameter
    - Retrieves code verifier from cookies
    - Exchanges code for tokens (with PKCE)
    - Gets user info from Google
    - Creates Supabase session (sets cookies)
    - Creates app user in database
    - Stores Google identity
    - Encrypts & stores refresh token
    ↓
Redirect to /dashboard
User is logged in! ✅
```

## Files

### 1. `lib/auth/google.ts`
Core OAuth logic:
- `googleOAuthStart()` - Generates authorization URL with PKCE
- `googleOAuthCallback()` - Handles token exchange and user creation

### 2. `app/api/auth/google/start/route.ts`
API endpoint to start OAuth flow:
- Calls `googleOAuthStart()`
- Stores PKCE parameters in cookies
- Returns authorization URL

### 3. `app/api/auth/google/callback/route.ts`
API endpoint for OAuth callback:
- Validates state and code verifier
- Calls `googleOAuthCallback()`
- Redirects to dashboard

### 4. `components/GoogleLoginButton.tsx`
Frontend button component:
- Calls `/api/auth/google/start`
- Redirects to returned URL
- Shows loading state

## Security Features

✅ **PKCE (Proof Key for Code Exchange)** - Prevents authorization code interception  
✅ **State parameter** - Prevents CSRF attacks  
✅ **HttpOnly cookies** - Stores sensitive parameters securely  
✅ **Encrypted tokens** - Refresh tokens encrypted with AES-256-GCM  
✅ **Short-lived cookies** - OAuth cookies expire in 10 minutes  

## Database Storage

After successful login, data is stored in:

1. **`auth.users`** - Supabase auth user (managed by Supabase)
2. **`app.users`** - Your app user record
3. **`app.user_identities`** - Link between app user and Google account
4. **`app.google_tokens`** - Encrypted refresh token for API calls

## Configuration Required

### Google Cloud Console
- OAuth 2.0 Client ID created
- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
- APIs enabled: Google My Business API
- Scopes configured in OAuth consent screen

### Supabase Dashboard
- Google provider enabled in Authentication → Providers
- Client ID and Secret configured

### Environment Variables
```bash
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
TOKEN_ENCRYPTION_SECRET=your-32-char-secret
```

## Testing

1. Start dev server: `npm run dev`
2. Visit: `http://localhost:3000/login`
3. Click "Sign in with Google"
4. Authorize the app
5. Should redirect to `/dashboard`

## Troubleshooting

**redirect_uri_mismatch**
- Ensure redirect URI in Google Cloud Console matches exactly
- Check `NEXT_PUBLIC_APP_URL` environment variable

**Provider not enabled**
- Enable Google provider in Supabase Dashboard
- Add Client ID and Secret

**Missing code verifier**
- Clear browser cookies and try again
- Ensure cookies are being set (check browser DevTools)

**invalid_grant**
- Authorization code already used or expired
- Try logging in again from the start

## Code Quality

- ✅ TypeScript with strict types
- ✅ Clear error messages
- ✅ Separated concerns (OAuth logic, API routes, UI)
- ✅ No console.log spam
- ✅ Proper error handling
- ✅ Well-commented
- ✅ Production-ready


