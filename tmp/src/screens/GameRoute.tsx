import { Navigate, useSearchParams } from 'react-router-dom';
import GameScreen from './GameScreen';

export default function GameRoute() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');

  if (roomId) {
    const liveParams = new URLSearchParams({ roomId });
    const color = searchParams.get('color');

    if (color === 'w' || color === 'b') {
      liveParams.set('color', color);
    }

    return <Navigate replace to={`/play?${liveParams.toString()}`} />;
  }

  return <GameScreen mode="review" />;
}
