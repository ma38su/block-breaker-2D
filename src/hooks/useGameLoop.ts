/**
 * ゲームループを管理するカスタムフック
 *
 * 責務:
 *   - requestAnimationFrame によるループ管理
 *   - フレームごとの update（物理・衝突・エフェクト更新）呼び出し
 *   - フレームごとの draw（描画）呼び出し
 *   - キーボード・マウス・タッチ入力の受け取り
 *
 * 物理演算・描画・音声・パーティクルの詳細ロジックは
 * src/game/ 以下の各モジュールに委譲している
 */
import { useEffect, useRef, useCallback } from 'react';
import type { GameState, KeyState, Particle, ScorePopup } from '../types';
import {
  CANVAS_WIDTH,
  PADDLE_WIDTH,
  PADDLE_SPEED,
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
} from '../game/physics';
import { spawnParticles, spawnScorePopup, updateParticles, updateScorePopups } from '../game/particles';
import { drawFrame } from '../game/renderer';
import { createInitialState } from '../game/state';

/** ゲームループのカスタムフック */
export function useGameLoop(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const gameStateRef = useRef<GameState>(createInitialState());
  const keyStateRef = useRef<KeyState>({ ArrowLeft: false, ArrowRight: false });
  const animFrameRef = useRef<number>(0);
  /** 破壊済みブロック数（速度計算に使用） */
  const blocksDestroyedRef = useRef<number>(0);
  /** 画面上のパーティクル一覧 */
  const particlesRef = useRef<Particle[]>([]);
  /** 画面上のスコアポップアップ一覧 */
  const scorePopupsRef = useRef<ScorePopup[]>([]);
  /**
   * アンマウント済みフラグ
   * setTimeout コールバックがアンマウント後に実行されても安全なように使用する
   */
  const unmountedRef = useRef<boolean>(false);
  /**
   * ゲームループ関数の最新版を保持する ref
   * useCallback の自己参照（循環依存）を避けるために使用する
   */
  const gameLoopRef = useRef<FrameRequestCallback>(() => {});

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

    // ボールが画面下端を越えた場合（ライフ消失）
    if (isBallOutOfBounds(ball)) {
      state.lives -= 1;
      playLifeLost();

      if (state.lives <= 0) {
        state.status = 'gameover';
      } else {
        // 短い自動停止（paused）後にボールをリセットして再開する
        // unmountedRef でアンマウント後のステート書き換えを防ぐ
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

    // ブロックとの衝突判定
    let blocksAlive = 0;
    for (const block of state.blocks) {
      if (!block.alive) {
        continue;
      }
      blocksAlive++;

      if (resolveBlockCollision(ball, block)) {
        block.alive = false;
        state.score += block.points;
        blocksDestroyedRef.current++;

        // ブロック破壊エフェクトを生成
        const cx = block.x + block.width / 2;
        const cy = block.y + block.height / 2;
        spawnParticles(particlesRef.current, cx, cy, block.color);
        spawnScorePopup(scorePopupsRef.current, cx, cy, block.points, block.color);

        // 5ブロック破壊ごとに加速
        accelerateBallTo(ball, calcBallSpeed(blocksDestroyedRef.current));

        playBlockBreak(block.row);
        blocksAlive--;
      }
    }

    // パーティクル・ポップアップを1フレーム分更新
    updateParticles(particlesRef.current);
    updateScorePopups(scorePopupsRef.current);

    if (blocksAlive === 0) {
      state.status = 'victory';
    }
  }, []);

  /** キャンバスに1フレーム分の描画を行う */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawFrame(ctx, gameStateRef.current, particlesRef.current, scorePopupsRef.current);
  }, [canvasRef]);

  /** requestAnimationFrame のコールバック（update → draw を毎フレーム繰り返す） */
  const gameLoop = useCallback(() => {
    update();
    draw();
    animFrameRef.current = requestAnimationFrame(gameLoopRef.current);
  }, [update, draw]);

  // gameLoopRef を常に最新の gameLoop 関数に同期させる
  gameLoopRef.current = gameLoop;

  /** ゲームを初期化して開始する */
  const startGame = useCallback(() => {
    blocksDestroyedRef.current = 0;
    particlesRef.current = [];
    scorePopupsRef.current = [];
    const newState = createInitialState();
    newState.status = 'playing';
    gameStateRef.current = newState;
  }, []);

  /** キーダウン: 矢印キーで移動 / スペース・Enter でゲーム開始 / P・Esc でポーズ切り替え */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = true;
      e.preventDefault();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      const { status } = gameStateRef.current;
      if (status === 'start' || status === 'gameover' || status === 'victory') {
        startGame();
      }
      e.preventDefault();
      return;
    }
    // P / Escape キーでユーザーポーズ切り替え（stopped ↔ playing）
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      const { status } = gameStateRef.current;
      if (status === 'playing') {
        gameStateRef.current.status = 'stopped';
      } else if (status === 'stopped') {
        gameStateRef.current.status = 'playing';
      }
      e.preventDefault();
    }
  }, [startGame]);

  /** キーアップ: 矢印キーの押下状態を解除 */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = false;
    }
  }, []);

  /** マウス移動: キャンバスのスケールを考慮してパドルを追従させる */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2),
    );
  }, [canvasRef]);

  /** タッチ移動: スマートフォンでのパドル操作 */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2),
    );
  }, [canvasRef]);

  /** タッチ開始: スタート・ゲームオーバー・クリア画面でゲームを開始し、パドル位置も更新 */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const { status } = gameStateRef.current;
    if (status === 'start' || status === 'gameover' || status === 'victory') {
      startGame();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2),
    );
  }, [canvasRef, startGame]);

  /** クリック: スタート・ゲームオーバー・クリア画面でゲームを開始・再挑戦 */
  const handleClick = useCallback(() => {
    const { status } = gameStateRef.current;
    if (status === 'start' || status === 'gameover' || status === 'victory') {
      startGame();
    }
  }, [startGame]);

  // イベントリスナーの登録・ゲームループの開始、アンマウント時のクリーンアップ
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

    animFrameRef.current = requestAnimationFrame(gameLoopRef.current);

    return () => {
      // アンマウントフラグを立てて setTimeout コールバックの暴走を防ぐ
      unmountedRef.current = true;

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasRef, handleKeyDown, handleKeyUp, handleMouseMove, handleTouchMove, handleTouchStart, handleClick]);
}
