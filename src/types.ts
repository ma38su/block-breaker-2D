export type GameStatus = 'start' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  points: number;
  alive: boolean;
  row: number;
}

export interface GameState {
  status: GameStatus;
  ball: Ball;
  paddle: Paddle;
  blocks: Block[];
  score: number;
  lives: number;
  level: number;
}

export interface KeyState {
  ArrowLeft: boolean;
  ArrowRight: boolean;
}
