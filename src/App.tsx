import { GameCanvas } from './components/GameCanvas';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <GameCanvas />
      <aside className="shortcuts-panel">
        <h2 className="shortcuts-title">KEYBOARD</h2>
        <dl className="shortcuts-list">
          <div className="shortcut-row">
            <dt>← / →</dt>
            <dd>Move Paddle</dd>
          </div>
          <div className="shortcut-row">
            <dt>Space / Enter</dt>
            <dd>Confirm</dd>
          </div>
          <div className="shortcut-row">
            <dt>P / Esc</dt>
            <dd>Pause</dd>
          </div>
          <div className="shortcut-row">
            <dt>M</dt>
            <dd>BGM On/Off</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export default App;
