# API Traffic Debugger

Real-time API traffic monitoring system for debugging 1health API calls.

## Enabling the Debugger

Set the environment variable:

```
NEXT_PUBLIC_ENABLE_DEBUG_STREAM=true
```

When enabled, a floating terminal icon appears in the bottom-right corner of the app.

## Features

- **Real-time streaming**: Uses Server-Sent Events (SSE) for instant log updates
- **Request/Response logging**: Captures all 1health API calls including:
  - Initial LPL token exchange
  - Token refresh calls
  - All authenticated API calls via `authFetch()`
- **Collapsible entries**: Click any log entry to see headers and body details
- **Status color coding**: Visual indicators for response status codes
- **Minimizable**: Collapse to a small bar at the bottom of the screen
- **Auto-redaction**: Sensitive values (tokens, passwords) are automatically redacted

## Log Sources

| Source | Description |
|--------|-------------|
| `token-exchange` | Initial LPL decryption and one-time code exchange |
| `token-refresh` | OAuth token refresh calls |
| `api-call` | General API calls via `authFetch()` |
| `auth` | Authentication-related events |

## Log Types

| Type | Icon | Description |
|------|------|-------------|
| `request` | ↑ (blue) | Outgoing HTTP request |
| `response` | ↓ (green) | Incoming HTTP response |
| `error` | ⚠ (red) | Error occurred |
| `info` | ℹ (gray) | Informational message |

## Architecture

```
Server-Side                          Client-Side
┌─────────────────┐                  ┌──────────────────────┐
│ Token Routes    │──emit──▶         │                      │
│ authFetch()     │        │         │ DebugTrafficConsole  │
└─────────────────┘        │         │                      │
                           ▼         │ EventSource          │
                  ┌─────────────────┐│ - onmessage          │
                  │ debugLogEmitter ││ - Auto-reconnect     │
                  │ (EventEmitter)  │└──────────────────────┘
                  └────────┬────────┘          ▲
                           │                   │
                           ▼                   │
                  ┌─────────────────┐          │
                  │ /api/debug/stream│──SSE────┘
                  │ (SSE endpoint)  │
                  └─────────────────┘
```

## Production Usage

**Important**: Disable the debugger in production by removing or setting `NEXT_PUBLIC_ENABLE_DEBUG_STREAM=false`.

The SSE endpoint returns 403 when debug mode is disabled.
