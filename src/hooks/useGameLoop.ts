/**
 * ゲームループを管理するカスタムフック
 *
 * 責務:
 *   - requestAnimationFrame によるループ管理
 *   - フレームごとの update（物理・衝突・エフェクト更新）呼び出し
 *   - フレームごとの draw（描画）呼び出し
 *   - キーボード・マウス・タッチ入力の受け取り（タップによる全操作に対応）
 *   - BGM のオン/オフ管理
 *   - ステージ進行管理
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
  HUD_BUTTON_Y_MAX,
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

    if (bgmEnabledRef.current) {
      startBGM();
    }
  }, []);

  /** 1フレーム分の物理演算・衝突判定・エフェクト更新 */
  const update = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'playing') return;

    const keys = keyStateRef.current;
    const { paddle, ball } = state;

    // キーボード入力によるパドル移動
    if (keys.ArrowLeft) {
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED);
    }
    if (keys.ArrowRight) {
      paddle.x = Math.min(CANVAS_WIDTH - paddle.width, paddle.x + PADDLE_SPEED);
    }

    // ボールを速度ベクトル分だけ移動
    ball.x += ball.vx;
    ball.y += ball.vy;

    // 壁・天井との衝突
    if (resolveWallCollision(ball) !== null) {
      playWallHit();
    }

    // パドルとの衝突
    if (resolvePaddleCollision(ball, paddle)) {
      playPaddleHit();
    }

    // 移動障害物の更新・衝突判定
    for (const obs of state.obstacles) {
      updateObstacle(obs);
      if (resolveObstacleCollision(ball, obs)) {
        playWallHit();
      }
    }

    // ボールが画面下端を越えた場合（ライフ消失）
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

    // スキャンタイマーを更新
    if (state.scanTimer > 0) {
      state.scanTimer -= 1;
    }

    // アイテム収集
    const collectedItemType = checkItemCollection(ball, state.items);
    if (collectedItemType === 'scan') {
      state.scanTimer = SCAN_DURATION_FRAMES;
      spawnParticles(particlesRef.current, ball.x, ball.y, '#00ffff');
    }

    // 再生ブロック・透明ブロックのタイマー更新（physics モジュールに委譲）
    updateSpecialBlockTimers(state.blocks);

    // ブロックとの衝突判定
    let clearableAlive = 0;
    let needRecount = false;

    for (const block of state.blocks) {
      // クリア条件カウント（indestructible と regenerating はクリア条件外）
      if (
        block.alive &&
        block.type !== 'indestructible' &&
        block.type !== 'regenerating'
      ) {
        clearableAlive++;
      }

      if (!block.alive) continue;

      const result = resolveBlockCollision(ball, block);
      if (result === null) continue;

      if (result === 'destroyed') {
        // 爆弾ブロックを特別処理: 連鎖爆発
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
          needRecount = true; // 連鎖爆発後にクリア条件を再確認
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
        // HP が減ったがまだ生存（レンダラーが hp から色を再計算するので block.color の更新は不要）
        spawnParticles(particlesRef.current, block.x + block.width / 2, block.y + block.height / 2, block.color);
        playBlockBreak(block.row);
      }
    }

    // 爆弾連鎖後: 残存クリア対象ブロックを正確に数え直す
    if (needRecount) {
      clearableAlive = state.blocks.filter(
        (b) => b.alive && b.type !== 'indestructible' && b.type !== 'regenerating',
      ).length;
    }

    // パーティクル・ポップアップを1フレーム分更新
    updateParticles(particlesRef.current);
    updateScorePopups(scorePopupsRef.current);

    // クリア判定
    if (clearableAlive === 0) {
      const nextStage = state.currentStage + 1;
      if (nextStage > TOTAL_STAGES) {
        // 全ステージクリア
        state.status = 'victory';
        stopBGM();
      } else {
        // 次のステージへ（currentStage はクリアしたステージ番号のまま保持）
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

    drawFrame(
      ctx,
      gameStateRef.current,
      particlesRef.current,
      scorePopupsRef.current,
      bgmEnabledRef.current,
    );
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
   * HUD ボタン領域へのタップを処理する
   * @returns true = ボタン操作だったので他の処理をスキップ
   */
  const handleHUDTap = useCallback((canvasX: number, canvasY: number): boolean => {
    if (canvasY > HUD_BUTTON_Y_MAX) return false;

    const state = gameStateRef.current;
    const { status } = state;

    // BGM ボタン（中央左）
    if (Math.abs(canvasX - HUD_BGM_BUTTON_X) < 28) {
      bgmEnabledRef.current = !bgmEnabledRef.current;
      if (bgmEnabledRef.current) {
        if (status === 'playing') startBGM();
      } else {
        stopBGM();
      }
      return true;
    }

    // ポーズボタン（中央右）
    if (Math.abs(canvasX - HUD_PAUSE_BUTTON_X) < 28) {
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

  /** キーダウンハンドラ */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = true;
      e.preventDefault();
      return;
    }

    if (e.key === ' ' || e.key === 'Enter') {
      const { status } = gameStateRef.current;
      if (status === 'start' || status === 'gameover' || status === 'victory') {
        startGame(1);
      } else if (status === 'stageCleared') {
        const nextStage = gameStateRef.current.currentStage + 1;
        const prev = gameStateRef.current;
        startGame(nextStage);
        // スコアとライフを引き継ぐ
        gameStateRef.current.score = prev.score;
        gameStateRef.current.lives = prev.lives;
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      const { status } = gameStateRef.current;
      if (status === 'playing') {
        gameStateRef.current.status = 'stopped';
        if (bgmEnabledRef.current) pauseBGM();
      } else if (status === 'stopped') {
        gameStateRef.current.status = 'playing';
        if (bgmEnabledRef.current) resumeBGM();
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
  }, [startGame]);

  /** キーアップハンドラ */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = false;
    }
  }, []);

  /** マウス移動: パドルを追従させる */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const mouseX = toCanvasX(e.clientX);
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2),
    );
  }, [toCanvasX]);

  /** タッチ移動: パドルを追従させる */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touchX = toCanvasX(e.touches[0].clientX);
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2),
    );
  }, [toCanvasX]);

  /** タッチ開始: HUD ボタン / ゲーム開始&再開 / パドル移動 */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvasX = toCanvasX(touch.clientX);
    const canvasY = toCanvasY(touch.clientY);

    // HUD ボタン（BGM / ポーズ）
    if (handleHUDTap(canvasX, canvasY)) return;

    const { status } = gameStateRef.current;

    if (status === 'start' || status === 'gameover' || status === 'victory') {
      startGame(1);
    } else if (status === 'stageCleared') {
      const nextStage = gameStateRef.current.currentStage + 1;
      const prev = gameStateRef.current;
      startGame(nextStage);
      gameStateRef.current.score = prev.score;
      gameStateRef.current.lives = prev.lives;
    } else if (status === 'stopped') {
      // タップで再開
      gameStateRef.current.status = 'playing';
      if (bgmEnabledRef.current) resumeBGM();
    }

    // パドル位置も更新
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, canvasX - PADDLE_WIDTH / 2),
    );
  }, [toCanvasX, toCanvasY, handleHUDTap, startGame]);

  /** クリック: スタート・ゲームオーバー・クリア画面でゲームを開始・再挑戦 */
  const handleClick = useCallback((e: MouseEvent) => {
    const canvasX = toCanvasX(e.clientX);
    const canvasY = toCanvasY(e.clientY);

    // HUD ボタン
    if (handleHUDTap(canvasX, canvasY)) return;

    const { status } = gameStateRef.current;
    if (status === 'start' || status === 'gameover' || status === 'victory') {
      startGame(1);
    } else if (status === 'stageCleared') {
      const nextStage = gameStateRef.current.currentStage + 1;
      const prev = gameStateRef.current;
      startGame(nextStage);
      gameStateRef.current.score = prev.score;
      gameStateRef.current.lives = prev.lives;
    }
  }, [toCanvasX, toCanvasY, handleHUDTap, startGame]);

  // イベントリスナーの登録・ゲームループ開始、アンマウント時クリーンアップ
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
