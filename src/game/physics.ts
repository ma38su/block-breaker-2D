/**
 * 衝突判定・物理演算の純粋関数モジュール
 * ゲーム状態への副作用を持たず、呼び出し元がミューテーションを行う
 */
import type { Ball, Paddle, Block, MovingObstacle, Item } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_BASE_SPEED,
  MIN_RESET_ANGLE_DEG,
  RESET_ANGLE_RANGE_DEG,
  PADDLE_Y,
  BALL_RADIUS,
  PADDLE_WIDTH,
  BOMB_EXPLOSION_RADIUS,
  REGEN_FRAMES,
  TRANSPARENT_FLASH_FRAMES,
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
 */
export function resetBall(ball: Ball, paddleX: number, blocksDestroyed: number): void {
  const speed = calcBallSpeed(blocksDestroyed);
  const angle = (-(MIN_RESET_ANGLE_DEG + Math.random() * RESET_ANGLE_RANGE_DEG)) * (Math.PI / 180);
  ball.x = paddleX + PADDLE_WIDTH / 2;
  ball.y = PADDLE_Y - BALL_RADIUS - 2;
  ball.radius = BALL_RADIUS;
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
 * @returns 衝突があった場合 true
 */
export function resolvePaddleCollision(ball: Ball, paddle: Paddle): boolean {
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

  const hitPos = (ball.x - paddle.x) / paddle.width;
  const angleCoeff = (hitPos - 0.5) * 2;
  const speed = Math.hypot(ball.vx, ball.vy);

  ball.vx = speed * angleCoeff * 1.2;
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
 * 円と矩形の最近接点距離の2乗を返す内部ヘルパー
 */
function circleRectDistSq(
  cx: number, cy: number, radius: number,
  rx: number, ry: number, rw: number, rh: number,
): number {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy - radius * radius;
}

/**
 * ボールとブロックの衝突を解決する（破壊的更新）
 * 特殊ブロックの挙動:
 *   - indestructible: 反射するが破壊されない
 *   - multi:          HP を1減らし、0になったら破壊
 *   - transparent:    flashTimer をセットして一時表示、破壊される
 *   - bomb:           破壊後に爆発処理が必要（呼び出し元で処理）
 *   - regenerating:   破壊後 regenTimer をセット
 *
 * @returns 'destroyed'=ブロック破壊, 'hit'=当たったが破壊なし, null=衝突なし
 */
export function resolveBlockCollision(ball: Ball, block: Block): 'destroyed' | 'hit' | null {
  if (!block.alive) return null;

  if (circleRectDistSq(ball.x, ball.y, ball.radius, block.x, block.y, block.width, block.height) >= 0) {
    return null;
  }

  // 衝突面（水平 or 垂直）を重なり量で判定
  const overlapX = block.width / 2 + ball.radius - Math.abs(ball.x - (block.x + block.width / 2));
  const overlapY = block.height / 2 + ball.radius - Math.abs(ball.y - (block.y + block.height / 2));

  if (overlapX < overlapY) {
    ball.vx = -ball.vx;
  } else {
    ball.vy = -ball.vy;
  }

  // 壊せないブロック: 反射のみ
  if (block.type === 'indestructible') {
    return 'hit';
  }

  // 透明ブロック: 一時フラッシュ表示
  if (block.type === 'transparent') {
    block.flashTimer = TRANSPARENT_FLASH_FRAMES;
    block.alive = false;
    return 'destroyed';
  }

  // 多層ブロック: HP を1減らす
  if (block.type === 'multi') {
    block.hp -= 1;
    if (block.hp <= 0) {
      block.alive = false;
      return 'destroyed';
    }
    return 'hit';
  }

  // 再生ブロック: 破壊後に復活タイマーをセット
  if (block.type === 'regenerating') {
    block.alive = false;
    block.regenTimer = REGEN_FRAMES;
    return 'destroyed';
  }

  // 通常・爆弾ブロック
  block.alive = false;
  return 'destroyed';
}

/**
 * 爆弾ブロックが破壊された時に周囲のブロックを連鎖破壊する（BFS）
 * @param epicenterBlock  爆発の震源になったブロック
 * @param allBlocks       全ブロック配列（生存フラグを直接書き換える）
 * @param onDestroy       各ブロック破壊時に呼ばれるコールバック（スコア加算・エフェクト等）
 */
export function explodeBombs(
  epicenterBlock: Block,
  allBlocks: Block[],
  onDestroy: (block: Block) => void,
): void {
  const queue: Block[] = [epicenterBlock];
  const processed = new Set<Block>();
  processed.add(epicenterBlock);

  while (queue.length > 0) {
    const source = queue.shift()!;
    const cx = source.x + source.width / 2;
    const cy = source.y + source.height / 2;

    for (const target of allBlocks) {
      if (!target.alive || processed.has(target) || target.type === 'indestructible') {
        continue;
      }

      const tx = target.x + target.width / 2;
      const ty = target.y + target.height / 2;
      const dist = Math.hypot(tx - cx, ty - cy);

      if (dist <= BOMB_EXPLOSION_RADIUS) {
        processed.add(target);
        target.alive = false;
        if (target.type === 'regenerating') {
          target.regenTimer = REGEN_FRAMES;
        }
        onDestroy(target);

        // 連鎖: 爆発で壊れたブロックも爆弾なら次の震源に
        if (target.type === 'bomb') {
          queue.push(target);
        }
      }
    }
  }
}

/**
 * 移動障害物との衝突を解決する（破壊的更新）
 * @returns 衝突が発生した場合 true
 */
export function resolveObstacleCollision(ball: Ball, obstacle: MovingObstacle): boolean {
  if (
    circleRectDistSq(
      ball.x, ball.y, ball.radius,
      obstacle.x, obstacle.y, obstacle.width, obstacle.height,
    ) >= 0
  ) {
    return false;
  }

  const overlapX =
    obstacle.width / 2 + ball.radius - Math.abs(ball.x - (obstacle.x + obstacle.width / 2));
  const overlapY =
    obstacle.height / 2 + ball.radius - Math.abs(ball.y - (obstacle.y + obstacle.height / 2));

  if (overlapX < overlapY) {
    ball.vx = -ball.vx;
    // めり込みを解消
    ball.x += ball.vx > 0 ? overlapX : -overlapX;
  } else {
    ball.vy = -ball.vy;
    ball.y += ball.vy > 0 ? overlapY : -overlapY;
  }

  return true;
}

/**
 * 移動障害物の位置を1フレーム分更新する（破壊的更新）
 * 直線移動モードは壁で折り返し、円軌道モードは角度を進める
 */
export function updateObstacle(obstacle: MovingObstacle): void {
  if (obstacle.orbiting) {
    obstacle.angle += obstacle.angularSpeed;
    obstacle.x = obstacle.pivotX + obstacle.orbitRadius * Math.cos(obstacle.angle) - obstacle.width / 2;
    obstacle.y = obstacle.pivotY + obstacle.orbitRadius * Math.sin(obstacle.angle) - obstacle.height / 2;
  } else {
    obstacle.x += obstacle.vx;
    obstacle.y += obstacle.vy;
    // 左右の壁で折り返す
    if (obstacle.x <= 0) {
      obstacle.x = 0;
      obstacle.vx = Math.abs(obstacle.vx);
    } else if (obstacle.x + obstacle.width >= CANVAS_WIDTH) {
      obstacle.x = CANVAS_WIDTH - obstacle.width;
      obstacle.vx = -Math.abs(obstacle.vx);
    }
  }
}

/**
 * ボールがアイテムに触れたか判定する（破壊的更新: alive=false にする）
 * @returns 収集されたアイテムオブジェクト、なければ null
 */
export function checkItemCollection(ball: Ball, items: Item[]): Item | null {
  for (const item of items) {
    if (!item.alive) continue;
    const dx = ball.x - item.x;
    const dy = ball.y - item.y;
    if (dx * dx + dy * dy <= (ball.radius + item.radius) ** 2) {
      item.alive = false;
      return item;
    }
  }
  return null;
}

/**
 * パドルがアイテムに触れたか判定する（破壊的更新: alive=false にする）
 * 落下中のアイテム（vy > 0）のみ対象とする（静止配置アイテムはボールで取得）
 * @returns 収集されたアイテムオブジェクト、なければ null
 */
export function checkPaddleItemCollection(paddle: Paddle, items: Item[]): Item | null {
  for (const item of items) {
    if (!item.alive || item.vy <= 0) continue;
    // 円（アイテム）と矩形（パドル）の最近接点を求めて距離判定
    const closestX = Math.max(paddle.x, Math.min(item.x, paddle.x + paddle.width));
    const closestY = Math.max(paddle.y, Math.min(item.y, paddle.y + paddle.height));
    const dx = item.x - closestX;
    const dy = item.y - closestY;
    if (dx * dx + dy * dy <= item.radius * item.radius) {
      item.alive = false;
      return item;
    }
  }
  return null;
}

/**
 * 落下アイテムの位置を1フレーム分更新し、画面外に出たものを除去する（破壊的更新）
 */
export function updateFallingItems(items: Item[], canvasHeight: number): void {
  for (const item of items) {
    if (!item.alive || item.vy <= 0) continue;
    item.y += item.vy;
    if (item.y - item.radius > canvasHeight) {
      item.alive = false;
    }
  }
}

/**
 * ボールの速度を指定の速さに正規化して加速する（破壊的更新）
 */
export function accelerateBallTo(ball: Ball, targetSpeed: number): void {
  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  if (currentSpeed > 0 && targetSpeed > currentSpeed) {
    const ratio = targetSpeed / currentSpeed;
    ball.vx *= ratio;
    ball.vy *= ratio;
  }
}

/**
 * 再生ブロックと透明ブロックのタイマーを1フレーム分更新する（破壊的更新）
 * useCallback の外で呼ぶことで react-hooks/immutability ルールを回避する
 */
export function updateSpecialBlockTimers(blocks: Block[]): void {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.alive && b.type === 'regenerating' && b.regenTimer > 0) {
      b.regenTimer -= 1;
      if (b.regenTimer <= 0) {
        b.alive = true;
        b.hp = b.maxHp; // 復活時に HP をリセット
      }
    }
    if (b.type === 'transparent' && b.flashTimer > 0) {
      b.flashTimer -= 1;
    }
  }
}
