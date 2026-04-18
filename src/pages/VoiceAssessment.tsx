import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { analyzeVoiceBlob } from "../audio/voiceAnalysis";
import { announcementController } from "../audio/controller";
import { addAudio, addSession, addTimeSeries } from "../storage/db";
import type { AudioClip } from "../types";

type VoiceTaskId = "sustain" | "count" | "reading";

type VoiceTaskDefinition = {
  id: VoiceTaskId;
  label: string;
  announcement:
    | "voice.task1"
    | "voice.task2"
    | "voice.task3";
  instruction: string;
};

type VoiceTaskResult = {
  clip: AudioClip | null;
  previewUrl: string | null;
};

const voiceTasks: VoiceTaskDefinition[] = [
  {
    id: "sustain",
    label: "持続母音「あー」",
    announcement: "voice.task1",
    instruction:
      "大きく息を吸って、できるだけ長く「あー」と声を出してください。"
  },
  {
    id: "count",
    label: "数字のカウント",
    announcement: "voice.task2",
    instruction:
      "画面の案内に沿って、1から50まで普段の速さで数えてください。"
  },
  {
    id: "reading",
    label: "定型文の音読",
    announcement: "voice.task3",
    instruction:
      "画面に表示された文章を、普段通りの声量で読み上げてください。"
  }
];

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];
  return candidates.find((value) => MediaRecorder.isTypeSupported(value)) ?? "";
}

