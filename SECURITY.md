# Security and privacy

## Current boundary

LitGraph 1.1.8 is a Windows Electron application with a loopback-only local service. The separate developer web preview is not a hardened multi-user hosting backend. Do not expose either local service publicly.

The desktop build encrypts API configuration with Electron safeStorage backed by Windows and keeps it separate from project backups. It does not use plaintext fallback if encryption is unavailable. This does not protect against malicious processes already running as the same Windows user. The web development preview still stores API configuration in browser localStorage. Model requests can contain excerpts, questions and attachments: choose a trusted service and review its retention policy. Local-first does not mean entirely offline.

The renderer is sandboxed with context isolation and no Node integration. IPC verifies the sender and the main local frame. Originals are normalized to signature-checked PDF or plain text, not active HTML; document popups have no application preload, and web links open externally. Chromium's PDF viewer requires its own scripting capability. Public-file retrieval validates DNS addresses and redirects. Model endpoints intentionally support HTTPS and local HTTP models; entering an endpoint is a trust decision. Keep operating-system security protection enabled.

The local service uses page-session credentials and separate browser / Agent tokens. Do not share copied Agent connection text publicly. Refreshing the page or rotating the copied credentials invalidates the previous connection. A green status indicator reports recent connection activity, not independent verification of the model's identity or abilities.

Treat paper contents, web pages and attachments as untrusted data. Prompts require this separation, but prompting alone does not guarantee protection against malicious content.

## Before publishing

- Do not upload `projects/`, browser profiles, localStorage exports, API settings, connection tokens, personal paper files or generated logs.
- Inspect staged files; `.gitignore` cannot protect files previously tracked or forcibly added.
- The public build uses the sanitized 50-paper metadata sample, without private originals or personal paths.
- Third-party papers are not relicensed by this repository's MIT license.
- Installer files are explicitly allowlisted; Cloudflare deployment secrets, local test profiles and generated output must remain excluded.

## Statistics and distribution

The official desktop build sends minimal installation/launch/use events. It does not send document contents, model keys or hardware identifiers. An opt-out is available under Settings → About LitGraph. The collector stores HMAC installation IDs and aggregate counts, and the dashboard requires a separate secret. See [Privacy](PRIVACY.md) and [Metrics](docs/metrics.md). Network infrastructure still processes connection information.

Official installers are unsigned. A checksum verifies integrity, not trusted publisher identity. Only use official repository downloads. Tests cover known scenarios and do not guarantee absence of defects or vulnerabilities.

## Reporting

Do not publish secrets or private documents in an issue. Until a repository security-advisory channel is available, contact the maintainer through a privately agreed channel. No security contact or support address is advertised yet.
