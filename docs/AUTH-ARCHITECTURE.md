# Authentication Architecture

This document describes the authentication flow for the 1health App Template.

## Overview

The app uses OAuth2 tokens obtained through a secure Launch Payload (LPL) flow. Only the initial token exchange requires server-side processing (to protect the secret key). All subsequent API calls are made directly from the browser.

## Environment Selection

The auth page supports two environments: **Demo** and **Production**. Each uses its own set of environment variables:

| Environment | Secret Key | Base URL |
|-------------|------------|----------|
| Demo | `ONEHEALTH_SECRET_KEY_DEMO` | `NEXT_PUBLIC_1H_URL_DEMO` |
| Production | `ONEHEALTH_SECRET_KEY_PROD` | `NEXT_PUBLIC_1H_URL_PROD` |

Environment is auto-detected from `document.referrer`:
- Referrer containing `demo.1health` selects **Demo**
- Referrer containing `app.1health` selects **Production**
- Otherwise, the user chooses manually

The selected environment is persisted in the `environment` cookie and passed to `/api/token` during LPL exchange.

## Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   1health   │     │   Browser   │     │  App Server │     │ 1health API │
│   Portal    │     │             │     │ (/api/token)│     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Launch with    │                   │                   │
       │    encrypted LPL  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 2. POST /api/token│                   │
       │                   │    { lpl: "..." } │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │ 3. Decrypt LPL    │
       │                   │                   │    using env-     │
       │                   │                   │    specific key   │
       │                   │                   │    (SECRET_KEY_   │
       │                   │                   │    DEMO or _PROD) │
       │                   │                   │                   │
       │                   │                   │ 4. Exchange code  │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │ 5. OAuth tokens   │
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │ 6. Set cookies    │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │                   │ 7. Direct API calls with Bearer token │
       │                   │───────────────────────────────────────>│
       │                   │                   │                   │
```

## Token Storage

Tokens are stored in browser cookies:

| Cookie | Purpose | Max Age |
|--------|---------|---------|
| `access_token` | Bearer token for API auth | ~50 minutes |
| `refresh_token` | Used to obtain new access token | 7 days |
| `token_expires_at` | Unix timestamp (seconds) | 7 days |
| `onehealth_base_url` | Base URL for API calls (set per environment) | 30 days |
| `onehealth_environment` | Selected environment: `demo` or `prod` | 30 days |
| `user_id` | Current user's ID | 7 days |
| `user_org_id` | Current user's organization ID | 7 days |

## Token Refresh

When an access token expires, `authFetch()` automatically:
1. Detects the 401 response
2. Calls `refreshToken()` to get new tokens directly from 1health
3. Retries the original request with the new token

```typescript
// Token refresh flow (client-side)
POST https://{1health-url}/auth/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={token}&client_id=public-client
```

## Security Considerations

1. **ONEHEALTH_SECRET_KEY_DEMO / _PROD** - Only used server-side for LPL decryption, selected per environment
2. **Tokens in cookies** - Not httpOnly to allow client-side access (required for client-side API calls)
3. **CORS** - 1health API must allow requests from the app domain
4. **Automatic refresh** - Tokens are refreshed before expiration to maintain session

## Files

| File | Purpose |
|------|---------|
| `/app/api/token/route.tsx` | Server-side LPL decryption and initial token exchange |
| `/lib/auth-server.ts` | Server-side cookie utilities (minimal) |
| `/lib/auth-client.ts` | Client-side auth utilities, authFetch, token refresh |
| `/lib/api/*.ts` | Client-side API modules |