export default function VoiceAssessment() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState(
    "開始すると3つの音声タスクを順番に案内します。"
  );
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [results, setResults] = useState<Record<VoiceTaskId, VoiceTaskResult>>({
    sustain: { clip: null, previewUrl: null },
    count: { clip: null, previewUrl: null },
    reading: { clip: null, previewUrl: null }
  });

  const activeTask = voiceTasks[activeTaskIndex] ?? voiceTasks[0]!;
  const canSave = voiceTasks.every((task) => Boolean(results[task.id].clip));

  const cleanupStream = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cleanupUrls = useCallback(() => {
    for (const result of Object.values(results)) {
      if (result.previewUrl) {
        URL.revokeObjectURL(result.previewUrl);
      }
    }
  }, [results]);

  const resetSession = useCallback((nextStatusText = "開始すると3つの音声タスクを順番に案内します。") => {
    cleanupStream();
    cleanupUrls();
    setSessionStarted(false);
    setRecording(false);
    setProcessing(false);
    setActiveTaskIndex(0);
    setResults({
      sustain: { clip: null, previewUrl: null },
      count: { clip: null, previewUrl: null },
      reading: { clip: null, previewUrl: null }
    });
    setStatusText(nextStatusText);
  }, [cleanupStream, cleanupUrls]);

  const startSession = useCallback(async () => {
    try {
      announcementController.enableAutoplay();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      streamRef.current = stream;
      setSessionStarted(true);
      setStatusText("最初のタスクの案内が流れます。準備ができたら録音できます。");
      void announcementController.interruptAndPlay(activeTask.announcement);
    } catch (error) {
      console.warn("Unable to start voice assessment", error);
      setStatusText("マイクへのアクセスが許可されていません。設定を確認してください。");
    }
  }, [activeTask.announcement]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recording || processing) {
      return;
    }
    announcementController.stopCurrent();
    const mimeType = getSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setStatusText(`${activeTask.label} を録音しています。必要な長さで停止してください。`);
  }, [activeTask.label, processing, recording]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !recording) {
      return;
    }
    setRecording(false);
    setProcessing(true);
    setStatusText("録音データを解析しています。");

    const blob = await new Promise<Blob>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(new Blob());
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mimeType }));
      };
      recorder.stop();
    });

    recorderRef.current = null;
    const metrics = await analyzeVoiceBlob(blob);
    const durationSec =
      startedAtRef.current === null ? 0 : (Date.now() - startedAtRef.current) / 1000;
    const nextClip: AudioClip = {
      taskId: activeTask.id,
      label: activeTask.label,
      blob,
      mimeType: blob.type || "audio/webm",
      durationSec,
      metrics
    };
    setResults((prev) => {
      if (prev[activeTask.id].previewUrl) {
        URL.revokeObjectURL(prev[activeTask.id].previewUrl as string);
      }
      return {
        ...prev,
        [activeTask.id]: {
          clip: nextClip,
          previewUrl: URL.createObjectURL(blob)
        }
      };
    });
    setProcessing(false);
    setStatusText(`${activeTask.label} の録音が完了しました。再録音することもできます。`);
  }, [activeTask.id, activeTask.label, recording]);

  const moveToTask = useCallback((index: number) => {
    const nextTask = voiceTasks[index];
    if (!nextTask) {
      return;
    }
    setActiveTaskIndex(index);
    setStatusText("次の音声タスクへ進みました。案内を待たずに録音を開始できます。");
    void announcementController.interruptAndPlay(nextTask.announcement);
  }, []);

  const saveSession = useCallback(async () => {
    const clips = voiceTasks
      .map((task) => results[task.id].clip)
      .filter(Boolean) as AudioClip[];
    if (clips.length !== voiceTasks.length) {
      return;
    }

    const id = Date.now();
    const averageRms =
      clips.reduce((sum, clip) => sum + clip.metrics.meanRms, 0) / clips.length;
    const averagePitch =
      clips.reduce((sum, clip) => sum + clip.metrics.pitchMeanHz, 0) / clips.length;

    await addSession({
      id,
      type: "voice",
      date: new Date().toISOString(),
      summaryScore: Number(averageRms.toFixed(4)),
      notes: `平均ピッチ ${averagePitch.toFixed(1)}Hz`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: clips.map((clip, index) => ({
        timestamp: Date.now() + index,
        voiceRms: clip.metrics.meanRms,
        voicePitchHz: clip.metrics.pitchMeanHz
      })),
      details: {
        tasks: clips.map((clip) => ({
          taskId: clip.taskId,
          label: clip.label,
          durationSec: clip.durationSec,
          metrics: clip.metrics
        }))
      }
    });
    await addAudio({
      sessionId: id,
      createdAt: Date.now(),
      clips
    });

    void announcementController.interruptAndPlay("voice.done");
    resetSession("保存しました。再度検査することもできます。");
  }, [resetSession, results]);

  useEffect(() => {
    return () => {
      cleanupStream();
      cleanupUrls();
      announcementController.stopCurrent();
    };
  }, [cleanupStream, cleanupUrls]);

  return (
    <Layout>
      <section className="page-header">
        <h1>音声検査</h1>
        <p>構音障害や発声変化を見るために、持続母音、数字カウント、定型文音読を順に録音します。</p>
      </section>

      <section className="card phase-card">
        <p className="phase-label">現在のフェーズ</p>
        <div className="phase-banner">
          <strong>{sessionStarted ? activeTask.label : "待機中"}</strong>
          <span>{statusText}</span>
        </div>
      </section>

      <section className="voice-task-stack">
        {voiceTasks.map((task, index) => {
          const result = results[task.id];
          const isActive = activeTask.id === task.id;
          return (
            <section
              key={task.id}
              className={`card voice-task-card${isActive ? " active" : ""}${
                result.clip ? " done" : ""
              }`}
            >
              <div className="voice-task-header">
                <div>
                  <h2>{task.label}</h2>
                  <p>{task.instruction}</p>
                </div>
                <span className="voice-task-badge">
                  {result.clip ? "録音済み" : isActive ? "現在のタスク" : "未着手"}
                </span>
              </div>

              {result.previewUrl ? (
                <audio className="voice-preview" controls src={result.previewUrl} />
              ) : null}

              {result.clip ? (
                <div className="voice-metrics-grid">
                  <div className="metric">
                    <span>録音時間</span>
                    <strong>{result.clip.metrics.durationSec.toFixed(1)}s</strong>
                  </div>
                  <div className="metric">
                    <span>平均音量</span>
                    <strong>{result.clip.metrics.meanRms.toFixed(3)}</strong>
                  </div>
                  <div className="metric">
                    <span>平均ピッチ</span>
                    <strong>{result.clip.metrics.pitchMeanHz.toFixed(1)}Hz</strong>
                  </div>
                </div>
              ) : null}

              {isActive ? (
                <div className="button-row">
                  {!sessionStarted ? (
                    <PrimaryButton onClick={startSession}>検査開始</PrimaryButton>
                  ) : null}
                  {sessionStarted && !recording ? (
                    <PrimaryButton disabled={processing} onClick={startRecording}>
                      録音開始
                    </PrimaryButton>
                  ) : null}
                  {recording ? (
                    <button className="ghost-button" onClick={() => void stopRecording()}>
                      録音停止
                    </button>
                  ) : null}
                  {sessionStarted ? (
                    <button
                      className="ghost-button"
                      disabled={processing}
                      onClick={() =>
                        void announcementController.interruptAndPlay(task.announcement)
                      }
                    >
                      案内を再生
                    </button>
                  ) : null}
                  {result.clip && index < voiceTasks.length - 1 ? (
                    <button
                      className="ghost-button"
                      disabled={processing}
                      onClick={() => moveToTask(index + 1)}
                    >
                      次のタスクへ
                    </button>
                  ) : null}
                  {result.clip && index === voiceTasks.length - 1 ? (
                    <PrimaryButton disabled={!canSave || processing} onClick={() => void saveSession()}>
                      保存する
                    </PrimaryButton>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </section>
    </Layout>
  );
}
