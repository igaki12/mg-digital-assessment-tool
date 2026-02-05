export type AssessmentType = "ptosis" | "limbs" | "gait" | "epro";

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
