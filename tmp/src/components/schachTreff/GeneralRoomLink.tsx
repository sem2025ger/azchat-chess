import { moderationEnabled, UnreadBadge } from './unread';
type Props = { label: string; search: string; className: string };
export default function GeneralRoomLink({ label, search, className }: Props) {
  const active = !new URLSearchParams(search).has('club');
  return <a className={className} href="/chat" aria-current={active ? 'page' : undefined}><span className="st-general-label">{label}</span>{moderationEnabled && <UnreadBadge />}</a>;
}
