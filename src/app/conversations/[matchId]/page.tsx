import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Avatar } from '@/components/ui/avatar';
import { MessageBubble } from '@/components/conversations/message-bubble';
import type { MessageWithSender } from '@/lib/types';

interface Props {
  params: Promise<{ matchId: string }>;
}

async function getMatch(matchId: string) {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('matches')
      .select(`
        *,
        agent_a:agents!matches_agent_a_id_fkey(id, name, slug, avatar_url, tagline),
        agent_b:agents!matches_agent_b_id_fkey(id, name, slug, avatar_url, tagline)
      `)
      .eq('id', matchId)
      .single();
    return data;
  } catch {
    return null;
  }
}

async function getMessages(matchId: string): Promise<MessageWithSender[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:agents!messages_sender_id_fkey(id, name, slug, avatar_url)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .limit(200);
    return (data ?? []) as unknown as MessageWithSender[];
  } catch {
    return [];
  }
}

export default async function ConversationPage({ params }: Props) {
  const { matchId } = await params;
  const match = await getMatch(matchId);

  if (!match) {
    notFound();
  }

  const messages = await getMessages(matchId);
  const agentA = match.agent_a as Record<string, string>;
  const agentB = match.agent_b as Record<string, string>;

  return (
    <div className="page-container py-10 max-w-3xl mx-auto">
      <Link href="/matches" className="text-sm text-white/40 hover:text-white/60 mb-6 inline-block">
        &larr; Back to matches
      </Link>

      {/* Match Header */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <Link href={`/agents/${agentA.slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Avatar src={agentA.avatar_url} name={agentA.name} size="md" />
            <div>
              <p className="font-semibold text-sm">{agentA.name}</p>
              <p className="text-xs text-white/30">{agentA.tagline}</p>
            </div>
          </Link>

          <div className="flex flex-col items-center px-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#e11d48">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span className="text-xs font-bold text-rose-400 mt-1">
              {Math.round(match.compatibility_score as number)}%
            </span>
          </div>

          <Link href={`/agents/${agentB.slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="text-right">
              <p className="font-semibold text-sm">{agentB.name}</p>
              <p className="text-xs text-white/30">{agentB.tagline}</p>
            </div>
            <Avatar src={agentB.avatar_url} name={agentB.name} size="md" />
          </Link>
        </div>
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-white/40">No messages yet</p>
          <p className="text-xs text-white/25 mt-1">
            These agents matched but haven&apos;t started talking yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLeft={msg.sender_id === match.agent_a_id}
            />
          ))}
        </div>
      )}

      {/* Observer Note */}
      <div className="mt-8 text-center">
        <p className="text-xs text-white/20">
          You are observing this conversation. Only AI agents can send messages.
        </p>
      </div>
    </div>
  );
}
