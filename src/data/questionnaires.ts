export type QuestionnaireItem = {
  id: string;
  label: string;
  description: string;
  leftLabel: string;
  rightLabel: string;
  maxScore: number;
};

export const mgAdlItems: QuestionnaireItem[] = [
  {
    id: "speech",
    label: "話しやすさ",
    description: "会話のしやすさ",
    leftLabel: "普段通り話せる",
    rightLabel: "ほとんど話せない",
    maxScore: 3
  },
  {
    id: "chewing",
    label: "かむ力",
    description: "食べ物をかめるか",
    leftLabel: "普通にかめる",
    rightLabel: "チューブ栄養が必要",
    maxScore: 3
  },
  {
    id: "swallowing",
    label: "飲み込みやすさ",
    description: "飲食時のむせやすさ",
    leftLabel: "問題なく飲み込める",
    rightLabel: "むせが強く食べられない",
    maxScore: 3
  },
  {
    id: "breathing",
    label: "呼吸の楽さ",
    description: "息苦しさの程度",
    leftLabel: "普段通りに呼吸できる",
    rightLabel: "安静時も息苦しい/人工呼吸器",
    maxScore: 3
  },
  {
    id: "hygiene",
    label: "歯磨き・整髪",
    description: "腕の力で日常動作ができるか",
    leftLabel: "休みなしでできる",
    rightLabel: "ほとんどできない",
    maxScore: 3
  },
  {
    id: "standing",
    label: "立ち上がり",
    description: "脚の力で立てるか",
    leftLabel: "手を使わず立てる",
    rightLabel: "何かにつかまらないと無理",
    maxScore: 3
  },
  {
    id: "diplopia",
    label: "二重に見える症状",
    description: "複視の頻度",
    leftLabel: "二重に見えない",
    rightLabel: "常に二重に見える",
    maxScore: 3
  },
  {
    id: "ptosis",
    label: "まぶたの重さ",
    description: "眼の開きやすさ",
    leftLabel: "まぶたが重くない",
    rightLabel: "目が開かない",
    maxScore: 3
  }
];

export const mgQolItems: QuestionnaireItem[] = [
  {
    id: "irritated",
    label: "体の使いにくさでイライラしましたか？",
    description: "気分面の影響",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "walking",
    label: "歩くのが大変だと感じましたか？",
    description: "移動のしづらさ",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "work",
    label: "仕事や家事に支障が出ましたか？",
    description: "社会生活への影響",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "eye_symptoms",
    label: "目の症状（まぶた・二重に見える）で困りましたか？",
    description: "視覚症状の負担",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "reading",
    label: "読書や画面を見るのがつらいと感じましたか？",
    description: "視線保持の負荷",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "speaking",
    label: "話すのが大変だと感じましたか？",
    description: "コミュニケーション",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "eating",
    label: "食事に不安を感じましたか？",
    description: "食事動作",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "fatigue",
    label: "疲れやすいと感じましたか？",
    description: "全身倦怠感",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "social",
    label: "外出や人と会うのが負担でしたか？",
    description: "社会参加",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "confidence",
    label: "自信が持てないと感じましたか？",
    description: "自己評価",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "stress",
    label: "ストレスを感じましたか？",
    description: "心理的負担",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "sleep",
    label: "睡眠に影響がありましたか？",
    description: "休息の質",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "family",
    label: "家族や周囲に負担を感じましたか？",
    description: "周囲への影響",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "independence",
    label: "自立が難しいと感じましたか？",
    description: "自立度",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  },
  {
    id: "future",
    label: "将来への不安がありましたか？",
    description: "将来の見通し",
    leftLabel: "まったくない",
    rightLabel: "とても強い",
    maxScore: 2
  }
];
