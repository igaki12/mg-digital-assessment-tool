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
        outputFaceBlendshapes: true,
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

function getBlendshapeScore(result: FaceLandmarkerResult, name: string) {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  const category = categories.find((item) => item.categoryName === name);
  return category?.score ?? 0;
}

export function isFaceCentered(result: FaceLandmarkerResult) {
  const face = result.faceLandmarks?.[0];
  if (!face) {
    return false;
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of face) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return (
    width > 0.18 &&
    height > 0.22 &&
    minX > 0.08 &&
    maxX < 0.92 &&
    minY > 0.05 &&
    maxY < 0.95
  );
}

export function extractSmileMetrics(result: FaceLandmarkerResult) {
  const left = getBlendshapeScore(result, "mouthSmileLeft");
  const right = getBlendshapeScore(result, "mouthSmileRight");
  const amplitude = (left + right) / 2;
  const maxValue = Math.max(left, right, 0.0001);
  const symmetry = 1 - Math.abs(left - right) / maxValue;
  return { left, right, amplitude, symmetry };
}
