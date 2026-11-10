// Shared bounded microphone capture for AI Coach and AI Organizer.
// No recordings are stored here. Tracks, timers and visualizer are released on every exit.
export type AudioCapture = { stop: () => void; cancel: () => void };
type AudioCaptureOptions = {
  maxBytes?: number;
  maxDurationMs?: number;
  onComplete: (audio: Blob) => void;
  onError: (reason: 'too_long' | 'empty' | 'unavailable') => void;
  onLevel?: (level: number) => void;
};
export async function startBoundedAudioRecording({
  maxBytes = 2 * 1024 * 1024, maxDurationMs = 30000, onComplete, onError, onLevel,
}: AudioCaptureOptions): Promise<AudioCapture> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined') throw new Error('unavailable');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder: MediaRecorder;
  try {
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
      .find(value => MediaRecorder.isTypeSupported(value));
    if (!type) throw new Error('unavailable');
    recorder = new MediaRecorder(stream, { mimeType: type });
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    throw error;
  }
  let cancelled = false;
  let tooLarge = false;
  let bytes = 0;
  const chunks: Blob[] = [];
  let frame: number | null = null;
  let audioContext: AudioContext | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const release = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (audioContext) void audioContext.close().catch(() => {});
    audioContext = null;
    stream.getTracks().forEach(track => track.stop());
    onLevel?.(0);
  };
  const cancel = () => {
    cancelled = true;
    recorder.onstop = null;
    recorder.onerror = null;
    recorder.ondataavailable = null;
    if (recorder.state !== 'inactive') recorder.stop();
    release();
  };
  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  recorder.ondataavailable = event => {
    bytes += event.data.size;
    if (bytes > maxBytes) {
      tooLarge = true;
      stop();
    } else if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    cancel();
    onError('unavailable');
  };
  recorder.onstop = () => {
    release();
    if (cancelled) return;
    if (tooLarge) return onError('too_long');
    const audio = new Blob(chunks, { type: recorder.mimeType.split(';')[0] });
    if (audio.size < 16) return onError('empty');
    onComplete(audio);
  };
  try {
    if (onLevel && typeof window.AudioContext !== 'undefined') {
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      const visualize = () => {
        if (cancelled || recorder.state === 'inactive') return;
        analyser.getByteFrequencyData(spectrum);
        const activeBins = spectrum.slice(1, 20);
        const level = activeBins.reduce((sum, value) => sum + value, 0) / (activeBins.length * 255);
        onLevel(Math.min(1, level * 2));
        frame = requestAnimationFrame(visualize);
      };
      frame = requestAnimationFrame(visualize);
    }
    recorder.start(250);
    timer = setTimeout(stop, maxDurationMs);
  } catch (error) {
    cancel();
    throw error;
  }
  return { stop, cancel };
}
