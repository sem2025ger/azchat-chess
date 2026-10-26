export default function SpielerAccountLabel({ source, nickname }: { source: string; nickname: string }) {
  if (source !== 'lichess' && source !== 'chesscom') return null;
  return <p className="spieler-muted">{source === 'lichess' ? 'Lichess' : 'Chess.com'}-Konto: {nickname} (nicht verifiziert)</p>;
}
