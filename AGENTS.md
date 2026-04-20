# AGENTS.md - MG Digital Assessment Tool (Project Draft)

このリポジトリでは、`AGENTS.md` をエージェント向けの作業ガイドとして使う。

## 0. 参照順

1. [PRODUCT_REQUIREMENTS_MG_PD.md](./PRODUCT_REQUIREMENTS_MG_PD.md)
2. [PRODUCT_DRAFT_LEGACY_MG.md](./PRODUCT_DRAFT_LEGACY_MG.md)
3. [PD_POSTURE_UX_NOTES.md](./PD_POSTURE_UX_NOTES.md)

## 0-2. 作業ルール

- 現行実装は MG 中心のプロトタイプとして扱う
- PD 対応は段階追加とし、未実装機能を「実装済み」とは書かない
- 単眼カメラでの絶対精度を過剰に約束しない
- 本アプリは診断補助ではなく経時比較支援を目的とする
- 認証、同意、クラウド保存はバックエンド前提の別フェーズとして扱う
- 要件書を更新するときは、現行実装 / 次期機能 / 研究課題を混在させない

## 1. プロジェクト概要
**目的:** 重症筋無力症（MG）患者が自宅で手軽に重症度を記録・管理できるWebアプリケーションの開発。
**特徴:**
*   **客観的評価:** Google MediaPipe (Face/Pose Landmarker) を使用し、眼瞼下垂、上肢筋力、歩行動作を自動解析・数値化する。
*   **主観的評価:** 論文「BioDigit MG」に基づいたMG-ADL / MG-QOL15r相当の日本語版質問票（ePRO）を実装。
*   **プライバシー重視:** サーバーサイドでの処理を行わず、すべてのAI解析はブラウザ（ローカル）で完結。データはユーザーのデバイス内に保存される。
*   **医師連携:** 蓄積データを診察時に端末上で見せる運用を基本としつつ、`医師共有` 画面からクラウド送信を模したダミーUIで未同期件数・送信導線・動画整理導線を確認できるようにする。

**技術スタック:**
*   **Frontend:** React (SPA), Vite
*   **AI/CV:** Google MediaPipe Tasks (Vision), TensorFlow.js backend
*   **Charting:** Recharts
*   **Hosting:** GitHub Pages
*   **Storage:** IndexedDB (動画・時系列データ用), LocalStorage (設定・軽量データ用)

---

## 2. 機能モジュール設計

### A. 主観的・準客観的評価モジュール (Symptoms Check)
論文にある「ビデオ評価（Video Assessments）」を参考に、MediaPipeで自動計測機能を付加して実装する。

#### A-1. 眼瞼下垂評価 (Ptosis Assessment)
*   **使用モデル:** MediaPipe Face Landmarker
*   **タスク:** 上方視試験 (Upward Gaze Test)
    *   ユーザーはカメラに向かい、頭を動かさずに視線だけを可能な限り上に向ける動作を一定時間（例：30秒〜60秒）維持する。
*   **計測ロジック:**
    *   **EAR (Eye Aspect Ratio):** まぶたの開き具合をランドマーク距離から算出。
    *   **Iris Position:** 瞳孔中心と目頭・目尻の距離比率。
    *   **疲労度検知:** 時間経過に伴うEARの低下（まぶたが下がってくる現象）をグラフ化。
*   **UI/UX:**
    *   画面中央に自分の顔を表示。
    *   「頭を動かさないでください」という警告表示（Pose Landmarkerで鼻の角度を監視して実装）。
    *   タイムカウンターと、疲労検知のリアルタイムフィードバック（オプション）。

#### A-2. 上肢筋力低下評価 (Upper Limb Weakness)
*   **使用モデル:** MediaPipe Pose Landmarker
*   **タスク:** 上肢挙上持続試験 (Arm Abduction Time)
    *   両腕を肩の高さ（90度）まで水平に広げ、その状態を維持する。
*   **計測ロジック:**
    *   肩・肘・手首のランドマーク角度を計算。
    *   腕の角度が90度を下回った時点、または震え（振幅）が大きくなった時点を「限界」として記録。
*   **UI/UX:**
    *   画面上にガイドライン（ボックス）を表示し、「この枠内に腕を維持してください」と指示。

### B. 客観的歩行・動作評価モジュール (Passive/Gait Monitoring)
論文のウェアラブルセンサー（PAMSys）の役割を、固定カメラ映像解析で代替する。

#### B-1. 監視カメラ形式歩行記録 (Surveillance Gait Analysis)
*   **使用モデル:** MediaPipe Pose Landmarker
*   **動作フロー:**
    1.  アプリを起動し「監視モード」にする（iPad/PCを部屋の隅に設置）。
    2.  **人体検知トリガー:** Pose Landmarkerが全身（足先まで）を検出すると、自動的に録画と解析を開始。
    3.  フレームアウトするか、一定時間動きが止まると録画終了。
*   **計測データ:**
    *   **歩行速度 (Gait Speed):** 画面内の移動ピクセル数 ÷ 時間（※身長設定による補正を行う）。
    *   **膝関節屈曲角度 (Knee Flexion Angle):** 歩行周期における膝の最大曲がり角度（すり足歩行になっていないかの指標）。
    *   **姿勢傾斜:** 体幹の傾き（左右・前後）。
