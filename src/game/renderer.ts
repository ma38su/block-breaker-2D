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
  HUD_BTN_W,
  HUD_BTN_H,
  TOTAL_STAGES,
  STAGE_NAMES,
  STAGE_THEME_COLORS,
  STAGE_GIMMICK_LABELS,
  STAGE_DIFFICULTIES,
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

/** 全ブロックを種類別にグロー効果付きで描画する */
function drawBlocks(ctx: CanvasRenderingContext2D, state: GameState, scanActive: boolean): void {
  for (const block of state.blocks) {
    let drawColor = block.color;
    let alpha = 1;

    if (block.type === 'transparent') {
      if (!block.alive) continue;
      if (scanActive) {
        alpha = 0.5;
        drawColor = TRANSPARENT_FLASH_COLOR;
      } else if (block.flashTimer > 0) {
        alpha = block.flashTimer % 6 < 3 ? 0.8 : 0.2;
        drawColor = TRANSPARENT_FLASH_COLOR;
      } else {
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
 * ボタン矩形を描画するヘルパー（大きめのタップ領域を視覚化）
 */
function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: string,
  active = false,
  fontSize = 10,
): void {
  // 背景
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 14 : 6;
  ctx.fillStyle = active ? color : 'rgba(0,0,0,0.55)';
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  // ラベル
  ctx.shadowBlur = 0;
  ctx.fillStyle = active ? '#000' : color;
  ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

/**
 * HUD（スコア・ライフ・BGM・ポーズ・ステージ）を描画する
 * ボタンは視認できる背景付きで描画し、タップ領域を大きく確保する
 */
function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  bgmEnabled: boolean,
): void {
  // HUD 背景バー
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 48);

  // スコア（左寄せ）
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 8, 20);

  // ステージ番号（左寄せ・小さく）
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`ST${state.currentStage}/${TOTAL_STAGES}`, 8, 36);

  // ライフ（右寄せ）
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff6688';
  ctx.fillText(`${'♥'.repeat(state.lives)}`, CANVAS_WIDTH - 8, 20);

  // BGM ボタン
  const btnY = 7;
  drawButton(
    ctx,
    HUD_BGM_BUTTON_X - HUD_BTN_W / 2,
    btnY,
    HUD_BTN_W,
    HUD_BTN_H,
    bgmEnabled ? '♪ ON' : '♪ OFF',
    bgmEnabled ? '#00ff88' : 'rgba(255,255,255,0.35)',
    bgmEnabled,
    9,
  );

  // ポーズ / 再開ボタン
  const isPlaying = state.status === 'playing';
  drawButton(
    ctx,
    HUD_PAUSE_BUTTON_X - HUD_BTN_W / 2,
    btnY,
    HUD_BTN_W,
    HUD_BTN_H,
    isPlaying ? '❚❚' : '▶',
    isPlaying ? 'rgba(255,255,255,0.6)' : '#ffcc00',
    !isPlaying,
    12,
  );
}

/** 半透明の暗いオーバーレイ下地 */
function drawDimOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

/** グロー付きタイトルテキストを描画する */
function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  y: number,
  fontSize = 22,
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_WIDTH / 2, y);
  ctx.shadowBlur = 0;
}

/** 通常テキスト行を描画する */
function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  startY: number,
  lineH = 24,
  fontSize = 10,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineH);
  });
}

/**
 * スタート画面オーバーレイを描画する
 * 「▶ PLAY」ボタンと「SELECT STAGE」ボタンを表示
 */
function drawStartOverlay(ctx: CanvasRenderingContext2D): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, 'BLOCK BREAKER', '#ff0055', 220);

  drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, '▶  PLAY', '#00ccff', false, 13);
  drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SWIPE / MOUSE: PADDLE', CANVAS_WIDTH / 2, 472);
}

/**
 * ステージ選択画面オーバーレイを描画する
 */
function drawStageSelectOverlay(ctx: CanvasRenderingContext2D): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, 'SELECT STAGE', '#cc66ff', 66);

  for (let i = 0; i < TOTAL_STAGES; i++) {
    const btnY = STAGE_BTN_FIRST_Y + i * (STAGE_BTN_H + STAGE_BTN_GAP);
    const color = STAGE_THEME_COLORS[i];

    // ボタン背景
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(STAGE_BTN_X, btnY, STAGE_BTN_W, STAGE_BTN_H, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ステージ番号バッジ
    ctx.fillStyle = color;
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, STAGE_BTN_X + 16, btnY + 28);

    // ステージ名
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText(STAGE_NAMES[i], STAGE_BTN_X + 48, btnY + 25);

    // ギミックラベル
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText(STAGE_GIMMICK_LABELS[i], STAGE_BTN_X + 48, btnY + 46);

    // 難易度バー（右端）
    const stars = STAGE_DIFFICULTIES[i];
    const starX = STAGE_BTN_X + STAGE_BTN_W - 16;
    for (let s = 0; s < 5; s++) {
      ctx.fillStyle = s < stars ? color : 'rgba(255,255,255,0.15)';
      ctx.fillRect(starX - s * 10, btnY + 14, 7, 7);
    }
  }

  // 戻るボタン
  drawButton(
    ctx,
    STAGE_BACK_BTN_X,
    STAGE_BACK_BTN_Y,
    STAGE_BACK_BTN_W,
    STAGE_BACK_BTN_H,
    '← BACK',
    'rgba(255,255,255,0.5)',
    false,
    10,
  );
}

/** ゲームオーバー / クリア共通オーバーレイ */
function drawEndOverlay(
  ctx: CanvasRenderingContext2D,
  titleColor: string,
  title: string,
  scoreText: string,
  primaryLabel: string,
  primaryColor: string,
  showSelectStage: boolean,
): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, title, titleColor, 220);

  drawLines(ctx, [scoreText], 282);

  drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, primaryLabel, primaryColor, false, 10);

  if (showSelectStage) {
    drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10);
  }
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

  if (state.status === 'stageSelect') {
    drawStageSelectOverlay(ctx);
    return;
  }

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
      drawStartOverlay(ctx);
      break;
    case 'stopped':
      drawDimOverlay(ctx);
      drawTitle(ctx, 'PAUSED', '#ffcc00', 220);
      drawLines(ctx, [`SCORE: ${state.score}`], 272);
      drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, '▶  RESUME', '#ffcc00', false, 10);
      drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10);
      break;
    case 'gameover':
      drawEndOverlay(
        ctx, '#ff0055', 'GAME OVER',
        `SCORE: ${state.score}`,
        '▶  RETRY', '#00ccff',
        true,
      );
      break;
    case 'stageCleared':
      drawDimOverlay(ctx);
      drawTitle(ctx, `STAGE ${state.currentStage}`, '#00ccff', 195);
      drawTitle(ctx, 'CLEAR!', '#00ccff', 228);
      drawLines(ctx, [`SCORE: ${state.score}`], 272);
      drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, 'NEXT ▶', '#00ccff', false, 10);
      drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10);
      break;
    case 'victory':
      drawEndOverlay(
        ctx, '#00ff88', 'ALL CLEAR!!',
        `FINAL SCORE: ${state.score}`,
        'PLAY AGAIN', '#00ff88',
        true,
      );
      break;
    case 'paused':
      ctx.fillStyle = 'rgba(255,0,85,0.2)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      break;
    default:
      break;
  }
}
