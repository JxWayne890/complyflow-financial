import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = 're_ey7CnNpe_qR5kz8e4JZFL7shQd3zR1zhZ';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { request_id, org_id } = await req.json();

    if (!request_id || !org_id) {
      return new Response(JSON.stringify({ error: 'Missing request_id or org_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // We need service role to query profiles (other users)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check if organization has enabled review emails
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('enable_review_emails, name')
      .eq('id', org_id)
      .single();

    if (orgError) {
      console.error('Error fetching org:', orgError);
      throw new Error('Failed to fetch organization settings');
    }

    if (!orgData?.enable_review_emails) {
      return new Response(JSON.stringify({ message: 'Review emails disabled for this org.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get the content request details (title, topic)
    const { data: requestData, error: requestError } = await supabase
      .from('content_requests')
      .select('topic_text, advisor_id')
      .eq('id', request_id)
      .single();

    if (requestError) throw requestError;

    // Get advisor name
    const { data: advisor, error: advError } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', requestData.advisor_id)
      .single();

    const advisorName = advisor?.name || 'An advisor';

    // 3. Get all compliance team members for this org
    const { data: complianceUsers, error: compError } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('org_id', org_id)
      .eq('role', 'compliance');

    if (compError) throw compError;

    if (!complianceUsers || complianceUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No compliance users found in this org.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientEmails = complianceUsers.map(u => u.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'Compliance users have no valid emails.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'ComplyFlow Notifications <onboarding@resend.dev>',
        to: recipientEmails, // Array of emails
        subject: `Review Required: New Content from ${advisorName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #0f172a;">Content ready for review!</h2>
            <p><strong>${advisorName}</strong> has submitted new content for compliance review.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0; font-weight: bold; color: #475569;">Topic:</p>
              <p style="margin: 5px 0 0 0; color: #0f172a;">${requestData.topic_text || 'Untitled Content'}</p>
            </div>
            <p>Please log in to ComplyFlow to review this content and leave compliance notes.</p>
            <a href="http://localhost:3000/#/content/${request_id}" style="display: inline-block; background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">Review Content Now</a>
          </div>
        `,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend Error:', resendData);
      throw new Error(`Resend failed: ${resendData.message || JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true, count: recipientEmails.length, data: resendData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in notify-review:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
