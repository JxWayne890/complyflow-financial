export enum UserRole {
  ADMIN = 'admin',
  ADVISOR = 'advisor',
  COMPLIANCE = 'compliance',
  CLIENT = 'client'
}

export enum ContentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  POSTED = 'posted',
  REJECTED = 'rejected'
}

export enum ContentType {
  BLOG = 'blog',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  AD = 'ad',
  VIDEO_SCRIPT = 'video_script'
}

export enum AudienceType {
  GENERAL_PUBLIC = 'general_public',
  ACCREDITED = 'accredited',
  QUALIFIED = 'qualified'
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ONBOARDING = 'onboarding'
}

export interface Client {
  id: string;
  org_id: string;
  name: string;
  contact_email: string;
  contact_phone?: string;
  company: string;
  audience_type: AudienceType;
  notes?: string;
  avatar_url?: string;
  status: ClientStatus;
  writing_style?: string;
  brand_tone?: string;
  business_description?: string;
  content_preferences?: Record<string, any>;
  created_at: string;
}

export interface ClientSocialAccount {
  id: string;
  client_id: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram';
  account_name: string;
  connected: boolean;
  blotato_connection_id?: string;
  posting_preference: 'auto' | 'manual' | 'scheduled';
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface Topic {
  id: string;
  category: string;
  theme: string;
  topic: string;
  active: boolean;
}

export interface ContentRequest {
  id: string;
  topic_text: string;
  content_type: ContentType;
  status: ContentStatus;
  updated_at: string;
  generation_mode?: string;
  advisor_id: string;
  title?: string; // Derived from current version
}

export interface ContentVersion {
  id: string;
  version_number: number;
  generated_by: 'ai' | 'human';
  title: string;
  body: string;
  disclaimers?: string;
  compliance_notes?: string;
  chart_data?: any;
  citation_payload?: CitationPayloadItem[] | null;
  source_payload?: CitationSourceItem[] | null;
  source_limitations?: string | null;
  grounding_status?: 'grounded' | 'limited' | 'ungrounded' | null;
  editor_id?: string;
  created_at: string;
}

export interface CitationPayloadItem {
  marker: string;
  source_id: string;
  title: string;
  url?: string | null;
  page?: number | null;
  section?: string | null;
  quoted_span: string;
  chunk_index: number;
  source_type: string;
  document_name?: string | null;
  published_date?: string | null;
  authority_score?: number | null;
}

export interface CitationSourceItem {
  source_id: string;
  title: string;
  url?: string | null;
  source_type: string;
}

export interface ComplianceReview {
  id: string;
  decision: 'approved' | 'changes_requested' | 'rejected' | 'resubmitted';
  notes: string;
  reviewer_id: string;
  created_at: string;
}

export interface ComplianceHighlight {
  id: string;
  org_id: string;
  request_id: string;
  version_id?: string | null;
  highlight_id: string;
  selected_text: string;
  note: string;
  status: 'open' | 'resolved';
  created_by: string;
  resolved_by?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface SocialVariant {
  id: string;
  platform: string;
  content: string;
  hashtags: string;
}

export type NotificationType = 'review_submitted' | 'approved' | 'changes_requested' | 'rejected';

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  request_id: string;
  asset_type: 'image' | 'video';
  provider: string;
  url: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PostingJob {
  id: string;
  request_id: string;
  platform: string;
  status: 'pending' | 'processing' | 'posted' | 'failed';
  provider: string;
  external_job_id?: string;
  created_at: string;
}
