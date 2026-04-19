import { getAnnouncementUrl, type AnnouncementKey } from "./announcements";

type PlayOptions = {
  cooldownMs?: number;
  interrupt?: boolean;
};

const ANNOUNCEMENT_VOLUME_STORAGE_KEY = "mg_announcement_volume";
const DEFAULT_ANNOUNCEMENT_VOLUME = 0.88;
const MAX_GAIN_VOLUME = 1.08;

export type AnnouncementPlaybackState = {
  currentKey: AnnouncementKey | null;
  isPlaying: boolean;
  volume: number;
};

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, value));
}

class AnnouncementController {
  private canAutoplay = false;
  private audioContext: AudioContext | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSource: MediaElementAudioSourceNode | null = null;
  private currentKey: AnnouncementKey | null = null;
  private isPlaying = false;
  private volume = DEFAULT_ANNOUNCEMENT_VOLUME;
  private lastPlayedAt = new Map<AnnouncementKey, number>();
  private listeners = new Set<(state: AnnouncementPlaybackState) => void>();

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(ANNOUNCEMENT_VOLUME_STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) {
        this.volume = clampVolume(parsed);
      }
    } catch (error) {
      console.warn("Unable to restore announcement volume", error);
    }
  }

  getState(): AnnouncementPlaybackState {
    return {
      currentKey: this.currentKey,
      isPlaying: this.isPlaying,
      volume: this.volume
    };
  }

  subscribe(listener: (state: AnnouncementPlaybackState) => void) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  getVolume() {
    return this.volume;
  }

  setVolume(nextVolume: number) {
    this.volume = clampVolume(nextVolume);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          ANNOUNCEMENT_VOLUME_STORAGE_KEY,
          this.volume.toString()
        );
      }
    } catch (error) {
      console.warn("Unable to persist announcement volume", error);
    }

    if (this.gainNode) {
      this.gainNode.gain.value = this.volume * MAX_GAIN_VOLUME;
    }
    if (this.currentAudio && !this.currentSource) {
      this.currentAudio.volume = this.volume;
    }
    this.emitState();
  }

  enableAutoplay() {
    this.canAutoplay = true;
    void this.resumeAudioContext();
  }

  private getAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextClass =
      window.AudioContext ||
      // @ts-expect-error webkit fallback
      window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    const context = new AudioContextClass();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    const gain = context.createGain();
    gain.gain.value = this.volume * MAX_GAIN_VOLUME;

    compressor.connect(gain);
    gain.connect(context.destination);

    this.audioContext = context;
    this.compressorNode = compressor;
    this.gainNode = gain;
    return context;
  }

  private async resumeAudioContext() {
    const context = this.getAudioContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
    return context;
  }

  async play(key: AnnouncementKey, options: PlayOptions = {}) {
    if (!this.canAutoplay) {
      return false;
    }

    const now = Date.now();
    const cooldownMs = options.cooldownMs ?? 0;
    const lastPlayed = this.lastPlayedAt.get(key) ?? 0;
    if (cooldownMs > 0 && now - lastPlayed < cooldownMs) {
      return false;
    }

    if (options.interrupt) {
      this.stopCurrent();
    } else if (this.currentAudio && !this.currentAudio.paused) {
      return false;
    }

    const audio = new Audio(getAnnouncementUrl(key));
    audio.preload = "auto";
    audio.volume = this.volume;
    this.currentAudio = audio;
    this.currentKey = key;
    this.isPlaying = false;
    this.lastPlayedAt.set(key, now);
    this.emitState();

    const clear = () => {
      if (this.currentSource) {
        this.currentSource.disconnect();
        this.currentSource = null;
      }
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentKey = null;
      }
      this.isPlaying = false;
      this.emitState();
    };

    audio.addEventListener("ended", clear, { once: true });
    audio.addEventListener("error", clear, { once: true });

    try {
      const context = await this.resumeAudioContext();
      if (context && this.compressorNode) {
        const source = context.createMediaElementSource(audio);
        source.connect(this.compressorNode);
        this.currentSource = source;
        audio.volume = 1;
      }
      await audio.play();
      this.isPlaying = true;
      this.emitState();
      return true;
    } catch (error) {
      console.warn("Failed to play announcement", key, error);
      clear();
      return false;
    }
  }

  interruptAndPlay(key: AnnouncementKey, options: Omit<PlayOptions, "interrupt"> = {}) {
    return this.play(key, { ...options, interrupt: true });
  }

  stopCurrent() {
    if (!this.currentAudio) {
      if (this.currentKey || this.isPlaying) {
        this.currentKey = null;
        this.isPlaying = false;
        this.emitState();
      }
      return;
    }
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    if (this.currentSource) {
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.currentAudio = null;
    this.currentKey = null;
    this.isPlaying = false;
    this.emitState();
  }
}

export const announcementController = new AnnouncementController();
