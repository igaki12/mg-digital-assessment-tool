import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult
} from "@mediapipe/tasks-vision";

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

export async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });
    })();
  }
  return poseLandmarkerPromise;
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dot = a.x * b.x + a.y * b.y;
  const mag = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (mag === 0) {
    return 0;
  }
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function extractArmAngles(result: PoseLandmarkerResult) {
  const pose = result.landmarks?.[0];
  if (!pose) {
    return { left: 0, right: 0 };
  }
  const leftShoulder = pose[11];
  const leftElbow = pose[13];
  const rightShoulder = pose[12];
  const rightElbow = pose[14];
  if (!leftShoulder || !leftElbow || !rightShoulder || !rightElbow) {
    return { left: 0, right: 0 };
  }

  const leftVector = {
    x: leftElbow.x - leftShoulder.x,
    y: leftElbow.y - leftShoulder.y
  };
  const rightVector = {
    x: rightElbow.x - rightShoulder.x,
    y: rightElbow.y - rightShoulder.y
  };

  const horizontal = { x: 1, y: 0 };
  const leftAngle = angleBetween(leftVector, horizontal);
  return {
    left: 180 - leftAngle,
    right: angleBetween(rightVector, horizontal)
  };
}

export function extractKneeAngles(result: PoseLandmarkerResult) {
  const pose = result.landmarks?.[0];
  if (!pose) {
    return { left: 0, right: 0 };
  }
  const leftHip = pose[23];
  const leftKnee = pose[25];
  const leftAnkle = pose[27];
  const rightHip = pose[24];
  const rightKnee = pose[26];
  const rightAnkle = pose[28];
  if (!leftHip || !leftKnee || !leftAnkle || !rightHip || !rightKnee || !rightAnkle) {
    return { left: 0, right: 0 };
  }

  const leftThigh = {
    x: leftHip.x - leftKnee.x,
    y: leftHip.y - leftKnee.y
  };
  const leftShin = {
    x: leftAnkle.x - leftKnee.x,
    y: leftAnkle.y - leftKnee.y
  };
  const rightThigh = {
    x: rightHip.x - rightKnee.x,
    y: rightHip.y - rightKnee.y
  };
  const rightShin = {
    x: rightAnkle.x - rightKnee.x,
    y: rightAnkle.y - rightKnee.y
  };

  return {
    left: angleBetween(leftThigh, leftShin),
    right: angleBetween(rightThigh, rightShin)
  };
}

export function extractHipCenter(result: PoseLandmarkerResult) {
  const pose = result.landmarks?.[0];
  if (!pose) {
    return null;
  }
  const leftHip = pose[23];
  const rightHip = pose[24];
  if (!leftHip || !rightHip) {
    return null;
  }
  return {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
}

export function estimateBodyHeightPixels(result: PoseLandmarkerResult) {
  const pose = result.landmarks?.[0];
  if (!pose) {
    return null;
  }
  const nose = pose[0];
  const leftAnkle = pose[27];
  const rightAnkle = pose[28];
  if (!nose || !leftAnkle || !rightAnkle) {
    return null;
  }
  const ankle = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2
  };
  return Math.hypot(nose.x - ankle.x, nose.y - ankle.y);
}

function hasReliablePoint(
  point: { x: number; y: number; visibility?: number } | undefined
) {
  return Boolean(
    point &&
      point.x > 0.02 &&
      point.x < 0.98 &&
      point.y > 0.02 &&
      point.y < 0.98 &&
      (point.visibility ?? 1) > 0.35
  );
}

function getPose(result: PoseLandmarkerResult) {
  return result.landmarks?.[0] ?? null;
}

function averagePoint(
  a:
    | { x: number; y: number; visibility?: number }
    | undefined,
  b:
    | { x: number; y: number; visibility?: number }
    | undefined
) {
  if (!a || !b) {
    return null;
  }
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

export function isFullBodyInFrame(result: PoseLandmarkerResult) {
  const pose = getPose(result);
  if (!pose) {
    return false;
  }
  const points = [pose[0], pose[11], pose[12], pose[23], pose[24], pose[27], pose[28]];
  return points.every((point) => hasReliablePoint(point));
}

export function isFrontFacingPose(result: PoseLandmarkerResult) {
  const pose = getPose(result);
  const bodyHeight = estimateBodyHeightPixels(result);
  if (!pose || !bodyHeight) {
    return false;
  }
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  const leftHip = pose[23];
  const rightHip = pose[24];
  if (
    !hasReliablePoint(leftShoulder) ||
    !hasReliablePoint(rightShoulder) ||
    !hasReliablePoint(leftHip) ||
    !hasReliablePoint(rightHip)
  ) {
    return false;
  }

  const shoulderSpan = Math.abs(leftShoulder!.x - rightShoulder!.x);
  const hipSpan = Math.abs(leftHip!.x - rightHip!.x);
  return shoulderSpan / bodyHeight > 0.12 && hipSpan / bodyHeight > 0.08;
}

export function isSideFacingPose(result: PoseLandmarkerResult) {
  const pose = getPose(result);
  const bodyHeight = estimateBodyHeightPixels(result);
  if (!pose || !bodyHeight) {
    return false;
  }
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  const leftHip = pose[23];
  const rightHip = pose[24];
  if (
    !hasReliablePoint(leftShoulder) ||
    !hasReliablePoint(rightShoulder) ||
    !hasReliablePoint(leftHip) ||
    !hasReliablePoint(rightHip)
  ) {
    return false;
  }
  const shoulderSpan = Math.abs(leftShoulder!.x - rightShoulder!.x);
  const hipSpan = Math.abs(leftHip!.x - rightHip!.x);
  return shoulderSpan / bodyHeight < 0.1 && hipSpan / bodyHeight < 0.08;
}

export function extractPostureAngles(result: PoseLandmarkerResult) {
  const pose = getPose(result);
  if (!pose) {
    return {
      trunkFlexionDeg: 0,
      droppedHeadDeg: 0,
      lateralTiltDeg: 0
    };
  }

  const shoulderCenter = averagePoint(pose[11], pose[12]);
  const hipCenter = averagePoint(pose[23], pose[24]);
  const earCenter = averagePoint(pose[7], pose[8]);
  if (!shoulderCenter || !hipCenter || !earCenter) {
    return {
      trunkFlexionDeg: 0,
      droppedHeadDeg: 0,
      lateralTiltDeg: 0
    };
  }

  const trunkVector = {
    x: shoulderCenter.x - hipCenter.x,
    y: shoulderCenter.y - hipCenter.y
  };
  const verticalAngle =
    (Math.atan2(Math.abs(trunkVector.x), Math.abs(trunkVector.y)) * 180) / Math.PI;
  const headVector = {
    x: earCenter.x - shoulderCenter.x,
    y: earCenter.y - shoulderCenter.y
  };

  return {
    trunkFlexionDeg: verticalAngle,
    droppedHeadDeg: angleBetween(headVector, trunkVector),
    lateralTiltDeg: verticalAngle
  };
}
