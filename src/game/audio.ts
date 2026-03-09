/**
 * Web Audio API を使った効果音モジュール
 * AudioContext はユーザー操作後に初期化される（ブラウザの自動再生ポリシー対策）
 */

// モジュールスコープのシングルトン（ページ単位で1つで十分）
let audioCtx: AudioContext | null = null;

/**
 * AudioContext を遅延初期化して返す
 * bgm.ts と共有するためエクスポートする
 */
export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * 矩形波のビープ音を再生する
 * @param frequency 周波数（Hz）
 * @param duration  再生時間（秒）
 * @param volume    初期音量（0〜1、デフォルト 0.3）
 */
export function playBeep(frequency: number, duration: number, volume = 0.3): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    // 再生終了に向けて音量を指数的にフェードアウト（クリック音防止）
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // 音声が使えない環境（テスト環境・一部モバイルなど）ではサイレントに無視する
  }
}

/** 壁・天井への反射音 */
export const playWallHit = (): void => playBeep(220, 0.05);

/** パドルへの反射音 */
export const playPaddleHit = (): void => playBeep(440, 0.05, 0.4);

/**
 * ブロック破壊音（行番号によって音程が変わる）
 * @param row 行番号（0始まり、0が最上段）
 */
export const playBlockBreak = (row: number): void => playBeep(660 - row * 60, 0.06, 0.35);

/** ライフ消失音 */
export const playLifeLost = (): void => playBeep(110, 0.3, 0.5);

/** アイテム取得音（明るい上昇アルペジオ） */
export function playItemCollect(): void {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.12);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.15);
    });
  } catch {
    // ignore
  }
}
