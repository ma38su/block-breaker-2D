import { useEffect, useRef, useCallback } from 'react';
import type { GameState, Block, KeyState } from '../types';

// ── キャンバスサイズ定数 ──────────────────────────────
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;

// ── パドル定数 ────────────────────────────────────────
const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const PADDLE_Y = 610;     // パドルのY座標（画面下部）
const PADDLE_SPEED = 7;   // キーボード操作時の移動速度

// ── ボール定数 ────────────────────────────────────────
const BALL_RADIUS = 8;
const BALL_BASE_SPEED = 5;          // ボールの基本速度
const INITIAL_BALL_ANGLE_DEG = -60; // 初期角度（水平基準・負で上方向）
const MIN_RESET_ANGLE_DEG = 50;     // ライフ消失後の最小打ち出し角度
const RESET_ANGLE_RANGE_DEG = 40;   // 打ち出し角度のランダム幅

// ── ブロックグリッド定数 ──────────────────────────────
const COLS = 8;            // 列数
const ROWS = 6;            // 行数
const BLOCK_WIDTH = 48;    // ブロック幅
const BLOCK_HEIGHT = 20;   // ブロック高さ
const BLOCK_GAP = 4;       // ブロック間の隙間
const BLOCK_OFFSET_X = 24; // グリッドの左端X座標
const BLOCK_OFFSET_Y = 60; // グリッドの上端Y座標

/** 行ごとのネオンカラー（上から下へ色相が変わる） */
const ROW_COLORS = [
  '#ff0055',
  '#ff6600',
  '#ffcc00',
  '#00ff88',
  '#00ccff',
  '#cc00ff',
];

/** 行ごとの得点（上の行ほど高得点） */
const ROW_POINTS = [100, 80, 60, 40, 20, 10];

