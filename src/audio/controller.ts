import { getAnnouncementUrl, type AnnouncementKey } from "./announcements";

type PlayOptions = {
  cooldownMs?: number;
  interrupt?: boolean;
};

class AnnouncementController {
  private canAutoplay = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentKey: AnnouncementKey | null = null;
  private lastPlayedAt = new Map<AnnouncementKey, number>();

  enableAutoplay() {
    this.canAutoplay = true;
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
    this.currentAudio = audio;
    this.currentKey = key;
    this.lastPlayedAt.set(key, now);

    const clear = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentKey = null;
      }
    };

    audio.addEventListener("ended", clear, { once: true });
    audio.addEventListener("error", clear, { once: true });

    try {
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
    this.currentAudio = null;
    this.currentKey = null;
  }
}

export const announcementController = new AnnouncementController();
