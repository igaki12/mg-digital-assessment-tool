const publicFiles = {
  "common.faceMissing": "顔が枠に入っていない時.wav",
  "common.bodyMissing": "全身が枠に入っていない時（姿勢計測時）.wav",
  "common.autoTrigger": "認識完了・計測開始時（オートトリガー）.wav",
  "ptosis.intro": "眼の検査（眼瞼下垂：上方視試験）開始前.wav",
  "ptosis.progress10": "眼の検査（眼瞼下垂：上方視試験）計測中10秒経過.wav",
  "ptosis.progress20": "眼の検査（眼瞼下垂：上方視試験）計測中20秒経過.wav",
  "ptosis.done": "眼の検査（眼瞼下垂：上方視試験）終了時.wav",
  "posture.frontIntro": "姿勢の検査（正面：側方偏位 ＆ 歩行）静止立位1.wav",
  "posture.frontHold": "姿勢の検査（正面：側方偏位 ＆ 歩行）静止立位2.wav",
  "posture.sideTurn":
    "姿勢の検査（側面：体幹前屈角・首下がり角）開始前側面への向き変更.wav",
  "posture.sideReady":
    "姿勢の検査（側面：体幹前屈角・首下がり角）位置認識後.wav",
  "posture.sideHold":
    "姿勢の検査（側面：体幹前屈角・首下がり角）計測中.wav",
  "posture.done":
    "姿勢の検査（側面：体幹前屈角・首下がり角）終了時.wav",
  "expression.rest": "表情の検査（仮面様顔貌・瞬目）安静時.wav",
  "expression.smile": "表情の検査（仮面様顔貌・瞬目）笑顔のタスク.wav",
  "expression.done": "表情の検査（仮面様顔貌・瞬目）終了時.wav",
  "voice.task1": "音声の検査（構音障害・発声機能）タスク1持続母音.wav",
  "voice.task2": "音声の検査（構音障害・発声機能）タスク2数字のカウント.wav",
  "voice.task3": "音声の検査（構音障害・発声機能）タスク3定型分の音読.wav",
  "voice.done": "音声の検査（構音障害・発声機能）終了時.wav"
} as const;

const pageIntroFiles = {
  "pageIntro.ptosis": "眼の検査ページ（眼瞼下垂：上方視試験）.wav",
  "pageIntro.limbs": "腕の検査ページ（上肢筋力）.wav",
  "pageIntro.gait": "歩行監視モードページ（歩行）.wav",
  "pageIntro.posture": "姿勢の検査ページ（正面・側面）.wav",
  "pageIntro.expression": "表情の検査ページ（仮面様顔貌・瞬目）.wav",
  "pageIntro.voice": "音声の検査ページ（構音障害・発声機能）.wav"
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
