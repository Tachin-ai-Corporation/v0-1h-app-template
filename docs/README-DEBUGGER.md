# API Traffic Debugger

Real-time API traffic monitoring in the browser console for debugging 1health API calls.

## How It Works

All API calls made through `authFetch()` in `lib/auth-client.ts` are automatically logged to the browser console with colored, collapsible output.

## Log Format

Each API call is logged as a collapsible group:

```
▼ [1health] POST /api/v2/query (200 OK) 145ms
    Request Headers: { Authorization: "Bearer [REDACTED]", ... }
    Request Body: { "key": "Person", ... }
    Response Body: { "data": [...], ... }
```

## Color Coding

- **Green (2xx)**: Successful responses
- **Yellow (4xx)**: Client errors
- **Red (5xx)**: Server errors
- **Blue**: Request info

## Sensitive Data Redaction

The following values are automatically redacted in logs:
- Authorization headers (Bearer tokens)
- Refresh tokens in request bodies

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT-SIDE                                │
├─────────────────────────────────────────────────────────────────┤
│  lib/auth-client.ts                                             │
│    - authFetch() wraps all 1health API calls                    │
│    - Logs request/response to console.group()                   │
│    - Auto-refresh on 401 responses                              │
│    - Sensitive data redaction                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Disabling Logs

To disable API logging in production, set `enableLogging: false` when calling `authFetch()` or modify the `authFetch` function to check an environment variable.
