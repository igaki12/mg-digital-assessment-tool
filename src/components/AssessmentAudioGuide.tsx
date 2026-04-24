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
    <section className="card assessment-audio-guide audio-guide-enhanced">
      <style>{`
        .audio-guide-enhanced {
          position: relative;
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,250,245,0.8));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(127, 214, 170, 0.3);
          box-shadow: 0 10px 30px rgba(18, 120, 88, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1);
          border-radius: 20px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .audio-guide-enhanced:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 35px rgba(18, 120, 88, 0.12), inset 0 1px 0 rgba(255, 255, 255, 1);
        }
        .audio-guide-enhanced::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #0e6f57, #1f9f72, #7fd6aa);
        }
        .audio-guide-enhanced .phase-label {
          color: #0e6f57;
          background: rgba(127, 214, 170, 0.15);
          border: 1px solid rgba(127, 214, 170, 0.3);
          font-weight: 600;
          padding: 0.3rem 0.8rem;
          border-radius: 999px;
          display: inline-block;
          margin-bottom: 0.5rem;
        }
        .audio-guide-enhanced .assessment-audio-guide-copy {
          color: #2c3e38;
          font-weight: 500;
          line-height: 1.5;
        }
        .audio-guide-enhanced .assessment-audio-guide-indicator {
          background: rgba(255, 255, 255, 0.6);
          border-radius: 12px;
          padding: 0.5rem 1rem;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }
        .audio-guide-enhanced .assessment-audio-guide-indicator span {
          color: #1f9f72;
          font-weight: 600;
        }
        .audio-guide-enhanced .assessment-audio-guide-volume span {
          color: #4a635a;
          font-weight: 600;
        }
        .audio-guide-enhanced .assessment-audio-guide-volume strong {
          color: #0e6f57;
        }
        .audio-guide-enhanced input[type=range] {
          accent-color: #1f9f72;
        }
        .audio-guide-enhanced .ghost-button {
          position: relative;
          background: linear-gradient(135deg, #0e6f57 0%, #1f9f72 50%, #2c9c9a 100%);
          color: white !important;
          border: none;
          padding: 0.8rem 1.8rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 1rem;
          box-shadow: 0 8px 20px rgba(18, 120, 88, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          overflow: hidden;
        }
        .audio-guide-enhanced .ghost-button::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: translateX(-100%) skewX(-15deg);
          animation: shine 3s infinite;
        }
        .audio-guide-enhanced .ghost-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px rgba(18, 120, 88, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          filter: brightness(1.1);
        }
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(200%) skewX(-15deg); }
        }
      `}</style>
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
          onClick={() => {
            announcementController.enableAutoplay();
            void announcementController.interruptAndPlay(announcementKey);
          }}
        >
          音声案内を聞く
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
