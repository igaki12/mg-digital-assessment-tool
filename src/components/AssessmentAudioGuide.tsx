import { useEffect, useState } from "react";
import {
  announcementController,
  type AnnouncementPlaybackState
} from "../audio/controller";
import type { AnnouncementKey } from "../audio/announcements";

type AssessmentAudioGuideProps = {
  announcementKey: AnnouncementKey;
  summary: string;
};

export default function AssessmentAudioGuide({
  announcementKey,
  summary
}: AssessmentAudioGuideProps) {
  const [playbackState, setPlaybackState] = useState<AnnouncementPlaybackState>(
    announcementController.getState()
  );

  useEffect(() => {
    const unsubscribe = announcementController.subscribe(setPlaybackState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    announcementController.enableAutoplay();
    void announcementController.interruptAndPlay(announcementKey);

    return () => {
      const state = announcementController.getState();
      if (state.currentKey === announcementKey) {
        announcementController.stopCurrent();
      }
    };
  }, [announcementKey]);

  const isPlaying =
    playbackState.currentKey === announcementKey && playbackState.isPlaying;

  return (
    <section className="card assessment-audio-guide">
      <div className="assessment-audio-guide-header">
        <div>
          <p className="phase-label">音声ガイド</p>
          <p className="assessment-audio-guide-copy">{summary}</p>
        </div>
        <div
          className={`assessment-audio-guide-indicator${
            isPlaying ? " is-playing" : ""
          }`}
          aria-live="polite"
        >
          <span className="assessment-audio-guide-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>{isPlaying ? "音声ガイド再生中" : "音声ガイド待機中"}</span>
        </div>
      </div>

      <div className="assessment-audio-guide-controls">
        <button
          type="button"
          className="ghost-button"
          onClick={() => void announcementController.interruptAndPlay(announcementKey)}
        >
          もう一度聞く
        </button>

        <label className="assessment-audio-guide-volume">
          <span>音量</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(playbackState.volume * 100)}
            onChange={(event) => {
              announcementController.setVolume(Number(event.target.value) / 100);
            }}
            aria-label="音声ガイドの音量"
          />
          <strong>{Math.round(playbackState.volume * 100)}%</strong>
        </label>
      </div>
    </section>
  );
}
