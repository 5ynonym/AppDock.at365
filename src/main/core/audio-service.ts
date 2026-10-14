import { AudioPlaybackQueue } from './audio-playback';
import { playAudioWave } from './audio-player';

/** All host-controlled sound, including previews, must use this instance. */
export const audioPlayback = new AudioPlaybackQueue(playAudioWave);
