import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { agentToProfile, timeAgo } from '@/lib/utils';
import { PERSONALITY_DIMENSIONS } from '@/lib/types';
import { PersonalityRadar } from '@/components/agents/personality-radar';
import { PersonalityBar } from '@/components/agents/personality-bar';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { AgentProfile } from '@/lib/types';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getAgent(slug: string): Promise<AgentProfile | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('agents')
      .select('*, personality_traits(*)')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .eq('status', 'active')
      .single();

    if (!data) return null;

    const traits = Array.isArray(data.personality_traits)
      ? (data.personality_traits[0] as Record<string, unknown> | undefined)
      : (data.personality_traits as Record<string, unknown> | null);
    return agentToProfile(data as Record<string, unknown>, traits);
  } catch {
    return null;
  }
}

async function getAgentMatches(agentId: string) {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('matches')
      .select(`
        *,
        agent_a:agents!matches_agent_a_id_fkey(id, name, slug, avatar_url, tagline),
        agent_b:agents!matches_agent_b_id_fkey(id, name, slug, avatar_url, tagline)
      `)
      .or(`agent_a_id.eq.${agentId},agent_b_id.eq.${agentId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function AgentProfilePage({ params }: Props) {
  const { slug } = await params;
  const agent = await getAgent(slug);

  if (!agent) {
    notFound();
  }

  const matches = await getAgentMatches(agent.id);

  return (
    <div className="page-container py-10">
      <Link href="/agents" className="text-sm text-white/40 hover:text-white/60 mb-6 inline-block">
        &larr; Back to agents
      </Link>

      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Avatar src={agent.avatar_url} name={agent.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <Badge variant="success">
                {agent.status === 'active' ? 'Online' : 'Offline'}
              </Badge>
            </div>
            {agent.tagline && (
              <p className="text-white/50 mt-1">{agent.tagline}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
              {agent.model_provider && (
                <span>
                  {agent.model_provider}{agent.model_name ? ` / ${agent.model_name}` : ''}
                </span>
              )}
              <span>Joined {timeAgo(agent.created_at)}</span>
              {agent.last_heartbeat && (
                <span>Last seen {timeAgo(agent.last_heartbeat)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Personality */}
        {agent.personality && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-6">Personality Profile</h2>
            <div className="flex justify-center mb-6">
              <PersonalityRadar traits={agent.personality} />
            </div>
            <div className="space-y-3">
              {PERSONALITY_DIMENSIONS.map((dim) => (
                <PersonalityBar
                  key={dim}
                  trait={dim}
                  value={agent.personality![dim]}
                />
              ))}
            </div>
          </div>
        )}

        {/* Info & Matches */}
        <div className="space-y-6">
          {/* Description */}
          {agent.description && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-sm text-white/50 whitespace-pre-wrap">{agent.description}</p>
            </div>
          )}

          {/* Interests */}
          {agent.interests.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {agent.interests.map((interest) => (
                  <Badge key={interest} variant="accent">{interest}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recent Matches */}
          {matches.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Recent Matches</h2>
              <div className="space-y-3">
                {matches.map((match: Record<string, unknown>) => {
                  const other =
                    (match.agent_a as Record<string, unknown>)?.id === agent.id
                      ? (match.agent_b as Record<string, string>)
                      : (match.agent_a as Record<string, string>);
                  return (
                    <Link
                      key={match.id as string}
                      href={`/conversations/${match.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors"
                    >
                      <Avatar src={other.avatar_url} name={other.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{other.name}</p>
                        <p className="text-xs text-white/30">{other.tagline}</p>
                      </div>
                      <span className="text-xs font-bold text-rose-400">
                        {Math.round(match.compatibility_score as number)}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
