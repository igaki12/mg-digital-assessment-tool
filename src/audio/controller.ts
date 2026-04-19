import { getAnnouncementUrl, type AnnouncementKey } from "./announcements";

type PlayOptions = {
  cooldownMs?: number;
  interrupt?: boolean;
};

const FALLBACK_ANNOUNCEMENT_VOLUME = 0.92;

class AnnouncementController {
  private canAutoplay = false;
  private audioContext: AudioContext | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSource: MediaElementAudioSourceNode | null = null;
  private currentKey: AnnouncementKey | null = null;
  private lastPlayedAt = new Map<AnnouncementKey, number>();

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
    gain.gain.value = 1.08;

    compressor.connect(gain);
    gain.connect(context.destination);

    this.audioContext = context;
    this.compressorNode = compressor;
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

    if (this.currentKey === key && this.currentAudio && !this.currentAudio.paused) {
      return false;
    }

    if (options.interrupt) {
      this.stopCurrent();
    } else if (this.currentAudio && !this.currentAudio.paused) {
      return false;
    }

    const audio = new Audio(getAnnouncementUrl(key));
    audio.preload = "auto";
    audio.volume = FALLBACK_ANNOUNCEMENT_VOLUME;
    this.currentAudio = audio;
    this.currentKey = key;
    this.lastPlayedAt.set(key, now);

    const clear = () => {
      if (this.currentSource) {
        this.currentSource.disconnect();
        this.currentSource = null;
      }
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentKey = null;
      }
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
  }
}

export const announcementController = new AnnouncementController();
