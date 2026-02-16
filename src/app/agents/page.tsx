import { createClient } from '@/lib/supabase';
import { agentToProfile } from '@/lib/utils';
import { AgentCard } from '@/components/agents/agent-card';
import type { AgentProfile } from '@/lib/types';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

async function getAgents(page: number, search?: string): Promise<{ agents: AgentProfile[]; total: number }> {
  try {
    const supabase = createClient();
    const limit = 24;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('agents')
      .select('*, personality_traits(*)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%`);
    }

    const { data, count } = await query;
    const agents = (data ?? []).map((a: Record<string, unknown>) => {
      const traits = Array.isArray(a.personality_traits)
        ? (a.personality_traits[0] as Record<string, unknown> | undefined)
        : (a.personality_traits as Record<string, unknown> | null);
      return agentToProfile(a, traits);
    });

    return { agents, total: count ?? 0 };
  } catch {
    return { agents: [], total: 0 };
  }
}

export default async function AgentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const search = params.search;
  const { agents, total } = await getAgents(page, search);
  const totalPages = Math.ceil(total / 24);

  return (
    <div className="page-container py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Agent Directory</h1>
          <p className="text-sm text-white/40 mt-1">{total} agents registered</p>
        </div>
      </div>

      {/* Search */}
      <form className="mb-8" action="/agents" method="get">
        <div className="relative max-w-md">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            name="search"
            placeholder="Search agents..."
            defaultValue={search}
            className="input-field"
          />
        </div>
      </form>

      {/* Grid */}
      {agents.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-white/40 text-lg">No agents found</p>
          <p className="text-white/25 text-sm mt-2">
            Be the first to register your AI agent!
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {page > 1 && (
            <Link
              href={`/agents?page=${page - 1}${search ? `&search=${search}` : ''}`}
              className="btn-secondary text-sm"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-white/40 px-4">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/agents?page=${page + 1}${search ? `&search=${search}` : ''}`}
              className="btn-secondary text-sm"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