*   **医師向け表示:**
    *   動画プレイヤーと共に、歩行速度と関節角度の変化をタイムライングラフで同期表示。
    *   異常値（極端に遅い、角度が浅い）が出た箇所に自動マーカーを設置。

### C. ePRO（電子的患者報告アウトカム）モジュール
論文で言及されているMG-ADLおよびMG-QOL15rを、日本の患者向けに分かりやすく実装する。

*   **UI設計方針:**
    *   大きなボタン、ハイコントラスト（視覚障害への配慮）。
    *   前回スコアとの比較表示（患者が変化に気づけるようにする）。

#### C-1. MG-ADL相当質問票 (Daily Living Profile)
*症状の重さが生活動作に与える影響を0-3点で評価（8項目）。*

1.  **会話:** 普段通り 〜 全く話せない
2.  **咀嚼（かむ力）:** 普通 〜 チューブ栄養が必要
3.  **嚥下（飲み込み）:** 普通 〜 むせがひどく食べられない
4.  **呼吸:** 普通 〜 安静時も息苦しい・人工呼吸器
5.  **歯磨き・整髪:** 休みなしで可能 〜 全くできない（腕の筋力）
6.  **立ち上がり:** 手を使わずに可能 〜 何かにつかまらないと無理（脚の筋力）
7.  **複視（二重に見える）:** なし 〜 常にある
8.  **眼瞼下垂（まぶた）:** なし 〜 目が開かない

#### C-2. MG-QOL15r相当質問票 (Quality of Life)
*病気が気持ちや社会生活に与える影響を0-2点で評価（15項目）。*

*   **文言例:**
    *   「体の使いにくさでイライラしましたか？」
    *   「歩くのが大変だと感じましたか？」
    *   「仕事や家事に支障が出ましたか？」
    *   「目の症状（まぶた・二重に見える）で困りましたか？」

---

## 3. データ構造と保存 (Storage Schema)

インターネット接続はアプリのロード時のみ必要。データはブラウザ内に保存。

**Database:** `IndexedDB` (名称: `MG_Assessment_DB`)

*   **Store: `sessions`** (評価セッションごとのメタデータ)
    *   `id`: Timestamp
    *   `type`: "ptosis" | "limbs" | "gait" | "posture" | "expression" | "voice" | "epro"
    *   `date`: ISO String
    *   `summary_score`: (例: EAR平均値, 歩行速度平均, 姿勢スコア, 問診票合計点)
*   **Store: `time_series_data`** (グラフ描画用)
    *   `session_id`: 参照キー
    *   `frame_data`: Array of objects `{ timestamp, earLeft, earRight, armLeftDeg, gaitSpeed, trunkFlexionDeg, blinkRatePerMin, voicePitchHz, ... }`
    *   `details`: 検査サマリーや問診票内訳などの補足オブジェクト
*   **Store: `audios`** (音声検査の録音データ)
    *   `session_id`: 参照キー
    *   `clips`: 音声タスクごとの Blob とメトリクス
*   **Store: `videos`** (録画データ)
    *   `session_id`: 参照キー
    *   `blob`: VideoBlob (WebM/MP4)
    *   *注: 容量圧迫時は古いものから削除するロジックが必要*

---

## 4. 画面遷移図 (Sitemap)

1.  **Home / Dashboard**
    *   「検査を始める」（新規測定）
    *   「記録を見る」（カレンダー・グラフ表示）
    *   「設定」（身長設定、データ削除）
    *   各検査の目的・使用ツール・見ている指標を切り替えて確認できる、LP風のガイドセクションを表示
    *   LINE などのアプリ内ブラウザや、Chrome / Safari / Microsoft Edge 以外のブラウザアプリで開かれた可能性がある場合は、トップページで標準ブラウザ利用を促すポップアップを表示する
    *   ポップアップには案内文と `現在のリンクをコピー` ボタン、閉じる導線を含める
    *   「最新の記録」セクションは、検査ガイドセクションの下に配置する
2.  **Select Assessment (Menu)**
    *   眼の検査 (Ptosis)
    *   腕の検査 (Upper Limb)
    *   歩行監視モード (Gait Monitor)
    *   問診票 (Questionnaire)
3.  **Records / 記録を見る**
    *   検査ごとのタブで履歴を切り替えて表示する
    *   各検査で、代表値を切り替えながら `日毎の変動` と `日内変動` を確認できる
    *   `日毎の変動` では、平均値に加えて最大値・最小値を線で表示し、その間を帯で着色する
    *   `日内変動` では、直近1週間の平均的な日内リズムと本日の変動を重ねて見る
    *   非モバイル幅では、変動グラフを上段、セッション一覧と詳細を下段に配置し、グラフ横に細い履歴カラムを作らない
    *   セッション一覧は選択中の検査だけを表示し、モバイルでは row タップで詳細モーダルを開く
    *   モバイルで詳細モーダルを開いている間は背景スクロールを禁止する
4.  **Measurement Views**
    *   各MediaPipe実装画面（カメラプレビュー + ガイドオーバーレイ）
    *   操作ボタンはメトリクス表示より上に配置し、狭いスマホ画面でも押しやすくする
    *   測定開始前は開始ボタンのみ表示し、測定中のみ「停止して保存」「推定表示ON/OFF」を表示する
    *   各検査ページでは、必要に応じて検査概要の音声ガイドと音量調整導線を設けてよいが、問診票ページは音声ガイド対象に含めない
    *   音声ガイドを設けるページでは、導入音声の自動再生は行わず、`音声案内を聞く` ボタンを押した時だけ再生する
    *   音声ガイドカードには、`音声案内を聞く` ボタンと音量調整 UI を同じカード内に配置してよい
    *   音声ガイド再生中は、音が出ていることが分かるコンパクトなアイコンまたはバーアニメーションを表示する
    *   結果プレビュー画面（保存するかキャンセルするか）
