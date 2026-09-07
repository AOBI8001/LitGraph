# Security and privacy

## Current boundary

LitGraph is a local web application. Bind it to loopback only. The development server is not a hardened multi-user hosting backend.

API keys are currently stored in browser localStorage, not a system credential vault. Model requests can include paper excerpts, user questions and attachments. Choose a trusted provider and consider its retention policy. Do not claim all processing is offline.

The local service uses page-session credentials and separate browser / Agent tokens. Do not share copied Agent connection text publicly. Refreshing the page or rotating the copied credentials invalidates the previous connection. A green status indicator reports recent connection activity, not independent verification of the model's identity or abilities.

Treat paper contents, web pages and attachments as untrusted data. Prompts require this separation, but prompting alone does not guarantee protection against malicious content.

## Before publishing

- Do not upload `projects/`, browser profiles, localStorage exports, API settings, connection tokens, personal paper files or generated logs.
- Inspect staged files; `.gitignore` cannot protect files previously tracked or forcibly added.
- The public build must use fictional sample data.
- Third-party papers are not relicensed by this repository's MIT license.
- Native desktop packaging should use an OS credential vault and application-specific storage before production distribution.

## Reporting

Do not publish secrets or private documents in an issue. Until a repository security-advisory channel is available, contact the maintainer through a privately agreed channel. No security contact or support address is advertised yet.
