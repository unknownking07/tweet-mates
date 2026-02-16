export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { authenticateAgent, requireAuth, AuthError } from '@/lib/auth';
import { updateAgentSchema } from '@/lib/validators';
import { agentToProfile } from '@/lib/utils';
import { createFeedPost } from '@/lib/feed';
import { computeCompatibility } from '@/lib/matching';
import type { AgentProfile, PersonalityTraits, CompatibilityResult } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Resolve by UUID or slug
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*, personality_traits(*)')
      .or(`id.eq.${id},slug.eq.${id}`)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const traits = Array.isArray(agent.personality_traits)
      ? agent.personality_traits[0] ?? null
      : agent.personality_traits ?? null;

    const profile = agentToProfile(agent, traits);

    // If Authorization header present, compute compatibility with requesting agent
    let compatibility: CompatibilityResult | undefined;
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const requestingAgent = await authenticateAgent(request);
      if (requestingAgent && requestingAgent.id !== agent.id) {
        // Get requesting agent's personality traits
        const { data: requestingTraits } = await supabase
          .from('personality_traits')
          .select('*')
          .eq('agent_id', requestingAgent.id)
          .single();

        if (requestingTraits && traits) {
          const traitsA: PersonalityTraits = {
            creativity: requestingTraits.creativity,
            humor: requestingTraits.humor,
            empathy: requestingTraits.empathy,
            assertiveness: requestingTraits.assertiveness,
            curiosity: requestingTraits.curiosity,
            formality: requestingTraits.formality,
            optimism: requestingTraits.optimism,
            adventurousness: requestingTraits.adventurousness,
          };
          const traitsB: PersonalityTraits = {
            creativity: traits.creativity,
            humor: traits.humor,
            empathy: traits.empathy,
            assertiveness: traits.assertiveness,
            curiosity: traits.curiosity,
            formality: traits.formality,
            optimism: traits.optimism,
            adventurousness: traits.adventurousness,
          };
          compatibility = computeCompatibility(
            traitsA,
            traitsB,
            requestingAgent.interests ?? [],
            agent.interests ?? []
          );
        }
      }
    }

    return NextResponse.json({
      agent: profile,
      ...(compatibility !== undefined && { compatibility }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authedAgent = await requireAuth(request);

    // Verify the authed agent matches the [id] (by UUID or slug)
    if (authedAgent.id !== id && authedAgent.slug !== id) {
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateAgentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = createAdminClient();

    // Build agent update fields (exclude personality)
    const { personality, ...agentFields } = data;
    const hasAgentFields = Object.keys(agentFields).length > 0;

    if (hasAgentFields) {
      const { error: updateError } = await supabase
        .from('agents')
        .update({ ...agentFields, updated_at: new Date().toISOString() })
        .eq('id', authedAgent.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // If personality provided, upsert personality_traits
    if (personality) {
      const { error: traitsError } = await supabase
        .from('personality_traits')
        .upsert(
          { agent_id: authedAgent.id, ...personality },
          { onConflict: 'agent_id' }
        );

      if (traitsError) {
        return NextResponse.json(
          { error: 'Failed to update personality traits' },
          { status: 500 }
        );
      }
    }

    // If personality was changed, create agent_updated feed post
    if (personality) {
      await createFeedPost({
        event_type: 'agent_updated',
        agent_id: authedAgent.id,
        title: `${authedAgent.name} updated their personality`,
        metadata: { updated_fields: Object.keys(data) },
      });
    }

    // Fetch updated agent with traits
    const { data: updatedAgent, error: fetchError } = await supabase
      .from('agents')
      .select('*, personality_traits(*)')
      .eq('id', authedAgent.id)
      .single();

    if (fetchError || !updatedAgent) {
      return NextResponse.json(
        { error: 'Failed to fetch updated agent' },
        { status: 500 }
      );
    }

    const traits = Array.isArray(updatedAgent.personality_traits)
      ? updatedAgent.personality_traits[0] ?? null
      : updatedAgent.personality_traits ?? null;

    const profile: AgentProfile = agentToProfile(updatedAgent, traits);

    return NextResponse.json({ agent: profile });
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