5.  **Doctor's Share View / 医師共有**
    *   未同期件数・未同期データ量・未同期期間・最終送信結果を確認できるサマリーを表示
    *   データ送信時のみ必要なログインUIを表示し、`ログインして送信準備をする` と `ログアウト` はトグルで片方のみ表示する
    *   利用規約チェックボックスと利用規約モーダルを設ける
    *   `クラウドへ送信する` 実行後のみ、段階的な送信進捗パネルを表示する
    *   同期対象一覧を表示し、その末尾に `同期済み動画を削除して容量を確保` ボタンと確認UIを配置する

---

## 5. UI/UX 文言ガイドライン (Wording)

論文にある「視認性が高く、直感的な指示」を目指します。

*   **全体:** フォントサイズは大きめ（18px以上推奨）。配色は目に優しいグリーンやブルーベース（論文Fig.1参照）。
*   **ダッシュボード:** 各検査の説明は、静的な一覧ではなく、選択中の検査内容が切り替わるリッチな案内セクションとして表示する。グラデーション、波打つアニメーション、ガラス風カードを使用してよい。
*   **ダッシュボードhero背景:** 背景画像は黒基調の雰囲気を維持しつつ、スマホ縦長画面でも重要な右側要素が見切れにくい位置に合わせる。完全な右端固定ではなく、右寄り中央を基準にする。
*   **測定画面の操作部:** 主要操作はカメラ映像を見ながら押せる位置に置く。開始ボタンは強い視認性を持たせ、緑系グラデーションや軽いアニメーションで誘導してよい。
*   **眼瞼下垂テスト:**
    *   *Bad:* 「上方視位を保持してください」
    *   *Good:* **「頭を動かさずに、目だけで天井を見てください。そのまま30秒キープします」**
*   **歩行監視モード:**
    *   *Bad:* 「監視待機中」
    *   *Good:* **「カメラの前に立つと、自動で録画が始まります。いつも通り歩いてください」**
*   **医師共有画面:**
    *   *Bad:* 「同期」
    *   *Good:* **「クラウドへ送信する」**
    *   *Good:* **「同期済み動画を削除して容量を確保」**
*   **フィードバック:**
    *   測定終了後、「お疲れ様でした。データは安全に保存されました」と表示し、安心感を与える。

---

## 6. 実装方針（決定事項）

以下の方針で実装を進めます。

1.  **動画データの保存容量について:**
    *   MediaPipeの解析結果（数値データ）は軽量ですが、**「動画そのもの」**をブラウザ（IndexedDB）に保存する場合、容量制限（ブラウザやディスク空き容量によるが、数百MB〜数GBで警告が出る）があります。
    *   **仕様:** 直近5回分のみ動画を保存し、それ以前は数値データとグラフのみ残す。
2.  **歩行速度の単位について:**
    *   カメラの距離が毎回変わる可能性があるため、正確な「時速km」や「秒速m」を出すには、**「身長」**をユーザーに入力してもらい、画面内の身長ピクセル数との比率で距離を推定するロジックが必要です。
    *   **仕様:** 身長入力を初回設定に組み込み、デフォルトは170cm。
3.  **医師へのデータ共有方法:**
    *   基本運用は、患者が自分のスマホ/タブレットを診察室で見せる想定でUIを組む。
    *   **追加:** 可能であればCSV出力を提供する。
4.  **測定画面の操作導線について:**
    *   スマホ利用時の押しやすさを優先し、`button-row` は `camera-metrics` より上に配置する。
    *   開始前は開始ボタンのみ表示し、測定中のみ停止・保存系のボタンを表示する。
5.  **カメラoverlayの縦横比同期について:**
    *   Android縦画面を含むモバイル環境でのずれを防ぐため、固定の `4:3` 前提ではなく、実際の `videoWidth / videoHeight` をフレーム比率として使用する。
    *   overlay canvas は video の表示サイズと内部解像度に同期させる共通処理で管理し、`object-fit: contain` を前提に重ねる。
6.  **ダッシュボードの検査説明について:**
    *   Dashboard 下部に、各検査で何を計測しているか・どの MediaPipe / 質問票を使っているか・何を見ているかを説明するガイドセクションを置く。
    *   患者・医師の双方が検査意図を短時間で理解できるよう、選択式のLP風UIで案内する。
    *   「最新の記録」はこのガイドセクションの後に続けて配置する。
7.  **ダッシュボードhero背景の見せ方について:**
    *   背景画像の `background-position` は、通常時もモバイル時も完全な中央固定・完全な右端固定にはしない。
    *   右側の被写体や要素を優先しつつ、狭い横幅でも不自然に端へ張り付かないよう「右寄り中央」を基準に調整する。
