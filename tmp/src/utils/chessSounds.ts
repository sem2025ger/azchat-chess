import type { SoundTheme } from '../context/ThemeContext';

export type ChessSoundType = 'move' | 'capture' | 'check';

const SOUND_FILES: Record<ChessSoundType, string> = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
};

const THEME_PLAYBACK: Record<
  Exclude<SoundTheme, 'Muted / Off'>,
  { volume: number; playbackRate: number }
> = {
  Default: {
    volume: 0.85,
    playbackRate: 1.0,
  },
  Soft: {
    volume: 0.45,
    playbackRate: 0.97,
  },
  Classic: {
    volume: 0.72,
    playbackRate: 0.82,
  },
  Wood: {
    volume: 0.20,
    playbackRate: 1.0,
  },
  Crystal: {
    volume: 0.11,
    playbackRate: 1.0,
  },
};

let audioContext: AudioContext | null = null;
let isChessSoundMuted = false;
let playbackGeneration = 0;

const activeSources = new Set<AudioBufferSourceNode>();
const bufferPromises = new Map<ChessSoundType, Promise<AudioBuffer | null>>();

function stopAllActiveSources(): void {
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // Source may already be stopped.
    }

    try {
      source.disconnect();
    } catch {
      // Never affect gameplay.
    }
  }

  activeSources.clear();
}

export function setChessSoundMuted(muted: boolean): void {
  if (isChessSoundMuted === muted) {
    return;
  }

  isChessSoundMuted = muted;
  playbackGeneration += 1;

  if (muted) {
    stopAllActiveSources();
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  return audioContext;
}

function loadBuffer(type: ChessSoundType): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);

  if (bufferPromises.has(type)) {
    return bufferPromises.get(type)!;
  }

  const promise = fetch(SOUND_FILES[type])
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.arrayBuffer();
    })
    .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
    .catch(() => {
      bufferPromises.delete(type);
      return null;
    });

  bufferPromises.set(type, promise);
  return promise;
}


function playWoodTone(ctx: AudioContext, type: ChessSoundType): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  const freq = type === 'move' ? 190 : type === 'capture' ? 145 : 235;
  const duration = type === 'check' ? 0.14 : 0.11;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.58), now + duration);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.Q.setValueAtTime(0.65, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.20, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playCrystalTone(ctx: AudioContext, type: ChessSoundType): void {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const primary = ctx.createOscillator();
  const shimmer = ctx.createOscillator();

  const base = type === 'move' ? 760 : type === 'capture' ? 610 : 980;
  const duration = type === 'check' ? 0.19 : 0.15;

  primary.type = 'sine';
  shimmer.type = 'sine';
  primary.frequency.setValueAtTime(base, now);
  shimmer.frequency.setValueAtTime(base * 1.5, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.095, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  primary.connect(gain);
  shimmer.connect(gain);
  gain.connect(ctx.destination);

  primary.start(now);
  shimmer.start(now);
  primary.stop(now + duration + 0.01);
  shimmer.stop(now + duration + 0.01);
}

export function preloadChessSounds(): void {
  if (typeof window === 'undefined') return;
  loadBuffer('move');
  loadBuffer('capture');
  loadBuffer('check');
}

export async function playChessSound(
  type: ChessSoundType,
  theme: SoundTheme
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (theme === 'Muted / Off' || isChessSoundMuted) return;

  const generationAtStart = playbackGeneration;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    if (ctx.state !== 'running') {
      return;
    }

    if (
      isChessSoundMuted ||
      generationAtStart !== playbackGeneration
    ) {
      return;
    }

    if (theme === 'Wood') {
      playWoodTone(ctx, type);
      return;
    }

    if (theme === 'Crystal') {
      playCrystalTone(ctx, type);
      return;
    }

    const buffer = await loadBuffer(type);
    if (!buffer) return;

    if (
      isChessSoundMuted ||
      generationAtStart !== playbackGeneration
    ) {
      return;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    const settings = THEME_PLAYBACK[theme as Exclude<SoundTheme, 'Muted / Off'>];
    source.buffer = buffer;
    source.playbackRate.value = settings.playbackRate;
    gain.gain.value = settings.volume;

    if (theme === 'Classic') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.7;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(ctx.destination);

    activeSources.add(source);

    source.onended = () => {
      activeSources.delete(source);
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // Never affect gameplay.
      }
    };

    source.start(0);

  } catch {
    // Ignore audio failures to prevent breaking gameplay
  }
}
