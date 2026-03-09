/**
 * ステージ別アトモスフェリック BGM モジュール
 *
 * Web Audio API のスケジューラパターンを使用:
 *  - setInterval で 50ms ごとに「150ms 先」までの音符を先行スケジューリング
 *  - JavaScript タイマーのジッターに関係なく正確なタイミングで再生できる
 *  - ステージごとに異なる BGM (テンポ・スケール・音色) を持つ
 *
 * デフォルト OFF。startBGM(stage) を明示的に呼んだときのみ再生される。
 */
import { getAudioContext } from './audio';

// ── 音符周波数定数 (Hz) ────────────────────────────────────────
const R    = 0;       // 休符
const D2   = 73.42;
const A2   = 110.00;
const Bb2  = 116.54;
const B2   = 123.47;
const C3   = 130.81;
const D3   = 146.83;
const E3   = 164.81;
const F3   = 174.61;
const Fs3  = 185.00;
const G3   = 196.00;
const Gs3  = 207.65;
const A3   = 220.00;
const B3   = 246.94;
const E4   = 329.63;
const F4   = 349.23;
const Fs4  = 369.99;
const G4   = 392.00;
const A4   = 440.00;
const Bb4  = 466.16;
const B4   = 493.88;
const C5   = 523.25;
const Cs5  = 554.37;
const D5   = 587.33;
const Ds5  = 622.25;
const E5   = 659.25;
const F5   = 698.46;
const Fs5  = 739.99;
const G5   = 783.99;
const Gs5  = 830.61;
const A5   = 880.00;
const Bb5  = 932.33;
const B5   = 987.77;
const C6   = 1046.50;

type NoteSeq = ReadonlyArray<readonly [number, number]>;

interface BGMConfig {
  bpm: number;
  melody: NoteSeq;
  bass: NoteSeq;
  arp: NoteSeq | null;
  melodyWave: OscillatorType;
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  melodyVol: number;
  bassVol: number;
  arpVol: number;
  /** 16ステップ（1小節分）のキックパターン。true = キック発音 */
  kickPattern: ReadonlyArray<boolean>;
}

// ── ステージ1: A マイナー / 130 BPM ──────────────────────────
// 「軌道衛星」- クリーン、流れるようなシンセポップ (sawtooth リード + arp)
const Q1 = 60 / 130 / 2;   // 8分音符
const S1 = Q1 / 2;          // 16分音符
const STAGE1: BGMConfig = {
  bpm: 130,
  melodyWave: 'sawtooth',
  bassWave: 'square',
  arpWave: 'triangle',
  melodyVol: 0.07,
  bassVol: 0.05,
  arpVol: 0.03,
  // 4小節ループ (32 × 8分音符)
  melody: [
    [A4, Q1*2], [C5, Q1*2], [E5, Q1*2], [G5, Q1],  [R,  Q1],
    [A5, Q1*2], [G5, Q1*2], [E5, Q1*2], [R,  Q1*2],
    [D5, Q1*2], [E5, Q1*2], [G5, Q1*2], [E5, Q1*2],
    [D5, Q1*2], [C5, Q1*2], [A4, Q1*4],
  ],
  // 2小節ループ (16 × 8分音符)
  bass: [
    [A2, Q1*4], [E3, Q1*4],
    [D3, Q1*2], [C3, Q1*2], [E3, Q1*4],
  ],
  // 4小節ループ (64 × 16分音符) Am→G→F→G アルペジオ
  arp: [
    [A4,S1],[C5,S1],[E5,S1],[A5,S1],[A4,S1],[C5,S1],[E5,S1],[A5,S1],
    [A4,S1],[C5,S1],[E5,S1],[A5,S1],[A4,S1],[C5,S1],[E5,S1],[A5,S1],
    [G4,S1],[B4,S1],[D5,S1],[G5,S1],[G4,S1],[B4,S1],[D5,S1],[G5,S1],
    [G4,S1],[B4,S1],[D5,S1],[G5,S1],[G4,S1],[B4,S1],[D5,S1],[G5,S1],
    [F4,S1],[A4,S1],[C5,S1],[F5,S1],[F4,S1],[A4,S1],[C5,S1],[F5,S1],
    [F4,S1],[A4,S1],[C5,S1],[F5,S1],[F4,S1],[A4,S1],[C5,S1],[F5,S1],
    [G4,S1],[B4,S1],[D5,S1],[G5,S1],[G4,S1],[B4,S1],[D5,S1],[G5,S1],
    [G4,S1],[B4,S1],[D5,S1],[G5,S1],[G4,S1],[B4,S1],[D5,S1],[G5,S1],
  ],
  kickPattern: [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false],
};

