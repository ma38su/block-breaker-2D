/**
 * ゲームループを管理するカスタムフック
 *
 * 責務:
 *   - requestAnimationFrame によるループ管理
 *   - フレームごとの update（物理・衝突・エフェクト更新）呼び出し
 *   - フレームごとの draw（描画）呼び出し
 *   - キーボード・マウス・タッチ入力の受け取り（タップによる全操作に対応）
 *   - BGM のオン/オフ管理
 *   - ステージ進行管理・ステージ選択
 */
import { useEffect, useRef, useCallback } from 'react';
import type { GameState, KeyState, Particle, ScorePopup } from '../types';
import {
  CANVAS_WIDTH,
  PADDLE_WIDTH,
  PADDLE_SPEED,
  TOTAL_STAGES,
  SCAN_DURATION_FRAMES,
  HUD_BGM_BUTTON_X,
  HUD_PAUSE_BUTTON_X,
  HUD_BTN_HALF_W,
  HUD_BUTTON_Y_MAX,
  BTN_PLAY_X,
  BTN_PLAY_Y,
  BTN_PLAY_W,
  BTN_PLAY_H,
  BTN_SELECT_X,
  BTN_SELECT_Y,
  BTN_SELECT_W,
  BTN_SELECT_H,
  STAGE_BTN_X,
  STAGE_BTN_W,
  STAGE_BTN_H,
  STAGE_BTN_FIRST_Y,
  STAGE_BTN_GAP,
  STAGE_BACK_BTN_X,
  STAGE_BACK_BTN_W,
  STAGE_BACK_BTN_Y,
  STAGE_BACK_BTN_H,
} from '../constants';
import { playWallHit, playPaddleHit, playBlockBreak, playLifeLost } from '../game/audio';
import {
  resetBall,
  resolveWallCollision,
  resolvePaddleCollision,
  isBallOutOfBounds,
  resolveBlockCollision,
  calcBallSpeed,
  accelerateBallTo,
  explodeBombs,
  updateObstacle,
  resolveObstacleCollision,
  checkItemCollection,
  updateSpecialBlockTimers,
} from '../game/physics';
import { spawnParticles, spawnScorePopup, updateParticles, updateScorePopups } from '../game/particles';
import { drawFrame } from '../game/renderer';
import { createInitialState } from '../game/state';
import { startBGM, stopBGM, pauseBGM, resumeBGM } from '../game/bgm';

/** ボタン矩形のヒットテスト */
function hitTest(clickX: number, clickY: number, buttonX: number, buttonY: number, buttonWidth: number, buttonHeight: number): boolean {
  return clickX >= buttonX && clickX <= buttonX + buttonWidth && clickY >= buttonY && clickY <= buttonY + buttonHeight;
}

/** パドル移動が許可されているステータスか判定する */
function canMovePaddle(status: string): boolean {
  return status === 'playing' || status === 'stopped';
}

