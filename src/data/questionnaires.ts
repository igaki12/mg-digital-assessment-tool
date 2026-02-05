export type QuestionnaireItem = {
  id: string;
  label: string;
  description: string;
  maxScore: number;
};

export const mgAdlItems: QuestionnaireItem[] = [
  {
    id: "speech",
    label: "会話",
    description: "普段通り 〜 全く話せない",
    maxScore: 3
  },
  {
    id: "chewing",
    label: "咀嚼（かむ力）",
    description: "普通 〜 チューブ栄養が必要",
    maxScore: 3
  },
  {
    id: "swallowing",
    label: "嚥下（飲み込み）",
    description: "普通 〜 むせがひどく食べられない",
    maxScore: 3
  },
  {
    id: "breathing",
    label: "呼吸",
    description: "普通 〜 安静時も息苦しい・人工呼吸器",
    maxScore: 3
  },
  {
    id: "hygiene",
    label: "歯磨き・整髪",
    description: "休みなしで可能 〜 全くできない",
    maxScore: 3
  },
  {
    id: "standing",
    label: "立ち上がり",
    description: "手を使わずに可能 〜 何かにつかまらないと無理",
    maxScore: 3
  },
  {
    id: "diplopia",
    label: "複視（二重に見える）",
    description: "なし 〜 常にある",
    maxScore: 3
  },
  {
    id: "ptosis",
    label: "眼瞼下垂（まぶた）",
    description: "なし 〜 目が開かない",
    maxScore: 3
  }
];

export const mgQolItems: QuestionnaireItem[] = [
  {
    id: "irritated",
    label: "体の使いにくさでイライラしましたか？",
    description: "気分面の影響",
    maxScore: 2
  },
  {
    id: "walking",
    label: "歩くのが大変だと感じましたか？",
    description: "移動のしづらさ",
    maxScore: 2
  },
  {
    id: "work",
    label: "仕事や家事に支障が出ましたか？",
    description: "社会生活への影響",
    maxScore: 2
  },
  {
    id: "eye_symptoms",
    label: "目の症状（まぶた・二重に見える）で困りましたか？",
    description: "視覚症状の負担",
    maxScore: 2
  },
  {
    id: "reading",
    label: "読書や画面を見るのがつらいと感じましたか？",
    description: "視線保持の負荷",
    maxScore: 2
  },
  {
    id: "speaking",
    label: "話すのが大変だと感じましたか？",
    description: "コミュニケーション",
    maxScore: 2
  },
  {
    id: "eating",
    label: "食事に不安を感じましたか？",
    description: "食事動作",
    maxScore: 2
  },
  {
    id: "fatigue",
    label: "疲れやすいと感じましたか？",
    description: "全身倦怠感",
    maxScore: 2
  },
  {
    id: "social",
    label: "外出や人と会うのが負担でしたか？",
    description: "社会参加",
    maxScore: 2
  },
  {
    id: "confidence",
    label: "自信が持てないと感じましたか？",
    description: "自己評価",
    maxScore: 2
  },
  {
    id: "stress",
    label: "ストレスを感じましたか？",
    description: "心理的負担",
    maxScore: 2
  },
  {
    id: "sleep",
    label: "睡眠に影響がありましたか？",
    description: "休息の質",
    maxScore: 2
  },
  {
    id: "family",
    label: "家族や周囲に負担を感じましたか？",
    description: "周囲への影響",
    maxScore: 2
  },
  {
    id: "independence",
    label: "自立が難しいと感じましたか？",
    description: "自立度",
    maxScore: 2
  },
  {
    id: "future",
    label: "将来への不安がありましたか？",
    description: "将来の見通し",
    maxScore: 2
  }
];
