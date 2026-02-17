import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Role = "admin" | "advisor" | "compliance";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: advisorProfile, error: advisorError } = await supabase
      .from("profiles")
      .select("id, org_id, role")
      .in("role", ["advisor", "admin"] as Role[])
      .limit(1)
      .maybeSingle();

    if (advisorError) throw advisorError;
    if (!advisorProfile?.id || !advisorProfile?.org_id) {
      throw new Error("No advisor/admin profile found for smoke test.");
    }

    const { data: complianceProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", advisorProfile.org_id)
      .eq("role", "compliance")
      .limit(1)
      .maybeSingle();

    const reviewerId = complianceProfile?.id || advisorProfile.id;
    const marker = `[SMOKE ${new Date().toISOString()}]`;

    const { data: requestRow, error: requestError } = await supabase
      .from("content_requests")
      .insert({
        org_id: advisorProfile.org_id,
        advisor_id: advisorProfile.id,
        topic_text: `${marker} Save workflow verification`,
        content_type: "blog",
        instructions: "Smoke test insert from edge function.",
        status: "draft",
      })
      .select("id, status, org_id, advisor_id, topic_text, created_at")
      .single();

    if (requestError) throw requestError;

    const { data: versionRow, error: versionError } = await supabase
      .from("content_versions")
      .insert({
        request_id: requestRow.id,
        version_number: 1,
        generated_by: "ai",
        title: "Smoke Test Title",
        body: "<p>Smoke test body content</p>",
        disclaimers: "Smoke test disclaimer",
      })
      .select("id, request_id, version_number, generated_by, title, created_at")
      .single();

    if (versionError) throw versionError;

    const { error: requestUpdateError } = await supabase
      .from("content_requests")
      .update({
        current_version_id: versionRow.id,
        status: "in_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestRow.id);

    if (requestUpdateError) throw requestUpdateError;

    const { data: reviewRow, error: reviewError } = await supabase
      .from("compliance_reviews")
      .insert({
        request_id: requestRow.id,
        reviewer_id: reviewerId,
        decision: "changes_requested",
        notes: "Smoke test compliance review.",
      })
      .select("id, request_id, reviewer_id, decision, created_at")
      .single();

    if (reviewError) throw reviewError;

    const { data: verifyRequest, error: verifyRequestError } = await supabase
      .from("content_requests")
      .select("id, status, current_version_id, topic_text, updated_at")
      .eq("id", requestRow.id)
      .single();
    if (verifyRequestError) throw verifyRequestError;

    const { data: verifyVersions, error: verifyVersionError } = await supabase
      .from("content_versions")
      .select("id")
      .eq("request_id", requestRow.id);
    if (verifyVersionError) throw verifyVersionError;

    const { data: verifyReviews, error: verifyReviewError } = await supabase
      .from("compliance_reviews")
      .select("id")
      .eq("request_id", requestRow.id);
    if (verifyReviewError) throw verifyReviewError;

    return new Response(
      JSON.stringify(
        {
          ok: true,
          summary: "Save workflow write/read test passed.",
          request: verifyRequest,
          version_count: verifyVersions?.length ?? 0,
          review_count: verifyReviews?.length ?? 0,
          inserted_ids: {
            request_id: requestRow.id,
            version_id: versionRow.id,
            review_id: reviewRow.id,
          },
        },
        null,
        2,
      ),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("workflow-smoke-test error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Smoke test failed." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
