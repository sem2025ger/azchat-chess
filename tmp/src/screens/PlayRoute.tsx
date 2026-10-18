import { useSearchParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PlayScreen from './PlayScreen';
import RouteLoadingFallback from '../components/RouteLoadingFallback';

const GameScreen = lazy(() => import('./GameScreen'));

export default function PlayRoute() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId');

  if (roomId) {
    return <Suspense fallback={<RouteLoadingFallback />}><GameScreen mode="live" /></Suspense>;
  }

  return <PlayScreen />;
}
