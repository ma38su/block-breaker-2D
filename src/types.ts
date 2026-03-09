/**
 * ゲームの状態を表す文字列リテラル型
 * - start        : タイトル画面
 * - stageSelect  : ステージ選択画面
 * - playing      : プレイ中
 * - paused       : ライフ消失直後の自動停止
 * - stopped      : ユーザーによるポーズ
 * - gameover     : ゲームオーバー
 * - stageCleared : ステージクリア（次ステージへ移行中）
 * - victory      : 全ステージクリア
 */
export type GameStatus = 'start' | 'stageSelect' | 'playing' | 'paused' | 'stopped' | 'gameover' | 'stageCleared' | 'victory';

/**
 * ブロックの種類
 * - normal       : 通常ブロック（1回で破壊）
 * - multi        : 多層ブロック（HP分だけ当てる必要がある）
 * - bomb         : 爆弾ブロック（破壊時に周囲を連鎖爆発）
 * - transparent  : 透明ブロック（衝突時だけ一瞬見える）
 * - indestructible: 壊せないブロック（障害物、クリア条件に含まれない）
 * - regenerating : 再生ブロック（破壊後一定時間で復活）
 */
export type BlockType = 'normal' | 'multi' | 'bomb' | 'transparent' | 'indestructible' | 'regenerating';

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
  /** 所属する行（0始まり）- サウンド計算に使用 */
  row: number;
  /** ブロックの種類 */
  type: BlockType;
  /** 現在HP（multi ブロックはこれが0になるまで破壊されない） */
  hp: number;
  /** 最大HP（色の計算基準） */
  maxHp: number;
  /** 透明ブロックの一時表示タイマー（フレーム数、0以下で非表示） */
  flashTimer: number;
  /** 再生ブロックの復活カウントダウン（フレーム数、0で復活） */
  regenTimer: number;
}

/**
 * 移動障害物（ステージ3・5などに配置される壊せないオブジェクト）
 * orbiting=false の場合は直線移動、orbiting=true の場合は円軌道移動
 */
export interface MovingObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 直線移動時のX速度 */
  vx: number;
  /** 直線移動時のY速度 */
  vy: number;
  /** 円軌道移動モード */
  orbiting: boolean;
  /** 円軌道の中心X座標 */
  pivotX: number;
  /** 円軌道の中心Y座標 */
  pivotY: number;
  /** 円軌道の半径 */
  orbitRadius: number;
  /** 現在の角度（ラジアン） */
  angle: number;
  /** 角速度（ラジアン/フレーム） */
  angularSpeed: number;
}

/**
 * アイテムの種類
 * - scan       : 透明ブロックを一定時間可視化
 * - widepaddle : パドルを一定時間拡幅
 * - speeddown  : ボールを一定時間減速
 * - extralife  : ライフ+1（即時効果）
 */
export type ItemType = 'scan' | 'widepaddle' | 'speeddown' | 'extralife';

/** フィールド上のアイテム */
export interface Item {
  x: number;
  y: number;
  /** 落下速度（px/フレーム）。0 = 静止アイテム */
  vy: number;
  radius: number;
  type: ItemType;
  alive: boolean;
}

/**
 * アイテム取得時の全画面派手エフェクトの状態
 */
export interface CollectEffect {
  type: ItemType;
  /** 残りフレーム数（0で消去） */
  timer: number;
  /** 生成時のフレーム数（フェード計算用） */
  maxTimer: number;
  /** エフェクト色 */
  color: string;
  /** 取得座標 X */
  x: number;
  /** 取得座標 Y */
  y: number;
  /** 画面に表示するラベル */
  label: string;
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
  /** 現在のステージ番号（1始まり） */
  currentStage: number;
  /** フィールド上の移動障害物 */
  obstacles: MovingObstacle[];
  /** フィールド上のアイテム */
  items: Item[];
  /** スキャンエフェクトの残りフレーム数（0以下で無効） */
  scanTimer: number;
  /** ワイドパドルの残りフレーム数（0 = 無効） */
  widePaddleTimer: number;
  /** ボール減速の残りフレーム数（0 = 無効） */
  slowBallTimer: number;
  /** アイテム取得時の全画面エフェクト（null = 非表示） */
  collectEffect: CollectEffect | null;
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
