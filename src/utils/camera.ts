import type { CameraFacingMode } from "../components/CameraOverlay";

export function getNextCameraFacingMode(
  current: CameraFacingMode
): CameraFacingMode {
  return current === "user" ? "environment" : "user";
}

export async function openCameraStream(facingMode: CameraFacingMode) {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode } },
    audio: false
  });
}
