import type { ReactNode } from "react";

export type CameraFacingMode = "user" | "environment";

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

function SwitchCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 7.5h1.7l1.1-1.6h2.4l1.1 1.6H17a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12.1"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 5.7A8.5 8.5 0 0 1 12 2.5c2.1 0 4 .8 5.5 2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m17.6 2.5.1 2.5-2.5.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 18.3A8.5 8.5 0 0 1 12 21.5c-2.1 0-4-.8-5.5-2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m6.4 21.5-.1-2.5 2.5-.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  cameraFacingMode?: CameraFacingMode;
  onSwitchCamera?: () => void;
  isCameraSwitching?: boolean;
  isCameraSwitchDisabled?: boolean;
};

export default function CameraOverlay({
  tone = "guide",
  topMessage,
  topLabel = "ガイド",
  showTopBadge = true,
  centerPrimary,
  cameraFacingMode,
  onSwitchCamera,
  isCameraSwitching = false,
  isCameraSwitchDisabled = false
}: CameraOverlayProps) {
  const hasTopText = Boolean(topLabel || topMessage);
  const canRenderCameraSwitch = Boolean(onSwitchCamera && cameraFacingMode);
  const nextCameraLabel =
    cameraFacingMode === "user" ? "背面カメラに切り替え" : "前面カメラに切り替え";

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

      {canRenderCameraSwitch ? (
        <button
          type="button"
          className="camera-switch-button"
          onClick={onSwitchCamera}
          disabled={isCameraSwitching || isCameraSwitchDisabled}
          aria-label={nextCameraLabel}
          title={isCameraSwitchDisabled ? "計測中は切り替えできません" : nextCameraLabel}
        >
          <SwitchCameraIcon />
          <span>
            {isCameraSwitching
              ? "切替中"
              : cameraFacingMode === "user"
                ? "前面"
                : "背面"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
