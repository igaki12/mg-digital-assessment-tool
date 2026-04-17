import type { AudioClipMetrics } from "../types";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  );
}

function autoCorrelate(frame: Float32Array, sampleRate: number) {
  let rms = 0;
  for (let i = 0; i < frame.length; i += 1) {
    rms += frame[i]! * frame[i]!;
  }
  rms = Math.sqrt(rms / frame.length);
  if (rms < 0.01) {
    return 0;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  const minOffset = Math.floor(sampleRate / 400);
  const maxOffset = Math.floor(sampleRate / 70);

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < frame.length - offset; i += 1) {
      correlation += frame[i]! * frame[i + offset]!;
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorrelation < 0.01) {
    return 0;
  }

  return sampleRate / bestOffset;
}

export async function analyzeVoiceBlob(blob: Blob): Promise<AudioClipMetrics> {
  const AudioContextClass =
    window.AudioContext ||
    // @ts-expect-error webkit fallback
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return {
      durationSec: 0,
      meanRms: 0,
      peakRms: 0,
      pitchMeanHz: 0,
      pitchStdHz: 0,
      voicedFrameRatio: 0
    };
  }

  const context = new AudioContextClass();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelData = buffer.getChannelData(0);
    const frameSize = 2048;
    const hopSize = 512;
    const rmsValues: number[] = [];
    const pitches: number[] = [];
    let voicedFrames = 0;
    let totalFrames = 0;

    for (let offset = 0; offset + frameSize <= channelData.length; offset += hopSize) {
      totalFrames += 1;
      const frame = channelData.slice(offset, offset + frameSize);
      let sumSquares = 0;
      for (let i = 0; i < frame.length; i += 1) {
        sumSquares += frame[i]! * frame[i]!;
      }
      const rms = Math.sqrt(sumSquares / frame.length);
      rmsValues.push(rms);

      const pitch = autoCorrelate(frame, buffer.sampleRate);
      if (pitch > 0) {
        voicedFrames += 1;
        pitches.push(pitch);
      }
    }

    return {
      durationSec: buffer.duration,
      meanRms: average(rmsValues),
      peakRms: rmsValues.length ? Math.max(...rmsValues) : 0,
      pitchMeanHz: average(pitches),
      pitchStdHz: std(pitches),
      voicedFrameRatio: totalFrames > 0 ? voicedFrames / totalFrames : 0
    };
  } finally {
    void context.close();
  }
}
