/**
 * 衝突判定・物理演算の純粋関数モジュール
 * ゲーム状態への副作用を持たず、呼び出し元がミューテーションを行う
 */
import type { Ball, Paddle, Block } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_BASE_SPEED,
  MIN_RESET_ANGLE_DEG,
  RESET_ANGLE_RANGE_DEG,
  PADDLE_Y,
  BALL_RADIUS,
  PADDLE_WIDTH,
} from '../constants';

/**
 * 現在の破壊ブロック数から計算したボール速度を返す
 * 5ブロック破壊ごとに +0.3 加速する
 */
export function calcBallSpeed(blocksDestroyed: number): number {
  return BALL_BASE_SPEED + Math.floor(blocksDestroyed / 5) * 0.3;
}

/**
 * ライフ消失後のボールをパドル中央に再配置する（破壊的更新）
 * @param ball            ボール状態（直接書き換える）
 * @param paddleX         パドルのX座標
 * @param blocksDestroyed 破壊済みブロック数（速度計算用）
 */
export function resetBall(ball: Ball, paddleX: number, blocksDestroyed: number): void {
  const speed = calcBallSpeed(blocksDestroyed);
  const angle = (-(MIN_RESET_ANGLE_DEG + Math.random() * RESET_ANGLE_RANGE_DEG)) * (Math.PI / 180);
  ball.x = paddleX + PADDLE_WIDTH / 2;
  ball.y = PADDLE_Y - BALL_RADIUS - 2;
  ball.vx = speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = -Math.abs(speed * Math.sin(angle));
}

/**
 * 壁・天井との衝突を解決する（破壊的更新）
 * @returns 衝突が発生した壁の種類、なければ null
 */
export function resolveWallCollision(ball: Ball): 'left' | 'right' | 'top' | null {
  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
    return 'left';
  }
  if (ball.x + ball.radius >= CANVAS_WIDTH) {
    ball.x = CANVAS_WIDTH - ball.radius;
    ball.vx = -Math.abs(ball.vx);
    return 'right';
  }
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
    return 'top';
  }
  return null;
}

/**
 * パドルとの衝突を解決する（破壊的更新）
 * 当たった位置によって反射角を変える（端に当たるほど鋭角）
 * @returns 衝突があった場合 true
 */
export function resolvePaddleCollision(ball: Ball, paddle: Paddle): boolean {
  // 下方向に移動中かつパドルと重なっている場合のみ判定
  if (
    ball.vy <= 0 ||
    ball.y + ball.radius < paddle.y ||
    ball.y + ball.radius > paddle.y + paddle.height ||
    ball.x < paddle.x - ball.radius ||
    ball.x > paddle.x + paddle.width + ball.radius
  ) {
    return false;
  }

  ball.y = paddle.y - ball.radius;

  // パドル上の相対位置（0〜1）から -1〜1 の角度係数を算出
  const hitPos = (ball.x - paddle.x) / paddle.width;
  const angleCoeff = (hitPos - 0.5) * 2;
  const speed = Math.hypot(ball.vx, ball.vy);

  ball.vx = speed * angleCoeff * 1.2;
  // 極端な水平方向の反射を防ぐクランプ
  const maxVx = speed * 0.9;
  ball.vx = Math.max(-maxVx, Math.min(maxVx, ball.vx));
  ball.vy = -Math.sqrt(speed * speed - ball.vx * ball.vx);

  return true;
}

/**
 * ボールが画面下端を越えたか判定する
 */
export function isBallOutOfBounds(ball: Ball): boolean {
  return ball.y - ball.radius > CANVAS_HEIGHT;
}

/**
 * ボールと1つのブロックの衝突を判定・解決する（破壊的更新）
 * 円-矩形の最近接点アルゴリズムを使用
 * @returns 衝突してブロックを破壊した場合 true
 */
export function resolveBlockCollision(ball: Ball, block: Block): boolean {
  if (!block.alive) return false;

  // ブロック上の最近接点を求める
  const closestX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
  const closestY = Math.max(block.y, Math.min(ball.y, block.y + block.height));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;

  if (dx * dx + dy * dy >= ball.radius * ball.radius) return false;

  // 衝突面（水平 or 垂直）をオーバーラップ量から判定して反射
  const overlapX = block.width / 2 + ball.radius - Math.abs(ball.x - (block.x + block.width / 2));
  const overlapY = block.height / 2 + ball.radius - Math.abs(ball.y - (block.y + block.height / 2));

  if (overlapX < overlapY) {
    ball.vx = -ball.vx; // 左右方向の反射
  } else {
    ball.vy = -ball.vy; // 上下方向の反射
  }

  return true;
}

/**
 * ボールの速度を指定の速さに正規化して加速する（破壊的更新）
 * 現在速度が目標速度より遅い場合のみ加速する
 */
export function accelerateBallTo(ball: Ball, targetSpeed: number): void {
  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  if (currentSpeed > 0 && targetSpeed > currentSpeed) {
    const ratio = targetSpeed / currentSpeed;
    ball.vx *= ratio;
    ball.vy *= ratio;
  }
}
