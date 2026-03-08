/**
 * Canvas 2D 描画ロジックモジュール
 * ゲーム状態・エフェクト配列を受け取り、純粋に描画だけを行う
 */
import type { GameState, Particle, ScorePopup } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

/**
 * 暗い背景とレトログリッドラインを描画する
 */
function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 薄い白線でレトロなグリッドパターンを描く
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
}

/**
 * 全ブロックをグロー効果付きで描画する
 */
function drawBlocks(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const block of state.blocks) {
    if (!block.alive) continue;

    ctx.shadowColor = block.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x, block.y, block.width, block.height);

    ctx.shadowBlur = 0;
    // ブロック上部に明るいハイライトラインを追加してレトロ感を演出
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(block.x, block.y, block.width, 3);
  }
  ctx.shadowBlur = 0;
}

/**
 * パーティクルをグロー付きで描画する
 * ライフに応じてフェードアウト・縮小しながら消える
 */
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const ratio = p.life / p.maxLife; // 1 → 0 でフェードアウト
    ctx.globalAlpha = ratio;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    const size = p.size * ratio; // ライフとともに縮小する
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/**
 * スコアポップアップをグロー付きで描画する
 */
function drawScorePopups(ctx: CanvasRenderingContext2D, popups: ScorePopup[]): void {
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  for (const popup of popups) {
    const ratio = popup.life / popup.maxLife;
    ctx.globalAlpha = ratio;
    ctx.shadowColor = popup.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/**
 * パドルをグラデーション＋グロー付きで描画する
 */
function drawPaddle(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { x, y, width, height } = state.paddle;
  ctx.shadowColor = '#00ccff';
  ctx.shadowBlur = 15;

  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, '#00eeff');
  gradient.addColorStop(1, '#0066ff');
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * ボールをラジアルグラデーション＋グロー付きで描画する
 */
function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { x, y, radius } = state.ball;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 15;

  const gradient = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#aaccff');
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * HUD（スコア・ライフ・BGM インジケーター）を画面上部に描画する
 * @param bgmEnabled BGM が ON かどうか
 */
function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, bgmEnabled: boolean): void {
  ctx.font = '12px "Press Start 2P", monospace';

  // スコア（左寄せ）
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${state.score}`, 10, 25);

  // ライフ（右寄せ）
  ctx.textAlign = 'right';
  ctx.fillText(`LIVES: ${'♥'.repeat(state.lives)}`, CANVAS_WIDTH - 10, 25);

  // BGM トグルインジケーター（中央）
  // ON: 明るい緑でグロー / OFF: 暗いグレーで控えめに表示
  ctx.textAlign = 'center';
  if (bgmEnabled) {
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.shadowBlur = 0;
  }
  ctx.fillText('♪', CANVAS_WIDTH / 2, 25);
  ctx.shadowBlur = 0;
}

/**
 * 半透明オーバーレイ（スタート・ポーズ・ゲームオーバー・クリア画面）を描画する
 * @param color タイトル文字のグロー色
 * @param title 大きく表示するタイトル
 * @param lines タイトル下の説明テキスト行
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  color: string,
  title: string,
  lines: string[],
): void {
  // 背景を薄暗くする
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // グロー付きタイトル
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

  // 操作説明などのサブテキスト
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px "Press Start 2P", monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10 + i * 24);
  });
}

/**
 * 1フレーム分のゲーム画面全体を描画するエントリーポイント
 * @param ctx        Canvas 2D コンテキスト
 * @param state      ゲーム状態
 * @param particles  パーティクルリスト
 * @param popups     スコアポップアップリスト
 * @param bgmEnabled BGM が ON かどうか（HUD インジケーター表示に使用）
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  particles: Particle[],
  popups: ScorePopup[],
  bgmEnabled: boolean,
): void {
  drawBackground(ctx);
  drawBlocks(ctx, state);
  // エフェクト系はブロックより手前、パドル・ボールより奥に重ねる
  drawParticles(ctx, particles);
  drawScorePopups(ctx, popups);
  drawPaddle(ctx, state);
  drawBall(ctx, state);
  drawHUD(ctx, state, bgmEnabled);

  // ゲーム状態に応じたオーバーレイを描画
  switch (state.status) {
    case 'start':
      drawOverlay(ctx, '#ff0055', 'BLOCK BREAKER', [
        'PRESS SPACE OR TAP',
        'TO START',
        '',
        '← → KEYS OR MOUSE',
        'TO MOVE PADDLE',
        '',
        'M: TOGGLE MUSIC',
      ]);
      break;
    case 'stopped':
      // ユーザーによるポーズ
      drawOverlay(ctx, '#ffcc00', 'PAUSED', [
        `SCORE: ${state.score}`,
        '',
        'PRESS P OR ESC',
        'TO RESUME',
        '',
        'M: TOGGLE MUSIC',
      ]);
      break;
    case 'gameover':
      drawOverlay(ctx, '#ff0055', 'GAME OVER', [
        `SCORE: ${state.score}`,
        '',
        'PRESS SPACE OR TAP',
        'TO RESTART',
      ]);
      break;
    case 'victory':
      drawOverlay(ctx, '#00ff88', 'YOU WIN!', [
        `SCORE: ${state.score}`,
        '',
        'PRESS SPACE OR TAP',
        'TO PLAY AGAIN',
      ]);
      break;
    case 'paused':
      // ライフ消失直後の短い自動停止中は画面を赤くフラッシュさせる
      ctx.fillStyle = 'rgba(255,0,85,0.2)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      break;
    default:
      // 'playing' はオーバーレイなし
      break;
  }
}
