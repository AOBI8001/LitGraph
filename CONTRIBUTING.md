# Contributing

1. Install Node.js 22.12+ and dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm dev` to start with a blank project; the optional sample contains 50 public bibliographic records.
3. Keep changes focused; do not include private projects, credentials, generated builds or screenshots.
4. Run `pnpm test`, `pnpm build`, `pnpm test:desktop` and `pnpm check:release`. On Windows, build the installer using `pnpm dist:win`.
5. Test affected UI paths in Chinese and English, light and dark themes, and both 2D / 3D where applicable.

Browser regression helpers live in `tests/browser/`. They are Playwright CLI run-code functions, not Playwright Test files. Start the local server, open a CLI browser session at its URL, then use `run-code --filename tests/browser/verify-model-rotation.js`. Generated results belong in ignored `output/`. Older helpers may cover narrower fixtures; inspect their requirements before running.

Never use a real API key for automated UI tests. Use synthetic response fixtures and restore browser storage afterward. Never send private paper text to a test endpoint.

Desktop smoke tests use isolated profiles under ignored `output/desktop/`, synthetic credentials and disabled telemetry. Set `LITGRAPH_TEST_EXECUTABLE` to test an unpacked or installed executable. Test actual installation, native controls, MCP and restart persistence before publishing binaries. Unit tests exercise telemetry deduplication and client queues without production requests. Cloudflare `*.local.json` configurations, `.dev.vars*`, deployment secrets and all `release/` files must stay out of source commits; publish installer binaries only as Release assets.

Update the corresponding docs whenever behavior or AI response schemas change. Executable contracts in `src/discovery-contract.js` and `src/research-agent.js` are the source of truth. Contributions to original project code are under MIT.