/** 全ブロックを初期状態で生成する */
function createBlocks(): Block[] {
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

/** ゲーム開始時の初期状態を生成する */
function createInitialState(): GameState {
  return {
    status: 'start',
    ball: {
      x: CANVAS_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      radius: BALL_RADIUS,
      vx: BALL_BASE_SPEED * Math.cos((INITIAL_BALL_ANGLE_DEG * Math.PI) / 180),
      vy: BALL_BASE_SPEED * Math.sin((INITIAL_BALL_ANGLE_DEG * Math.PI) / 180),
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

// Web Audio API の AudioContext シングルトン
let audioCtx: AudioContext | null = null;

/** AudioContext を遅延初期化して返す */
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * 矩形波のビープ音を鳴らす
 * @param frequency 周波数（Hz）
 * @param duration  再生時間（秒）
 * @param volume    初期音量（0〜1）
 */
function playBeep(frequency: number, duration: number, volume: number = 0.3) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    // 再生終了に向けて音量を指数的にフェードアウト
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // 音声が使えない環境ではサイレントに無視する
  }
}

/**
 * スタート・ゲームオーバー・クリア画面の半透明オーバーレイを描画する
 * @param ctx    描画コンテキスト
 * @param width  キャンバス幅
 * @param height キャンバス高さ
 * @param color  タイトルのグロー色
 * @param title  大きく表示するタイトル文字列
 * @param lines  タイトル下に表示するテキスト行
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  title: string,
  lines: string[]
) {
  // 背景を薄暗くする
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, width, height);

  // グロー付きタイトルを描画
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, height / 2 - 60);

  // 操作説明などのテキスト行を描画
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px "Press Start 2P", monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, height / 2 - 10 + i * 24);
  });
}

/**
 * ゲームループ（更新・描画・入力）を管理するカスタムフック
 * requestAnimationFrame を使ってフレームごとに状態を更新する
 */
export function useGameLoop(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const gameStateRef = useRef<GameState>(createInitialState());
  const keyStateRef = useRef<KeyState>({ ArrowLeft: false, ArrowRight: false });
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  /** 破壊済みブロック数（速度計算に使用） */
  const blocksDestroyedRef = useRef<number>(0);

  /** ライフ消失後にボールをパドル中央へリセットする */
  const resetBall = useCallback((state: GameState) => {
    // 破壊数が増えるほど少しずつ速くなる
    const speed = BALL_BASE_SPEED + Math.floor(blocksDestroyedRef.current / 5) * 0.3;
    const angle = (-(MIN_RESET_ANGLE_DEG + Math.random() * RESET_ANGLE_RANGE_DEG)) * (Math.PI / 180);
    state.ball.x = state.paddle.x + state.paddle.width / 2;
    state.ball.y = PADDLE_Y - BALL_RADIUS - 2;
    state.ball.vx = speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
    state.ball.vy = -Math.abs(speed * Math.sin(angle));
  }, []);

  /** 1フレーム分の物理演算・衝突判定を行う */
  const update = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'playing') return;

    const keys = keyStateRef.current;
    const paddle = state.paddle;
    const ball = state.ball;

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

    // 左右の壁との衝突処理
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
      playBeep(220, 0.05);
    } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
      ball.x = CANVAS_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      playBeep(220, 0.05);
    }

    // 天井との衝突処理
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      playBeep(220, 0.05);
    }

    // パドルとの衝突処理（当たり位置で反射角を変える）
    if (
      ball.y + ball.radius >= paddle.y &&
      ball.y + ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x - ball.radius &&
      ball.x <= paddle.x + paddle.width + ball.radius &&
      ball.vy > 0
    ) {
      ball.y = paddle.y - ball.radius;
      // パドル中央=まっすぐ上、端=鋭い角度
      const hitPos = (ball.x - paddle.x) / paddle.width; // 0〜1
      const angle = (hitPos - 0.5) * 2; // -1〜1
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      ball.vx = speed * angle * 1.2;
      const maxAngle = speed * 0.9;
      ball.vx = Math.max(-maxAngle, Math.min(maxAngle, ball.vx));
      ball.vy = -Math.sqrt(speed * speed - ball.vx * ball.vx);
      playBeep(440, 0.05, 0.4);
    }

    // ボールが画面下へ落下した場合の処理
    if (ball.y - ball.radius > CANVAS_HEIGHT) {
      state.lives -= 1;
      playBeep(110, 0.3, 0.5);
      if (state.lives <= 0) {
        // ライフが0になったらゲームオーバー
        state.status = 'gameover';
      } else {
        // 1秒後にボールをリセットして再開
        state.status = 'paused';
        setTimeout(() => {
          resetBall(state);
          gameStateRef.current.status = 'playing';
        }, 1000);
      }
      return;
    }

    // ブロックとの衝突判定（円-矩形の最近接点アルゴリズム）
    let blocksAlive = 0;
    for (const block of state.blocks) {
      if (!block.alive) continue;
      blocksAlive++;

      // ブロック上の最近接点を求める
      const closestX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
      const closestY = Math.max(block.y, Math.min(ball.y, block.y + block.height));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ball.radius) {
        // ブロックを破壊してスコアを加算
        block.alive = false;
        state.score += block.points;
        blocksDestroyedRef.current++;

        // 5ブロック破壊ごとにボールを少しずつ加速
        const speed = BALL_BASE_SPEED + Math.floor(blocksDestroyedRef.current / 5) * 0.3;
        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (currentSpeed > 0 && speed > currentSpeed) {
          ball.vx = (ball.vx / currentSpeed) * speed;
          ball.vy = (ball.vy / currentSpeed) * speed;
        }

        // 衝突面（水平 or 垂直）をオーバーラップ量から判定して反射
        const overlapX = block.width / 2 + ball.radius - Math.abs(ball.x - (block.x + block.width / 2));
        const overlapY = block.height / 2 + ball.radius - Math.abs(ball.y - (block.y + block.height / 2));

        if (overlapX < overlapY) {
          ball.vx = -ball.vx; // 左右方向の反射
        } else {
          ball.vy = -ball.vy; // 上下方向の反射
        }

        // 行によって音の高さを変える（上段=高音）
        playBeep(660 - block.row * 60, 0.06, 0.35);
        blocksAlive--;
      }
    }

    // 全ブロックを破壊したらクリア
    if (blocksAlive === 0) {
      state.status = 'victory';
    }
  }, [resetBall]);

  /** キャンバスに1フレーム分の描画を行う */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = gameStateRef.current;

    // 暗い背景を塗りつぶす
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // レトロな雰囲気を出すためのグリッドライン（薄い白線）
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // ブロックをグロー効果付きで描画
    for (const block of state.blocks) {
      if (!block.alive) continue;
      ctx.shadowColor = block.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      ctx.shadowBlur = 0;
      // ブロック上部にハイライトラインを追加
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(block.x, block.y, block.width, 3);
    }

    ctx.shadowBlur = 0;

    // パドルをグラデーション＋グロー付きで描画
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 15;
    const paddleGradient = ctx.createLinearGradient(
      state.paddle.x, state.paddle.y,
      state.paddle.x, state.paddle.y + state.paddle.height
    );
    paddleGradient.addColorStop(0, '#00eeff');
    paddleGradient.addColorStop(1, '#0066ff');
    ctx.fillStyle = paddleGradient;
    ctx.beginPath();
    ctx.roundRect(state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ボールをラジアルグラデーション＋グロー付きで描画
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    const ballGradient = ctx.createRadialGradient(
      state.ball.x - 2, state.ball.y - 2, 1,
      state.ball.x, state.ball.y, state.ball.radius
    );
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(1, '#aaccff');
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD（スコアとライフ）を画面上部に表示
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${state.score}`, 10, 25);
    ctx.textAlign = 'right';
    ctx.fillText(`LIVES: ${'♥'.repeat(state.lives)}`, CANVAS_WIDTH - 10, 25);

    // ゲーム状態に応じたオーバーレイを描画
    if (state.status === 'start') {
      drawOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, '#ff0055', 'BLOCK BREAKER', [
        'PRESS SPACE OR TAP',
        'TO START',
        '',
        '← → KEYS OR MOUSE',
        'TO MOVE PADDLE',
      ]);
    } else if (state.status === 'gameover') {
      drawOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, '#ff0055', 'GAME OVER', [
        `SCORE: ${state.score}`,
        '',
        'PRESS SPACE OR TAP',
        'TO RESTART',
      ]);
    } else if (state.status === 'victory') {
      drawOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, '#00ff88', 'YOU WIN!', [
        `SCORE: ${state.score}`,
        '',
        'PRESS SPACE OR TAP',
        'TO PLAY AGAIN',
      ]);
    } else if (state.status === 'paused') {
      // ライフ消失直後の短い停止中は画面を赤く点滅させる
      ctx.fillStyle = 'rgba(255,0,85,0.2)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [canvasRef]);

  /** requestAnimationFrame のコールバック（更新→描画を毎フレーム繰り返す） */
  const gameLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    lastTimeRef.current = timestamp;

    update();
    draw();

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  /** ゲームを初期化して開始する */
  const startGame = useCallback(() => {
    blocksDestroyedRef.current = 0;
    const newState = createInitialState();
    newState.status = 'playing';
    gameStateRef.current = newState;
  }, []);

  /** キーダウンイベント: 矢印キーで移動、スペース/Enterでゲーム開始・再挑戦 */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = true;
      e.preventDefault();
    }
    if (e.key === ' ' || e.key === 'Enter') {
      const status = gameStateRef.current.status;
      if (status === 'start' || status === 'gameover' || status === 'victory') {
        startGame();
      }
      e.preventDefault();
    }
  }, [startGame]);

  /** キーアップイベント: 矢印キーの押下状態を解除 */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keyStateRef.current[e.key as keyof KeyState] = false;
    }
  }, []);

  /** マウス移動イベント: キャンバスのスケールを考慮してパドルを追従させる */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, mouseX - PADDLE_WIDTH / 2)
    );
  }, [canvasRef]);

  /** タッチ移動イベント: スマートフォンでのパドル操作 */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const touchX = (e.touches[0].clientX - rect.left) * scaleX;
    gameStateRef.current.paddle.x = Math.max(
      0,
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2)
    );
  }, [canvasRef]);

  /** タッチ開始イベント: スタート画面でゲームを開始し、パドル位置も更新 */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const status = gameStateRef.current.status;
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
      Math.min(CANVAS_WIDTH - PADDLE_WIDTH, touchX - PADDLE_WIDTH / 2)
    );
  }, [canvasRef, startGame]);

  /** クリックイベント: スタート・ゲームオーバー・クリア画面でゲームを開始・再挑戦 */
  const handleClick = useCallback(() => {
    const status = gameStateRef.current.status;
    if (status === 'start' || status === 'gameover' || status === 'victory') {
      startGame();
    }
  }, [startGame]);

  // イベントリスナーの登録とゲームループの開始
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('click', handleClick);

    animFrameRef.current = requestAnimationFrame(gameLoop);

    // クリーンアップ: アンマウント時にリスナーとループを解除
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasRef, gameLoop, handleKeyDown, handleKeyUp, handleMouseMove, handleTouchMove, handleTouchStart, handleClick]);
}
