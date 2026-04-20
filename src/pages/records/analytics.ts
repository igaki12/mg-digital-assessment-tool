import type { SessionMeta } from "../../types";

export type MetricGranularity = "day" | "week" | "month";

export type DerivedSessionMetric = {
  sessionId: number;
  session: SessionMeta;
  timestamp: number;
  date: string;
  value: number;
};

export type DailyAggregatePoint = {
  bucketKey: string;
  label: string;
  averageValue: number;
  minValue: number;
  maxValue: number;
  rangeFillBase: number;
  rangeFillSpan: number;
  sampleCount: number;
};

export type IntradayAggregatePoint = {
  hour: number;
  label: string;
  todayValue: number | null;
  recentAverageValue: number | null;
};

type DailyBucket = {
  key: string;
  label: string;
  sortValue: number;
  values: number[];
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDayLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function startOfIsoWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() + diff);
  return start;
}

function isoWeekKey(date: Date) {
  const start = startOfIsoWeek(date);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-W${month}${day}`;
}

function isoWeekLabel(date: Date) {
  const start = startOfIsoWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${localDayLabel(start)}-${localDayLabel(end)}`;
}

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildDailyBuckets(
  metrics: DerivedSessionMetric[],
  granularity: MetricGranularity
) {
  const dayBuckets = new Map<string, DailyBucket>();

  metrics.forEach((metric) => {
    const date = new Date(metric.timestamp);
    const key = localDayKey(date);
    const existing = dayBuckets.get(key);
    if (existing) {
      existing.values.push(metric.value);
      return;
    }
    dayBuckets.set(key, {
      key,
      label: localDayLabel(date),
      sortValue: startOfLocalDay(date).getTime(),
      values: [metric.value]
    });
  });

  const dailyPoints = Array.from(dayBuckets.values())
    .sort((a, b) => a.sortValue - b.sortValue)
    .map((bucket) => {
      const averageValue = average(bucket.values);
      const minValue = Math.min(...bucket.values);
      const maxValue = Math.max(...bucket.values);
      return {
        bucketKey: bucket.key,
        label: bucket.label,
        sortValue: bucket.sortValue,
        averageValue,
        minValue,
        maxValue,
        rangeFillBase: minValue,
        rangeFillSpan: maxValue - minValue,
        sampleCount: bucket.values.length
      };
    });

  if (granularity === "day") {
    return dailyPoints;
  }

  const groupedBuckets = new Map<
    string,
    {
      label: string;
      sortValue: number;
      points: typeof dailyPoints;
    }
  >();

  dailyPoints.forEach((point) => {
    const date = new Date(point.sortValue);
    const key =
      granularity === "week" ? isoWeekKey(date) : monthKey(date);
    const label =
      granularity === "week" ? isoWeekLabel(date) : monthLabel(date);
    const sortValue =
      granularity === "week"
        ? startOfIsoWeek(date).getTime()
        : new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const existing = groupedBuckets.get(key);
    if (existing) {
      existing.points.push(point);
      return;
    }
    groupedBuckets.set(key, { label, sortValue, points: [point] });
  });

  return Array.from(groupedBuckets.entries())
    .sort((a, b) => a[1].sortValue - b[1].sortValue)
    .map(([bucketKey, bucket]) => {
      const averageValue = average(
        bucket.points.map((point) => point.averageValue)
      );
      const minValue = average(bucket.points.map((point) => point.minValue));
      const maxValue = average(bucket.points.map((point) => point.maxValue));
      const sampleCount = bucket.points.reduce(
        (sum, point) => sum + point.sampleCount,
        0
      );
      return {
        bucketKey,
        label: bucket.label,
        averageValue,
        minValue,
        maxValue,
        rangeFillBase: minValue,
        rangeFillSpan: maxValue - minValue,
        sampleCount
      };
    });
}

export function buildDailyAggregatePoints(
  metrics: DerivedSessionMetric[],
  granularity: MetricGranularity
): DailyAggregatePoint[] {
  if (metrics.length === 0) {
    return [];
  }
  return buildDailyBuckets(metrics, granularity);
}

export function buildIntradayAggregatePoints(
  metrics: DerivedSessionMetric[],
  referenceDate = new Date()
): IntradayAggregatePoint[] {
  const todayStart = startOfLocalDay(referenceDate);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const recentWindowStart = new Date(todayStart);
  recentWindowStart.setDate(recentWindowStart.getDate() - 6);

  const todayByHour = new Map<number, number[]>();
  const recentByHour = new Map<number, number[]>();

  metrics.forEach((metric) => {
    const date = new Date(metric.timestamp);
    if (date < recentWindowStart || date >= tomorrowStart) {
      return;
    }

    const hour = date.getHours();
    const recentValues = recentByHour.get(hour) ?? [];
    recentValues.push(metric.value);
    recentByHour.set(hour, recentValues);

    if (date >= todayStart) {
      const todayValues = todayByHour.get(hour) ?? [];
      todayValues.push(metric.value);
      todayByHour.set(hour, todayValues);
    }
  });

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    todayValue: todayByHour.has(hour)
      ? average(todayByHour.get(hour) ?? [])
      : null,
    recentAverageValue: recentByHour.has(hour)
      ? average(recentByHour.get(hour) ?? [])
      : null
  }));
}
