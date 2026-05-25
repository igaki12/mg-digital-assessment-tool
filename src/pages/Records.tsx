import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Layout from "../components/Layout";
import useIsCompactViewport from "../hooks/useIsCompactViewport";
import {
  getAudio,
  getTimeSeries,
  getVideo,
  listSessions
} from "../storage/db";
import type {
  AssessmentType,
  AudioRecord,
  SessionMeta,
  TimeSeriesEntry,
  TimeSeriesRecord,
  VideoRecord
} from "../types";
import {
  buildDailyAggregatePoints,
  buildIntradayAggregatePoints,
  type DailyAggregatePoint,
  type DerivedSessionMetric,
  type IntradayAggregatePoint,
  type MetricGranularity
} from "./records/analytics";

type GraphMode = "daily" | "intraday";

type AssessmentMetricConfig = {
  id: string;
  label: string;
  digits: number;
  unit?: string;
  getValue: (
    session: SessionMeta,
    record: TimeSeriesRecord | null | undefined
  ) => number | null;
};

type StateByAssessment<T> = Record<AssessmentType, T>;

type AudioClipWithUrl = AudioRecord["clips"][number] & { url: string };

type DetailChartSeries = {
  key: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
};

type DetailChartDefinition = {
  title: string;
  description: string;
  data: Array<Record<string, number | string | null>>;
  xAxisKey: string;
  xAxisType: "number" | "category";
  xAxisTickFormatter?: (value: number | string) => string;
  tooltipLabelFormatter?: (value: number | string) => string;
  series: DetailChartSeries[];
  showRightAxis?: boolean;
};

const assessmentOrder: AssessmentType[] = [
  "ptosis",
  "limbs",
  "gait",
  "tug",
  "posture",
  "expression",
  "voice",
  "epro"
];

const typeLabels: Record<AssessmentType, string> = {
  ptosis: "眼瞼下垂",
  limbs: "上肢の筋力",
  gait: "歩行動作",
  tug: "3m立ち上がり歩行テスト",
  posture: "姿勢の検査",
  expression: "表情の検査",
  voice: "音声の検査",
  epro: "症状の問診"
};

const defaultMetricByType: StateByAssessment<string> = {
  ptosis: "avgEar",
  limbs: "avgShoulder",
  gait: "gaitSpeed",
  tug: "totalDuration",
  posture: "postureScore",
  expression: "smileAmplitude",
  voice: "voiceRms",
  epro: "combined"
};

const defaultGraphModeByType: StateByAssessment<GraphMode> = {
  ptosis: "daily",
  limbs: "daily",
  gait: "daily",
  tug: "daily",
  posture: "daily",
  expression: "daily",
  voice: "daily",
  epro: "daily"
};

