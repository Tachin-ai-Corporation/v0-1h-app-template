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

## Sensitive Data in Logs

Note: API logs include full request/response data including Authorization headers
and tokens. This is intentional for debugging but should be considered when
sharing console output. Future enhancement: add optional redaction of Bearer
tokens and refresh tokens.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT-SIDE                                │
├─────────────────────────────────────────────────────────────────┤
│  lib/auth-client.ts                                             │
│    - authFetch() wraps all 1health API calls                    │
│    - Logs request/response to console.group()                   │
│    - Auto-refresh on 401 responses                              │
│    - Full request/response logging                              │
└─────────────────────────────────────────────────────────────────┘
```

## Disabling Logs

To disable API logging in production, set `enableLogging: false` when calling `authFetch()` or modify the `authFetch` function to check an environment variable.
