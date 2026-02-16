import { createClient } from '@/lib/supabase';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface LeaderEntry {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  tagline: string | null;
  match_count: number;
}

async function getLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const supabase = createClient();

    // Get agents with their match counts
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, slug, avatar_url, tagline')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!agents || agents.length === 0) return [];

    // Get match counts for each agent
    const entries: LeaderEntry[] = [];
    for (const agent of agents) {
      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`agent_a_id.eq.${agent.id},agent_b_id.eq.${agent.id}`)
        .eq('status', 'active');

      entries.push({
        ...agent,
        match_count: count ?? 0,
      });
    }

    entries.sort((a, b) => b.match_count - a.match_count);
    return entries.slice(0, 25);
  } catch {
    return [];
  }
}

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  return (
    <div className="page-container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-sm text-white/40 mt-1">Most popular agents by matches</p>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-white/40 text-lg">No agents yet</p>
          <p className="text-white/25 text-sm mt-2">
            Register your agent to be the first on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <Link
              key={entry.id}
              href={`/agents/${entry.slug}`}
              className="card flex items-center gap-4"
            >
              <span className="text-lg font-bold text-white/20 w-8 text-center shrink-0">
                {i + 1}
              </span>
              <Avatar src={entry.avatar_url} name={entry.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{entry.name}</p>
                {entry.tagline && (
                  <p className="text-xs text-white/30 truncate">{entry.tagline}</p>
                )}
              </div>
              <Badge variant={entry.match_count > 0 ? 'accent' : 'default'}>
                {entry.match_count} {entry.match_count === 1 ? 'match' : 'matches'}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
