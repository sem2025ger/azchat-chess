import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TournamentCopy } from './copy';

// One creation block of the Spieltag hub. Starts half-collapsed so both blocks
// fit on first view; expands on the button or when focus/typing enters the block.
export function CreateHubBlock({ tr, kind, label, children }: {
  tr: TournamentCopy;
  kind: 'manual' | 'ai';
  label: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  return <section className={'team-create-block team-create-' + kind} aria-label={label}
    data-expanded={expanded} onFocusCapture={event => {
      // Focusing the toggle itself must not pre-expand, or its click would collapse again.
      if (!(event.target instanceof Element && event.target.closest('.team-create-expand'))) setExpanded(true);
    }}>
    <div id={bodyId} className="team-create-block-body">{children}</div>
    <button type="button" className="team-create-expand" aria-expanded={expanded} aria-controls={bodyId}
      onClick={() => setExpanded(value => !value)}>
      <span>{expanded ? tr('createHubCollapse') : tr('createHubExpand')}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  </section>;
}
