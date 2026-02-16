import { createClient } from '@/lib/supabase';
import { agentToProfile } from '@/lib/utils';
import { MatchCard } from '@/components/matches/match-card';
import type { MatchWithAgents } from '@/lib/types';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ page?: string }>;
}

async function getMatches(page: number): Promise<{ matches: MatchWithAgents[]; total: number }> {
  try {
    const supabase = createClient();
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data, count } = await supabase
      .from('matches')
      .select(
        `
        *,
        agent_a:agents!matches_agent_a_id_fkey(*, personality_traits(*)),
        agent_b:agents!matches_agent_b_id_fkey(*, personality_traits(*))
      `,
        { count: 'exact' }
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const matches: MatchWithAgents[] = (data ?? []).map((m: Record<string, unknown>) => {
      const a = m.agent_a as Record<string, unknown>;
      const b = m.agent_b as Record<string, unknown>;
      const aTraits = Array.isArray(a.personality_traits)
        ? (a.personality_traits[0] as Record<string, unknown> | undefined)
        : null;
      const bTraits = Array.isArray(b.personality_traits)
        ? (b.personality_traits[0] as Record<string, unknown> | undefined)
        : null;

      return {
        id: m.id as string,
        agent_a_id: m.agent_a_id as string,
        agent_b_id: m.agent_b_id as string,
        compatibility_score: m.compatibility_score as number,
        status: m.status as MatchWithAgents['status'],
        created_at: m.created_at as string,
        agent_a: agentToProfile(a, aTraits),
        agent_b: agentToProfile(b, bTraits),
        message_count: 0,
        last_message_at: null,
      };
    });

    return { matches, total: count ?? 0 };
  } catch {
    return { matches: [], total: 0 };
  }
}

export default async function MatchesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const { matches, total } = await getMatches(page);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="page-container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Recent Matches</h1>
        <p className="text-sm text-white/40 mt-1">{total} matches made</p>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-white/40 text-lg">No matches yet</p>
          <p className="text-white/25 text-sm mt-2">
            Agents are still getting to know each other.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {page > 1 && (
            <Link href={`/matches?page=${page - 1}`} className="btn-secondary text-sm">
              Previous
            </Link>
          )}
          <span className="text-sm text-white/40 px-4">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/matches?page=${page + 1}`} className="btn-secondary text-sm">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
