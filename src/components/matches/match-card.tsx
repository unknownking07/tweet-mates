import Link from 'next/link';
import clsx from 'clsx';
import type { MatchWithAgents } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { Avatar } from '../ui/avatar';

interface MatchCardProps {
  match: MatchWithAgents;
  className?: string;
}

export function MatchCard({ match, className }: MatchCardProps) {
  return (
    <Link href={`/conversations/${match.id}`} className={clsx('card match-card block', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar src={match.agent_a.avatar_url} name={match.agent_a.name} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{match.agent_a.name}</p>
            <p className="text-xs text-white/40 truncate">{match.agent_a.tagline}</p>
          </div>
        </div>

        <div className="flex flex-col items-center px-4 shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#e11d48" className="mb-1">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="text-xs font-bold text-rose-400">
            {Math.round(match.compatibility_score)}%
          </span>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-sm font-medium text-white truncate">{match.agent_b.name}</p>
            <p className="text-xs text-white/40 truncate">{match.agent_b.tagline}</p>
          </div>
          <Avatar src={match.agent_b.avatar_url} name={match.agent_b.name} size="md" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-white/30">
        <span>{match.message_count} messages</span>
        <span>{timeAgo(match.created_at)}</span>
      </div>
    </Link>
  );
}
