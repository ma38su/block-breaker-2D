/**
 * Canvas 2D 描画ロジックモジュール
 * ゲーム状態・エフェクト配列を受け取り、純粋に描画だけを行う
 */
import type { GameState, Particle, ScorePopup, MovingObstacle, Item, CollectEffect } from '../types';
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
  ITEM_COLORS,
  ITEM_ICONS,
  PADDLE_WIDTH,
} from '../constants';

type MousePos = { x: number; y: number } | null;

/** マウスがボタン矩形上にあるか判定するヘルパー */
function isHovered(mousePos: MousePos, x: number, y: number, w: number, h: number): boolean {
  if (!mousePos) return false;
  return mousePos.x >= x && mousePos.x <= x + w && mousePos.y >= y && mousePos.y <= y + h;
}

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

/** アイテムを種類別に描画する（落下アイテムも静止アイテムも同じ関数で描く） */
function drawItems(ctx: CanvasRenderingContext2D, items: Item[]): void {
  for (const item of items) {
    if (!item.alive) continue;
    const color = ITEM_COLORS[item.type] ?? '#00ffff';
    const icon = ITEM_ICONS[item.type] ?? '?';
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 200);

    // 外周グロー
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 内側を暗く
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // アイコン
    ctx.fillStyle = color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, item.x, item.y);
    ctx.textBaseline = 'alphabetic';

    // 落下アイテムは下向き三角の矢印で視認性アップ
    if (item.vy > 0) {
      ctx.globalAlpha = 0.6 * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y + item.radius + 6);
      ctx.lineTo(item.x - 5, item.y + item.radius + 1);
      ctx.lineTo(item.x + 5, item.y + item.radius + 1);
      ctx.closePath();
      ctx.fill();
    }
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

/** パドルを描画する（ワイドパドル時はグロー色変化） */
function drawPaddle(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { x, y, width, height } = state.paddle;
  const isWide = width > PADDLE_WIDTH;
  const paddleColor0 = isWide ? '#00ffcc' : '#00eeff';
  const paddleColor1 = isWide ? '#0044ff' : '#0066ff';
  const glowColor   = isWide ? '#00ffcc' : '#00ccff';

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isWide ? 25 : 15;
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, paddleColor0);
  gradient.addColorStop(1, paddleColor1);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 4);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ワイドパドル時は上部に発光ライン
  if (isWide) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#aaffff';
    ctx.fillRect(x + 4, y + 1, width - 8, 2);
    ctx.globalAlpha = 1;
  }
}

/** ボールを描画する */
function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { x, y, radius } = state.ball;
  const isSlowed = state.slowBallTimer > 0;
  ctx.shadowColor = isSlowed ? '#00ff88' : '#ffffff';
  ctx.shadowBlur = 15;
  const gradient = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, isSlowed ? '#88ffcc' : '#aaccff');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * ボタン矩形を描画するヘルパー
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
  hovered = false,
): void {
  const isHighlighted = active || hovered;
  ctx.shadowColor = color;
  ctx.shadowBlur = isHighlighted ? 18 : 6;
  ctx.fillStyle = active ? color : (hovered ? `${color}44` : 'rgba(0,0,0,0.55)');
  ctx.strokeStyle = color;
  ctx.lineWidth = isHighlighted ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

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
 */
function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  bgmEnabled: boolean,
  mousePos: MousePos,
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 48);

  // スコア（左寄せ）
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 8, 20);

  // ステージ番号
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`ST${state.currentStage}/${TOTAL_STAGES}`, 8, 36);

  // ライフ（右寄せ）
  ctx.font = '11px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff6688';
  ctx.fillText(`${'♥'.repeat(state.lives)}`, CANVAS_WIDTH - 8, 20);

  // アクティブ効果インジケーター
  const effectY = 36;
  let effectX = CANVAS_WIDTH - 8;
  ctx.font = '6px "Press Start 2P", monospace';
  if (state.widePaddleTimer > 0) {
    ctx.fillStyle = '#0099ff';
    ctx.textAlign = 'right';
    ctx.fillText(`W:${Math.ceil(state.widePaddleTimer / 60)}s`, effectX, effectY);
    effectX -= 44;
  }
  if (state.slowBallTimer > 0) {
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'right';
    ctx.fillText(`S:${Math.ceil(state.slowBallTimer / 60)}s`, effectX, effectY);
  }

  const btnY = 7;
  const bgmHovered = isHovered(mousePos, HUD_BGM_BUTTON_X - HUD_BTN_W / 2, btnY, HUD_BTN_W, HUD_BTN_H);
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
    bgmHovered,
  );

  const isPlaying = state.status === 'playing';
  const pauseHovered = isHovered(mousePos, HUD_PAUSE_BUTTON_X - HUD_BTN_W / 2, btnY, HUD_BTN_W, HUD_BTN_H);
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
    pauseHovered,
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
 * アイテム取得時の全画面派手エフェクトを描画する
 */
