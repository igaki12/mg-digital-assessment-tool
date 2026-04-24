export type AssessmentType =
  | "ptosis"
  | "limbs"
  | "gait"
  | "tug"
  | "posture"
  | "expression"
  | "voice"
  | "epro";

export type SessionMeta = {
  id: number;
  type: AssessmentType;
  date: string;
  summaryScore: number;
  notes?: string;
};

export type TimeSeriesEntry = {
  timestamp: number;
  earLeft?: number;
  earRight?: number;
  armLeftDeg?: number;
  armRightDeg?: number;
  kneeLeftDeg?: number;
  kneeRightDeg?: number;
  gaitSpeed?: number;
  tugElapsedSec?: number;
  tugStepCount?: number;
  tugPhase?: "standingUp" | "walkOut" | "turning" | "returning" | "sittingDown";
  trunkFlexionDeg?: number;
  droppedHeadDeg?: number;
  lateralTiltDeg?: number;
  poseStable?: number;
  blinkCount?: number;
  blinkRatePerMin?: number;
  expressionSet?: number;
  expressionPhase?: "rest" | "smile";
  smileLeft?: number;
  smileRight?: number;
  smileSymmetry?: number;
  voiceRms?: number;
  voicePitchHz?: number;
};

export type TimeSeriesRecord = {
  sessionId: number;
  frameData: TimeSeriesEntry[];
  details?: Record<string, unknown>;
};

export type VideoRecord = {
  sessionId: number;
  blob: Blob;
  createdAt: number;
};

export type AudioClipMetrics = {
  durationSec: number;
  meanRms: number;
  peakRms: number;
  pitchMeanHz: number;
  pitchStdHz: number;
  voicedFrameRatio: number;
};

export type AudioClip = {
  taskId: string;
  label: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  metrics: AudioClipMetrics;
};

export type AudioRecord = {
  sessionId: number;
  createdAt: number;
  clips: AudioClip[];
};
