/**
 * チップチューン風 BGM モジュール
 *
 * Web Audio API のスケジューラパターンを使用:
 *  - setInterval で 50ms ごとに「150ms 先」までの音符を先行スケジューリング
 *  - JavaScript タイマーのジッターに関係なく正確なタイミングで再生できる
 *
 * デフォルト OFF。startBGM() を明示的に呼んだときのみ再生される。
 */
import { getAudioContext } from './audio';

// ── BGM テンポ定数 ────────────────────────────────────
/** テンポ (BPM) */
const BPM = 150;
/** 8分音符の長さ（秒） */
const Q = 60 / BPM / 2; // = 0.2s

// ── 音符周波数テーブル (Hz) ───────────────────────────
const G5 = 783.99;
const E5 = 659.25;
const C5 = 523.25;
const A5 = 880.00;
const D5 = 587.33;
const C3 = 130.81;
const G3 = 196.00;
const A3 = 220.00;
/** 休符（発音なし） */
const R  = 0;

/**
 * メロディーシーケンス [周波数 Hz, 長さ 秒]
 * C メジャーペンタトニックスケールによる 4 小節ループ（32 × 8分音符 = 6.4秒）
 *
 * 音符の概略:
 *   Bar1: G5 E5 C5 R | G5 A5 G5 E5
 *   Bar2: D5 E5 D5 C5 | D5 R  R  R
 *   Bar3: E5 G5 A5 G5 | E5 D5 E5 G5
 *   Bar4: A5 G5 E5 D5 | C5 R  R  R
 */
const MELODY: ReadonlyArray<readonly [number, number]> = [
  [G5, Q], [E5, Q], [C5, Q], [R,  Q],
  [G5, Q], [A5, Q], [G5, Q], [E5, Q],
  [D5, Q], [E5, Q], [D5, Q], [C5, Q],
  [D5, Q], [R,  Q], [R,  Q], [R,  Q],
  [E5, Q], [G5, Q], [A5, Q], [G5, Q],
  [E5, Q], [D5, Q], [E5, Q], [G5, Q],
  [A5, Q], [G5, Q], [E5, Q], [D5, Q],
  [C5, Q], [R,  Q], [R,  Q], [R,  Q],
] as const;

/**
 * ベースシーケンス [周波数 Hz, 長さ 秒]
 * 4 音 × 8Q = 32Q でメロディーと同じループ長になる
 */
const BASS: ReadonlyArray<readonly [number, number]> = [
  [C3, Q * 8],
  [G3, Q * 8],
  [A3, Q * 8],
  [G3, Q * 8],
] as const;

// ── スケジューラ定数 ──────────────────────────────────
/** 先読み時間（秒）。この分だけ先の音符を事前スケジューリングする */
const LOOKAHEAD_SEC = 0.15;
/** スケジューラの起動間隔（ms）。LOOKAHEAD より短ければ OK */
const SCHEDULE_INTERVAL_MS = 50;

// ── モジュールスコープの BGM プレイヤー状態 ────────────
/** マスターゲインノード（音量一括制御・フェード用） */
let masterGain: GainNode | null = null;
/** スケジューラの setInterval ハンドル */
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
/** 現在 BGM がアクティブか */
let isActive = false;
/** メロディーの再生インデックス（ループ） */
let melodyIdx = 0;
/** ベースの再生インデックス（ループ） */
let bassIdx = 0;
/** 次にメロディー音符をスケジューリングする AudioContext 時刻 */
let melodyNextTime = 0;
/** 次にベース音符をスケジューリングする AudioContext 時刻 */
let bassNextTime = 0;

/**
 * 指定した AudioContext 時刻に 1 音符をスケジューリングする
 * @param ctx       AudioContext
 * @param output    接続先ゲインノード
 * @param freq      周波数 Hz（0 なら休符として何もしない）
 * @param startTime 再生開始時刻（AudioContext.currentTime 基準）
 * @param duration  音符の長さ（秒）
 * @param type      オシレーター波形
 * @param vol       最大音量（0〜1）
 */
function scheduleNote(
  ctx: AudioContext,
  output: GainNode,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  vol: number,
): void {
  if (freq === R) return; // 休符はスキップ

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(output);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  // 音符の末尾で指数フェードアウトしてプツッという音（クリック）を防ぐ
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.85);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * 先読み時間内の未スケジュール音符をすべてキューに入れる
 * setInterval から定期的に呼ばれる
 */
function runScheduler(): void {
  if (!masterGain || !isActive) return;

  const ctx = getAudioContext();
  const horizon = ctx.currentTime + LOOKAHEAD_SEC;

  // メロディーを先読み分だけスケジューリング
  while (melodyNextTime < horizon) {
    const [freq, dur] = MELODY[melodyIdx];
    scheduleNote(ctx, masterGain, freq, melodyNextTime, dur, 'square', 0.09);
    melodyNextTime += dur;
    melodyIdx = (melodyIdx + 1) % MELODY.length;
  }

  // ベースを先読み分だけスケジューリング
  while (bassNextTime < horizon) {
    const [freq, dur] = BASS[bassIdx];
    scheduleNote(ctx, masterGain, freq, bassNextTime, dur, 'triangle', 0.06);
    bassNextTime += dur;
    bassIdx = (bassIdx + 1) % BASS.length;
  }
}

/**
 * BGM を最初から開始する
 * すでに再生中の場合は何もしない
 */
export function startBGM(): void {
  if (isActive) return;

  const ctx = getAudioContext();

  // 新しいマスターゲインを作成してフェードイン
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
  masterGain.connect(ctx.destination);

  // インデックスと次回スケジュール時刻をリセット
  melodyIdx = 0;
  bassIdx = 0;
  melodyNextTime = ctx.currentTime + 0.1;
  bassNextTime   = ctx.currentTime + 0.1;
  isActive = true;

  runScheduler(); // 初回の音符を即座にキューへ
  schedulerTimer = setInterval(runScheduler, SCHEDULE_INTERVAL_MS);
}

/**
 * BGM を完全停止してリソースを解放する
 * ゲームオーバー・クリア時に呼ぶ
 */
export function stopBGM(): void {
  isActive = false;

  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  if (masterGain) {
    const ctx = getAudioContext();
    // フェードアウト後に disconnect（すでにスケジュール済みの音も自然に消える）
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    const g = masterGain;
    setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 350);
    masterGain = null;
  }
}

/**
 * BGM を一時停止する（ユーザーポーズ時）
 * インデックスは保持されるが、再開時は先頭から再スタートする
 */
export function pauseBGM(): void {
  if (!isActive) return;
  isActive = false;

  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  if (masterGain) {
    const ctx = getAudioContext();
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  }
}

/**
 * 一時停止した BGM を再開する
 * すでに再生中の場合は何もしない
 */
export function resumeBGM(): void {
  if (isActive) return;

  const ctx = getAudioContext();

  // masterGain が残っていれば再利用、なければ新規作成
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }

  // フェードイン
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);

  // タイムラインを現在時刻に合わせてリセットし、ループ位置は先頭から再開
  melodyNextTime = ctx.currentTime + 0.1;
  bassNextTime   = ctx.currentTime + 0.1;
  isActive = true;

  runScheduler();
  schedulerTimer = setInterval(runScheduler, SCHEDULE_INTERVAL_MS);
}
