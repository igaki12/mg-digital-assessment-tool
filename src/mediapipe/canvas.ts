export function syncOverlayCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  frame?: HTMLElement | null
) {
  if (video.videoWidth && video.videoHeight) {
    frame?.style.setProperty(
      "--camera-aspect-ratio",
      `${video.videoWidth} / ${video.videoHeight}`
    );
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const rect = video.getBoundingClientRect();
  if (rect.width && rect.height) {
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }
}