8.  **医師共有（ダミークラウド送信）画面について:**
    *   `Review` ページは記録閲覧の派生ではなく、ローカルデータをクラウド送信する想定のダミー画面として扱う。
    *   未同期データは IndexedDB 上の `sessions` / `time_series_data` / `videos` を集計して概算表示する。
    *   同期済み状態、ログイン状態、同意状態、最終送信結果はページ内 state のみで保持し、再読込では引き継がない。
    *   ログイン確認中のローディングは短めにし、送信進捗パネルは送信開始前は表示しない。
    *   `同期済み動画を削除して容量を確保` で削除する対象は、このページ滞在中に送信成功したセッションに紐づく `videos` のみとし、`sessions` と `time_series_data` は残す。
    *   未同期サマリーは「データ量 / 件数」を1枚のカードにまとめ、短く表示する。
9.  **Ptosis 再計測時の MediaPipe ループ管理について:**
    *   30秒計測完了後に `もう一度測定` を押した際、古い `requestAnimationFrame` ループや停止済み `video` を再利用しない。
    *   `stopStream()` では track 停止に加えて `video.pause()` と `video.srcObject = null` を行い、再計測ごとに run id を切り替えて古い非同期処理を無効化する。
    *   `detectForVideo` 実行前に `readyState`、`videoWidth`、`videoHeight`、stream の active 状態を確認し、未準備フレームでは推論しない。
10. **Ptosis 画面のフェーズ表示とオーバーレイについて:**
    *   眼瞼下垂テストでは、Ptosis 専用のフェーズ表示 DOM を別途重ねず、`CameraOverlay` の `topLabel` / `topMessage` にフェーズ名と状態文言を渡して上部表示を統一する。
    *   旧 `ptosis-phase-overlay` / `phase-banner` のような個別オーバーレイは廃止し、上部ガイド表示は `CameraOverlay` 側の共通 UI に寄せる。
    *   Ptosis の上部表示も他のカメラ検査と同じ黒基調の半透明ガラス風オーバーレイに揃える。
    *   `CameraOverlay` の `centerIcons` は全体方針として原則使わず、中央表示はカウントダウンや短い補助文言など、計測に直接必要な情報を優先する。
    *   中央の意味づけは `topLabel` / `topMessage` / `centerPrimary` / `centerSecondary` のテキストで完結させ、装飾的なアイコン列は増やさない。
11. **モバイル測定画面の camera-sidebar について:**
    *   `camera-sidebar` はモバイル端末でも画面下部固定にしない。通常フロー内に配置し、小さめの `margin-top` でカメラ直下へ続けて表示する。
    *   理由は、一部モバイル環境で固定レイヤーがカメラ許可導線に干渉したため。
    *   Ptosis で調整したモバイル時の `camera-sidebar` / `button-row` / `camera-metrics` のコンパクトなカードデザインは、`/#/limbs` を含む他のカメラ検査にも共通適用する。
    *   モバイル端末では、カメラ計測が始まったら `page-header` と導入音声カードを非表示にし、カメラ起動中は優先度の低いコンテンツが残らないようにする。
    *   計測終了後または停止後は、`page-header` と導入音声カードの表示を元に戻す。
    *   この省スペース挙動はコンパクト幅でのみ適用し、PC 幅では各ページの既存レイアウトルールを維持する。
12. **アプリ内ブラウザ向けの案内について:**
    *   トップページでは `navigator.userAgent` を用いて、LINE などのアプリ内ブラウザや主要ブラウザ以外のブラウザアプリを検知した場合に案内モーダルを表示する。
    *   案内文では、マイク・カメラ権限が取得できない可能性があることと、標準ブラウザまたは Chrome / Safari / Microsoft Edge の利用を推奨する。
    *   モーダルには現在の URL をコピーできる導線を設け、同一セッション内では閉じた後に再表示しない。
13. **検査ページの導入音声について:**
    *   眼・腕・歩行・姿勢・表情・音声の各検査ページでは、検査名と概要を伝える導入音声を設けてよい。
    *   導入音声はページ表示時に自動再生せず、ユーザーが `音声案内を聞く` を押した時だけ再生する。
    *   導入音声を設けるページでは、音声ガイドの音量を調整できる UI を併設してよい。
    *   導入音声の wav ファイルはルート直下に置かず、`public/audio` 配下で管理し、可能であれば ASCII 名のファイル名を使う。
    *   導入音声カードには、再生中インジケータと `もう一度聞く` 導線を含める。
    *   カメラを使う検査ページでは、モバイル計測中に導入音声カードも `page-header` と同じ条件で一時的に隠す。
    *   問診票ページは音声ガイド対象外とし、導入音声や音量調整 UI を前提にしない。
14. **Records / 記録を見る ページの構成について:**
    *   記録一覧は全件を単純に並べず、検査ごとのタブで分けて表示する。
    *   グラフは Recharts を用い、検査ごとに代表値の切り替えをできるようにする。
    *   `日毎の変動` は、日単位の平均値に加え、最大値と最小値を別線で描き、その間を半透明の帯で表現する。
    *   `日毎の変動` の集計粒度は `日 / 週 / 月` を切り替え可能にし、週は ISO 週、月はローカル月で扱う。
    *   `日内変動` は、保存済み測定値を時刻帯ごとにまとめた比較表示とし、連続監視の波形としては扱わない。
    *   `日内変動` では、本日と直近1週間平均を重ねて表示する。
    *   非モバイル幅では、変動グラフカードを上段に広く表示し、その下に `records-side` を配置する。
    *   `records-side` の内部は十分な横幅がある場合のみ 2 カラム化してよく、グラフカードの横に固定で並べない。
    *   PC では一覧選択に応じて詳細カードを同一画面内で更新し、モバイルでは詳細をモーダル表示に切り替える。
    *   モバイル詳細モーダルは閉じるアイコンボタンを使い、表示中は背景スクロールをロックする。

