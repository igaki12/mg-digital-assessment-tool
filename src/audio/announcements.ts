const publicFiles = {
  "common.faceMissing": "common-face-missing.wav",
  "common.bodyMissing": "common-body-missing.wav",
  "common.autoTrigger": "common-auto-trigger.wav",
  "ptosis.intro": "ptosis-intro.wav",
  "ptosis.hold": "ptosis-hold.wav",
  "ptosis.progress10": "ptosis-progress-10.wav",
  "ptosis.progress20": "ptosis-progress-20.wav",
  "ptosis.done": "ptosis-done.wav",
  "limbs.start": "limbs-start.wav",
  "limbs.positioning": "limbs-positioning.wav",
  "gait.start": "gait-start.wav",
  "gait.recordingStart": "gait-recording-start.wav",
  "posture.frontIntro": "posture-front-intro.wav",
  "posture.frontHold": "posture-front-hold.wav",
  "posture.sideTurn": "posture-side-turn.wav",
  "posture.sideReady": "posture-side-ready.wav",
  "posture.sideHold": "posture-side-hold.wav",
  "posture.done": "posture-done.wav",
  "expression.rest": "expression-rest.wav",
  "expression.smile": "expression-smile.wav",
  "expression.done": "expression-done.wav",
  "voice.task1": "voice-task-1.wav",
  "voice.task2": "voice-task-2.wav",
  "voice.task3": "voice-task-3.wav",
  "voice.done": "voice-done.wav"
} as const;

const pageIntroFiles = {
  "pageIntro.ptosis": "page-intro-ptosis.wav",
  "pageIntro.limbs": "page-intro-limbs.wav",
  "pageIntro.gait": "page-intro-gait.wav",
  "pageIntro.posture": "page-intro-posture.wav",
  "pageIntro.expression": "page-intro-expression.wav",
  "pageIntro.voice": "page-intro-voice.wav"
} as const;

export type AnnouncementKey =
  | keyof typeof publicFiles
  | keyof typeof pageIntroFiles;

export function getAnnouncementUrl(key: AnnouncementKey) {
  if (key in publicFiles) {
    return `${import.meta.env.BASE_URL}audio/${encodeURIComponent(
      publicFiles[key as keyof typeof publicFiles]
    )}`;
  }

  return `${import.meta.env.BASE_URL}audio/${encodeURIComponent(
    pageIntroFiles[key as keyof typeof pageIntroFiles]
  )}`;
}
