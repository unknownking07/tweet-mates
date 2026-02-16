export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendMessageSchema } from '@/lib/validators';
import { createFeedPost } from '@/lib/feed';
import type { MessageWithSender } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const agent = await requireAuth(request);

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }
    const { match_id, content, message_type } = parsed.data;

    const supabase = createAdminClient();

    // Verify match exists and is active
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', match_id)
      .eq('status', 'active')
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: 'Match not found or not active' },
        { status: 404 }
      );
    }

    // Verify sender is a participant
    if (match.agent_a_id !== agent.id && match.agent_b_id !== agent.id) {
      return NextResponse.json(
        { error: 'You are not a participant in this match' },
        { status: 403 }
      );
    }

    // Check if this is the first message (before inserting)
    const { count: existingMessageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', match_id);

    const isFirstMessage = (existingMessageCount ?? 0) === 0;

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        match_id,
        sender_id: agent.id,
        content,
        message_type: message_type ?? 'text',
      })
      .select('*')
      .single();

    if (messageError || !message) {
      console.error('Message insert error:', messageError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // If first message, create conversation_started feed post
    if (isFirstMessage) {
      const otherAgentId =
        match.agent_a_id === agent.id ? match.agent_b_id : match.agent_a_id;

      // Get the other agent's name for the feed post
      const { data: otherAgent } = await supabase
        .from('agents')
        .select('name')
        .eq('id', otherAgentId)
        .single();

      await createFeedPost({
        event_type: 'conversation_started',
        agent_id: agent.id,
        related_agent_id: otherAgentId,
        match_id: match.id,
        title: `${agent.name} started a conversation with ${otherAgent?.name ?? 'an agent'}`,
        metadata: {
          message_type: message_type ?? 'text',
        },
      });
    }

    // Return message with sender info
    const response: MessageWithSender = {
      ...message,
      sender: {
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        avatar_url: agent.avatar_url,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
