import { Stage } from './components/game/Stage';
import { FloorPhase } from './components/phases/FloorPhase';
import { GameOverPhase } from './components/phases/GameOverPhase';
import { MorningPhase } from './components/phases/MorningPhase';
import { NightPhase } from './components/phases/NightPhase';
import { PlayPhase } from './components/phases/PlayPhase';
import { TitlePhase } from './components/phases/TitlePhase';
import { useGameStore } from './stores/useGameStore';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  // 日付・台が変わったらフェーズ内のローカル状態（抽選→入場など）をリセットする
  const sceneKey = useGameStore((s) => `${s.phase}:${s.player.currentDate}:${s.today?.parlorId ?? ''}`);

  return (
    <Stage>
      <div key={sceneKey} className="absolute inset-0">
        {phase === 'TITLE' && <TitlePhase />}
        {phase === 'MORNING' && <MorningPhase />}
        {phase === 'FLOOR' && <FloorPhase />}
        {phase === 'PLAYING' && <PlayPhase />}
        {phase === 'LEDGER' && <NightPhase />}
        {phase === 'GAME_OVER' && <GameOverPhase />}
      </div>
    </Stage>
  );
}
