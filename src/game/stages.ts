/**
 * 全5ステージのレイアウト定義モジュール
 *
 * ステージ1: 軌道衛星    - ピクセルアート型（人工衛星）+ 多層ブロック
 * ステージ2: エネルギー炉 - サーキット型 + 爆弾ブロック（連鎖爆発）
 * ステージ3: 時空の歪み   - 砂時計型 + 横移動する壊せない障害物
 * ステージ4: 暗号化エリア - 迷路型 + 透明ブロック + スキャンアイテム
 * ステージ5: マザー・コア  - 要塞型 + 周回する壊せない障害物 + 再生ブロック
 */
import type { Block, MovingObstacle } from '../types';
import {
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BLOCK_GAP,
  BLOCK_OFFSET_X,
  BLOCK_OFFSET_Y,
  ROW_COLORS,
  ROW_POINTS,
  CANVAS_WIDTH,
  BOMB_COLOR,
  REGEN_COLOR,
  MULTI_HP_COLORS,
} from '../constants';

/** ステージ1つ分のデータ */
export interface StageData {
  blocks: Block[];
  obstacles: MovingObstacle[];
  items: Item[];
}

/** グリッド座標からキャンバス上のX座標を求める */
function bx(col: number): number {
  return BLOCK_OFFSET_X + col * (BLOCK_WIDTH + BLOCK_GAP);
}

/** グリッド座標からキャンバス上のY座標を求める */
function by(row: number): number {
  return BLOCK_OFFSET_Y + row * (BLOCK_HEIGHT + BLOCK_GAP);
}

/** ブロックを生成するヘルパー */
function makeBlock(
  col: number,
  row: number,
  type: Block['type'],
  hp: number,
  color: string,
  points: number,
): Block {
  return {
    x: bx(col),
    y: by(row),
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    color,
    points,
    alive: true,
    row,
    type,
    hp,
    maxHp: hp,
    flashTimer: 0,
    regenTimer: 0,
  };
}

/** 通常ブロック（行カラー・行ポイント使用） */
function normal(col: number, row: number): Block {
  const r = row % ROW_COLORS.length;
  return makeBlock(col, row, 'normal', 1, ROW_COLORS[r], ROW_POINTS[r]);
}

/** 多層ブロック（HP に応じた色を使用） */
function multi(col: number, row: number, hp: number): Block {
  const colorIdx = Math.min(hp - 1, MULTI_HP_COLORS.length - 1);
  return makeBlock(col, row, 'multi', hp, MULTI_HP_COLORS[colorIdx], ROW_POINTS[0] * hp);
}

/** 爆弾ブロック */
function bomb(col: number, row: number): Block {
  const r = row % ROW_COLORS.length;
  return makeBlock(col, row, 'bomb', 1, BOMB_COLOR, ROW_POINTS[r] * 2);
}

/** 透明ブロック */
function transparent(col: number, row: number): Block {
  const r = row % ROW_COLORS.length;
  return makeBlock(col, row, 'transparent', 1, ROW_COLORS[r], ROW_POINTS[r]);
}

/** 再生ブロック（破壊後15秒で復活） */
function regen(col: number, row: number): Block {
  return makeBlock(col, row, 'regenerating', 1, REGEN_COLOR, ROW_POINTS[1]);
}

// ──────────────────────────────────────────────────────────────────────────
// ステージ1: 軌道衛星（Orbital Satellite）
// ピクセルアート型：衛星のシルエット配置
// 中央コアが多層ブロック（3→2→1 HP）
// ──────────────────────────────────────────────────────────────────────────
export function createStage1(): StageData {
  const blocks: Block[] = [
    // ──── ボディ上部（アンテナ） ────
    normal(3, 0), normal(4, 0),

    // ──── ソーラーパネル行1 ────
    normal(0, 1), normal(1, 1), normal(2, 1),
    multi(3, 1, 2), multi(4, 1, 2),
    normal(5, 1), normal(6, 1), normal(7, 1),

    // ──── ソーラーパネル行2（コア最硬） ────
    normal(0, 2), normal(1, 2), normal(2, 2),
    multi(3, 2, 3), multi(4, 2, 3),
    normal(5, 2), normal(6, 2), normal(7, 2),

    // ──── ソーラーパネル行3 ────
    normal(0, 3), normal(1, 3), normal(2, 3),
    multi(3, 3, 2), multi(4, 3, 2),
    normal(5, 3), normal(6, 3), normal(7, 3),

    // ──── ボディ下部 ────
    normal(2, 4), normal(3, 4), normal(4, 4), normal(5, 4),

    // ──── 推進部 ────
    normal(3, 5), normal(4, 5),
  ];

  return { blocks, obstacles: [], items: [] };
}

