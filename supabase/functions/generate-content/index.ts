import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Provider = "claude" | "kimi" | "gemini";
type ContentLength = "Short" | "Medium" | "Long";
type Action = "generate" | "extend" | "rewrite";
type RewriteMode = "rewrite" | "shorten" | "expand" | "fix_compliance";

const lengthGuides: Record<ContentLength, string> = {
  Short: "Length: Concise, around 300-500 words.",
  Medium: "Length: Balanced, around 600-1000 words.",
  Long: "Length: Comprehensive deep-dive, around 1200+ words.",
};

const maxTokensMap: Record<ContentLength, number> = {
  Short: 2048,
  Medium: 4096,
  Long: 8192,
};

const legacyWealthStyle = `
You are a senior wealth advisor at Legacy Wealth Management (like Lincoln West or Andy Rad).
Tone: Professional, educational, authoritative, yet accessible. NOT salesy.
Formatting:
- Use clear, bold headers.
- DO NOT use bullet points with dashes/hyphens. Use cohesive paragraphs or numbered lists if absolutely necessary.
- Write in a flowing, human narrative.
- No "AI-isms" (e.g., avoid "In conclusion", "Delve", "In the dynamic world of", "Tapestry").
- Focus on wealth preservation, endowments, and alternative investments.
`;

const posterStyle = `
You are a creative director for a high-end financial firm.
Task: Describe a "Poster Style" visual asset or video script.
Style: Clean, bold font, high contrast, professional financial aesthetic.
Output: Provide a detailed visual description or script. Do not output markdown code blocks unless it's a script.
`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

async function generateWithClaude(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userContent }],
    }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Claude API error: ${response.statusText}`);
  }

  const text = (data.content || [])
    .filter((part: any) => part?.type === "text")
    .map((part: any) => part.text || "")
    .join("\n")
    .trim();

  return text;
}

async function generateWithKimi(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
  topP: number;
}) {
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userContent },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      top_p: params.topP,
      stream: false,
    }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Kimi API error: ${response.statusText}`);
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Kimi API returned empty content.");
  }

  return text;
}

