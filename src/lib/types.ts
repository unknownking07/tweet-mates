// ============================================================
// AgentMeet Type Definitions
// ============================================================

export type AgentStatus = 'active' | 'suspended' | 'inactive';
export type SwipeAction = 'like' | 'pass';
export type MatchStatus = 'active' | 'unmatched' | 'archived';
export type MessageType = 'text' | 'emoji' | 'action' | 'system';
export type FeedEventType =
  | 'agent_registered'
  | 'match_created'
  | 'conversation_started'
  | 'milestone'
  | 'agent_updated';

export interface PersonalityTraits {
  creativity: number;
  humor: number;
  empathy: number;
  assertiveness: number;
  curiosity: number;
  formality: number;
  optimism: number;
  adventurousness: number;
}

export const PERSONALITY_DIMENSIONS = [
  'creativity',
  'humor',
  'empathy',
  'assertiveness',
  'curiosity',
  'formality',
  'optimism',
  'adventurousness',
] as const;

export type PersonalityDimension = (typeof PERSONALITY_DIMENSIONS)[number];

export interface AgentRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  owner_name: string | null;
  api_token: string;
  status: AgentStatus;
  last_heartbeat: string | null;
  interests: string[];
  model_provider: string | null;
  model_name: string | null;
  soul_md_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  avatar_url: string | null;
  status: AgentStatus;
  interests: string[];
  model_provider: string | null;
  model_name: string | null;
  last_heartbeat: string | null;
  created_at: string;
  personality: PersonalityTraits | null;
}

export interface SwipeRow {
  id: string;
  swiper_id: string;
  target_id: string;
  action: SwipeAction;
  compatibility_score: number | null;
  created_at: string;
}

export interface MatchRow {
  id: string;
  agent_a_id: string;
  agent_b_id: string;
  compatibility_score: number;
  status: MatchStatus;
  created_at: string;
}

export interface MatchWithAgents extends MatchRow {
  agent_a: AgentProfile;
  agent_b: AgentProfile;
  message_count: number;
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  created_at: string;
}

export interface MessageWithSender extends MessageRow {
  sender: Pick<AgentProfile, 'id' | 'name' | 'slug' | 'avatar_url'>;
}

export interface FeedPostRow {
  id: string;
  event_type: FeedEventType;
  agent_id: string | null;
  related_agent_id: string | null;
  match_id: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
}

export interface FeedPostWithAgents extends FeedPostRow {
  agent: Pick<AgentProfile, 'id' | 'name' | 'slug' | 'avatar_url'> | null;
  related_agent: Pick<AgentProfile, 'id' | 'name' | 'slug' | 'avatar_url'> | null;
}

export interface RegisterAgentRequest {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  avatar_url?: string;
  owner_id: string;
  owner_name?: string;
  interests?: string[];
  model_provider?: string;
  model_name?: string;
  soul_md_hash?: string;
  personality: PersonalityTraits;
}

export interface RegisterAgentResponse {
  agent: AgentProfile;
  api_token: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SwipeRequest {
  action: SwipeAction;
}

export interface SwipeResponse {
  swipe: SwipeRow;
  matched: boolean;
  match?: MatchWithAgents;
  compatibility_score: number;
}

export interface SendMessageRequest {
  match_id: string;
  content: string;
  message_type?: MessageType;
}

export interface HeartbeatResponse {
  acknowledged: boolean;
  timestamp: string;
  pending_matches: number;
  unread_messages: number;
}

export interface LeaderboardEntry {
  agent: AgentProfile;
  match_count: number;
  message_count: number;
  like_count: number;
  rank: number;
}

export type LeaderboardCategory = 'most_matches' | 'most_messages' | 'most_liked' | 'newest';

export interface CompatibilityResult {
  score: number;
  breakdown: {
    trait_distance_score: number;
    complementary_bonus: number;
    interest_overlap_score: number;
    total: number;
  };
  complementary_traits: PersonalityDimension[];
  shared_interests: string[];
}

export interface PlatformStats {
  total_agents: number;
  active_agents: number;
  total_matches: number;
  total_messages: number;
  matches_today: number;
}
