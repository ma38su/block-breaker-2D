import type { GameState } from '../types';
import {
  CANVAS_WIDTH,
  BALL_RADIUS,
  BALL_SPEED_LEVELS,
  INITIAL_BALL_ANGLE_DEG,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
} from '../constants';
import { createStage } from './stages';

/** ゲーム全体の初期状態を生成する（純粋関数） */
export function createInitialState(stage = 1): GameState {
  const angleRad = (INITIAL_BALL_ANGLE_DEG * Math.PI) / 180;
  const stageData = createStage(stage);
  /** 初期スピードレベルは2 */
  const initialSpeedLevel = 2;
  const initialSpeed = BALL_SPEED_LEVELS[initialSpeedLevel - 1];
  return {
    status: 'start',
    ball: {
      x: CANVAS_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      radius: BALL_RADIUS,
      vx: initialSpeed * Math.cos(angleRad),
      vy: initialSpeed * Math.sin(angleRad),
    },
    paddle: {
      x: CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2,
      y: PADDLE_Y,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    },
    blocks: stageData.blocks,
    score: 0,
    lives: 3,
    level: 1,
    currentStage: stage,
    obstacles: stageData.obstacles,
    items: stageData.items,
    scanTimer: 0,
    widePaddleTimer: 0,
    slowBallTimer: 0,
    speedUpTimer: 0,
    bigBallTimer: 0,
    laserTimer: 0,
    speedLevel: initialSpeedLevel,
    collectEffect: null,
  };
}
