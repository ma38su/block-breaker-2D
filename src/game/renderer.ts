/**
 * Canvas 2D 描画ロジックモジュール
 * ゲーム状態・エフェクト配列を受け取り、純粋に描画だけを行う
 */
import type { GameState, Particle, ScorePopup, MovingObstacle, Item } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MULTI_HP_COLORS,
  BOMB_COLOR,
  INDESTRUCTIBLE_COLOR,
  REGEN_COLOR,
  TRANSPARENT_FLASH_COLOR,
  HUD_BGM_BUTTON_X,
  HUD_PAUSE_BUTTON_X,
  TOTAL_STAGES,
} from '../constants';

/** 背景とグリッドラインを描画する */
function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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
 * 全ブロックを種類別にグロー効果付きで描画する
 * @param scanActive スキャンアイテム効果が有効か
 */
function drawBlocks(ctx: CanvasRenderingContext2D, state: GameState, scanActive: boolean): void {
  for (const block of state.blocks) {
    let drawColor = block.color;
    let alpha = 1;

    if (block.type === 'transparent') {
      if (!block.alive) continue; // 破壊済み透明ブロックは描画しない

      if (scanActive) {
        // スキャン有効中: 半透明で表示
        alpha = 0.5;
        drawColor = TRANSPARENT_FLASH_COLOR;
      } else if (block.flashTimer > 0) {
        // 衝突直後フラッシュ中: 点滅表示
        alpha = block.flashTimer % 6 < 3 ? 0.8 : 0.2;
        drawColor = TRANSPARENT_FLASH_COLOR;
      } else {
        // 通常時は不可視
        continue;
      }
    } else {
      if (!block.alive) continue;

      if (block.type === 'multi') {
        const colorIdx = Math.min(block.hp - 1, MULTI_HP_COLORS.length - 1);
        drawColor = MULTI_HP_COLORS[colorIdx];
      } else if (block.type === 'bomb') {
        drawColor = BOMB_COLOR;
      } else if (block.type === 'indestructible') {
        drawColor = INDESTRUCTIBLE_COLOR;
      } else if (block.type === 'regenerating') {
        drawColor = REGEN_COLOR;
      }
    }

    ctx.globalAlpha = alpha;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = drawColor;
    ctx.fillRect(block.x, block.y, block.width, block.height);

    // 壊せないブロックと再生ブロックは特殊アイコン
    if (block.type === 'bomb') {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('💣', block.x + block.width / 2, block.y + block.height / 2 + 5);
    } else if (block.type === 'indestructible') {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(block.x + 2, block.y + 2, block.width - 4, 3);
    } else {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(block.x, block.y, block.width, 3);

      // 多層ブロックにHP インジケーターを表示
      if (block.type === 'multi' && block.maxHp > 1) {
        const pipW = Math.max(2, (block.width - 4) / block.maxHp - 1);
        for (let i = 0; i < block.maxHp; i++) {
          ctx.fillStyle = i < block.hp ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.4)';
          ctx.fillRect(
            block.x + 2 + i * ((block.width - 4) / block.maxHp),
            block.y + block.height - 5,
            pipW,
            3,
          );
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** 移動障害物を描画する */
function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: MovingObstacle[]): void {
  for (const obs of obstacles) {
    ctx.shadowColor = INDESTRUCTIBLE_COLOR;
    ctx.shadowBlur = 10;
    ctx.fillStyle = INDESTRUCTIBLE_COLOR;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

    ctx.shadowBlur = 0;
    // 金属感のあるハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(obs.x, obs.y, obs.width, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(obs.x, obs.y + obs.height - 3, obs.width, 3);
  }
  ctx.shadowBlur = 0;
}

/** アイテムを描画する */
function drawItems(ctx: CanvasRenderingContext2D, items: Item[]): void {
  for (const item of items) {
    if (!item.alive) continue;

    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();

    // アイコン
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#003344';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('👁', item.x, item.y + 4);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** パーティクルを描画する */
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const ratio = p.life / p.maxLife;
    ctx.globalAlpha = ratio;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    const size = p.size * ratio;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** スコアポップアップを描画する */
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

/** パドルを描画する */
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

/** ボールを描画する */
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
 * HUD（スコア・ライフ・BGM・ポーズ・ステージ）を描画する
 * @param bgmEnabled BGM が ON かどうか
 * @param status     ゲームステータス（ポーズボタン表示に使用）
 */
function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  bgmEnabled: boolean,
): void {
  ctx.font = '11px "Press Start 2P", monospace';

  // スコア（左寄せ）
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 10, 25);

  // ステージ番号（左寄せ・小さく）
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`ST${state.currentStage}/${TOTAL_STAGES}`, 10, 36);

  // ライフ（右寄せ）
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${'♥'.repeat(state.lives)}`, CANVAS_WIDTH - 10, 25);

  // BGM トグルボタン（中央左）
  ctx.textAlign = 'center';
  if (bgmEnabled) {
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 0;
  }
  ctx.font = '14px monospace';
  ctx.fillText('♪', HUD_BGM_BUTTON_X, 25);
  ctx.shadowBlur = 0;

  // ポーズボタン（中央右）
  const isPlaying = state.status === 'playing';
  ctx.fillStyle = isPlaying ? 'rgba(255,255,255,0.6)' : '#ffcc00';
  ctx.shadowColor = isPlaying ? 'transparent' : '#ffcc00';
  ctx.shadowBlur = isPlaying ? 0 : 6;
  ctx.font = '12px monospace';
  ctx.fillText(isPlaying ? '❚❚' : '▶', HUD_PAUSE_BUTTON_X, 25);
  ctx.shadowBlur = 0;
}

/**
 * 半透明オーバーレイを描画する
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  color: string,
  title: string,
  lines: string[],
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.font = '22px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 70);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px "Press Start 2P", monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20 + i * 26);
  });
}

/**
 * 1フレーム分のゲーム画面全体を描画する
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  particles: Particle[],
  popups: ScorePopup[],
  bgmEnabled: boolean,
): void {
  const scanActive = state.scanTimer > 0;

  drawBackground(ctx);
  drawBlocks(ctx, state, scanActive);
  drawObstacles(ctx, state.obstacles);
  drawItems(ctx, state.items);
  drawParticles(ctx, particles);
  drawScorePopups(ctx, popups);
  drawPaddle(ctx, state);
  drawBall(ctx, state);
  drawHUD(ctx, state, bgmEnabled);

  switch (state.status) {
    case 'start':
      drawOverlay(ctx, '#ff0055', 'BLOCK BREAKER', [
        'TAP OR SPACE TO START',
        '',
        'SWIPE / MOUSE: PADDLE',
        'TAP ♪ : MUSIC',
        'TAP ❚❚ : PAUSE',
      ]);
      break;
    case 'stopped':
      drawOverlay(ctx, '#ffcc00', 'PAUSED', [
        `SCORE: ${state.score}`,
        '',
        'TAP ▶ OR PRESS P',
        'TO RESUME',
        '',
        'TAP ♪ : MUSIC',
      ]);
      break;
    case 'gameover':
      drawOverlay(ctx, '#ff0055', 'GAME OVER', [
        `SCORE: ${state.score}`,
        '',
        'TAP OR SPACE',
        'TO RETRY',
      ]);
      break;
    case 'stageCleared':
      drawOverlay(ctx, '#00ccff', `STAGE ${state.currentStage} CLEAR!`, [
        `SCORE: ${state.score}`,
        '',
        'TAP OR SPACE',
        'FOR NEXT STAGE',
      ]);
      break;
    case 'victory':
      drawOverlay(ctx, '#00ff88', 'ALL CLEAR!!', [
        `FINAL SCORE: ${state.score}`,
        '',
        'TAP OR SPACE',
        'TO PLAY AGAIN',
      ]);
      break;
    case 'paused':
      // ライフ消失直後の赤フラッシュ
      ctx.fillStyle = 'rgba(255,0,85,0.2)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      break;
    default:
      break;
  }
}
