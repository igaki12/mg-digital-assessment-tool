import type { ReactNode } from "react";

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 14h3l4 4V6L8 10H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.5a4 4 0 0 1 0 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.8 7a7.5 7.5 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type CameraOverlayProps = {
  tone?: "guide" | "active";
  topMessage?: string;
  topLabel?: string;
  showTopBadge?: boolean;
  centerPrimary?: ReactNode;
};

export default function CameraOverlay({
  tone = "guide",
  topMessage,
  topLabel = "ガイド",
  showTopBadge = true,
  centerPrimary
}: CameraOverlayProps) {
  const hasTopText = Boolean(topLabel || topMessage);

  return (
    <div className={`camera-overlay camera-overlay-${tone}`}>
      {showTopBadge ? (
        <div
          className={`camera-overlay-top ${hasTopText ? "" : "camera-overlay-top-icon-only"}`.trim()}
        >
          <div className="camera-overlay-topbar">
            <span className="camera-overlay-audio">
              <AudioIcon />
            </span>
            {topLabel ? (
              <span className="camera-overlay-toplabel">{topLabel}</span>
            ) : null}
          </div>
          {topMessage ? <p className="camera-overlay-message">{topMessage}</p> : null}
        </div>
      ) : null}

      <div className="camera-overlay-center">
        {centerPrimary ? (
          <div className="camera-overlay-primary">{centerPrimary}</div>
        ) : null}
      </div>
    </div>
  );
}
