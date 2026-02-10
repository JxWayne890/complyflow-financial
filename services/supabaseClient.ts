import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Invoke the secure Supabase Edge Function for AI content generation
export const triggerContentGeneration = async (payload: {
  topic: string;
  contentType: string;
  instructions: string;
  provider?: 'claude' | 'gemini';
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
    console.error("Error invoking edge function:", error);
    throw error;
  }

  // Handle custom error returned with 200 OK status
  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
};

// Invoke the secure Supabase Edge Function for AI topic generation
export const triggerTopicGeneration = async (existingTopics: string[]) => {
  const { data, error } = await supabase.functions.invoke('generate-topics', {
    body: { existingTopics },
  });

  if (error) {
    console.error("Error invoking topic generation:", error);
    throw error;
  }

  if (data && data.error) {
    throw new Error(data.error);
  }

  return data;
};
