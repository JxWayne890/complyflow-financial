import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const {
      request_id,
      org_id,
      platform,
      content_text,
      image_url,
      client_id,
    }: {
      request_id: string;
      org_id: string;
      platform: string;
      content_text: string;
      image_url?: string;
      client_id: string;
    } = await req.json();

    if (!request_id || !platform || !content_text || !client_id) {
      throw new Error("Missing required fields: request_id, platform, content_text, client_id");
    }

    const { data: socialAccount, error: saError } = await supabaseAdmin
      .from("client_social_accounts")
      .select("blotato_connection_id")
      .eq("client_id", client_id)
      .eq("platform", platform)
      .single();

    if (saError || !socialAccount?.blotato_connection_id) {
      throw new Error(`No Blotato connection found for client ${client_id} on ${platform}`);
    }

    const blotatoApiKey = Deno.env.get("BLOTATO_API_KEY");
    if (!blotatoApiKey) {
      throw new Error("Missing BLOTATO_API_KEY secret.");
    }

    const postBody: Record<string, any> = {
      accountId: socialAccount.blotato_connection_id,
      platform,
      text: content_text,
    };

    if (image_url) {
      postBody.mediaUrls = [image_url];
    }

    const blotatoResponse = await fetch("https://api.blotato.com/v1/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${blotatoApiKey}`,
      },
      body: JSON.stringify(postBody),
    });

    const blotatoResult = await blotatoResponse.json();

    if (!blotatoResponse.ok) {
      const { error: insertError } = await supabaseAdmin
        .from("posting_jobs")
        .insert({
          request_id,
          platform,
          status: "failed",
          provider: "blotato",
          external_job_id: null,
        });
      if (insertError) console.error("Failed to insert posting_job:", insertError);

      throw new Error(blotatoResult?.error || blotatoResult?.message || `Blotato API error: ${blotatoResponse.status}`);
    }

    const externalJobId = blotatoResult?.postSubmissionId || blotatoResult?.id || null;

    const { error: insertError } = await supabaseAdmin
      .from("posting_jobs")
      .insert({
        request_id,
        platform,
        status: "pending",
        provider: "blotato",
        external_job_id: externalJobId,
      });

    if (insertError) {
      console.error("Failed to insert posting_job:", insertError);
    }

    await supabaseAdmin
      .from("content_requests")
      .update({ status: "posted" })
      .eq("id", request_id);

    return new Response(
      JSON.stringify({
        data: {
          status: "posted",
          external_job_id: externalJobId,
          platform,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Post to social error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Social posting failed" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
