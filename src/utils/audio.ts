/**
 * Procedural Web Audio API sound synthesizer for Romanian Whist.
 * Zero external audio files, works offline and immediately in any browser.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sound when dealing a card (short swish / snap)
   */
  public playDeal() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Audio context may be restricted before user gesture
    }
  }

  /**
   * Sound when placing a card on the felt table
   */
  public playCardPlay() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      // Sub click + filtered noise burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.07);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  /**
   * Sound when winning a trick
   */
  public playTrickWin() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    } catch {}
  }

  /**
   * Sound when placing a bid
   */
  public playBid() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  /**
   * Sound for invalid / forbidden action
   */
  public playForbidden() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.setValueAtTime(95, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  }

  /**
   * Fanfare on game victory / completed match
   */
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [
        { f: 523.25, d: 0.15, delay: 0 },
        { f: 659.25, d: 0.15, delay: 0.15 },
        { f: 783.99, d: 0.15, delay: 0.3 },
        { f: 1046.5, d: 0.45, delay: 0.45 },
      ];
      const now = ctx.currentTime;
      notes.forEach(({ f, d, delay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + delay);

        gain.gain.setValueAtTime(0.2, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + d + 0.05);
      });
    } catch {}
  }
}

export const sounds = new SoundEngine();
