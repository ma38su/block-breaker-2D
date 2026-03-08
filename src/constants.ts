// ── キャンバスサイズ ──────────────────────────────────
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ── パドル ────────────────────────────────────────────
export const PADDLE_WIDTH = 80;
export const PADDLE_HEIGHT = 12;
/** パドルのY座標（画面下部固定） */
export const PADDLE_Y = 610;
/** キーボード操作時の1フレームあたり移動速度（ピクセル） */
export const PADDLE_SPEED = 7;

// ── ボール ────────────────────────────────────────────
export const BALL_RADIUS = 8;
/** ボールの初期速度（ピクセル/フレーム） */
export const BALL_BASE_SPEED = 5;
/** ゲーム開始時の打ち出し角度（水平基準・度数法、負で上方向） */
export const INITIAL_BALL_ANGLE_DEG = -60;
/** ライフ消失後リセット時の最小打ち出し角度（度） */
export const MIN_RESET_ANGLE_DEG = 50;
/** リセット時の打ち出し角度ランダム幅（度） */
export const RESET_ANGLE_RANGE_DEG = 40;

// ── ブロックグリッド ──────────────────────────────────
export const COLS = 8;
export const ROWS = 6;
export const BLOCK_WIDTH = 48;
export const BLOCK_HEIGHT = 20;
/** ブロック間の隙間（ピクセル） */
export const BLOCK_GAP = 4;
/** グリッド左端のX座標オフセット */
export const BLOCK_OFFSET_X = 24;
/** グリッド上端のY座標オフセット */
export const BLOCK_OFFSET_Y = 60;

/** 行ごとのネオンカラー（上から下へ色相が変わる） */
export const ROW_COLORS: readonly string[] = [
  '#ff0055',
  '#ff6600',
  '#ffcc00',
  '#00ff88',
  '#00ccff',
  '#cc00ff',
] as const;

/** 行ごとの得点（上の行ほど高得点） */
export const ROW_POINTS: readonly number[] = [100, 80, 60, 40, 20, 10] as const;

// ── パーティクル ──────────────────────────────────────
/** ブロック1つ破壊時に生成するパーティクル数 */
export const PARTICLES_PER_BLOCK = 18;
/** パーティクルの最大ライフ（フレーム数） */
export const PARTICLE_MAX_LIFE = 40;
/** スコアポップアップの表示時間（フレーム数） */
export const SCORE_POPUP_LIFE = 45;
