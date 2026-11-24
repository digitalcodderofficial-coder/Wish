// 100% procedural Web Audio API ambient harmonic pad (zero external audio file dependencies)
class AmbientSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscNodes: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private playing = false;

  public toggle(): boolean {
    if (this.playing) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public start() {
    if (this.playing) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.11, now + 2.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(760, now);
    filter.Q.setValueAtTime(1.2, now);

    // Subtle slow filter breath LFO
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.12, now);
    lfoGain.gain.setValueAtTime(220, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);
    this.lfo = lfo;

    filter.connect(master);
    master.connect(this.ctx.destination);
    this.masterGain = master;

    // Lush D-flat major 9 / F minor cinematic chord frequencies (Hz)
    const freqs = [138.59, 207.65, 261.63, 311.13, 415.3];
    this.oscNodes = freqs.map((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime((idx - 2) * 4.5, now);
      oscGain.gain.setValueAtTime(idx === 0 ? 0.35 : 0.16, now);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      return osc;
    });

    this.playing = true;
  }

  public stop() {
    if (!this.playing || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, 0.0001), now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    const oscs = this.oscNodes;
    const lfo = this.lfo;
    setTimeout(() => {
      oscs.forEach((o) => {
        try {
          o.stop();
          o.disconnect();
        } catch {
          // ignore already stopped
        }
      });
      try {
        lfo?.stop();
        lfo?.disconnect();
      } catch {
        // ignore
      }
    }, 650);

    this.oscNodes = [];
    this.lfo = null;
    this.playing = false;
  }
}

export const ambientSynth = new AmbientSynthEngine();