function drawCollectEffect(ctx: CanvasRenderingContext2D, effect: CollectEffect): void {
  if (effect.timer <= 0) return;
  const ratio = effect.timer / effect.maxTimer; // 1.0→0

  // 1. 全画面カラーオーバーレイ（明暗フラッシュ）
  ctx.globalAlpha = ratio * 0.38;
  ctx.fillStyle = effect.color;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalAlpha = 1;

  // 2. 収集位置から拡散する同心リング（3本）
  for (let r = 0; r < 3; r++) {
    const ringOffset = r * 0.28;
    const ringRatio = Math.max(0, ratio - ringOffset);
    if (ringRatio <= 0) continue;
    const ringRadius = (1 - ringRatio) * 260 + 10;
    const ringAlpha = ringRatio * 0.9;
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3 - r;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // 3. 中央テキストアナウンス（ratio 0.4 でフルアルファに達し、その後フェードアウト）
  const textAlpha = Math.min(ratio * 2.5, 1); // 2.5 = 1/0.4 (全体の前40%で最大輝度に達する)
  if (textAlpha > 0.05) {
    ctx.globalAlpha = textAlpha;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 35;
    ctx.fillStyle = effect.color;
    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effect.label, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  // 4. 収集位置にパルスサークル
  const pulseAlpha = ratio * 0.8;
  ctx.globalAlpha = pulseAlpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, 14 + (1 - ratio) * 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * スタート画面オーバーレイを描画する
 */
function drawStartOverlay(ctx: CanvasRenderingContext2D, mousePos: MousePos): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, 'BLOCK BREAKER', '#ff0055', 220);

  const playHovered = isHovered(mousePos, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H);
  const selectHovered = isHovered(mousePos, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H);
  drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, '▶  PLAY', '#00ccff', false, 13, playHovered);
  drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10, selectHovered);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SWIPE / MOUSE: PADDLE', CANVAS_WIDTH / 2, 472);
}

/**
 * ステージ選択画面オーバーレイを描画する
 */