// ── ステージ2: D マイナー / 148 BPM ──────────────────────────
// 「エネルギー炉」- ドライブ感のあるエレクトロニック (square リード)
const Q2 = 60 / 148 / 2;
const STAGE2: BGMConfig = {
  bpm: 148,
  melodyWave: 'square',
  bassWave: 'sawtooth',
  arpWave: 'square',
  melodyVol: 0.08,
  bassVol: 0.06,
  arpVol: 0,
  // 4小節ループ
  melody: [
    [D5, Q2*2], [F5, Q2*2], [A5, Q2*2], [G5, Q2*2],
    [F5, Q2*2], [E5, Q2*2], [D5, Q2*4],
    [Bb4, Q2*2], [C5, Q2*2], [D5, Q2*2], [F5, Q2*2],
    [G5, Q2*2], [F5, Q2*2], [E5, Q2*2], [D5, Q2*2],
  ],
  // 2小節ループ
  bass: [
    [D2, Q2*2], [A2, Q2*2], [D3, Q2*2], [C3, Q2*2],
    [Bb2, Q2*4], [A2, Q2*4],
  ],
  arp: null,
  kickPattern: [true,false,false,false, true,false,true,false, true,false,false,false, true,false,true,false],
};

// ── ステージ3: B マイナー / 120 BPM ──────────────────────────
// 「時空の歪み」- ミステリアス、アトモスフェリック (triangle リード + arp)
const Q3 = 60 / 120 / 2;
const S3 = Q3 / 2;
const STAGE3: BGMConfig = {
  bpm: 120,
  melodyWave: 'triangle',
  bassWave: 'sine',
  arpWave: 'square',
  melodyVol: 0.09,
  bassVol: 0.06,
  arpVol: 0.025,
  // 4小節ループ
  melody: [
    [B4, Q3*2], [D5, Q3*2], [Fs5, Q3*2], [A5, Q3*2],
    [G5, Q3*2], [Fs5, Q3*2], [E5, Q3*4],
    [E5, Q3*2], [Fs5, Q3*2], [Gs5, Q3*2], [A5, Q3*2],
    [Fs5, Q3*2], [E5, Q3*2], [B4, Q3*4],
  ],
  // 4小節ループ
  bass: [
    [B2, Q3*4], [Fs3, Q3*4],
    [G3, Q3*2], [Fs3, Q3*2], [E3, Q3*4],
    [A3, Q3*4], [Gs3, Q3*4],
    [Fs3, Q3*4], [B2, Q3*4],
  ],
  // 4小節ループ (64 × 16分音符) Bm→G→A→F#m アルペジオ
  arp: [
    [B4,S3],[D5,S3],[Fs5,S3],[A5,S3],[B4,S3],[D5,S3],[Fs5,S3],[A5,S3],
    [B4,S3],[D5,S3],[Fs5,S3],[A5,S3],[B4,S3],[D5,S3],[Fs5,S3],[A5,S3],
    [G4,S3],[B4,S3],[D5,S3],[G5,S3],[G4,S3],[B4,S3],[D5,S3],[G5,S3],
    [G4,S3],[B4,S3],[D5,S3],[G5,S3],[G4,S3],[B4,S3],[D5,S3],[G5,S3],
    [A4,S3],[Cs5,S3],[E5,S3],[A5,S3],[A4,S3],[Cs5,S3],[E5,S3],[A5,S3],
    [A4,S3],[Cs5,S3],[E5,S3],[A5,S3],[A4,S3],[Cs5,S3],[E5,S3],[A5,S3],
    [Fs4,S3],[A4,S3],[Cs5,S3],[Fs5,S3],[Fs4,S3],[A4,S3],[Cs5,S3],[Fs5,S3],
    [Fs4,S3],[A4,S3],[Cs5,S3],[Fs5,S3],[Fs4,S3],[A4,S3],[Cs5,S3],[Fs5,S3],
  ],
  kickPattern: [true,false,false,false, false,false,false,false, true,false,false,false, false,false,true,false],
};