const defaultGranularityByType: StateByAssessment<MetricGranularity> = {
  ptosis: "day",
  limbs: "day",
  gait: "day",
  tug: "day",
  posture: "day",
  expression: "day",
  voice: "day",
  epro: "day"
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxValue(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDetailNumber(
  record: TimeSeriesRecord | null | undefined,
  key: string
) {
  return asNumber(record?.details?.[key]);
}

function getPostureSnapshots(record: TimeSeriesRecord | null | undefined) {
  const snapshots = record?.details?.snapshots;
  if (!snapshots || typeof snapshots !== "object") {
    return [];
  }

  const result: Array<{ key: "front" | "side"; label: string; src: string }> = [];
  ([
    ["front", "正面写真"],
    ["side", "側面写真"]
  ] as const)
    .forEach(([key, label]) => {
      const value = (snapshots as Record<string, unknown>)[key];
      if (typeof value !== "string" || !value.startsWith("data:image/")) {
        return;
      }
      result.push({ key, label, src: value });
    });
  return result;
}

function averageEntryValue(
  record: TimeSeriesRecord | null | undefined,
  pick: (entry: TimeSeriesEntry) => number | undefined
) {
  if (!record?.frameData.length) {
    return null;
  }
  const values = record.frameData
    .map((entry) => pick(entry))
    .filter((value): value is number => typeof value === "number");
  return average(values);
}

function maxEntryValue(
  record: TimeSeriesRecord | null | undefined,
  pick: (entry: TimeSeriesEntry) => number | undefined
) {
  if (!record?.frameData.length) {
    return null;
  }
  const values = record.frameData
    .map((entry) => pick(entry))
    .filter((value): value is number => typeof value === "number");
  return maxValue(values);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMetricValue(value: number, config: AssessmentMetricConfig) {
  const formatted = value.toFixed(config.digits);
  return config.unit ? `${formatted}${config.unit}` : formatted;
}

function createDetailText(record: TimeSeriesRecord) {
  if (record.frameData.length === 0 && record.details) {
    return JSON.stringify(record.details, null, 2);
  }

  const headers = new Set<string>();
  record.frameData.forEach((entry) => {
    Object.keys(entry).forEach((key) => headers.add(key));
  });

  const columns = Array.from(headers);
  const rows = [columns.join(",")];
  record.frameData.forEach((entry) => {
    rows.push(
      columns
        .map((column) => String(entry[column as keyof TimeSeriesEntry] ?? ""))
        .join(",")
    );
  });
  return rows.join("\n");
}

function formatChartNumber(value: number) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

function buildElapsedSeriesData(
  record: TimeSeriesRecord,
  mapEntry: (entry: TimeSeriesEntry, index: number) => Record<string, number | null>
) {
  const firstTimestamp = record.frameData[0]?.timestamp ?? 0;
  return record.frameData.map((entry, index) => ({
    elapsedSec: Number(((entry.timestamp - firstTimestamp) / 1000).toFixed(2)),
    ...mapEntry(entry, index)
  }));
}

function getVoiceTaskLabels(record: TimeSeriesRecord) {
  const rawTasks = record.details?.tasks;
  if (!Array.isArray(rawTasks)) {
    return [];
  }
  return rawTasks.map((task, index) => {
    if (
      task &&
      typeof task === "object" &&
      "label" in task &&
      typeof task.label === "string"
    ) {
      return task.label;
    }
    return `タスク ${index + 1}`;
  });
}

function getDetailChartDefinition(
  type: AssessmentType,
  record: TimeSeriesRecord
): DetailChartDefinition | null {
  if (record.frameData.length === 0) {
    return null;
  }

  if (type === "ptosis") {
    return {
      title: "EAR の推移",
      description: "有効計測時間内の左右 EAR の変化を確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        earLeft: entry.earLeft ?? null,
        earRight: entry.earRight ?? null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      series: [
        { key: "earLeft", label: "左EAR", color: "#1f8b86" },
        { key: "earRight", label: "右EAR", color: "#0e2c2e" }
      ]
    };
  }

  if (type === "limbs") {
    return {
      title: "腕角度の推移",
      description: "計測中の左右の腕角度を時系列で確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        armLeftDeg: entry.armLeftDeg ?? null,
        armRightDeg: entry.armRightDeg ?? null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      series: [
        { key: "armLeftDeg", label: "左腕角度", color: "#1f8b86" },
        { key: "armRightDeg", label: "右腕角度", color: "#0e2c2e" }
      ]
    };
  }

  if (type === "gait") {
    const hasKneeSeries = record.frameData.some(
      (entry) =>
        typeof entry.kneeLeftDeg === "number" ||
        typeof entry.kneeRightDeg === "number"
    );

    if (hasKneeSeries) {
      return {
        title: "膝角度の推移",
        description: "歩行中の左右膝角度の変化を確認できます。",
        data: buildElapsedSeriesData(record, (entry) => ({
          kneeLeftDeg: entry.kneeLeftDeg ?? null,
          kneeRightDeg: entry.kneeRightDeg ?? null
        })),
        xAxisKey: "elapsedSec",
        xAxisType: "number",
        xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
        tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
        series: [
          { key: "kneeLeftDeg", label: "左膝角度", color: "#1f8b86" },
          { key: "kneeRightDeg", label: "右膝角度", color: "#0e2c2e" }
        ]
      };
    }

    return {
      title: "歩行速度の推移",
      description: "歩行セッション内の速度変化を確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        gaitSpeed: entry.gaitSpeed ?? null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      series: [{ key: "gaitSpeed", label: "歩行速度", color: "#0e2c2e" }]
    };
  }

  if (type === "tug") {
    return {
      title: "3m立ち上がり歩行指標の推移",
      description: "計測中の速度、膝角度、歩数の変化を確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        gaitSpeed: entry.gaitSpeed ?? null,
        kneeLeftDeg: entry.kneeLeftDeg ?? null,
        kneeRightDeg: entry.kneeRightDeg ?? null,
        tugStepCount: entry.tugStepCount ?? null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      showRightAxis: true,
      series: [
        { key: "gaitSpeed", label: "歩行速度", color: "#1f8b86", yAxisId: "left" },
        { key: "kneeLeftDeg", label: "左膝角度", color: "#0e2c2e", yAxisId: "right" },
        { key: "kneeRightDeg", label: "右膝角度", color: "#5db7af", yAxisId: "right" },
        { key: "tugStepCount", label: "歩数", color: "#7c67c8", yAxisId: "left" }
      ]
    };
  }

  if (type === "posture") {
    return {
      title: "姿勢指標の推移",
      description: "正面・側面計測中の姿勢指標の変化を確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        lateralTiltDeg: entry.lateralTiltDeg ?? null,
        trunkFlexionDeg: entry.trunkFlexionDeg ?? null,
        droppedHeadDeg: entry.droppedHeadDeg ?? null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      series: [
        { key: "lateralTiltDeg", label: "側方偏位", color: "#1f8b86" },
        { key: "trunkFlexionDeg", label: "体幹前傾", color: "#0e2c2e" },
        { key: "droppedHeadDeg", label: "首下がり", color: "#5db7af" }
      ]
    };
  }

  if (type === "expression") {
    return {
      title: "表情指標の推移",
      description: "表情計測中の左右口角と対称性の変化を確認できます。",
      data: buildElapsedSeriesData(record, (entry) => ({
        smileLeftPct:
          typeof entry.smileLeft === "number" ? entry.smileLeft * 100 : null,
        smileRightPct:
          typeof entry.smileRight === "number" ? entry.smileRight * 100 : null,
        smileSymmetryPct:
          typeof entry.smileSymmetry === "number"
            ? entry.smileSymmetry * 100
            : null
      })),
      xAxisKey: "elapsedSec",
      xAxisType: "number",
      xAxisTickFormatter: (value) => `${Number(value).toFixed(0)}秒`,
      tooltipLabelFormatter: (value) => `${Number(value).toFixed(1)}秒`,
      series: [
        { key: "smileLeftPct", label: "左口角", color: "#1f8b86" },
        { key: "smileRightPct", label: "右口角", color: "#0e2c2e" },
        { key: "smileSymmetryPct", label: "対称性", color: "#5db7af" }
      ]
    };
  }

  if (type === "voice") {
    const taskLabels = getVoiceTaskLabels(record);
    return {
      title: "音声タスク別の結果",
      description: "各音声タスクの平均音量と平均ピッチを確認できます。",
      data: record.frameData.map((entry, index) => ({
        taskLabel: taskLabels[index] ?? `タスク ${index + 1}`,
        voiceRms: entry.voiceRms ?? null,
        voicePitchHz: entry.voicePitchHz ?? null
      })),
      xAxisKey: "taskLabel",
      xAxisType: "category",
      tooltipLabelFormatter: (value) => String(value),
      showRightAxis: true,
      series: [
        { key: "voiceRms", label: "平均音量", color: "#1f8b86", yAxisId: "left" },
        {
          key: "voicePitchHz",
          label: "平均ピッチ",
          color: "#0e2c2e",
          yAxisId: "right"
        }
      ]
    };
  }

  return null;
}

const metricConfigsByType: Record<AssessmentType, AssessmentMetricConfig[]> = {
  ptosis: [
    {
      id: "avgEar",
      label: "EAR平均",
      digits: 4,
      getValue: (session, record) =>
        typeof session.summaryScore === "number"
          ? session.summaryScore
          : averageEntryValue(
              record,
              (entry) =>
                ((entry.earLeft ?? 0) + (entry.earRight ?? 0)) / 2 || undefined
            )
    },
    {
      id: "leftEar",
      label: "左EAR",
      digits: 4,
      getValue: (_, record) => averageEntryValue(record, (entry) => entry.earLeft)
    },
    {
      id: "rightEar",
      label: "右EAR",
      digits: 4,
      getValue: (_, record) => averageEntryValue(record, (entry) => entry.earRight)
    }
  ],
  limbs: [
    {
      id: "avgShoulder",
      label: "肩角度平均",
      digits: 1,
      unit: "°",
      getValue: (session, record) =>
        typeof session.summaryScore === "number"
          ? session.summaryScore
          : averageEntryValue(
              record,
              (entry) =>
                ((entry.armLeftDeg ?? 0) + (entry.armRightDeg ?? 0)) / 2 || undefined
            )
    },
    {
      id: "leftArm",
      label: "左腕角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.armLeftDeg)
    },
    {
      id: "rightArm",
      label: "右腕角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.armRightDeg)
    }
  ],
  gait: [
    {
      id: "gaitSpeed",
      label: "歩行速度",
      digits: 2,
      unit: "m/s",
      getValue: (session, record) =>
        typeof session.summaryScore === "number"
          ? session.summaryScore
          : averageEntryValue(record, (entry) => entry.gaitSpeed)
    },
    {
      id: "leftKnee",
      label: "左膝角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.kneeLeftDeg)
    },
    {
      id: "rightKnee",
      label: "右膝角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.kneeRightDeg)
    },
    {
      id: "trunkFlexion",
      label: "体幹前傾",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.trunkFlexionDeg)
    }
  ],
  tug: [
    {
      id: "totalDuration",
      label: "合計時間",
      digits: 1,
      unit: "秒",
      getValue: (session, record) =>
        getDetailNumber(record, "totalDurationSec") ??
        (typeof session.summaryScore === "number" ? session.summaryScore : null)
    },
    {
      id: "standUpSec",
      label: "立ち上がり時間",
      digits: 1,
      unit: "秒",
      getValue: (_, record) => getDetailNumber(record, "standUpSec")
    },
    {
      id: "stepCount",
      label: "歩数",
      digits: 0,
      unit: "歩",
      getValue: (_, record) =>
        getDetailNumber(record, "stepCount") ??
        maxEntryValue(record, (entry) => entry.tugStepCount)
    },
    {
      id: "avgGaitSpeed",
      label: "平均歩行速度",
      digits: 2,
      unit: "m/s",
      getValue: (_, record) =>
        getDetailNumber(record, "avgGaitSpeed") ??
        averageEntryValue(record, (entry) => entry.gaitSpeed)
    },
    {
      id: "leftKnee",
      label: "左膝角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        getDetailNumber(record, "avgKneeLeftDeg") ??
        averageEntryValue(record, (entry) => entry.kneeLeftDeg)
    },
    {
      id: "rightKnee",
      label: "右膝角度",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        getDetailNumber(record, "avgKneeRightDeg") ??
        averageEntryValue(record, (entry) => entry.kneeRightDeg)
    }
  ],
  posture: [
    {
      id: "postureScore",
      label: "姿勢スコア",
      digits: 1,
      unit: "°",
      getValue: (session, record) => {
        if (typeof session.summaryScore === "number") {
          return session.summaryScore;
        }
        const lateral = getDetailNumber(record, "lateralTiltDeg");
        const trunk = getDetailNumber(record, "trunkFlexionDeg");
        const dropped = getDetailNumber(record, "droppedHeadDeg");
        if (lateral === null || trunk === null || dropped === null) {
          return null;
        }
        return (Math.abs(lateral) + trunk + dropped) / 3;
      }
    },
    {
      id: "lateralTilt",
      label: "側方偏位",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        getDetailNumber(record, "lateralTiltDeg") ??
        averageEntryValue(record, (entry) => entry.lateralTiltDeg)
    },
    {
      id: "trunkFlexion",
      label: "体幹前傾",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        getDetailNumber(record, "trunkFlexionDeg") ??
        averageEntryValue(record, (entry) => entry.trunkFlexionDeg)
    },
    {
      id: "droppedHead",
      label: "首下がり",
      digits: 1,
      unit: "°",
      getValue: (_, record) =>
        getDetailNumber(record, "droppedHeadDeg") ??
        averageEntryValue(record, (entry) => entry.droppedHeadDeg)
    }
  ],
  expression: [
    {
      id: "smileAmplitude",
      label: "笑顔振幅",
      digits: 1,
      unit: "%",
      getValue: (session) =>
        typeof session.summaryScore === "number" ? session.summaryScore : null
    },
    {
      id: "smileSymmetry",
      label: "笑顔対称性",
      digits: 1,
      unit: "%",
      getValue: (_, record) => {
        const detailValue = getDetailNumber(record, "smileSymmetry");
        if (detailValue !== null) {
          return detailValue * 100;
        }
        const frameAverage = averageEntryValue(record, (entry) => entry.smileSymmetry);
        return frameAverage === null ? null : frameAverage * 100;
      }
    },
    {
      id: "blinkCount",
      label: "瞬目回数",
      digits: 0,
      unit: "回",
      getValue: (_, record) =>
        getDetailNumber(record, "blinkCount") ??
        maxEntryValue(record, (entry) => entry.blinkCount)
    },
    {
      id: "blinkRate",
      label: "瞬目率",
      digits: 1,
      unit: "/分",
      getValue: (_, record) =>
        getDetailNumber(record, "blinkRatePerMin") ??
        maxEntryValue(record, (entry) => entry.blinkRatePerMin)
    }
  ],
  voice: [
    {
      id: "voiceRms",
      label: "平均音量",
      digits: 4,
      getValue: (session) =>
        typeof session.summaryScore === "number" ? session.summaryScore : null
    },
    {
      id: "voicePitch",
      label: "平均ピッチ",
      digits: 1,
      unit: "Hz",
      getValue: (_, record) =>
        averageEntryValue(record, (entry) => entry.voicePitchHz)
    }
  ],
  epro: [
    {
      id: "combined",
      label: "合計点",
      digits: 0,
      unit: "点",
      getValue: (session) =>
        typeof session.summaryScore === "number" ? session.summaryScore : null
    },
    {
      id: "adl",
      label: "ADL合計",
      digits: 0,
      unit: "点",
      getValue: (_, record) => getDetailNumber(record, "adlTotal")
    },
    {
      id: "qol",
      label: "QOL合計",
      digits: 0,
      unit: "点",
      getValue: (_, record) => getDetailNumber(record, "qolTotal")
    }
  ]
};

function GraphTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | null }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const filteredPayload = payload.filter(
    (item) => typeof item.value === "number" && Number.isFinite(item.value)
  );

  if (filteredPayload.length === 0) {
    return null;
  }

  return (
    <div className="records-tooltip">
      <p className="records-tooltip-title">{label}</p>
      {filteredPayload.map((item) => (
        <p key={item.name} className="records-tooltip-row">
          <span>{item.name}</span>
          <strong>{item.value}</strong>
        </p>
      ))}
    </div>
  );
}

