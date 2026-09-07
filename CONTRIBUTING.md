# Contributing

1. Install Node.js 22.12+ and dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm dev` to start with a blank project; the optional sample contains 50 public bibliographic records.
3. Keep changes focused; do not include private projects, credentials, generated builds or screenshots.
4. Run `pnpm test`, `pnpm build` and `pnpm check:release`.
5. Test affected UI paths in Chinese and English, light and dark themes, and both 2D / 3D where applicable.

Browser regression helpers live in `tests/browser/`. They are Playwright CLI run-code functions, not Playwright Test files. Start the local server, open a CLI browser session at its URL, then use `run-code --filename tests/browser/verify-model-rotation.js`. Generated results belong in ignored `output/`. Older helpers may cover narrower fixtures; inspect their requirements before running.

Never use a real API key for automated UI tests. Use synthetic response fixtures and restore browser storage afterward. Never send private paper text to a test endpoint.

Update the corresponding docs whenever behavior or AI response schemas change. Executable contracts in `src/discovery-contract.js` and `src/research-agent.js` are the source of truth. Contributions to original project code are under MIT.
