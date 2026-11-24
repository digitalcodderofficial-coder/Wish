import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { ParticleCanvas } from './components/ParticleCanvas';
import { ambientSynth } from './audio/ambientSynth';

const STORY_DURATION_SEC = 46;
const HOLD_FINALE_SEC = 8;

export default function App() {
  const [timeline, setTimeline] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    let last = performance.now();
    let rafId = 0;
    const totalCycle = STORY_DURATION_SEC + HOLD_FINALE_SEC;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      elapsedRef.current = (elapsedRef.current + dt) % totalCycle;

      const t = Math.min(1, elapsedRef.current / STORY_DURATION_SEC);
      setTimeline(t);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    return () => {
      ambientSynth.stop();
    };
  }, []);

  const handleReplay = () => {
    elapsedRef.current = 0;
    setTimeline(0);
  };

  const handleToggleAudio = () => {
    const active = ambientSynth.toggle();
    setAudioEnabled(active);
  };

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden">
      <ParticleCanvas timeline={timeline} />

      {/* Whisper-quiet top-right icon-only controls (no bottom bar or code overlay) */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleAudio}
          aria-label={audioEnabled ? 'Mute ambient sound' : 'Play ambient sound'}
          title={audioEnabled ? 'Mute sound' : 'Play sound'}
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/45 hover:text-white bg-black/30 hover:bg-white/10 transition-colors cursor-pointer"
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={handleReplay}
          aria-label="Replay animation"
          title="Replay"
          className="flex items-center justify-center w-9 h-9 rounded-full text-white/45 hover:text-white bg-black/30 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
}