// ── ステージ4: E マイナー / 158 BPM ──────────────────────────
// 「暗号化エリア」- 高速・デジタル・シンコペーション (16分音符メロディー + arp)
const S4 = 60 / 158 / 4;   // 16分音符を基本単位に
const STAGE4: BGMConfig = {
  bpm: 158,
  melodyWave: 'square',
  bassWave: 'sawtooth',
  arpWave: 'triangle',
  melodyVol: 0.07,
  bassVol: 0.055,
  arpVol: 0.028,
  // 4小節ループ (64 × 16分音符)
  melody: [
    [E5,S4*2],[G5,S4*2],[B5,S4*2],[A5,S4*2],[G5,S4*2],[Fs5,S4*2],[E5,S4*2],[D5,S4*2],
    [B4,S4*2],[D5,S4*2],[Fs5,S4*2],[A5,S4*2],[G5,S4*4],[R,S4*4],
    [G5,S4*2],[Fs5,S4*2],[E5,S4*2],[D5,S4*2],[Cs5,S4*2],[B4,S4*2],[A4,S4*2],[G4,S4*2],
    [Fs4,S4*4],[A4,S4*4],[E5,S4*8],
  ],
  // 2小節ループ (32 × 16分音符)
  bass: [
    [E3, S4*8], [B3, S4*8],
    [A3, S4*8], [G3, S4*8],
  ],
  // 2小節ループ (32 × 16分音符) Em→Am アルペジオ
  arp: [
    [E4,S4],[G4,S4],[B4,S4],[E5,S4],[E4,S4],[G4,S4],[B4,S4],[E5,S4],
    [E4,S4],[G4,S4],[B4,S4],[E5,S4],[E4,S4],[G4,S4],[B4,S4],[E5,S4],
    [A4,S4],[C5,S4],[E5,S4],[A5,S4],[A4,S4],[C5,S4],[E5,S4],[A5,S4],
    [A4,S4],[C5,S4],[E5,S4],[A5,S4],[A4,S4],[C5,S4],[E5,S4],[A5,S4],
  ],
  kickPattern: [true,false,true,false, false,false,true,false, true,false,false,false, true,false,true,false],
};

// ── ステージ5: C マイナー / 168 BPM ──────────────────────────
// 「マザー・コア」- ボスバトル・インテンス (sawtooth リード + 重厚ベース)
const Q5 = 60 / 168 / 2;
const STAGE5: BGMConfig = {
  bpm: 168,
  melodyWave: 'sawtooth',
  bassWave: 'square',
  arpWave: 'square',
  melodyVol: 0.08,
  bassVol: 0.065,
  arpVol: 0,
  // 8小節ループ (64 × 8分音符)
  melody: [
    [C5, Q5*2], [Ds5, Q5*2], [G5,  Q5*2], [Bb5, Q5*2],
    [Gs5, Q5*2], [G5,  Q5*2], [F5,  Q5*4],
    [G5, Q5],   [Gs5, Q5],   [G5,  Q5],   [F5,  Q5],   [Ds5, Q5],   [F5,  Q5],   [G5, Q5*2],
    [Ds5, Q5*2], [D5,  Q5],   [C5,  Q5],   [Bb4, Q5*4],
    [G5,  Q5],   [Bb5, Q5],   [C6,  Q5*2], [Bb5, Q5*2], [Gs5, Q5*2],
    [G5,  Q5*2], [F5,  Q5*2], [Ds5, Q5*2], [D5,  Q5*2],
    [C5,  Q5],   [Ds5, Q5],   [F5,  Q5],   [G5,  Q5],   [Gs5, Q5],   [G5,  Q5],   [F5,  Q5],   [Ds5, Q5],
    [G5,  Q5*4], [R,   Q5*4],
  ],
  // 4小節ループ (32 × 8分音符)
  bass: [
    [C3, Q5*4],  [G3, Q5*4],
    [Gs3, Q5*4], [G3, Q5*4],
    [Bb2, Q5],   [C3, Q5],    [Bb2, Q5],   [C3, Q5],    [G3, Q5*4],
    [F3,  Q5*2], [G3, Q5*2],  [C3,  Q5*4],
  ],
  arp: null,
  kickPattern: [true,false,false,true, false,false,true,false, true,false,false,false, true,false,true,false],
};

const STAGE_BGMS: ReadonlyArray<BGMConfig> = [STAGE1, STAGE2, STAGE3, STAGE4, STAGE5];

// ── スケジューラ定数 ──────────────────────────────────
/** 先読み時間（秒） */
const LOOKAHEAD_SEC = 0.15;
/** スケジューラの起動間隔（ms） */
const SCHEDULE_INTERVAL_MS = 50;

// ── モジュールスコープの BGM プレイヤー状態 ────────────
let masterGain: GainNode | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isActive = false;
let currentConfig: BGMConfig | null = null;
/** 再生速度の倍率（1.0 = 通常, >1.0 = 速い）*/
let tempoMultiplier = 1.0;

let melodyIdx = 0;
let bassIdx = 0;
let arpIdx = 0;
let kickStepIdx = 0;

let melodyNextTime = 0;
let bassNextTime = 0;
let arpNextTime = 0;
let kickNextTime = 0;
let kickStepDuration = 0;

