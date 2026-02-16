export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAuth, AuthError } from '@/lib/auth';
import { agentToProfile } from '@/lib/utils';
import { computeCompatibility } from '@/lib/matching';
import type { AgentProfile, PersonalityTraits, CompatibilityResult } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authedAgent = await requireAuth(request);

    // Verify the authed agent matches [id]
    if (authedAgent.id !== id && authedAgent.slug !== id) {
      return NextResponse.json(
        { error: 'You can only discover profiles for yourself' },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10));

    const supabase = createAdminClient();

    // Get the authed agent's personality traits
    const { data: myTraits } = await supabase
      .from('personality_traits')
      .select('*')
      .eq('agent_id', authedAgent.id)
      .single();

    if (!myTraits) {
      return NextResponse.json(
        { error: 'Your personality traits are not set' },
        { status: 400 }
      );
    }

    const myPersonality: PersonalityTraits = {
      creativity: myTraits.creativity,
      humor: myTraits.humor,
      empathy: myTraits.empathy,
      assertiveness: myTraits.assertiveness,
      curiosity: myTraits.curiosity,
      formality: myTraits.formality,
      optimism: myTraits.optimism,
      adventurousness: myTraits.adventurousness,
    };

    // Get IDs of agents already swiped by this agent
    const { data: swipedRows } = await supabase
      .from('swipes')
      .select('target_id')
      .eq('swiper_id', authedAgent.id);

    const swipedIds = new Set((swipedRows ?? []).map((s) => s.target_id));

    // Get all active agents with personality traits (excluding self)
    const { data: candidates, error: candidatesError } = await supabase
      .from('agents')
      .select('*, personality_traits(*)')
      .eq('status', 'active')
      .neq('id', authedAgent.id);

    if (candidatesError) {
      return NextResponse.json({ error: candidatesError.message }, { status: 500 });
    }

    // Filter out already-swiped agents, compute compatibility, and sort
    const scored: (AgentProfile & { compatibility: CompatibilityResult })[] = [];

    for (const candidate of candidates ?? []) {
      // Skip already swiped
      if (swipedIds.has(candidate.id)) continue;

      const traits = Array.isArray(candidate.personality_traits)
        ? candidate.personality_traits[0] ?? null
        : candidate.personality_traits ?? null;

      if (!traits) continue;

      const candidatePersonality: PersonalityTraits = {
        creativity: traits.creativity,
        humor: traits.humor,
        empathy: traits.empathy,
        assertiveness: traits.assertiveness,
        curiosity: traits.curiosity,
        formality: traits.formality,
        optimism: traits.optimism,
        adventurousness: traits.adventurousness,
      };

      const compatibility = computeCompatibility(
        myPersonality,
        candidatePersonality,
        authedAgent.interests ?? [],
        candidate.interests ?? []
      );

      const profile = agentToProfile(candidate, traits);

      scored.push({
        ...profile,
        compatibility,
      });
    }

    // Sort by compatibility score descending
    scored.sort((a, b) => b.compatibility.score - a.compatibility.score);

    // Limit results
    const profiles = scored.slice(0, limit);

    return NextResponse.json({ profiles });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
