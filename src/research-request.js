export function formatResearchDuration(milliseconds, language = 'zh') {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return language === 'zh' ? minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`
    : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

// Pause cancels transport. Resume starts the same immutable request again.
// A generation guard discards late completions, even if a provider ignores abort.
export class ResearchRequest {
  constructor(execute, onChange, now = () => performance.now()) {
    this.execute = execute;
    this.onChange = onChange;
    this.now = now;
    this.status = 'idle';
    this.elapsedMs = 0;
    this.generation = 0;
  }
  elapsed() { return this.elapsedMs + (this.status === 'pending' ? this.now() - this.startedAt : 0); }
  async start() {
    if (this.status === 'pending' || this.status === 'done') return;
    const generation = ++this.generation;
    this.controller = new AbortController();
    this.startedAt = this.now();
    this.status = 'pending';
    this.onChange(this, 'state');
    this.timer = setInterval(() => this.onChange(this, 'tick'), 1000);
    try {
      const result = await this.execute(this.controller.signal);
      if (generation !== this.generation) return;
      this.elapsedMs = this.elapsed();
      this.status = 'done';
      this.result = result;
    } catch (error) {
      if (generation !== this.generation) return;
      this.elapsedMs = this.elapsed();
      this.status = 'error';
      this.error = error;
    } finally {
      if (generation === this.generation) {
        clearInterval(this.timer);
        this.onChange(this, 'state');
      }
    }
  }
  pause() {
    if (this.status !== 'pending') return;
    this.elapsedMs = this.elapsed();
    this.status = 'paused';
    ++this.generation;
    clearInterval(this.timer);
    this.controller.abort();
    this.onChange(this, 'state');
  }
}
