import { audioPlayback } from './audio-service';
export function playTtsWave(
  bytes: Buffer,
  duration: number,
  signal: AbortSignal,
  speed = 1,
  beforePlay?: () => void,
): Promise<void> {
  return audioPlayback.play({
    bytes,
    signal,
    speed,
    beforePlay,
    playbackTimeoutMs: (duration / speed + 30) * 1000,
  });
}