// ──────────────────────────────────────────────────────────────────────────
// ステージ2: エネルギー炉（Energy Furnace）
// サーキット型：回路図のように並んだブロックの交差点に爆弾配置
// 特定の爆弾を壊すと連鎖誘爆が起きる
// ──────────────────────────────────────────────────────────────────────────
export function createStage2(): StageData {
  const blocks: Block[] = [
    // ──── 外周ノード（行0） ────
    normal(0, 0), normal(2, 0), normal(5, 0), normal(7, 0),

    // ──── 横回路（行1） ────
    normal(1, 1), normal(2, 1), normal(3, 1), normal(4, 1), normal(5, 1), normal(6, 1),

    // ──── 爆弾ノード（行2） ────
    normal(0, 2), normal(1, 2),
    bomb(2, 2),
    normal(3, 2), normal(4, 2),
    bomb(5, 2),
    normal(6, 2), normal(7, 2),

    // ──── 横回路（行3） ────
    normal(1, 3), normal(2, 3), normal(3, 3), normal(4, 3), normal(5, 3), normal(6, 3),

    // ──── 外周ノード（行4） ────
    normal(0, 4), normal(2, 4), normal(3, 4), normal(4, 4), normal(5, 4), normal(7, 4),

    // ──── 中央コア爆弾（行5）：キー爆弾、ここから連鎖が始まる ────
    bomb(2, 5), bomb(3, 5), bomb(4, 5), bomb(5, 5),

    // ──── 最下部安定装置（行6） ────
    multi(1, 6, 2), multi(2, 6, 2), multi(5, 6, 2), multi(6, 6, 2),
  ];

  return { blocks, obstacles: [], items: [] };
}

// ──────────────────────────────────────────────────────────────────────────
// ステージ3: 時空の歪み（Time-Space Warp）
// 砂時計型レイアウト：中央が極端に狭くなっている
// 壊せない横移動ブロックが中央の狭い通路を行き来する
// ──────────────────────────────────────────────────────────────────────────
export function createStage3(): StageData {
  const blocks: Block[] = [
    // ──── 上部エリア（広い） ────
    normal(0, 0), normal(1, 0), normal(2, 0), normal(3, 0),
    normal(4, 0), normal(5, 0), normal(6, 0), normal(7, 0),

    normal(0, 1), normal(1, 1), normal(2, 1), normal(3, 1),
    normal(4, 1), normal(5, 1), normal(6, 1), normal(7, 1),

    // ──── 上部絞り ────
    normal(1, 2), normal(2, 2), normal(3, 2),
    normal(4, 2), normal(5, 2), normal(6, 2),

    // ──── 最狭部（行3, 4）：移動障害物が通過 ────
    //  ブロックなし（障害物が通る）

    // ──── 下部絞り ────
    normal(1, 5), normal(2, 5), normal(3, 5),
    normal(4, 5), normal(5, 5), normal(6, 5),

    // ──── 下部エリア（広い） ────
    normal(0, 6), normal(1, 6), normal(2, 6), normal(3, 6),
    normal(4, 6), normal(5, 6), normal(6, 6), normal(7, 6),

    normal(0, 7), normal(1, 7), normal(2, 7), normal(3, 7),
    normal(4, 7), normal(5, 7), normal(6, 7), normal(7, 7),
  ];

  // 砂時計の首部を左右に往復する移動障害物
  const waistY = by(3) + (BLOCK_HEIGHT + BLOCK_GAP) / 2 - BLOCK_HEIGHT / 2; // 行3と行4の間
  const obstacle: MovingObstacle = {
    x: CANVAS_WIDTH / 2 - BLOCK_WIDTH * 1.5,
    y: waistY,
    width: BLOCK_WIDTH * 3,
    height: BLOCK_HEIGHT,
    vx: 2.2,
    vy: 0,
    orbiting: false,
    pivotX: 0,
    pivotY: 0,
    orbitRadius: 0,
    angle: 0,
    angularSpeed: 0,
  };

  return { blocks, obstacles: [obstacle], items: [] };
}

