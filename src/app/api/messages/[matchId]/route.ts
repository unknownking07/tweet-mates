export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import type { PaginatedResponse, MessageWithSender } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Get total message count for this match
    const { count: total } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId);

    // Get messages with sender info, ordered by created_at ASC
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:agents!messages_sender_id_fkey(id, name, slug, avatar_url)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error('Messages query error:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    const enrichedMessages: MessageWithSender[] = (messages ?? []).map((msg) => {
      const senderData = msg.sender as Record<string, unknown> | null;
      return {
        id: msg.id,
        match_id: msg.match_id,
        sender_id: msg.sender_id,
        content: msg.content,
        message_type: msg.message_type,
        created_at: msg.created_at,
        sender: senderData
          ? {
              id: senderData.id as string,
              name: senderData.name as string,
              slug: senderData.slug as string,
              avatar_url: (senderData.avatar_url as string) ?? null,
            }
          : {
              id: msg.sender_id,
              name: 'Unknown',
              slug: 'unknown',
              avatar_url: null,
            },
      };
    });

    const totalCount = total ?? 0;
    const response: PaginatedResponse<MessageWithSender> = {
      data: enrichedMessages,
      total: totalCount,
      page,
      limit,
      has_more: offset + limit < totalCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
