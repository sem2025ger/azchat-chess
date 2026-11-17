import SchachTreffDesktop from './SchachTreffDesktop';
import './WorldChatScreen.css';

// Separate route and data room; reuse the approved message, position and challenge stack.
export default function WorldChatScreen() {
  return <div className="world-chat-page"><SchachTreffDesktop hideRooms /></div>;
}