/** ゲームループのカスタムフック */
export function useGameLoop(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const gameStateRef = useRef<GameState>(createInitialState(1));
  const keyStateRef = useRef<KeyState>({ ArrowLeft: false, ArrowRight: false });
  const animFrameRef = useRef<number>(0);
  const blocksDestroyedRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const scorePopupsRef = useRef<ScorePopup[]>([]);
  const unmountedRef = useRef<boolean>(false);
  const bgmEnabledRef = useRef<boolean>(false);

  /** ゲームを新規開始する */
  const startGame = useCallback((stage = 1) => {
    blocksDestroyedRef.current = 0;
    particlesRef.current = [];
    scorePopupsRef.current = [];
    const newState = createInitialState(stage);
    newState.status = 'playing';
    gameStateRef.current = newState;
    if (bgmEnabledRef.current) startBGM();
  }, []);

  /** ゲームを新規開始する（スコア・ライフを引き継ぐ） */
  const continueToStage = useCallback((stage: number, score: number, lives: number) => {
    blocksDestroyedRef.current = 0;
    particlesRef.current = [];
    scorePopupsRef.current = [];
    const newState = createInitialState(stage);
    newState.status = 'playing';
    newState.score = score;
    newState.lives = lives;
    gameStateRef.current = newState;
    if (bgmEnabledRef.current) startBGM();
  }, []);

  /** 1フレーム分の物理演算・衝突判定・エフェクト更新 */
  const update = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'playing') return;

    const keys = keyStateRef.current;
    const { paddle, ball } = state;

    if (keys.ArrowLeft)  paddle.x = Math.max(0, paddle.x - PADDLE_SPEED);
    if (keys.ArrowRight) paddle.x = Math.min(CANVAS_WIDTH - paddle.width, paddle.x + PADDLE_SPEED);

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (resolveWallCollision(ball) !== null) playWallHit();
    if (resolvePaddleCollision(ball, paddle))  playPaddleHit();

    for (const obs of state.obstacles) {
      updateObstacle(obs);
      if (resolveObstacleCollision(ball, obs)) playWallHit();
    }

    if (isBallOutOfBounds(ball)) {
      state.lives -= 1;
      playLifeLost();
      if (state.lives <= 0) {
        state.status = 'gameover';
        stopBGM();
      } else {
        state.status = 'paused';
        const capturedState = state;
        const capturedDestroyed = blocksDestroyedRef.current;
        setTimeout(() => {
          if (unmountedRef.current) return;
          resetBall(capturedState.ball, capturedState.paddle.x, capturedDestroyed);
          gameStateRef.current.status = 'playing';
        }, 1000);
      }
      return;
    }

    if (state.scanTimer > 0) state.scanTimer -= 1;

    const collectedItemType = checkItemCollection(ball, state.items);
    if (collectedItemType === 'scan') {
      state.scanTimer = SCAN_DURATION_FRAMES;
      spawnParticles(particlesRef.current, ball.x, ball.y, '#00ffff');
    }

    updateSpecialBlockTimers(state.blocks);

    let clearableAlive = 0;
    let needRecount = false;

    for (const block of state.blocks) {
      if (block.alive && block.type !== 'indestructible' && block.type !== 'regenerating') {
        clearableAlive++;
      }
      if (!block.alive) continue;

      const result = resolveBlockCollision(ball, block);
      if (result === null) continue;

      if (result === 'destroyed') {
        if (block.type === 'bomb') {
          explodeBombs(block, state.blocks, (destroyed) => {
            state.score += destroyed.points;
            blocksDestroyedRef.current++;
            const cx = destroyed.x + destroyed.width / 2;
            const cy = destroyed.y + destroyed.height / 2;
            spawnParticles(particlesRef.current, cx, cy, destroyed.color);
            spawnScorePopup(scorePopupsRef.current, cx, cy, destroyed.points, destroyed.color);
            playBlockBreak(destroyed.row);
          });
          needRecount = true;
        } else {
          state.score += block.points;
          blocksDestroyedRef.current++;
          const cx = block.x + block.width / 2;
          const cy = block.y + block.height / 2;
          spawnParticles(particlesRef.current, cx, cy, block.color);
          spawnScorePopup(scorePopupsRef.current, cx, cy, block.points, block.color);
          playBlockBreak(block.row);
          clearableAlive--;
        }
        accelerateBallTo(ball, calcBallSpeed(blocksDestroyedRef.current));
      } else if (result === 'hit' && block.type === 'multi') {
        spawnParticles(particlesRef.current, block.x + block.width / 2, block.y + block.height / 2, block.color);
        playBlockBreak(block.row);
      }
    }

    if (needRecount) {
      clearableAlive = state.blocks.filter(
        (b) => b.alive && b.type !== 'indestructible' && b.type !== 'regenerating',
      ).length;
    }

    updateParticles(particlesRef.current);
    updateScorePopups(scorePopupsRef.current);

    if (clearableAlive === 0) {
      const nextStage = state.currentStage + 1;
      if (nextStage > TOTAL_STAGES) {
        state.status = 'victory';
        stopBGM();
      } else {
        state.status = 'stageCleared';
        stopBGM();
      }
    }
  }, []);

  /** キャンバスに1フレーム分の描画を行う */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, gameStateRef.current, particlesRef.current, scorePopupsRef.current, bgmEnabledRef.current);
  }, [canvasRef]);

  /** キャンバス座標のX値（スケール補正済み）を返す */
  const toCanvasX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
  }, [canvasRef]);

  /** キャンバス座標のY値（スケール補正済み）を返す */
  const toCanvasY = useCallback((clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return (clientY - rect.top) * (CANVAS_WIDTH / rect.width);
  }, [canvasRef]);

  /**
   * HUD ボタン領域へのタップを処理する（再生中 / 停止中のみ有効）
   * @returns true = ボタン操作だったので他の処理をスキップ
   */
  const handleHUDTap = useCallback((canvasX: number, canvasY: number): boolean => {
    if (canvasY > HUD_BUTTON_Y_MAX) return false;

    const state = gameStateRef.current;
    const { status } = state;

    if (Math.abs(canvasX - HUD_BGM_BUTTON_X) < HUD_BTN_HALF_W) {
      bgmEnabledRef.current = !bgmEnabledRef.current;
      if (bgmEnabledRef.current) {
        if (status === 'playing') startBGM();
      } else {
        stopBGM();
      }
      return true;
    }

    if (Math.abs(canvasX - HUD_PAUSE_BUTTON_X) < HUD_BTN_HALF_W) {
      if (status === 'playing') {
        state.status = 'stopped';
        if (bgmEnabledRef.current) pauseBGM();
      } else if (status === 'stopped') {
        state.status = 'playing';
        if (bgmEnabledRef.current) resumeBGM();
      }
      return true;
    }

    return false;
  }, []);

  /**
   * スタート / ゲームオーバー / クリア系のオーバーレイ上のタップを処理する
   * @returns true = 処理したのでパドル移動をスキップ
   */
  const handleOverlayTap = useCallback((canvasX: number, canvasY: number): boolean => {
    const state = gameStateRef.current;
    const { status } = state;

    // ── スタート画面 ──────────────────────────────────────────
    if (status === 'start') {
      if (hitTest(canvasX, canvasY, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H)) {
        startGame(1);
        return true;
      }
      if (hitTest(canvasX, canvasY, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H)) {
        state.status = 'stageSelect';
        return true;
      }
      return false;
    }

    // ── ステージ選択画面 ──────────────────────────────────────
    if (status === 'stageSelect') {
      // 各ステージボタン
      for (let i = 0; i < TOTAL_STAGES; i++) {
        const btnY = STAGE_BTN_FIRST_Y + i * (STAGE_BTN_H + STAGE_BTN_GAP);
        if (hitTest(canvasX, canvasY, STAGE_BTN_X, btnY, STAGE_BTN_W, STAGE_BTN_H)) {
          startGame(i + 1);
          return true;
        }
      }
      // 戻るボタン
      if (hitTest(canvasX, canvasY, STAGE_BACK_BTN_X, STAGE_BACK_BTN_Y, STAGE_BACK_BTN_W, STAGE_BACK_BTN_H)) {
        state.status = 'start';
        return true;
      }
      return true; // Prevent paddle movement while stage select is open
    }

    // ── ポーズ画面 ────────────────────────────────────────────
    if (status === 'stopped') {
      if (hitTest(canvasX, canvasY, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H)) {
        state.status = 'playing';
        if (bgmEnabledRef.current) resumeBGM();
        return true;
      }
      if (hitTest(canvasX, canvasY, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H)) {
        state.status = 'stageSelect';
        stopBGM();
        return true;
      }
      return false;
    }

    // ── ゲームオーバー / クリア全体 / ステージクリア ──────────
    if (status === 'gameover') {
      if (hitTest(canvasX, canvasY, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H)) {
        startGame(state.currentStage);
        return true;
      }
      if (hitTest(canvasX, canvasY, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H)) {
        state.status = 'stageSelect';
        return true;
      }
      return false;
    }

    if (status === 'stageCleared') {
      if (hitTest(canvasX, canvasY, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H)) {
        const nextStage = state.currentStage + 1;
        continueToStage(nextStage, state.score, state.lives);
        return true;
      }
      if (hitTest(canvasX, canvasY, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H)) {
        state.status = 'stageSelect';
        return true;
      }
      return false;
    }

    if (status === 'victory') {
      if (hitTest(canvasX, canvasY, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H)) {
        startGame(1);
        return true;
      }
      if (hitTest(canvasX, canvasY, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H)) {
        state.status = 'stageSelect';
        return true;
      }
      return false;
    }

    return false;
  }, [startGame, continueToStage]);

  /** キーダウンハンドラ */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = true;
      e.preventDefault();
      return;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      const state = gameStateRef.current;
      const { status } = state;
      if (status === 'start' || status === 'victory') {
        startGame(1);
      } else if (status === 'gameover') {
        startGame(state.currentStage);
      } else if (status === 'stageCleared') {
        continueToStage(state.currentStage + 1, state.score, state.lives);
      } else if (status === 'stageSelect') {
        state.status = 'start';
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      const state = gameStateRef.current;
      const { status } = state;
      if (status === 'playing') {
        state.status = 'stopped';
        if (bgmEnabledRef.current) pauseBGM();
      } else if (status === 'stopped') {
        state.status = 'playing';
        if (bgmEnabledRef.current) resumeBGM();
      } else if (status === 'stageSelect') {
        state.status = 'start';
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'm' || e.key === 'M') {
      bgmEnabledRef.current = !bgmEnabledRef.current;
      const { status } = gameStateRef.current;
      if (bgmEnabledRef.current) {
        if (status === 'playing') startBGM();
      } else {
        stopBGM();
      }
      e.preventDefault();
    }
  }, [startGame, continueToStage]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!canMovePaddle(gameStateRef.current.status)) return;
    const mouseX = toCanvasX(e.clientX);
    gameStateRef.current.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2));
  }, [toCanvasX]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!canMovePaddle(gameStateRef.current.status)) return;
    const touchX = toCanvasX(e.touches[0].clientX);
    gameStateRef.current.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2));
  }, [toCanvasX]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvasX = toCanvasX(touch.clientX);
    const canvasY = toCanvasY(touch.clientY);

    // HUD ボタン（playing / stopped 中のみ）
    if (handleHUDTap(canvasX, canvasY)) return;

    // オーバーレイボタン
    if (handleOverlayTap(canvasX, canvasY)) return;

    // それ以外のタップでパドルを移動
    gameStateRef.current.paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, canvasX - PADDLE_WIDTH / 2));
  }, [toCanvasX, toCanvasY, handleHUDTap, handleOverlayTap]);

  const handleClick = useCallback((e: MouseEvent) => {
    const canvasX = toCanvasX(e.clientX);
    const canvasY = toCanvasY(e.clientY);

    if (handleHUDTap(canvasX, canvasY)) return;
    handleOverlayTap(canvasX, canvasY);
  }, [toCanvasX, toCanvasY, handleHUDTap, handleOverlayTap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    unmountedRef.current = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('click', handleClick);

    const loop = (): void => {
      update();
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      unmountedRef.current = true;
      stopBGM();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasRef, update, draw, handleKeyDown, handleKeyUp, handleMouseMove, handleTouchMove, handleTouchStart, handleClick]);
}
