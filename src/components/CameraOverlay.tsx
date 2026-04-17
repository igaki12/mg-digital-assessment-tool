import type { ReactNode } from "react";

type OverlayIcon = "audio" | "eye" | "arrowUp" | "body" | "rotate" | "face" | "smile";

function OverlaySvg({ icon }: { icon: OverlayIcon }) {
  switch (icon) {
    case "audio":
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
    case "eye":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20V6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m6.5 11.5 5.5-5.5 5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "body":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 7.5v5M8.5 10l3.5 2.5 3.5-2.5M10 13l-1.5 5M14 13l1.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "rotate":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 6H3v4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 10a8 8 0 0 1 13.5-3M17 18h4v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 14a8 8 0 0 1-13.5 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "face":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <path
            d="M9 15h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "smile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <path
            d="M8.5 13.5c.9 1.7 2.2 2.5 3.5 2.5s2.6-.8 3.5-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

type CameraOverlayProps = {
  tone?: "guide" | "active";
  topMessage: string;
  topLabel?: string;
  centerIcons?: OverlayIcon[];
  centerPrimary?: ReactNode;
  centerSecondary?: ReactNode;
};

export default function CameraOverlay({
  tone = "guide",
  topMessage,
  topLabel = "ガイド",
  centerIcons = [],
  centerPrimary,
  centerSecondary
}: CameraOverlayProps) {
  return (
    <div className={`camera-overlay camera-overlay-${tone}`}>
      <div className="camera-overlay-top">
        <div className="camera-overlay-topbar">
          <span className="camera-overlay-audio">
            <OverlaySvg icon="audio" />
          </span>
          <span className="camera-overlay-toplabel">{topLabel}</span>
        </div>
        <p className="camera-overlay-message">{topMessage}</p>
      </div>

      <div className="camera-overlay-center">
        {centerIcons.length > 0 ? (
          <div className="camera-overlay-icons">
            {centerIcons.map((icon) => (
              <span key={icon} className="camera-overlay-icon-chip">
                <OverlaySvg icon={icon} />
              </span>
            ))}
          </div>
        ) : null}
        {centerPrimary ? (
          <div className="camera-overlay-primary">{centerPrimary}</div>
        ) : null}
        {centerSecondary ? (
          <div className="camera-overlay-secondary">{centerSecondary}</div>
        ) : null}
      </div>
    </div>
  );
}
