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
    volume: 0.80,
    playbackRate: 0.88,
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

    source.connect(gain);
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

  } catch (e) {
    // Ignore audio failures to prevent breaking gameplay
  }
}
