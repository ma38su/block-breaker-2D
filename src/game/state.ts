import type { GameState, Block } from '../types';
import {
  CANVAS_WIDTH,
  BALL_RADIUS,
  BALL_BASE_SPEED,
  INITIAL_BALL_ANGLE_DEG,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  COLS,
  ROWS,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  BLOCK_GAP,
  BLOCK_OFFSET_X,
  BLOCK_OFFSET_Y,
  ROW_COLORS,
  ROW_POINTS,
} from '../constants';

/** ゲーム開始時のブロックグリッドを生成する（純粋関数） */
export function createBlocks(): Block[] {
  const blocks: Block[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      blocks.push({
        x: BLOCK_OFFSET_X + c * (BLOCK_WIDTH + BLOCK_GAP),
        y: BLOCK_OFFSET_Y + r * (BLOCK_HEIGHT + BLOCK_GAP),
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        color: ROW_COLORS[r],
        points: ROW_POINTS[r],
        alive: true,
        row: r,
      });
    }
  }
  return blocks;
}

/** ゲーム全体の初期状態を生成する（純粋関数） */
export function createInitialState(): GameState {
  const angleRad = (INITIAL_BALL_ANGLE_DEG * Math.PI) / 180;
  return {
    status: 'start',
    ball: {
      x: CANVAS_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      radius: BALL_RADIUS,
      vx: BALL_BASE_SPEED * Math.cos(angleRad),
      vy: BALL_BASE_SPEED * Math.sin(angleRad),
    },
    paddle: {
      x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      y: PADDLE_Y,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    },
    blocks: createBlocks(),
    score: 0,
    lives: 3,
    level: 1,
  };
}
