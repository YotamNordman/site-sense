# Security & DLP Compliance

## Data Flow

```
Content Script (on explicit invoke only)
  → reads: accessibility tree, URL, title
  → captures: screenshot via chrome.tabs API
  → sends to: service worker (in-process)
    → sends to: native host (stdio pipe, no network)
      → MCP server reads it (Unix socket, 0600 permissions)
        → CLI session ends → data gone
```

Every arrow is local. No network hop. No disk write.

## What site-sense Captures

- DOM structure (accessibility tree) of the active tab
- Screenshot (base64 PNG, in memory)
- URL (path only — query params stripped) and title

## What site-sense NEVER Captures

- Form input values (password, text, credit card fields)
- URL query parameters or hash fragments (stripped)
- Cookies, localStorage, sessionStorage
- Auth tokens or credentials
- Data from non-active tabs
- Browsing history

## Permission Model

**Default mode:** `activeTab` only — zero install warning, access per user gesture.

**All-sites mode (opt-in):** `optional_host_permissions` requested at runtime — user approves once, revoked on session end.

```json
{
  "permissions": ["activeTab", "scripting", "nativeMessaging"],
  "optional_host_permissions": ["http://*/*", "https://*/*"]
}
```

**Not requested:** `<all_urls>`, `tabs`, `cookies`, `history`, `storage`, `webRequest`, `clipboardRead/Write`, `downloads`, `bookmarks`.

## Socket Security

- Socket directory: `0700` (user-only access)
- Socket file: `0600` (user-only read/write)
- bridge.json: `0600` (user-only)
- PID-guarded cleanup prevents race conditions

## Reporting Vulnerabilities

If you discover a security vulnerability, **do not open a public issue.**

Email: yotam.nordman@gmail.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 48 hours and work with you on a fix before public disclosure.