/**
 * 指定した AudioContext 時刻に 1 音符をスケジューリングする
 * シンセ風 ADSR エンベロープを適用してエレクトロニックな音色を演出する
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
  if (freq === R) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(output);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  // シンセ風エンベロープ: 速いアタック → ディケイ → サスティン → リリース
  const attack = Math.min(0.015, duration * 0.15);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(vol * 0.55, startTime + duration * 0.45);
  gain.gain.setValueAtTime(vol * 0.55, startTime + duration * 0.82);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * キックドラムをスケジューリングする（サイン波の周波数スイープで低音打音を再現）
 */
function scheduleKick(ctx: AudioContext, output: GainNode, time: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(output);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(130, time);
  osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
  gain.gain.setValueAtTime(0.85, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
  osc.start(time);
  osc.stop(time + 0.32);
}

/**
 * 先読み時間内の未スケジュール音符をすべてキューに入れる
 * メロディー・ベース・アルペジオ・キックドラムを独立してスケジューリング
 */
function runScheduler(): void {
  if (!masterGain || !isActive || !currentConfig) return;

  const ctx = getAudioContext();
  const horizon = ctx.currentTime + LOOKAHEAD_SEC;
  const { melody, bass, arp, melodyWave, bassWave, arpWave, melodyVol, bassVol, arpVol, kickPattern } = currentConfig;

  while (melodyNextTime < horizon) {
    const [freq, dur] = melody[melodyIdx];
    const scaledDur = dur / tempoMultiplier;
    scheduleNote(ctx, masterGain, freq, melodyNextTime, scaledDur, melodyWave, melodyVol);
    melodyNextTime += scaledDur;
    melodyIdx = (melodyIdx + 1) % melody.length;
  }

  while (bassNextTime < horizon) {
    const [freq, dur] = bass[bassIdx];
    const scaledDur = dur / tempoMultiplier;
    scheduleNote(ctx, masterGain, freq, bassNextTime, scaledDur, bassWave, bassVol);
    bassNextTime += scaledDur;
    bassIdx = (bassIdx + 1) % bass.length;
  }

  if (arp && arpVol > 0) {
    while (arpNextTime < horizon) {
      const [freq, dur] = arp[arpIdx];
      const scaledDur = dur / tempoMultiplier;
      scheduleNote(ctx, masterGain, freq, arpNextTime, scaledDur, arpWave, arpVol);
      arpNextTime += scaledDur;
      arpIdx = (arpIdx + 1) % arp.length;
    }
  }

  while (kickNextTime < horizon) {
    const stepInBar = kickStepIdx % kickPattern.length;
    if (kickPattern[stepInBar]) {
      scheduleKick(ctx, masterGain, kickNextTime);
    }
    kickNextTime += kickStepDuration / tempoMultiplier;
    kickStepIdx++;
  }
}

/**
 * 指定ステージの BGM を最初から開始する
 * すでに再生中の場合は何もしない
 * @param stage ステージ番号（1〜5）
 */
export function startBGM(stage = 1): void {
  if (isActive) return;

  const stageIndex = Math.max(0, Math.min(stage - 1, STAGE_BGMS.length - 1));
  currentConfig = STAGE_BGMS[stageIndex];

  const ctx = getAudioContext();

  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
  masterGain.connect(ctx.destination);

  melodyIdx = 0;
  bassIdx = 0;
  arpIdx = 0;
  kickStepIdx = 0;

  const startOffset = ctx.currentTime + 0.1;
  melodyNextTime = startOffset;
  bassNextTime   = startOffset;
  arpNextTime    = startOffset;
  kickNextTime   = startOffset;
  kickStepDuration = 60 / currentConfig.bpm / 4; // 16分音符の長さ

  isActive = true;

  runScheduler();
  schedulerTimer = setInterval(runScheduler, SCHEDULE_INTERVAL_MS);
}

/**
 * BGM を完全停止してリソースを解放する
 */
export function stopBGM(): void {
  isActive = false;

  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  if (masterGain) {
    const ctx = getAudioContext();
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    const g = masterGain;
    setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, 350);
    masterGain = null;
  }
}

/**
 * BGM を一時停止する（ユーザーポーズ時）
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

  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }

  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);

  const startOffset = ctx.currentTime + 0.1;
  melodyNextTime = startOffset;
  bassNextTime   = startOffset;
  arpNextTime    = startOffset;
  kickNextTime   = startOffset;
  isActive = true;

  runScheduler();
  schedulerTimer = setInterval(runScheduler, SCHEDULE_INTERVAL_MS);
}
