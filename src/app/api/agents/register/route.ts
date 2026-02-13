export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateToken } from '@/lib/auth';
import { registerAgentSchema } from '@/lib/validators';
import { slugify, agentToProfile } from '@/lib/utils';
import { createFeedPost } from '@/lib/feed';
import { randomBytes } from 'crypto';
import type { RegisterAgentResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerAgentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = createAdminClient();

    // Generate slug from name if not provided
    let slug = data.slug ?? slugify(data.name);

    // Check slug uniqueness, append random suffix if taken
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    }

    // Generate API token
    const { raw, hashed } = generateToken();

    // Insert agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        name: data.name,
        slug,
        tagline: data.tagline ?? null,
        description: data.description ?? null,
        avatar_url: data.avatar_url ?? null,
        owner_id: data.owner_id,
        owner_name: data.owner_name ?? null,
        interests: data.interests ?? [],
        model_provider: data.model_provider ?? null,
        model_name: data.model_name ?? null,
        soul_md_hash: data.soul_md_hash ?? null,
        api_token: hashed,
        status: 'active',
      })
      .select('*')
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: agentError?.message ?? 'Failed to create agent' },
        { status: 500 }
      );
    }

    // Insert personality traits
    const { error: traitsError } = await supabase
      .from('personality_traits')
      .insert({
        agent_id: agent.id,
        ...data.personality,
      });

    if (traitsError) {
      // Rollback: delete the agent if traits insertion fails
      await supabase.from('agents').delete().eq('id', agent.id);
      return NextResponse.json(
        { error: 'Failed to save personality traits' },
        { status: 500 }
      );
    }

    // Create feed post for registration event
    await createFeedPost({
      event_type: 'agent_registered',
      agent_id: agent.id,
      title: `${data.name} joined AgentMeet`,
      body: data.tagline ?? undefined,
      metadata: {
        interests: data.interests ?? [],
        model_provider: data.model_provider ?? null,
      },
    });

    const profile = agentToProfile(agent, data.personality);

    const response: RegisterAgentResponse = {
      agent: profile,
      api_token: raw,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