---

## 7. MediaPipe 参照（原文）貼り付けスペース

以下に、MediaPipeの原文リファレンスと、それに対応するTypeScriptコードおよび概要説明を貼り付ける。

### 7-A. FaceLandmarker

#### 7-A-1. 原文リファレンス
（ここに原文を貼り付け）

#### 7-A-2. TypeScriptコード

```typescript
// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;
const demosSection = document.getElementById("demos");
const imageBlendShapes = document.getElementById("image-blend-shapes");
const videoBlendShapes = document.getElementById("video-blend-shapes");

let faceLandmarker;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let enableWebcamButton: HTMLButtonElement;
let webcamRunning: Boolean = false;
const videoWidth = 480;

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });
  demosSection.classList.remove("invisible");
}
createFaceLandmarker();

/********************************************************************
// Demo 1: Grab a bunch of images from the page and detection them
// upon click.
********************************************************************/

// In this demo, we have put all our clickable images in divs with the
// CSS class 'detectionOnClick'. Lets get all the elements that have
// this class.
const imageContainers = document.getElementsByClassName("detectOnClick");

// Now let's go through all of these and add a click event listener.
for (let imageContainer of imageContainers) {
  // Add event listener to the child element whichis the img element.
  imageContainer.children[0].addEventListener("click", handleClick);
}

// When an image is clicked, let's detect it and display results!
async function handleClick(event) {
  if (!faceLandmarker) {
    console.log("Wait for faceLandmarker to load before clicking!");
    return;
  }

  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await faceLandmarker.setOptions({ runningMode });
  }
  // Remove all landmarks drawed before
  const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
  for (var i = allCanvas.length - 1; i >= 0; i--) {
    const n = allCanvas[i];
    n.parentNode.removeChild(n);
  }

  // We can call faceLandmarker.detect as many times as we like with
  // different image data each time. This returns a promise
  // which we wait to complete and then call a function to
  // print out the results of the prediction.
  const faceLandmarkerResult = faceLandmarker.detect(event.target);
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.setAttribute("class", "canvas");
  canvas.setAttribute("width", event.target.naturalWidth + "px");
  canvas.setAttribute("height", event.target.naturalHeight + "px");
  canvas.style.left = "0px";
  canvas.style.top = "0px";
  canvas.style.width = `${event.target.width}px`;
  canvas.style.height = `${event.target.height}px`;

  event.target.parentNode.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const drawingUtils = new DrawingUtils(ctx);
  for (const landmarks of faceLandmarkerResult.faceLandmarks) {
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      { color: "#C0C0C070", lineWidth: 1 }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      { color: "#30FF30" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
      { color: "#30FF30" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
      { color: "#E0E0E0" }
    );
    drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
      color: "#E0E0E0"
    });
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
      { color: "#FF3030" }
    );
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      { color: "#30FF30" }
    );
  }
  drawBlendShapes(imageBlendShapes, faceLandmarkerResult.faceBlendshapes);
}

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById(
  "output_canvas"
) as HTMLCanvasElement;

const canvasCtx = canvasElement.getContext("2d");

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById(
    "webcamButton"
  ) as HTMLButtonElement;
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!faceLandmarker) {
    console.log("Wait! faceLandmarker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICTIONS";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);
async function predictWebcam() {
  const radio = video.videoHeight / video.videoWidth;
  video.style.width = videoWidth + "px";
  video.style.height = videoWidth * radio + "px";
  canvasElement.style.width = videoWidth + "px";
  canvasElement.style.height = videoWidth * radio + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await faceLandmarker.setOptions({ runningMode: runningMode });
  }
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = faceLandmarker.detectForVideo(video, startTimeMs);
  }
  if (results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#C0C0C070", lineWidth: 1 }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        { color: "#FF3030" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
        { color: "#FF3030" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        { color: "#30FF30" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        { color: "#30FF30" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        { color: "#E0E0E0" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LIPS,
        { color: "#E0E0E0" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        { color: "#FF3030" }
      );
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        { color: "#30FF30" }
      );
    }
  }
  drawBlendShapes(videoBlendShapes, results.faceBlendshapes);

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

function drawBlendShapes(el: HTMLElement, blendShapes: any[]) {
  if (!blendShapes.length) {
    return;
  }

  console.log(blendShapes[0]);
  
  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${
          shape.displayName || shape.categoryName
        }</span>
        <span class="blend-shapes-value" style="width: calc(${
          +shape.score * 100
        }% - 120px)">${(+shape.score).toFixed(4)}</span>
      </li>
    `;
  });

  el.innerHTML = htmlMaker;
}
```

#### 7-A-3. 説明概要

```text
メイン コンテンツにスキップ
ai.google.dev では、サービスの提供および品質向上とトラフィックの分析に Cookie が使用されています。同意すると、広告の配信や、表示されるコンテンツと広告のパーソナライズにも Cookie が使用されます。 詳細

同意する
同意しない
Google AI for Developers
モデル
ソリューション

コード アシスタンス
ショーケース
Community
検索
/


日本語

