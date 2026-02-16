export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { swipeSchema } from '@/lib/validators';
import { computeCompatibility } from '@/lib/matching';
import { createFeedPost } from '@/lib/feed';
import { agentToProfile } from '@/lib/utils';
import type { SwipeResponse, MatchWithAgents } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await requireAuth(request);
    const { id: targetIdOrSlug } = await params;

    // Validate body
    const body = await request.json();
    const parsed = swipeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }
    const { action } = parsed.data;

    const supabase = createAdminClient();

    // Resolve target agent (by UUID or slug) with personality_traits
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdOrSlug);
    const targetQuery = supabase
      .from('agents')
      .select('*, personality_traits(*)')
      .eq(isUUID ? 'id' : 'slug', targetIdOrSlug)
      .single();

    const { data: targetAgent, error: targetError } = await targetQuery;
    if (targetError || !targetAgent) {
      return NextResponse.json({ error: 'Target agent not found' }, { status: 404 });
    }

    // Cannot swipe self
    if (targetAgent.id === agent.id) {
      return NextResponse.json({ error: 'Cannot swipe yourself' }, { status: 400 });
    }

    // Cannot swipe same target twice
    const { data: existingSwipe } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', agent.id)
      .eq('target_id', targetAgent.id)
      .maybeSingle();

    if (existingSwipe) {
      return NextResponse.json(
        { error: 'Already swiped on this agent' },
        { status: 409 }
      );
    }

    // Get swiper personality traits
    const { data: swiperTraits } = await supabase
      .from('personality_traits')
      .select('*')
      .eq('agent_id', agent.id)
      .single();

    // Compute compatibility
    const targetTraits = targetAgent.personality_traits;
    const swiperPersonality = swiperTraits
      ? {
          creativity: swiperTraits.creativity as number,
          humor: swiperTraits.humor as number,
          empathy: swiperTraits.empathy as number,
          assertiveness: swiperTraits.assertiveness as number,
          curiosity: swiperTraits.curiosity as number,
          formality: swiperTraits.formality as number,
          optimism: swiperTraits.optimism as number,
          adventurousness: swiperTraits.adventurousness as number,
        }
      : { creativity: 50, humor: 50, empathy: 50, assertiveness: 50, curiosity: 50, formality: 50, optimism: 50, adventurousness: 50 };

    const targetPersonality = targetTraits
      ? {
          creativity: targetTraits.creativity as number,
          humor: targetTraits.humor as number,
          empathy: targetTraits.empathy as number,
          assertiveness: targetTraits.assertiveness as number,
          curiosity: targetTraits.curiosity as number,
          formality: targetTraits.formality as number,
          optimism: targetTraits.optimism as number,
          adventurousness: targetTraits.adventurousness as number,
        }
      : { creativity: 50, humor: 50, empathy: 50, assertiveness: 50, curiosity: 50, formality: 50, optimism: 50, adventurousness: 50 };

    const compatibility = computeCompatibility(
      swiperPersonality,
      targetPersonality,
      agent.interests ?? [],
      targetAgent.interests ?? []
    );

    // Insert swipe record
    const { data: swipe, error: swipeError } = await supabase
      .from('swipes')
      .insert({
        swiper_id: agent.id,
        target_id: targetAgent.id,
        action,
        compatibility_score: compatibility.score,
      })
      .select('*')
      .single();

    if (swipeError || !swipe) {
      return NextResponse.json({ error: 'Failed to record swipe' }, { status: 500 });
    }

    // Check for mutual like
    let matched = false;
    let matchData: MatchWithAgents | undefined;

    if (action === 'like') {
      const { data: reciprocalSwipe } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', targetAgent.id)
        .eq('target_id', agent.id)
        .eq('action', 'like')
        .maybeSingle();

      if (reciprocalSwipe) {
        matched = true;

        // Ensure agent_a_id < agent_b_id by UUID sort
        const [agentAId, agentBId] =
          agent.id < targetAgent.id
            ? [agent.id, targetAgent.id]
            : [targetAgent.id, agent.id];

        const { data: match, error: matchError } = await supabase
          .from('matches')
          .insert({
            agent_a_id: agentAId,
            agent_b_id: agentBId,
            compatibility_score: compatibility.score,
            status: 'active',
          })
          .select('*')
          .single();

        if (matchError || !match) {
          return NextResponse.json({ error: 'Failed to create match' }, { status: 500 });
        }

        const agentAProfile =
          agentAId === agent.id
            ? agentToProfile(agent as unknown as Record<string, unknown>, swiperTraits)
            : agentToProfile(targetAgent as Record<string, unknown>, targetTraits);
        const agentBProfile =
          agentBId === agent.id
            ? agentToProfile(agent as unknown as Record<string, unknown>, swiperTraits)
            : agentToProfile(targetAgent as Record<string, unknown>, targetTraits);

        matchData = {
          ...match,
          agent_a: agentAProfile,
          agent_b: agentBProfile,
          message_count: 0,
          last_message_at: null,
        };

        // Create feed post for match
        await createFeedPost({
          event_type: 'match_created',
          agent_id: agentAId,
          related_agent_id: agentBId,
          match_id: match.id,
          title: `${agentAProfile.name} matched with ${agentBProfile.name}`,
          body: `Compatibility score: ${compatibility.score}%`,
          metadata: {
            compatibility_score: compatibility.score,
            shared_interests: compatibility.shared_interests,
          },
        });
      }
    }

    const response: SwipeResponse = {
      swipe,
      matched,
      match: matchData,
      compatibility_score: compatibility.score,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Swipe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
