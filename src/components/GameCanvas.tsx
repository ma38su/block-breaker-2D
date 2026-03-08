import { useRef, useEffect } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

/** ゲームキャンバスをレンダリングし、ゲームループをマウント・アンマウントするコンポーネント */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useGameLoop(canvasRef);

  // キャンバスの論理解像度を初期化（CSS 表示サイズとは独立）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100vh',
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        cursor: 'none',
        border: '2px solid rgba(0, 204, 255, 0.4)',
        boxShadow: '0 0 30px rgba(0, 204, 255, 0.3), 0 0 60px rgba(0, 204, 255, 0.1)',
      }}
    />
  );
}