// ──────────────────────────────────────────────────────────────────────────
// ステージ4: 暗号化エリア（Ghost Data）
// 迷路型：見えない壁（透明ブロック）が張り巡らされている
// ──────────────────────────────────────────────────────────────────────────
export function createStage4(): StageData {
  const blocks: Block[] = [
    // ──── 可視ブロック行（行0） ────
    normal(0, 0), normal(2, 0), normal(4, 0), normal(6, 0),

    // ──── 透明の壁（行1）：横方向の見えない壁 ────
    transparent(0, 1), transparent(1, 1),
    transparent(3, 1), transparent(4, 1),
    transparent(6, 1), transparent(7, 1),

    // ──── 可視ブロック（行2）：一部がスキャンアイテムドロップ ────
    normal(1, 2), normal(6, 2),

    // ──── 透明の迷路（行3） ────
    transparent(0, 3),
    transparent(2, 3), transparent(3, 3), transparent(4, 3), transparent(5, 3),
    transparent(7, 3),

    // ──── 可視ブロック（行4） ────
    normal(0, 4), normal(2, 4), normal(4, 4), normal(6, 4),

    // ──── 透明の壁（行5） ────
    transparent(0, 5), transparent(1, 5), transparent(2, 5),
    transparent(5, 5), transparent(6, 5), transparent(7, 5),

    // ──── 可視ブロック（行6）：最下部 ────
    normal(2, 6), normal(3, 6), normal(4, 6), normal(5, 6),
  ];

  return { blocks, obstacles: [], items: [] };
}

// ──────────────────────────────────────────────────────────────────────────
// ステージ5: マザー・コア（Mother Core）
// 要塞型：多層外壁 + 再生ブロック + 超堅いコア
// プロペラのように回転する壊せない障害物がコアを守る
// ──────────────────────────────────────────────────────────────────────────
export function createStage5(): StageData {
  const blocks: Block[] = [
    // ──── 外壁（行0） ────
    normal(0, 0), normal(1, 0), normal(2, 0), normal(3, 0),
    normal(4, 0), normal(5, 0), normal(6, 0), normal(7, 0),

    // ──── 強化外壁（行1） ────
    multi(0, 1, 2), multi(1, 1, 2), multi(2, 1, 2), multi(3, 1, 2),
    multi(4, 1, 2), multi(5, 1, 2), multi(6, 1, 2), multi(7, 1, 2),

    // ──── 強化側壁 + 再生ガード（行2） ────
    multi(0, 2, 2), multi(1, 2, 2),
    regen(2, 2), regen(3, 2), regen(4, 2), regen(5, 2),
    multi(6, 2, 2), multi(7, 2, 2),

    // ──── コア行（行3）：最も硬い ────
    multi(0, 3, 2), multi(1, 3, 2),
    regen(2, 3),
    multi(3, 3, 5), multi(4, 3, 5),
    regen(5, 3),
    multi(6, 3, 2), multi(7, 3, 2),

    // ──── 再生ガード（行4） ────
    multi(0, 4, 2), multi(1, 4, 2),
    regen(2, 4), regen(3, 4), regen(4, 4), regen(5, 4),
    multi(6, 4, 2), multi(7, 4, 2),

    // ──── 強化外壁（行5） ────
    multi(0, 5, 2), multi(1, 5, 2), multi(2, 5, 2), multi(3, 5, 2),
    multi(4, 5, 2), multi(5, 5, 2), multi(6, 5, 2), multi(7, 5, 2),

    // ──── 外壁（行6） ────
    normal(0, 6), normal(1, 6), normal(2, 6), normal(3, 6),
    normal(4, 6), normal(5, 6), normal(6, 6), normal(7, 6),
  ];

  // コア中心を計算
  const coreCenterX = CANVAS_WIDTH / 2;
  const coreCenterY = by(3) + BLOCK_HEIGHT / 2;
  const orbitRadius = 70;
  const angularSpeed = 0.025;

  // 4つの壊せない障害物がプロペラのようにコアを周回する
  const obstacles: MovingObstacle[] = [0, 1, 2, 3].map((i) => ({
    x: coreCenterX + orbitRadius * Math.cos((i * Math.PI) / 2) - BLOCK_WIDTH / 2,
    y: coreCenterY + orbitRadius * Math.sin((i * Math.PI) / 2) - BLOCK_HEIGHT / 2,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    vx: 0,
    vy: 0,
    orbiting: true,
    pivotX: coreCenterX,
    pivotY: coreCenterY,
    orbitRadius,
    angle: (i * Math.PI) / 2,
    angularSpeed,
  }));

  return { blocks, obstacles, items: [] };
}

/** ステージ番号に対応する StageData を返す */
export function createStage(stageNumber: number): StageData {
  switch (stageNumber) {
    case 1: return createStage1();
    case 2: return createStage2();
    case 3: return createStage3();
    case 4: return createStage4();
    case 5: return createStage5();
    default: return createStage1();
  }
}
