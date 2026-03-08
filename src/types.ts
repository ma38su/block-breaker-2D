/**
 * ゲームの状態を表す文字列リテラル型
 * - start    : タイトル画面
 * - playing  : プレイ中
 * - paused   : ライフ消失直後の自動停止
 * - stopped  : ユーザーによるポーズ
 * - gameover : ゲームオーバー
 * - victory  : クリア
 */
export type GameStatus = 'start' | 'playing' | 'paused' | 'stopped' | 'gameover' | 'victory';

/** ボールの座標・半径・速度を管理する型 */
export interface Ball {
  x: number;
  y: number;
  radius: number;
  /** X方向の速度 */
  vx: number;
  /** Y方向の速度 */
  vy: number;
}

/** パドルの座標・サイズを管理する型 */
export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ブロック1つ分のデータを管理する型 */
export interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 描画色（行ごとに異なるネオンカラー） */
  color: string;
  /** 破壊時に加算されるスコア */
  points: number;
  /** 生存フラグ（falseのとき描画・衝突判定をスキップ） */
  alive: boolean;
  /** 所属する行（0始まり） */
  row: number;
}

/** フレームごとに参照するゲーム全体の状態 */
export interface GameState {
  status: GameStatus;
  ball: Ball;
  paddle: Paddle;
  blocks: Block[];
  score: number;
  lives: number;
  level: number;
}

/** キーボード入力の押下状態を追跡する型 */
export interface KeyState {
  ArrowLeft: boolean;
  ArrowRight: boolean;
}

/**
 * ブロック破壊時に生成するパーティクル1粒の状態
 * Canvas上で毎フレーム移動・縮小しながらフェードアウトする
 */
export interface Particle {
  x: number;
  y: number;
  /** X方向の速度（ピクセル/フレーム） */
  vx: number;
  /** Y方向の速度（ピクセル/フレーム） */
  vy: number;
  /** 残りライフ（フレーム数、0になったら除去） */
  life: number;
  /** 生成時の最大ライフ（透明度計算の基準） */
  maxLife: number;
  /** 描画色（ブロックと同じネオンカラー） */
  color: string;
  /** パーティクルの初期サイズ（ピクセル） */
  size: number;
}

/**
 * スコア加算時に画面上に浮かび上がる得点ポップアップ
 */
export interface ScorePopup {
  x: number;
  y: number;
  /** 表示するスコア文字列（例: "+100"） */
  text: string;
  /** 残りライフ（フレーム数） */
  life: number;
  /** 生成時の最大ライフ */
  maxLife: number;
  /** 描画色 */
  color: string;
}