T
Google AI エッジ
MediaPipe
LiteRT
モデル エクスプローラ
AI Edge Portal
API リファレンス
フィルタ

Google AI Edge Portal のご紹介: エッジ AI を大規模にベンチマークします。限定公開プレビュー中にアクセスをリクエストするには、登録してください。
ホーム
Google AI Edge
ソリューション
この情報は役に立ちましたか？

フィードバックを送信顔ランドマーク検出ガイド



Face Landmarker タスク

MediaPipe Face Landmarker タスクを使用すると、画像や動画内の顔のランドマークと表情を検出できます。このタスクを使用して、人間の顔の表情を特定したり、顔のフィルタやエフェクトを適用したり、仮想アバターを作成したりできます。このタスクでは、単一の画像または連続した画像ストリームを処理できる ML モデルを使用します。このタスクは、3 次元の顔のランドマーク、ブレンドシェイプ スコア（表情を表す係数）を出力して、詳細な顔の表面をリアルタイムで推測し、エフェクトのレンダリングに必要な変換を行うための変換行列を出力します。

試してみるarrow_forward

使ってみる
このタスクの使用を開始するには、対象プラットフォームの実装ガイドのいずれかに沿って操作します。これらのプラットフォーム固有のガイドでは、推奨モデルや、推奨構成オプションを含むコード例など、このタスクの基本的な実装について説明します。

Android - コード例 - ガイド
Python - コード例 - ガイド
ウェブ - コード例 - ガイド
タスクの詳細
このセクションでは、このタスクの機能、入力、出力、構成オプションについて説明します。

機能
入力画像処理 - 処理には、画像の回転、サイズ変更、正規化、色空間変換が含まれます。
スコアのしきい値 - 予測スコアに基づいて結果をフィルタします。
タスク入力	タスク出力
顔ランドマーカーは、次のデータ型のいずれかの入力を受け入れます。
静止画像
デコードされた動画フレーム
ライブ動画フィード
Face Landmarker は次の結果を出力します。
検出された顔ごとに、顔の表情を示すブレンドシェイプ スコアと顔のランドマークの座標を含む完全な顔メッシュ。
顔のブレンドシェイプと顔の変換行列
構成オプション
このタスクには、次の構成オプションがあります。

オプション名	説明	値の範囲	デフォルト値
running_mode	タスクの実行モードを設定します。モードは 3 つあります。

IMAGE: 単一の画像入力用のモード。

動画: 動画のデコードされたフレームのモード。

LIVE_STREAM: カメラなどの入力データのライブ ストリームのモード。このモードでは、結果を非同期で受け取るリスナーを設定するために、resultListener を呼び出す必要があります。	{IMAGE, VIDEO, LIVE_STREAM}	IMAGE
num_faces	FaceLandmarker で検出できる顔の最大数。平滑化は、num_faces が 1 に設定されている場合にのみ適用されます。	Integer > 0	1
min_face_detection_confidence	顔検出が成功とみなされるための最小信頼スコア。	Float [0.0,1.0]	0.5
min_face_presence_confidence	顔のランドマーク検出における顔の存在スコアの最小信頼度スコア。	Float [0.0,1.0]	0.5
min_tracking_confidence	顔追跡が成功とみなされるための最小信頼スコア。	Float [0.0,1.0]	0.5
output_face_blendshapes	Face Landmarker が顔のブレンドシェイプを出力するかどうか。顔のブレンドシェイプは、3D 顔モデルのレンダリングに使用されます。	Boolean	False
output_facial_transformation_matrixes	FaceLandmarker が顔の変換行列を出力するかどうか。FaceLandmarker は、この行列を使用して、標準の顔モデルから検出された顔に顔のランドマークを変換します。これにより、ユーザーは検出されたランドマークにエフェクトを適用できます。	Boolean	False
result_callback	FaceLandmarker がライブ ストリーム モードの場合に、ランドマーク検出の結果を非同期で受け取る結果リスナーを設定します。実行モードが LIVE_STREAM に設定されている場合にのみ使用できます	ResultListener	N/A
モデル
顔のランドマーク検出器は、一連のモデルを使用して顔のランドマークを予測します。1 つ目のモデルで顔を検出し、2 つ目のモデルで検出された顔のランドマークを特定し、3 つ目のモデルでそれらのランドマークを使用して顔の特徴と表情を識別します。

次のモデルは、ダウンロード可能なモデル バンドルにまとめてパッケージ化されています。

顔検出モデル: 重要な顔のランドマークをいくつか使用して、顔の有無を検出します。
顔メッシュモデル: 顔の完全なマッピングを追加します。モデルは、478 個の 3 次元顔ランドマークの推定値を出力します。
ブレンドシェイプ予測モデル: フェイス メッシュモデルから出力を受け取り、顔のさまざまな表情を表す係数である 52 個のブレンドシェイプ スコアを予測します。
顔検出モデルは BlazeFace 短距離モデルです。これは、モバイル GPU 推論用に最適化された軽量で正確な顔検出器です。詳しくは、顔検出器タスクをご覧ください。

下の図は、モデルバンドル出力からの顔のランドマークの完全なマッピングを示しています。

Face Landmarker のキーポイント

顔のランドマークの詳細については、フルサイズの画像をご覧ください。

