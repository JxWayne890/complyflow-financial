import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // Supabase API URL - Env var exported by default.
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API ANON KEY - Env var exported by default.
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, name, company, org_id, audience_type } = await req.json()

    // Debug logging
    console.log(`Received invite request for: ${email}, org: ${org_id}`);

    if (!email || !name || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, name, org_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 1. Invite User (or get existing if already registered)
    console.log("Attempting to invite user with metadata...");
    const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
      data: { is_client: true, org_id: org_id }
    })

    let userId = inviteData.user?.id;

    if (inviteError) {
      console.error("Error inviting user:", inviteError);

      // Check if user already exists
      // Note: inviteUserByEmail throws error if user exists.
      // We try to find the user to link them.
      const { data: usersData, error: listError } = await supabaseClient.auth.admin.listUsers();

      if (listError) {
        console.error("Error listing users:", listError);
        throw new Error("Failed to list users to find existing one: " + listError.message);
      }

      const found = usersData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        userId = found.id;
        console.log("User already exists, use existing ID:", userId);
      } else {
        // Real error
        throw new Error("Invite failed and user not found: " + inviteError.message);
      }
    }

    if (!userId) {
      throw new Error("Failed to get User ID for client (User ID is null).");
    }

    console.log(`Proceeding with User ID: ${userId}`);

    // 2. Ensure Client Profile exists
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        org_id: org_id,
        role: 'client',
        name: name,
        email: email
      })

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // We can't proceed if we can't create a profile? 
      // Actually we can, but it's bad. Let's log and continue for now.
    }

    // 3. Create Client Record in `clients` table
    // Check if client record already exists for this org/email to avoid duplicates/errors
    const { data: existingClient } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('contact_email', email)
      .eq('org_id', org_id)
      .single();

    let clientData;
    let clientError;

    if (existingClient) {
      console.log("Client record already exists, updating...");
      const updateResult = await supabaseClient
        .from('clients')
        .update({
          name: name,
          company: company || '',
          audience_type: audience_type || 'general_public',
          status: 'active',
          linked_user_id: userId
        })
        .eq('id', existingClient.id) // Only update if same ID
        .select()
        .single();
      clientData = updateResult.data;
      clientError = updateResult.error;
    } else {
      console.log("Creating new client record...");
      const insertResult = await supabaseClient
        .from('clients')
        .insert([
          {
            org_id: org_id,
            name: name,
            contact_email: email,
            company: company || '',
            audience_type: audience_type || 'general_public',
            status: 'active', // Automatically active
            linked_user_id: userId
          }
        ])
        .select()
        .single();
      clientData = insertResult.data;
      clientError = insertResult.error;
    }

    if (clientError) {
      console.error("Database error creating/updating client:", clientError);
      throw new Error("Database error: " + clientError.message);
    }

    return new Response(
      JSON.stringify(clientData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )

  } catch (error) {
    console.error("Unexpected error in edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    )
  }
})
