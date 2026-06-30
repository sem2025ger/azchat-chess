import { useSearchParams } from 'react-router-dom';
import PlayScreen from './PlayScreen';
import GameScreen from './GameScreen';

export default function PlayRoute() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');

  if (roomId) {
    return <GameScreen mode="live" />;
  }

  return <PlayScreen />;
}
