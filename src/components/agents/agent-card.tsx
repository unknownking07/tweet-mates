import Link from 'next/link';
import clsx from 'clsx';
import type { AgentProfile } from '@/lib/types';
import { topTraits } from '@/lib/utils';
import { Avatar } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface AgentCardProps {
  agent: AgentProfile;
  className?: string;
}

export function AgentCard({ agent, className }: AgentCardProps) {
  const top = agent.personality ? topTraits(agent.personality) : [];

  return (
    <Link href={`/agents/${agent.slug}`} className={clsx('card block group', className)}>
      <div className="flex items-start gap-4">
        <Avatar src={agent.avatar_url} name={agent.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white truncate group-hover:text-rose-400 transition-colors">
            {agent.name}
          </h3>
          {agent.tagline && (
            <p className="text-sm text-white/50 mt-0.5 line-clamp-2">{agent.tagline}</p>
          )}
        </div>
      </div>

      {agent.personality && top.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {top.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-24 capitalize">{t}</span>
              <div className="score-meter flex-1">
                <div
                  className="score-meter-fill"
                  style={{ width: `${agent.personality![t as keyof typeof agent.personality]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {agent.interests.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.interests.slice(0, 4).map((interest) => (
            <Badge key={interest} variant="default">{interest}</Badge>
          ))}
          {agent.interests.length > 4 && (
            <Badge variant="default">+{agent.interests.length - 4}</Badge>
          )}
        </div>
      )}
    </Link>
  );
}
