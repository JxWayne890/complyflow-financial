import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

const publicEdgeFunctionClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
});

const isJwtAuthError = (error: any) => {
  const text = [
    error?.message,
    error?.error_description,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('invalid jwt') ||
    text.includes('jwt expired') ||
    text.includes('expired jwt') ||
    text.includes('invalid claim') ||
    text.includes('bad_jwt')
  );
};

const refreshCurrentSession = async () => {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }
  return data.session;
};

export const ensureFreshSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt - now < 60) {
    return refreshCurrentSession();
  }

  const { error: validationError } = await supabase.auth.getUser();
  if (validationError) {
    if (isJwtAuthError(validationError)) {
      return refreshCurrentSession();
    }

    console.error('Failed to validate current session:', validationError);
  }

  return session;
};

export const ensureSignedInSession = async () => {
  const session = await ensureFreshSession();
  if (!session?.user) {
    throw new Error('Your session expired. Please sign in again.');
  }
  return session;
};

export const extractFunctionErrorMessage = async (error: any): Promise<string> => {
  if (!error) return 'Unknown function error';

  const response = error?.context;
  if (response) {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
      try {
        const text = await response.clone().text();
        if (text) return text;
      } catch {
        // ignore secondary parse errors
      }
    }
  }

  return error.message || 'Unknown function error';
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Invoke the secure Supabase Edge Function for AI content generation
export const triggerContentGeneration = async (payload: {
  topic: string;
  contentType: string;
  instructions: string;
  provider?: 'claude' | 'kimi' | 'gemini' | 'chatgpt';
  contentLength?: 'Short' | 'Medium' | 'Long';
  action?: 'generate' | 'extend' | 'rewrite';
  currentContent?: string;
  rewriteMode?: 'rewrite' | 'shorten' | 'expand' | 'fix_compliance';
  complianceNote?: string;
  count?: number;
  orgId?: string;
  requestId?: string;
  sourceUrls?: string[];
  clientContext?: {
    writing_style?: string;
    brand_tone?: string;
    business_description?: string;
    audience_type?: string;
  };
}) => {
  const { data, error } = await publicEdgeFunctionClient.functions.invoke('generate-content', {
    body: payload,
  });

  if (error) {
    console.error("Error invoking content generation:", error);
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
};

// Invoke the secure Supabase Edge Function for AI topic generation
export const triggerTopicGeneration = async (
  existingTopics: string[],
  provider: 'claude' | 'kimi' = 'claude',
) => {
  const { data, error } = await publicEdgeFunctionClient.functions.invoke('generate-topics', {
    body: { existingTopics, provider },
  });

  if (error) {
    console.error("Error invoking topic generation:", error);
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
};

// ── In-app Notifications ─────────────────────────────────────────────

export const fetchNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return data ?? [];
};

export const markNotificationRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) console.error('Error marking notification read:', error);
};

export const markAllNotificationsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) console.error('Error marking all notifications read:', error);
};

export const insertNotification = async (payload: {
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) => {
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) console.error('Error inserting notification:', error);
};

// ── Email Notifications ──────────────────────────────────────────────

export const triggerSocialPost = async (payload: {
  request_id: string;
  org_id: string;
  platform: string;
  content_text: string;
  image_url?: string;
  client_id: string;
}) => {
  await ensureFreshSession();
  const { data, error } = await supabase.functions.invoke('post-to-social', {
    body: payload,
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data;
};

export const triggerVideoGeneration = async (payload: {
  request_id: string;
  org_id: string;
  script_text: string;
  avatar_id?: string;
  voice_id?: string;
}) => {
  await ensureFreshSession();
  const { data, error } = await supabase.functions.invoke('generate-video', {
    body: payload,
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data;
};

export const triggerReviewNotification = async (payload: {
  request_id: string;
  org_id: string;
}) => {
  await ensureFreshSession();
  const { data, error } = await supabase.functions.invoke('notify-review', {
    body: payload,
  });

  if (error) {
    console.error('Error invoking review notification:', error);
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};