async function generateImageWithGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Gemini API error: ${response.statusText}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part?.inlineData?.data);
  const textPart = parts.find((part: any) => typeof part?.text === "string");
  const caption = (textPart?.text || "Generated visual concept.").trim();

  if (!imagePart?.inlineData?.data) {
    return {
      html: `<p>${escapeHtml(caption)}</p>`,
      caption,
    };
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  const html = `<figure style="margin:0;">
  <img src="data:${mimeType};base64,${imagePart.inlineData.data}" alt="${escapeHtml(caption)}" style="max-width:100%;height:auto;border-radius:12px;display:block;margin-bottom:12px;" />
  <figcaption style="font-size:14px;color:#64748b;">${escapeHtml(caption)}</figcaption>
</figure>`;

  return { html, caption };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      topic,
      contentType,
      instructions,
      provider = "claude",
      contentLength = "Medium",
      action = "generate",
      currentContent = "",
      rewriteMode = "rewrite",
      complianceNote = "",
    }: {
      topic: string;
      contentType: string;
      instructions: string;
      provider?: Provider;
      contentLength?: ContentLength;
      action?: Action;
      currentContent?: string;
      rewriteMode?: RewriteMode;
      complianceNote?: string;
    } = await req.json();

    const safeLength = (contentLength in lengthGuides ? contentLength : "Medium") as ContentLength;
    const lengthInstruction = lengthGuides[safeLength];

    if (provider === "gemini") {
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      const geminiImageModel = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
      if (!geminiApiKey) {
        throw new Error("Missing GEMINI_API_KEY secret.");
      }

      const imagePrompt = `Create a premium financial marketing visual for "${topic}".
Content type: ${contentType || "marketing visual"}.
Creative direction: ${instructions || "Clean, bold, high-contrast, professional financial aesthetic"}.
Output style: polished, trustworthy, modern.
Include no logos, no copyrighted trademarks, and no misleading claims in text.`;

      const imageResult = await generateImageWithGemini({
        apiKey: geminiApiKey,
        model: geminiImageModel,
        prompt: imagePrompt,
      });

      return new Response(
        JSON.stringify({
          data: {
            title: `Visual Asset: ${topic}`,
            body: imageResult.html,
            disclaimers: `Generated by Gemini (${geminiImageModel}). Investment content is for educational purposes only.`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let systemPrompt = legacyWealthStyle;
    let userContent = `Write a ${contentType} about ${topic}. \n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}`;

    if (
      contentType &&
      (contentType.toLowerCase().includes("video") ||
        contentType.toLowerCase().includes("ad"))
    ) {
      systemPrompt = posterStyle;
      userContent = `Create a visual description or video script for: ${topic}. \n\nContext: ${instructions}`;
    }

    if (action === "extend") {
      userContent = `
You are rewriting and expanding an existing draft.
Current Draft:
"""
${currentContent}
"""

Task:
1. Keep the core message and tone of the original draft.
2. Significantly expand the content (make it at least 50% longer).
3. Add more depth, examples, and educational value to key points.
4. Maintain the "Legacy Wealth" style (authoritative, educational, no salesy language).
5. Ensure the new length aligns with: ${lengthInstruction}

Return the FULL expanded article.
`;
    }

    if (action === "rewrite") {
      const modePrompts: Record<RewriteMode, string> = {
        rewrite: "Rephrase and rewrite the following passage while keeping the same meaning, tone, and style.",
        shorten: "Make the following passage significantly more concise without losing key information.",
        expand: "Expand the following passage with more depth and educational detail.",
        fix_compliance: `Rewrite the following passage to address this compliance concern: "${complianceNote}". Ensure it is fully SEC/FINRA compliant. Do not use promissory language or guarantees.`,
      };
      userContent = `
${modePrompts[rewriteMode]}
Passage to rewrite:
"""
${currentContent}
"""
IMPORTANT: Return ONLY the rewritten passage.
`;
    }

    const textProvider = provider === "kimi" ? "kimi" : "claude";
    const maxTokens = action === "rewrite" ? 2048 : maxTokensMap[safeLength];

    let generatedText = "";
    let providerName = "";
    let providerModel = "";

    if (textProvider === "kimi") {
      const nvidiaApiKey = Deno.env.get("NVIDIA_API_KEY");
      const kimiModel = Deno.env.get("KIMI_TEXT_MODEL") || "moonshotai/kimi-k2.5";
      if (!nvidiaApiKey) {
        throw new Error("Missing NVIDIA_API_KEY secret.");
      }

      generatedText = await generateWithKimi({
        apiKey: nvidiaApiKey,
        model: kimiModel,
        systemPrompt,
        userContent,
        maxTokens,
        temperature: action === "rewrite" ? 0.7 : 1.0,
        topP: 1.0,
      });

      providerName = "Kimi K2.5";
      providerModel = kimiModel;
    } else {
      const claudeApiKey = Deno.env.get("ANTHROPIC_API_KEY");
      const claudeModel = Deno.env.get("CLAUDE_TEXT_MODEL") || "claude-sonnet-4-20250514";
      if (!claudeApiKey) {
        throw new Error("Missing ANTHROPIC_API_KEY secret.");
      }

      generatedText = await generateWithClaude({
        apiKey: claudeApiKey,
        model: claudeModel,
        systemPrompt,
        userContent,
        maxTokens,
        temperature: action === "rewrite" ? 0.6 : 0.9,
      });

      providerName = "Claude";
      providerModel = claudeModel;
    }

    if (action === "rewrite") {
      return new Response(
        JSON.stringify({
          data: {
            title: "",
            body: generatedText,
            disclaimers: `Generated by ${providerName} (${providerModel}). Investment content is for educational purposes only.`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lines = generatedText.split("\n");
    let title =
      lines[0]?.replace(/^#\s*/, "").replace(/\*\*/g, "").trim() || `Generated Content: ${topic}`;
    let body = lines.slice(1).join("\n").trim();

    if (!title || title.length < 5) title = `Deep Dive: ${topic}`;

    const htmlBody = body
      .split("\n\n")
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("###"))
          return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(
            /^###\s*/,
            "",
          )}</h3>`;
        if (trimmed.startsWith("##"))
          return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(
            /^##\s*/,
            "",
          )}</h2>`;
        if (trimmed.startsWith("#"))
          return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(
            /^#\s*/,
            "",
          )}</h1>`;
        const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return `<p style="margin-bottom: 24px;">${formatted}</p>`;
      })
      .join("\n");

    return new Response(
      JSON.stringify({
        data: {
          title,
          body: htmlBody || "<p>No content generated.</p>",
          disclaimers: `Generated by ${providerName} (${providerModel}). Investment content is for educational purposes only.`,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Edge Function Error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