function DetailChartTooltip({
  active,
  payload,
  label,
  labelFormatter
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | null }>;
  label?: string | number;
  labelFormatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const filteredPayload = payload.filter(
    (item) => typeof item.value === "number" && Number.isFinite(item.value)
  );

  if (filteredPayload.length === 0) {
    return null;
  }

  return (
    <div className="records-tooltip">
      <p className="records-tooltip-title">
        {labelFormatter ? labelFormatter(label ?? "") : String(label ?? "")}
      </p>
      {filteredPayload.map((item) => (
        <p key={item.name} className="records-tooltip-row">
          <span>{item.name}</span>
          <strong>{formatChartNumber(item.value as number)}</strong>
        </p>
      ))}
    </div>
  );
}

function DetailPanel({
  session,
  record,
  videoUrl,
  audioUrls,
  isRecordLoading,
  isAssetLoading
}: {
  session: SessionMeta;
  record: TimeSeriesRecord | null | undefined;
  videoUrl: string | null;
  audioUrls: AudioClipWithUrl[];
  isRecordLoading: boolean;
  isAssetLoading: boolean;
}) {
  const detailChart = record ? getDetailChartDefinition(session.type, record) : null;
  const postureSnapshots =
    session.type === "posture" ? getPostureSnapshots(record) : [];

  return (
    <div className="records-detail">
      <div className="records-detail-header">
        <div>
          <p className="records-detail-eyebrow">{typeLabels[session.type]}</p>
          <h2>詳細</h2>
        </div>
        <div className="records-detail-meta">
          <strong>{formatDateTime(session.date)}</strong>
          <span>スコア {session.summaryScore.toFixed(2)}</span>
        </div>
      </div>

      <div className="records-detail-summary">
        <div className="records-detail-summary-card">
          <span>検査</span>
          <strong>{typeLabels[session.type]}</strong>
        </div>
        <div className="records-detail-summary-card">
          <span>記録日時</span>
          <strong>{formatShortDate(session.date)}</strong>
        </div>
        <div className="records-detail-summary-card">
          <span>メモ</span>
          <strong>{session.notes?.trim() || "なし"}</strong>
        </div>
      </div>

      {isRecordLoading ? (
        <p className="records-detail-empty">詳細データを読み込んでいます。</p>
      ) : record && detailChart ? (
        <div className="records-detail-chart">
          <div className="records-detail-chart-header">
            <h3>{detailChart.title}</h3>
            <p>{detailChart.description}</p>
          </div>
          <div className="records-detail-chart-frame">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={detailChart.data}
                margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#d7ebe5" />
                <XAxis
                  dataKey={detailChart.xAxisKey}
                  type={detailChart.xAxisType}
                  stroke="#5d7b7d"
                  tickLine={false}
                  tickFormatter={detailChart.xAxisTickFormatter}
                  domain={detailChart.xAxisType === "number" ? ["dataMin", "dataMax"] : undefined}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#5d7b7d"
                  tickLine={false}
                  width={56}
                />
                {detailChart.showRightAxis ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#5d7b7d"
                    tickLine={false}
                    width={56}
                  />
                ) : null}
                <Tooltip
                  content={
                    <DetailChartTooltip
                      labelFormatter={detailChart.tooltipLabelFormatter}
                    />
                  }
                />
                <Legend />
                {detailChart.series.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2.4}
                    dot={false}
                    connectNulls={false}
                    yAxisId={series.yAxisId ?? "left"}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : record ? (
        <pre className="detail-pre">{createDetailText(record)}</pre>
      ) : (
        <p className="records-detail-empty">詳細データがありません。</p>
      )}

      {postureSnapshots.length > 0 ? (
        <div className="records-detail-snapshots">
          {postureSnapshots.map((snapshot) => (
            <figure key={snapshot.key} className="records-detail-snapshot">
              <img src={snapshot.src} alt={snapshot.label} />
              <figcaption>{snapshot.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {videoUrl ? (
        <video className="detail-video" src={videoUrl} controls />
      ) : null}

      {audioUrls.length > 0 ? (
        <div className="voice-clip-list">
          {audioUrls.map((clip) => (
            <div key={clip.taskId} className="card voice-clip-card">
              <h3>{clip.label}</h3>
              <audio className="voice-preview" src={clip.url} controls />
              <p>
                録音時間 {clip.metrics.durationSec.toFixed(1)}s / 平均音量{" "}
                {clip.metrics.meanRms.toFixed(3)} / 平均ピッチ{" "}
                {clip.metrics.pitchMeanHz.toFixed(1)}Hz
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {!videoUrl && audioUrls.length === 0 && isAssetLoading ? (
        <p className="records-detail-footnote">添付データを読み込んでいます。</p>
      ) : null}
    </div>
  );
}

export default function Records() {
  const isCompactViewport = useIsCompactViewport();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeType, setActiveType] = useState<AssessmentType>("ptosis");
  const [recordCache, setRecordCache] = useState<
    Record<number, TimeSeriesRecord | null | undefined>
  >({});
  const [videoCache, setVideoCache] = useState<
    Record<number, VideoRecord | null | undefined>
  >({});
  const [audioCache, setAudioCache] = useState<
    Record<number, AudioRecord | null | undefined>
  >({});
  const [selectedSessionIdByType, setSelectedSessionIdByType] = useState<
    StateByAssessment<number | null>
  >({
    ptosis: null,
    limbs: null,
    gait: null,
    tug: null,
    posture: null,
    expression: null,
    voice: null,
    epro: null
  });
  const [metricByType, setMetricByType] =
    useState<StateByAssessment<string>>(defaultMetricByType);
  const [graphModeByType, setGraphModeByType] =
    useState<StateByAssessment<GraphMode>>(defaultGraphModeByType);
  const [granularityByType, setGranularityByType] =
    useState<StateByAssessment<MetricGranularity>>(defaultGranularityByType);
  const [loadingRecordTypes, setLoadingRecordTypes] = useState<
    StateByAssessment<boolean>
  >({
    ptosis: false,
    limbs: false,
    gait: false,
    tug: false,
    posture: false,
    expression: false,
    voice: false,
    epro: false
  });
  const [modalSessionId, setModalSessionId] = useState<number | null>(null);

  useEffect(() => {
    listSessions().then((data) =>
      setSessions(data.sort((a, b) => b.date.localeCompare(a.date)))
    );
  }, []);

  const sessionsByType = useMemo(() => {
    return assessmentOrder.reduce<Record<AssessmentType, SessionMeta[]>>(
      (acc, type) => {
        acc[type] = sessions.filter((session) => session.type === type);
        return acc;
      },
      {
        ptosis: [],
        limbs: [],
        gait: [],
        tug: [],
        posture: [],
        expression: [],
        voice: [],
        epro: []
      }
    );
  }, [sessions]);

  useEffect(() => {
    const firstTypeWithRecord =
      assessmentOrder.find((type) => sessionsByType[type].length > 0) ?? "ptosis";
    setActiveType((current) =>
      sessionsByType[current].length > 0 ? current : firstTypeWithRecord
    );
  }, [sessionsByType]);

  useEffect(() => {
    setSelectedSessionIdByType((current) => {
      let changed = false;
      const next = { ...current };

      assessmentOrder.forEach((type) => {
        const availableSessions = sessionsByType[type];
        const currentSelection = current[type];
        const hasCurrentSelection = availableSessions.some(
          (session) => session.id === currentSelection
        );
        const nextSelection = hasCurrentSelection
          ? currentSelection
          : availableSessions[0]?.id ?? null;
        if (nextSelection !== currentSelection) {
          next[type] = nextSelection;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [sessionsByType]);

  const activeSessions = sessionsByType[activeType];
  const activeSessionIds = activeSessions.map((session) => session.id);
  const missingRecordIds = activeSessionIds.filter(
    (id) => !Object.prototype.hasOwnProperty.call(recordCache, id)
  );

  useEffect(() => {
    if (missingRecordIds.length === 0) {
      return;
    }

    let cancelled = false;
    setLoadingRecordTypes((current) => ({ ...current, [activeType]: true }));

    void Promise.all(
      missingRecordIds.map(async (sessionId) => {
        const record = await getTimeSeries(sessionId);
        return [sessionId, record ?? null] as const;
      })
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setRecordCache((current) => ({
        ...current,
        ...Object.fromEntries(entries)
      }));
      setLoadingRecordTypes((current) => ({ ...current, [activeType]: false }));
    });

    return () => {
      cancelled = true;
    };
  }, [activeType, missingRecordIds]);

  const selectedSessionId = selectedSessionIdByType[activeType];
  const selectedSession =
    activeSessions.find((session) => session.id === selectedSessionId) ?? null;
  const detailSession = isCompactViewport
    ? activeSessions.find((session) => session.id === modalSessionId) ?? null
    : selectedSession;

  useEffect(() => {
    setModalSessionId(null);
  }, [activeType]);

  useEffect(() => {
    if (!detailSession) {
      return;
    }

    const sessionId = detailSession.id;

    if (!Object.prototype.hasOwnProperty.call(recordCache, sessionId)) {
      void getTimeSeries(sessionId).then((record) => {
        setRecordCache((current) => {
          if (Object.prototype.hasOwnProperty.call(current, sessionId)) {
            return current;
          }
          return { ...current, [sessionId]: record ?? null };
        });
      });
    }

    if (!Object.prototype.hasOwnProperty.call(videoCache, sessionId)) {
      void getVideo(sessionId).then((video) => {
        setVideoCache((current) => {
          if (Object.prototype.hasOwnProperty.call(current, sessionId)) {
            return current;
          }
          return { ...current, [sessionId]: video ?? null };
        });
      });
    }

    if (!Object.prototype.hasOwnProperty.call(audioCache, sessionId)) {
      void getAudio(sessionId).then((audio) => {
        setAudioCache((current) => {
          if (Object.prototype.hasOwnProperty.call(current, sessionId)) {
            return current;
          }
          return { ...current, [sessionId]: audio ?? null };
        });
      });
    }
  }, [detailSession, audioCache, videoCache]);

  useEffect(() => {
    if (!isCompactViewport || !detailSession) {
      return;
    }

    const scrollY = window.scrollY;
    const { body } = document;
    const originalPosition = body.style.position;
    const originalTop = body.style.top;
    const originalWidth = body.style.width;
    const originalOverflow = body.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = originalPosition;
      body.style.top = originalTop;
      body.style.width = originalWidth;
      body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [detailSession, isCompactViewport]);

  useEffect(() => {
    if (!isCompactViewport || !detailSession) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalSessionId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailSession, isCompactViewport]);

  const activeMetricConfigs = metricConfigsByType[activeType];
  const availableMetricConfigs = activeMetricConfigs.filter((config) =>
    activeSessions.some((session) => config.getValue(session, recordCache[session.id]) !== null)
  );

  useEffect(() => {
    const activeMetricId = metricByType[activeType];
    const hasActiveMetric = availableMetricConfigs.some(
      (config) => config.id === activeMetricId
    );

    if (!hasActiveMetric && availableMetricConfigs[0]) {
      setMetricByType((current) => ({
        ...current,
        [activeType]: availableMetricConfigs[0]!.id
      }));
    }
  }, [activeType, availableMetricConfigs, metricByType]);

  const activeMetricConfig =
    availableMetricConfigs.find((config) => config.id === metricByType[activeType]) ??
    availableMetricConfigs[0] ??
    activeMetricConfigs[0];
  const graphMode = graphModeByType[activeType];
  const granularity = granularityByType[activeType];

  const derivedMetrics = useMemo<DerivedSessionMetric[]>(() => {
    if (!activeMetricConfig) {
      return [];
    }

    return activeSessions
      .map((session) => {
        const value = activeMetricConfig.getValue(session, recordCache[session.id]);
        if (value === null) {
          return null;
        }
        return {
          sessionId: session.id,
          session,
          timestamp: new Date(session.date).getTime(),
          date: session.date,
          value
        };
      })
      .filter((metric): metric is DerivedSessionMetric => metric !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [activeMetricConfig, activeSessions, recordCache]);

  const dailyData = useMemo<DailyAggregatePoint[]>(() => {
    return buildDailyAggregatePoints(derivedMetrics, granularity);
  }, [derivedMetrics, granularity]);

  const intradayData = useMemo<IntradayAggregatePoint[]>(() => {
    return buildIntradayAggregatePoints(derivedMetrics, new Date());
  }, [derivedMetrics]);

  const detailRecord = detailSession ? recordCache[detailSession.id] : undefined;
  const detailVideo = detailSession ? videoCache[detailSession.id] : undefined;
  const detailAudio = detailSession ? audioCache[detailSession.id] : undefined;
  const isDetailRecordLoading =
    detailSession !== null &&
    !Object.prototype.hasOwnProperty.call(recordCache, detailSession.id);
  const isDetailAssetLoading =
    detailSession !== null &&
    (!Object.prototype.hasOwnProperty.call(videoCache, detailSession.id) ||
      !Object.prototype.hasOwnProperty.call(audioCache, detailSession.id));

  const videoUrl = useMemo(() => {
    if (!detailVideo) {
      return null;
    }
    return URL.createObjectURL(detailVideo.blob);
  }, [detailVideo]);

  useEffect(() => {
    if (!videoUrl) {
      return;
    }
    return () => {
      URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const audioUrls = useMemo<AudioClipWithUrl[]>(() => {
    if (!detailAudio) {
      return [];
    }
    return detailAudio.clips.map((clip) => ({
      ...clip,
      url: URL.createObjectURL(clip.blob)
    }));
  }, [detailAudio]);

  useEffect(() => {
    return () => {
      audioUrls.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [audioUrls]);

  const graphEmptyMessage = useMemo(() => {
    if (activeSessions.length === 0) {
      return "この検査の記録はまだありません。";
    }
    if (loadingRecordTypes[activeType] && availableMetricConfigs.length === 0) {
      return "解析データを読み込んでいます。";
    }
    if (!activeMetricConfig) {
      return "表示できる指標がまだありません。";
    }
    if (derivedMetrics.length === 0) {
      return "この指標のデータがまだありません。";
    }
    if (graphMode === "daily" && dailyData.length === 0) {
      return "日別の最大値・最小値帯を描画できるデータがありません。";
    }
    if (
      graphMode === "intraday" &&
      intradayData.every(
        (point) => point.todayValue === null && point.recentAverageValue === null
      )
    ) {
      return "日内変動を描画できるデータがまだありません。";
    }
    return null;
  }, [
    activeMetricConfig,
    activeSessions.length,
    activeType,
    availableMetricConfigs.length,
    dailyData.length,
    derivedMetrics.length,
    graphMode,
    intradayData,
    loadingRecordTypes
  ]);

  const latestSession = activeSessions[0] ?? null;

  return (
    <Layout>
      <section className="page-header">
        <h1>記録を見る</h1>
        <p>
          検査ごとの代表値の推移と、同じ日の最大値・最小値の幅をまとめて確認できます。
        </p>
      </section>

      <section className="records-tabs" aria-label="検査タブ">
        {assessmentOrder.map((type) => {
          const count = sessionsByType[type].length;
          return (
            <button
              key={type}
              type="button"
              className={
                type === activeType
                  ? "records-tab-button active"
                  : "records-tab-button"
              }
              onClick={() => setActiveType(type)}
            >
              <span>{typeLabels[type]}</span>
              <span className="records-tab-count">{count}</span>
            </button>
          );
        })}
      </section>

      <section className="records-shell">
        <div className="records-analytics card">
          <div className="records-card-header">
            <div>
              <p className="records-eyebrow">{typeLabels[activeType]}</p>
              <h2>変動グラフ</h2>
            </div>
            <div className="records-summary-pills">
              <span className="records-summary-pill">
                記録 {activeSessions.length}件
              </span>
              <span className="records-summary-pill">
                指標 {activeMetricConfig?.label ?? "なし"}
              </span>
              <span className="records-summary-pill">
                最新 {latestSession ? formatShortDate(latestSession.date) : "--"}
              </span>
            </div>
          </div>

          <div className="records-controls">
            <div className="records-control-group">
              <span className="records-control-label">グラフモード</span>
              <div className="records-segmented">
                <button
                  type="button"
                  className={
                    graphMode === "daily"
                      ? "records-segmented-button active"
                      : "records-segmented-button"
                  }
                  onClick={() =>
                    setGraphModeByType((current) => ({
                      ...current,
                      [activeType]: "daily"
                    }))
                  }
                >
                  日毎の変動
                </button>
                <button
                  type="button"
                  className={
                    graphMode === "intraday"
                      ? "records-segmented-button active"
                      : "records-segmented-button"
                  }
                  onClick={() =>
                    setGraphModeByType((current) => ({
                      ...current,
                      [activeType]: "intraday"
                    }))
                  }
                >
                  日内変動
                </button>
              </div>
            </div>

            <label className="records-select-field">
              <span className="records-control-label">代表値</span>
              <select
                value={activeMetricConfig?.id ?? ""}
                onChange={(event) =>
                  setMetricByType((current) => ({
                    ...current,
                    [activeType]: event.target.value
                  }))
                }
              >
                {availableMetricConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="records-control-group">
              <span className="records-control-label">集計粒度</span>
              <div className="records-segmented">
                {(["day", "week", "month"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      granularity === value
                        ? "records-segmented-button active"
                        : "records-segmented-button"
                    }
                    onClick={() =>
                      setGranularityByType((current) => ({
                        ...current,
                        [activeType]: value
                      }))
                    }
                    disabled={graphMode === "intraday"}
                  >
                    {value === "day" ? "日" : value === "week" ? "週" : "月"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="records-chart-note">
            {graphMode === "daily"
              ? "平均値に加えて、同じ日や同じ週・月の最大値と最小値を線で表示し、その間を帯で着色します。"
              : "直近1週間の平均的な日内リズムと、本日の変動を時刻ごとに重ねて表示します。"}
          </p>

          <div className="records-chart-frame">
            {graphEmptyMessage ? (
              <div className="records-chart-empty">
                <p>{graphEmptyMessage}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isCompactViewport ? 260 : 320}>
                {graphMode === "daily" ? (
                  <ComposedChart
                    data={dailyData}
                    margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7ebe5" />
                    <XAxis dataKey="label" stroke="#5d7b7d" tickLine={false} />
                    <YAxis stroke="#5d7b7d" tickLine={false} width={56} />
                    <Tooltip content={<GraphTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="rangeFillBase"
                      name="帯の下端"
                      stackId="range"
                      stroke="none"
                      fill="transparent"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="rangeFillSpan"
                      name="最大-最小帯"
                      stackId="range"
                      stroke="none"
                      fill="rgba(39, 156, 154, 0.18)"
                    />
                    <Line
                      type="monotone"
                      dataKey="maxValue"
                      name="最大値"
                      stroke="#1f8b86"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minValue"
                      name="最小値"
                      stroke="#5db7af"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageValue"
                      name="平均値"
                      stroke="#0e2c2e"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={intradayData}
                    margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7ebe5" />
                    <XAxis dataKey="label" stroke="#5d7b7d" tickLine={false} />
                    <YAxis stroke="#5d7b7d" tickLine={false} width={56} />
                    <Tooltip content={<GraphTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="recentAverageValue"
                      name="直近1週間平均"
                      stroke="#1f8b86"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="todayValue"
                      name="本日"
                      stroke="#0e2c2e"
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {graphMode === "intraday" ? (
            <p className="records-chart-footnote">
              各時刻の保存済み測定値を比較しています。連続監視の波形ではありません。
            </p>
          ) : null}
        </div>

        <div className="records-side">
          {!isCompactViewport ? (
            <div className="card records-detail-card">
              {detailSession ? (
                <DetailPanel
                  session={detailSession}
                  record={detailRecord}
                  videoUrl={videoUrl}
                  audioUrls={audioUrls}
                  isRecordLoading={isDetailRecordLoading}
                  isAssetLoading={isDetailAssetLoading}
                />
              ) : (
                <div className="records-detail-empty-state">
                  <h2>詳細</h2>
                  <p>一覧から記録を選ぶと、詳細データと添付データを確認できます。</p>
                </div>
              )}
            </div>
          ) : null}

          <div className="card records-list-card">
            <div className="records-card-header">
              <div>
                <p className="records-eyebrow">{typeLabels[activeType]}</p>
                <h2>セッション一覧</h2>
              </div>
            </div>

            {activeSessions.length === 0 ? (
              <p>まだ記録がありません。</p>
            ) : (
              <div className="list records-session-list">
                {activeSessions.map((session) => {
                  const metricValue = activeMetricConfig?.getValue(
                    session,
                    recordCache[session.id]
                  );
                  const isActive = selectedSession?.id === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={
                        isActive ? "list-row records-row active" : "list-row records-row"
                      }
                      onClick={() => {
                        setSelectedSessionIdByType((current) => ({
                          ...current,
                          [activeType]: session.id
                        }));
                        if (isCompactViewport) {
                          setModalSessionId(session.id);
                        }
                      }}
                    >
                      <div className="records-row-main">
                        <div className="records-row-heading">
                          <p className="list-title">{typeLabels[session.type]}</p>
                          <p className="list-sub">{formatShortDate(session.date)}</p>
                        </div>
                        <p className="records-row-note">
                          {session.notes?.trim() || "メモはありません。"}
                        </p>
                      </div>
                      <div className="records-row-side">
                        <span className="badge">
                          {metricValue != null && activeMetricConfig
                            ? formatMetricValue(metricValue, activeMetricConfig)
                            : "--"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {isCompactViewport && detailSession ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setModalSessionId(null)}
        >
          <div
            className="modal-card records-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="records-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="records-modal-header">
              <div>
                <p className="records-eyebrow">{typeLabels[detailSession.type]}</p>
                <h2 id="records-detail-title">記録の詳細</h2>
              </div>
              <button
                type="button"
                className="records-modal-close"
                aria-label="閉じる"
                onClick={() => setModalSessionId(null)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6L18 18M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>

            <DetailPanel
              session={detailSession}
              record={detailRecord}
              videoUrl={videoUrl}
              audioUrls={audioUrls}
              isRecordLoading={isDetailRecordLoading}
              isAssetLoading={isDetailAssetLoading}
            />
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
