import { Stage } from './components/game/Stage';
import { FloorPhase } from './components/phases/FloorPhase';
import { GameOverPhase } from './components/phases/GameOverPhase';
import { PlayPhase } from './components/phases/PlayPhase';
import { ShoubuNightPhase } from './components/phases/ShoubuNightPhase';
import { TitlePhase } from './components/phases/TitlePhase';
import { WeekEndPhase } from './components/phases/WeekEndPhase';
import { WeekPlanPhase } from './components/phases/WeekPlanPhase';
import { useGameStore } from './stores/useGameStore';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  // 日付・店が変わったらフェーズ内のローカル状態（抽選→入場、方針の選択途中など）をリセットする
  const sceneKey = useGameStore((s) => `${s.phase}:${s.player.currentDate}:${s.today?.parlorId ?? ''}`);

  return (
    <Stage>
      <div key={sceneKey} className="absolute inset-0">
        {phase === 'TITLE' && <TitlePhase />}
        {phase === 'WEEK_PLAN' && <WeekPlanPhase />}
        {phase === 'FLOOR' && <FloorPhase />}
        {phase === 'PLAYING' && <PlayPhase />}
        {phase === 'LEDGER' && <ShoubuNightPhase />}
        {phase === 'WEEK_END' && <WeekEndPhase />}
        {phase === 'GAME_OVER' && <GameOverPhase />}
      </div>
    </Stage>
  );
}
