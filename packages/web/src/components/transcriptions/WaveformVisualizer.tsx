import { useEffect, useRef, memo } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const BAR_COUNT = 48;
const MOBILE_FPS = 30;
const MOBILE_FRAME_MS = 1000 / MOBILE_FPS;

interface WaveformVisualizerProps {
  readonly analyser: AnalyserNode | null;
  readonly isPaused: boolean;
}

/**
 * High-performance waveform visualizer using direct DOM manipulation.
 * Bypasses React state/rendering entirely — bar heights are set via refs.
 * Throttled to 30fps on mobile to reduce GPU/CPU pressure.
 */
export const WaveformVisualizer = memo(function WaveformVisualizer({
  analyser,
  isPaused,
}: WaveformVisualizerProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!analyser || isPaused) {
      // Reset bars to flat when paused or no analyser
      for (const bar of barsRef.current) {
        if (bar) {
          bar.style.height = '4px';
        }
      }
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.floor(dataArray.length / BAR_COUNT);

    const draw = (timestamp: number) => {
      // Throttle to 30fps on mobile
      if (isMobile && timestamp - lastFrameTimeRef.current < MOBILE_FRAME_MS) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const normalized = sum / step / 255;
        const bar = barsRef.current[i];
        if (bar) {
          bar.style.height = `${Math.max(4, normalized * 64)}px`;
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [analyser, isPaused, isMobile]);

  const barColor = isPaused
    ? 'bg-yellow-400 dark:bg-yellow-500'
    : 'bg-teal-500 dark:bg-teal-400';

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <div className="flex items-end justify-center gap-0.5 h-16" aria-label="Audio waveform">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => { barsRef.current[i] = el; }}
            className={`w-1.5 rounded-full ${barColor}`}
            style={{ height: '4px' }}
          />
        ))}
      </div>
    </div>
  );
});
