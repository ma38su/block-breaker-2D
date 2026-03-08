# 🕹 Block Breaker 2D

SF テーマの 5 ステージ制ブロック崩しゲーム。  
スマホのタップ・スワイプだけで全操作が可能です。  
PWA 対応のため、ホーム画面に追加してオフラインでも遊べます。

## プレイ方法

| 操作 | 内容 |
|------|------|
| **スワイプ / マウス移動** | パドル操作 |
| **タップ / クリック** | 開始・再開・ステージ選択 |
| **♪ ON/OFF ボタン** | BGM のオン・オフ切り替え |
| **❚❚ / ▶ ボタン** | ポーズ・再開 |
| **キーボード ←→** | パドル移動（PC） |
| **Space / Enter** | 開始・次へ（PC） |
| **P / Escape** | ポーズ・再開 / 選択画面に戻る（PC） |
| **M** | BGM ミュート切り替え（PC） |

---

## スクリーンショット

### タイトル画面 / ステージ選択

<table>
<tr>
<td align="center"><b>タイトル画面</b></td>
<td align="center"><b>ステージ選択画面</b></td>
</tr>
<tr>
<td><img src="https://github.com/user-attachments/assets/81e2eadb-ae7f-4a21-a07a-86a2b51cec99" width="240" alt="タイトル画面"></td>
<td><img src="https://github.com/user-attachments/assets/66add2a4-5181-4c83-916d-819896ee63c3" width="240" alt="ステージ選択"></td>
</tr>
</table>

### 各ステージ

<table>
<tr>
<td align="center"><b>Stage 1 — 軌道衛星</b><br><sub>多層ブロック</sub></td>
<td align="center"><b>Stage 2 — エネルギー炉</b><br><sub>爆弾・連鎖爆発</sub></td>
<td align="center"><b>Stage 3 — 時空の歪み</b><br><sub>砂時計 ＋ 移動障害物</sub></td>
</tr>
<tr>
<td><img src="https://github.com/user-attachments/assets/3345dd2b-6dab-4cf9-844a-9bdbc4d7ec3f" width="160" alt="Stage 1"></td>
<td><img src="https://github.com/user-attachments/assets/823ef34b-a654-45ee-924e-f8dd155067b9" width="160" alt="Stage 2"></td>
<td><img src="https://github.com/user-attachments/assets/054dba7f-c8f6-4257-80c7-7f5a7a0e0345" width="160" alt="Stage 3"></td>
</tr>
<tr>
<td align="center"><b>Stage 4 — 暗号化エリア</b><br><sub>透明ブロック ＋ スキャン</sub></td>
<td align="center"><b>Stage 5 — マザー・コア</b><br><sub>周回壁 ＋ 再生ブロック</sub></td>
<td></td>
</tr>
<tr>
<td><img src="https://github.com/user-attachments/assets/a021622f-9439-4d02-af2b-e316738722c4" width="160" alt="Stage 4"></td>
<td><img src="https://github.com/user-attachments/assets/9634295a-8823-42ee-8542-92b48066838e" width="160" alt="Stage 5"></td>
<td></td>
</tr>
</table>

---

## ステージ一覧

| # | テーマ | 主要ギミック | 難易度 |
|---|--------|-------------|--------|
| 1 | 軌道衛星 | 多層ブロック（HP インジケーター付き）| ★☆☆☆☆ |
| 2 | エネルギー炉 | 爆弾ブロック（BFS 連鎖爆発） | ★★☆☆☆ |
| 3 | 時空の歪み | 砂時計レイアウト ＋ 横移動する壊せない障害物 | ★★★☆☆ |
| 4 | 暗号化エリア | 透明ブロック ＋ スキャンアイテム | ★★★★☆ |
| 5 | マザー・コア | 周回する壊せない壁 ＋ 再生ブロック | ★★★★★ |

### ブロックの種類

| 種類 | 説明 |
|------|------|
| **通常ブロック** | 1 回で破壊 |
| **多層ブロック** | 複数回ヒットが必要。HP が減るにつれて色が変化 |
| **爆弾ブロック** 💣 | 破壊すると周囲に連鎖爆発 |
| **透明ブロック** | 通常は見えない。当たった瞬間だけ光る |
| **壊せないブロック** | 破壊不可。反射だけ行う |
| **再生ブロック** | 破壊後 15 秒で復活 |

---

## 技術スタック

- **React 19** + **TypeScript**
- **Vite** / **vite-plugin-pwa**（PWA・オフライン対応）
- Canvas 2D API（描画・アニメーション）
- Web Audio API（SE・BGM）

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run lint     # ESLint
npm run preview  # ビルド結果をプレビュー
```
