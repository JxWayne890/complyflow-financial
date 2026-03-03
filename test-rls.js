import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('content_requests')
    .insert({
      topic_text: 'Test Topic',
      content_type: 'blog',
      instructions: 'test',
      status: 'draft',
      advisor_id: '00000000-0000-0000-0000-000000000000',
      org_id: '00000000-0000-0000-0000-000000000000',
      client_id: null,
    })
    .select('id')
    .single();

  console.log("Insert Test Result:");
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
