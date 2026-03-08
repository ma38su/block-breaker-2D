/** ゲームの状態を表す文字列リテラル型 */
export type GameStatus = 'start' | 'playing' | 'paused' | 'gameover' | 'victory';

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