注意: この MediaPipe Solutions プレビューは早期リリースです。詳細
モデル バンドル	入力シェイプ	データ型	モデルカード	バージョン
FaceLandmarker	FaceDetector: 192 x 192
FaceMesh-V2: 256 x 256
Blendshape: 1 x 146 x 2	float 16	FaceDetector
FaceMesh-V2
Blendshape
最新
この情報は役に立ちましたか？

フィードバックを送信
特に記載のない限り、このページのコンテンツはクリエイティブ・コモンズの表示 4.0 ライセンスにより使用許諾されます。コードサンプルは Apache 2.0 ライセンスにより使用許諾されます。詳しくは、Google Developers サイトのポリシーをご覧ください。Java は Oracle および関連会社の登録商標です。

最終更新日 2026-01-29 UTC。

利用規約
プライバシー

日本語
新しいページが読み込まれました。
```

### 7-B. PoseLandmarker

#### 7-B-1. 原文リファレンス
（ここに原文を貼り付け）

#### 7-B-2. TypeScriptコード
```typescript
// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");

let poseLandmarker: PoseLandmarker = undefined;
let runningMode = "IMAGE";
let enableWebcamButton: HTMLButtonElement;
let webcamRunning: Boolean = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Before we can use PoseLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numPoses: 2
  });
  demosSection.classList.remove("invisible");
};
createPoseLandmarker();

/********************************************************************
// Demo 1: Grab a bunch of images from the page and detection them
// upon click.
********************************************************************/

// In this demo, we have put all our clickable images in divs with the
// CSS class 'detectionOnClick'. Lets get all the elements that have
// this class.
const imageContainers = document.getElementsByClassName("detectOnClick");

// Now let's go through all of these and add a click event listener.
for (let i = 0; i < imageContainers.length; i++) {
  // Add event listener to the child element whichis the img element.
  imageContainers[i].children[0].addEventListener("click", handleClick);
}

// When an image is clicked, let's detect it and display results!
async function handleClick(event) {
  if (!poseLandmarker) {
    console.log("Wait for poseLandmarker to load before clicking!");
    return;
  }

  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await poseLandmarker.setOptions({ runningMode: "IMAGE" });
  }
  // Remove all landmarks drawed before
  const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
  for (var i = allCanvas.length - 1; i >= 0; i--) {
    const n = allCanvas[i];
    n.parentNode.removeChild(n);
  }

  // We can call poseLandmarker.detect as many times as we like with
  // different image data each time. The result is returned in a callback.
  poseLandmarker.detect(event.target, (result) => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "canvas");
    canvas.setAttribute("width", event.target.naturalWidth + "px");
    canvas.setAttribute("height", event.target.naturalHeight + "px");
    canvas.style =
      "left: 0px;" +
      "top: 0px;" +
      "width: " +
      event.target.width +
      "px;" +
      "height: " +
      event.target.height +
      "px;";

    event.target.parentNode.appendChild(canvas);
    const canvasCtx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(canvasCtx);
    for (const landmark of result.landmarks) {
      drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
      });
      drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
  });
}

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById(
  "output_canvas"
) as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Check if webcam access is supported.
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmaker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE PREDICTIONS";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE PREDICTIONS";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
async function predictWebcam() {
  canvasElement.style.height = videoHeight;
  video.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  video.style.width = videoWidth;
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await poseLandmarker.setOptions({ runningMode: "VIDEO" });
  }
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
        });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
      }
      canvasCtx.restore();
    });
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

```

#### 7-B-3. 説明概要
```text
メイン コンテンツにスキップ
ai.google.dev では、サービスの提供および品質向上とトラフィックの分析に Cookie が使用されています。同意すると、広告の配信や、表示されるコンテンツと広告のパーソナライズにも Cookie が使用されます。 詳細

同意する
同意しない
Google AI for Developers
モデル
ソリューション

コード アシスタンス
ショーケース
Community
検索
/


日本語

T
Google AI エッジ
MediaPipe
LiteRT
モデル エクスプローラ
AI Edge Portal
API リファレンス
フィルタ

Google AI Edge Portal のご紹介: エッジ AI を大規模にベンチマークします。限定公開プレビュー中にアクセスをリクエストするには、登録してください。
ホーム
Google AI Edge
ソリューション
この情報は役に立ちましたか？

フィードバックを送信姿勢ランドマーク検出ガイド



瞑想のポーズをとっている女性。ポーズがワイヤーフレームでハイライト表示され、四肢と胴体の位置が示されます。

MediaPipe Pose Landmarker タスクを使用すると、画像または動画内の人体のランドマークを検出できます。このタスクを使用すると、体の主要な位置を特定し、姿勢を分析して、動きを分類できます。このタスクでは、単一の画像または動画を処理する ML モデルを使用します。このタスクは、画像座標と 3 次元ワールド座標でボディポーズのランドマークを出力します。

試してみるarrow_forward

使ってみる
このタスクを使用するには、対象プラットフォームの実装ガイドに沿って操作します。以下のプラットフォーム固有のガイドでは、推奨モデルや、推奨構成オプションを含むコード例など、このタスクの基本的な実装について説明します。

Android - コード例 - ガイド
Python - コード例 - ガイド
ウェブ - コード例 - ガイド
タスクの詳細
このセクションでは、このタスクの機能、入力、出力、構成オプションについて説明します。

