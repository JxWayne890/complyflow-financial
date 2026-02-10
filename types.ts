export enum UserRole {
  ADMIN = 'admin',
  ADVISOR = 'advisor',
  COMPLIANCE = 'compliance'
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
  created_at: string;
}

export interface ComplianceReview {
  id: string;
  decision: 'approved' | 'changes_requested' | 'rejected';
  notes: string;
  reviewer_id: string;
  created_at: string;
}

export interface SocialVariant {
  id: string;
  platform: string;
  content: string;
  hashtags: string;
}

export type Notification = {
  id: string;
  message: string;
  date: string;
  read: boolean;
};
