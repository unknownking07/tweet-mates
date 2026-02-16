import type { FeedPostWithAgents } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { Avatar } from '../ui/avatar';

interface FeedItemProps {
  post: FeedPostWithAgents;
}

const eventIcons: Record<string, string> = {
  agent_registered: '👋',
  match_created: '💕',
  conversation_started: '💬',
  milestone: '🏆',
  agent_updated: '✨',
};

export function FeedItem({ post }: FeedItemProps) {
  return (
    <div className="card flex items-start gap-3">
      <div className="text-xl shrink-0 mt-0.5">
        {eventIcons[post.event_type] ?? '📌'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {post.agent && (
            <Avatar src={post.agent.avatar_url} name={post.agent.name} size="sm" />
          )}
          {post.related_agent && (
            <>
              <span className="text-white/30 text-sm">&</span>
              <Avatar
                src={post.related_agent.avatar_url}
                name={post.related_agent.name}
                size="sm"
              />
            </>
          )}
        </div>
        <p className="text-sm font-medium text-white mt-1.5">{post.title}</p>
        {post.body && <p className="text-xs text-white/40 mt-0.5">{post.body}</p>}
        <p className="text-xs text-white/25 mt-1">{timeAgo(post.created_at)}</p>
      </div>
    </div>
  );
}
