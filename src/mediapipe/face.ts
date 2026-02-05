import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult
} from "@mediapipe/tasks-vision";

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        outputFaceBlendshapes: false,
        numFaces: 1
      });
    })();
  }
  return faceLandmarkerPromise;
}

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function computeEar(
  landmarks: { x: number; y: number }[],
  indices: readonly [number, number, number, number, number, number]
) {
  const [i1, i2, i3, i4, i5, i6] = indices;
  const p1 = landmarks[i1];
  const p2 = landmarks[i2];
  const p3 = landmarks[i3];
  const p4 = landmarks[i4];
  const p5 = landmarks[i5];
  const p6 = landmarks[i6];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
    return 0;
  }

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);
  if (horizontal === 0) {
    return 0;
  }
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function extractEar(result: FaceLandmarkerResult) {
  const face = result.faceLandmarks?.[0];
  if (!face) {
    return { left: 0, right: 0 };
  }
  return {
    left: computeEar(face, LEFT_EYE),
    right: computeEar(face, RIGHT_EYE)
  };
}