機能
入力画像の処理 - 処理には、画像の回転、サイズ変更、正規化、色空間の変換が含まれます。
スコアしきい値 - 予測スコアに基づいて結果をフィルタします。
タスク入力	タスクの出力
Pose Landmarker は、次のいずれかのデータ型の入力を受け入れます。
静止画像
デコードされた動画フレーム
ライブ動画フィード
Pose Landmarker は次の結果を出力します。
正規化された画像座標でのポーズ ランドマーク
ワールド座標のポーズ ランドマーク
省略可: ポーズのセグメンテーション マスク。
構成オプション
このタスクには、次の構成オプションがあります。

オプション名	説明	値の範囲	デフォルト値
running_mode	タスクの実行モードを設定します。モードは次の 3 つです。

IMAGE: 単一画像入力のモード。

動画: 動画のデコードされたフレームのモード。

LIVE_STREAM: カメラなどからの入力データのライブ配信モード。 このモードでは、resultListener を呼び出して、結果を非同期で受信するリスナーを設定する必要があります。	{IMAGE, VIDEO, LIVE_STREAM}	IMAGE
num_poses	Pose Landmarker で検出できるポーズの最大数。	Integer > 0	1
min_pose_detection_confidence	ポーズ検出が成功と見なされるための最小信頼度スコア。	Float [0.0,1.0]	0.5
min_pose_presence_confidence	ポーズランドマーク検出でのポーズ存在スコアの最小信頼度スコア。	Float [0.0,1.0]	0.5
min_tracking_confidence	ポーズ トラッキングが成功とみなされるための最小信頼スコア。	Float [0.0,1.0]	0.5
output_segmentation_masks	Pose Landmarker が検出されたポーズのセグメンテーション マスクを出力するかどうか。	Boolean	False
result_callback	Pose Landmarker がライブ配信モードの場合に、ランドマークの結果を非同期で受信するように結果リスナーを設定します。実行モードが LIVE_STREAM に設定されている場合にのみ使用できます。	ResultListener	N/A
モデル
ポーズ ランドマークは、一連のモデルを使用してポーズ ランドマークを予測します。最初のモデルは画像フレーム内の人間の存在を検出し、2 つ目のモデルは身体上のランドマークを特定します。

次のモデルは、ダウンロード可能なモデル バンドルにまとめられています。

ポーズ検出モデル: いくつかの重要なポーズ ランドマークを使用して、身体の存在を検出します。
ポーズ ランドマークモデル: ポーズの完全なマッピングを追加します。モデルは、33 個の 3 次元ポーズランドマークの推定値を出力します。
このバンドルは MobileNetV2 に似た畳み込みニューラル ネットワークを使用しており、オンデバイスのリアルタイム フィットネス アプリ用に最適化されています。BlazePose モデルのこのバリアントは、3D 人間形状モデリング パイプラインである GHUM を使用して、画像または動画内の個人の完全な 3D ボディポーズを推定します。

注意: この MediaPipe Solutions プレビュー版は早期リリース版です。 詳細
モデル バンドル	入力シェイプ	データ型	モデルカード	バージョン
Pose Landmarker（Lite）	ポーズ検出器: 224 x 224 x 3
ポーズ ランドマーク: 256 x 256 x 3	float 16	info	最新
Pose Landmarker（完全版）	ポーズ検出器: 224 x 224 x 3
ポーズ ランドマーク: 256 x 256 x 3	float 16	info	最新
ポーズ ランドマーク（負荷が高い）	ポーズ検出器: 224 x 224 x 3
ポーズ ランドマーク: 256 x 256 x 3	float 16	info	最新
ポーズ ランドマークモデル
ポーズ ランドマーク モデルは、次の体の部分のおおよその位置を表す 33 個の体のランドマークの位置を追跡します。



0 - nose
1 - left eye (inner)
2 - left eye
3 - left eye (outer)
4 - right eye (inner)
5 - right eye
6 - right eye (outer)
7 - left ear
8 - right ear
9 - mouth (left)
10 - mouth (right)
11 - left shoulder
12 - right shoulder
13 - left elbow
14 - right elbow
15 - left wrist
16 - right wrist
17 - left pinky
18 - right pinky
19 - left index
20 - right index
21 - left thumb
22 - right thumb
23 - left hip
24 - right hip
25 - left knee
26 - right knee
27 - left ankle
28 - right ankle
29 - left heel
30 - right heel
31 - left foot index
32 - right foot index
モデルの出力には、各ランドマークの正規化された座標（Landmarks）とワールド座標（WorldLandmarks）の両方が含まれます。

この情報は役に立ちましたか？

フィードバックを送信
特に記載のない限り、このページのコンテンツはクリエイティブ・コモンズの表示 4.0 ライセンスにより使用許諾されます。コードサンプルは Apache 2.0 ライセンスにより使用許諾されます。詳しくは、Google Developers サイトのポリシーをご覧ください。Java は Oracle および関連会社の登録商標です。

最終更新日 2025-01-13 UTC。

利用規約
プライバシー

日本語
新しいページが読み込まれました。
```

***

### 補足：参考文献との対応
*   **眼瞼下垂:** MediaPipe FaceMeshでまぶたの距離を測定するロジックを採用。
*   **ウェアラブル代替:** パッシブで筋疲労を計測していたPAMSysセンサーの機能を、 監視カメラのような形でビデオベースの解析（歩行・姿勢）で代替する設計。
*   **ePRO:** 重症筋無力症の MG-ADL/MG-QOL15rをそのままデジタル化。
