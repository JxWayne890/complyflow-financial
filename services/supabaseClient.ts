import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const extractFunctionErrorMessage = async (error: any): Promise<string> => {
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
  provider?: 'claude' | 'kimi' | 'gemini';
  contentLength?: 'Short' | 'Medium' | 'Long';
  action?: 'generate' | 'extend' | 'rewrite';
  currentContent?: string;
  rewriteMode?: 'rewrite' | 'shorten' | 'expand' | 'fix_compliance';
  complianceNote?: string;
}) => {
  const { data, error } = await supabase.functions.invoke('generate-content', {
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
  const { data, error } = await supabase.functions.invoke('generate-topics', {
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