function drawStageSelectOverlay(ctx: CanvasRenderingContext2D, mousePos: MousePos): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, 'SELECT STAGE', '#cc66ff', 66);

  for (let i = 0; i < TOTAL_STAGES; i++) {
    const btnY = STAGE_BTN_FIRST_Y + i * (STAGE_BTN_H + STAGE_BTN_GAP);
    const color = STAGE_THEME_COLORS[i];
    const hovered = isHovered(mousePos, STAGE_BTN_X, btnY, STAGE_BTN_W, STAGE_BTN_H);

    ctx.shadowColor = color;
    ctx.shadowBlur = hovered ? 16 : 8;
    ctx.fillStyle = hovered ? `${color}22` : 'rgba(0,0,0,0.6)';
    ctx.strokeStyle = color;
    ctx.lineWidth = hovered ? 2 : 1.5;
    ctx.beginPath();
    ctx.roundRect(STAGE_BTN_X, btnY, STAGE_BTN_W, STAGE_BTN_H, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, STAGE_BTN_X + 16, btnY + 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText(STAGE_NAMES[i], STAGE_BTN_X + 48, btnY + 25);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText(STAGE_GIMMICK_LABELS[i], STAGE_BTN_X + 48, btnY + 46);

    const stars = STAGE_DIFFICULTIES[i];
    const starX = STAGE_BTN_X + STAGE_BTN_W - 16;
    for (let s = 0; s < 5; s++) {
      ctx.fillStyle = s < stars ? color : 'rgba(255,255,255,0.15)';
      ctx.fillRect(starX - s * 10, btnY + 14, 7, 7);
    }
  }

  const backHovered = isHovered(mousePos, STAGE_BACK_BTN_X, STAGE_BACK_BTN_Y, STAGE_BACK_BTN_W, STAGE_BACK_BTN_H);
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
    backHovered,
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
  mousePos: MousePos,
): void {
  drawDimOverlay(ctx);
  drawTitle(ctx, title, titleColor, 220);

  drawLines(ctx, [scoreText], 282);

  const playHovered = isHovered(mousePos, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H);
  drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, primaryLabel, primaryColor, false, 10, playHovered);

  if (showSelectStage) {
    const selectHovered = isHovered(mousePos, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H);
    drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10, selectHovered);
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
  mousePos: MousePos,
): void {
  const scanActive = state.scanTimer > 0;

  drawBackground(ctx);

  if (state.status === 'stageSelect') {
    drawStageSelectOverlay(ctx, mousePos);
    return;
  }

  drawBlocks(ctx, state, scanActive);
  drawObstacles(ctx, state.obstacles);
  drawItems(ctx, state.items);
  drawParticles(ctx, particles);
  drawScorePopups(ctx, popups);
  drawPaddle(ctx, state);
  drawBall(ctx, state);
  drawHUD(ctx, state, bgmEnabled, mousePos);

  // アイテム取得エフェクト（HUD より手前に重ねる）
  if (state.collectEffect) {
    drawCollectEffect(ctx, state.collectEffect);
  }

  const playHovered = isHovered(mousePos, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H);
  const selectHovered = isHovered(mousePos, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H);

  switch (state.status) {
    case 'start':
      drawStartOverlay(ctx, mousePos);
      break;
    case 'stopped':
      drawDimOverlay(ctx);
      drawTitle(ctx, 'PAUSED', '#ffcc00', 220);
      drawLines(ctx, [`SCORE: ${state.score}`], 272);
      drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, '▶  RESUME', '#ffcc00', false, 10, playHovered);
      drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10, selectHovered);
      break;
    case 'gameover':
      drawEndOverlay(
        ctx, '#ff0055', 'GAME OVER',
        `SCORE: ${state.score}`,
        '▶  RETRY', '#00ccff',
        true,
        mousePos,
      );
      break;
    case 'stageCleared':
      drawDimOverlay(ctx);
      drawTitle(ctx, `STAGE ${state.currentStage}`, '#00ccff', 195);
      drawTitle(ctx, 'CLEAR!', '#00ccff', 228);
      drawLines(ctx, [`SCORE: ${state.score}`], 272);
      drawButton(ctx, BTN_PLAY_X, BTN_PLAY_Y, BTN_PLAY_W, BTN_PLAY_H, 'NEXT ▶', '#00ccff', false, 10, playHovered);
      drawButton(ctx, BTN_SELECT_X, BTN_SELECT_Y, BTN_SELECT_W, BTN_SELECT_H, 'SELECT STAGE', '#cc66ff', false, 10, selectHovered);
      break;
    case 'victory':
      drawEndOverlay(
        ctx, '#00ff88', 'ALL CLEAR!!',
        `FINAL SCORE: ${state.score}`,
        'PLAY AGAIN', '#00ff88',
        true,
        mousePos,
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
