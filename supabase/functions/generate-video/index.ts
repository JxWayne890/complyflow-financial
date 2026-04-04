import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      request_id,
      org_id,
      script_text,
      avatar_id,
      voice_id,
    }: {
      request_id: string;
      org_id: string;
      script_text: string;
      avatar_id?: string;
      voice_id?: string;
    } = await req.json();

    const heygenApiKey = Deno.env.get("HEYGEN_API_KEY");
    if (!heygenApiKey) {
      throw new Error("Missing HEYGEN_API_KEY secret. Video generation is not yet configured.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // TODO: Call HeyGen API v2 to create a video
    // POST https://api.heygen.com/v2/video/generate
    // Headers: { "X-Api-Key": heygenApiKey, "Content-Type": "application/json" }
    // Body: { video_inputs: [{ character: { type: "avatar", avatar_id }, voice: { type: "text", input_text: script_text, voice_id }, background: { type: "color", value: "#FFFFFF" } }], dimension: { width: 1920, height: 1080 } }
    //
    // Response includes a video_id for polling status
    // Poll: GET https://api.heygen.com/v1/video_status.get?video_id=...
    // When status === "completed", get the video_url

    const { data: asset, error: assetError } = await supabaseAdmin
      .from('assets')
      .insert({
        request_id,
        asset_type: 'video',
        provider: 'heygen',
        url: null,
        metadata: {
          status: 'pending_api_key',
          avatar_id: avatar_id || 'default',
          voice_id: voice_id || 'default',
          script_length: script_text.length,
        },
      })
      .select()
      .single();

    if (assetError) throw assetError;

    return new Response(
      JSON.stringify({
        data: {
          asset_id: asset.id,
          status: 'pending_api_key',
          message: 'HeyGen integration is configured but awaiting API key. Set HEYGEN_API_KEY in Supabase secrets to activate.',
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Video generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Video generation failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
