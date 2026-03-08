import type { Particle, ScorePopup } from '../types';
import { PARTICLES_PER_BLOCK, PARTICLE_MAX_LIFE, SCORE_POPUP_LIFE } from '../constants';

/**
 * ブロック破壊時にパーティクルを生成してリストに追加する
 * @param particles 追加先のパーティクル配列（破壊的更新）
 * @param cx        ブロック中心X座標
 * @param cy        ブロック中心Y座標
 * @param color     ブロックのネオンカラー
 */
export function spawnParticles(
  particles: Particle[],
  cx: number,
  cy: number,
  color: string,
): void {
  for (let i = 0; i < PARTICLES_PER_BLOCK; i++) {
    // 均等な方向 + 少しランダム性を加えて自然な広がりにする
    const angle = (Math.PI * 2 * i) / PARTICLES_PER_BLOCK + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: PARTICLE_MAX_LIFE,
      maxLife: PARTICLE_MAX_LIFE,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

/**
 * スコアポップアップを生成してリストに追加する
 * @param popups  追加先のポップアップ配列（破壊的更新）
 * @param cx      表示X座標（ブロック中心）
 * @param cy      表示Y座標（ブロック中心）
 * @param points  獲得ポイント
 * @param color   ブロックのネオンカラー
 */
export function spawnScorePopup(
  popups: ScorePopup[],
  cx: number,
  cy: number,
  points: number,
  color: string,
): void {
  popups.push({
    x: cx,
    y: cy,
    text: `+${points}`,
    life: SCORE_POPUP_LIFE,
    maxLife: SCORE_POPUP_LIFE,
    color,
  });
}

/**
 * パーティクルを1フレーム分更新する（移動・重力・摩擦・寿命減算）
 * ライフが尽きたパーティクルは配列から除去する（破壊的更新）
 */
export function updateParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12; // 重力で落下感を演出
    p.vx *= 0.97; // 摩擦で横方向を減衰
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

/**
 * スコアポップアップを1フレーム分更新する（上昇・寿命減算）
 * ライフが尽きたポップアップは配列から除去する（破壊的更新）
 */
export function updateScorePopups(popups: ScorePopup[]): void {
  for (let i = popups.length - 1; i >= 0; i--) {
    const popup = popups[i];
    popup.y -= 0.8; // 上方向に浮き上がる
    popup.life--;
    if (popup.life <= 0) {
      popups.splice(i, 1);
    }
  }
}
