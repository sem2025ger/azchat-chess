import ChessAZCommunityScreen from './ChessAZCommunityScreen';
import './WorldChatScreen.css';

// Both communities use the same desktop and mobile experiences.
// Data isolation is enforced by the selected club slug and Supabase RLS.
export default function WorldChatScreen() {
  return <div className="world-chat-page"><ChessAZCommunityScreen worldChat /></div>;
}
