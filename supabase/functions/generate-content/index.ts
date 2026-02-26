import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type Provider = "claude" | "kimi" | "gemini" | "chatgpt";
type ImageProvider = "gemini" | "chatgpt";
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

async function generateImageWithChatGPT(params: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      size: "1536x1024",
    }),
  });

  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `OpenAI API error: ${response.statusText}`);
  }

  const imagePayload = data?.data?.[0];
  const caption = (imagePayload?.revised_prompt || "Generated visual concept.").trim();
  const imageBase64 = imagePayload?.b64_json;
  const imageUrl = imagePayload?.url;

  if (!imageBase64 && !imageUrl) {
    return {
      html: `<p>${escapeHtml(caption)}</p>`,
      caption,
    };
  }

  const src = imageBase64 ? `data:image/png;base64,${imageBase64}` : imageUrl;
  const html = `<figure style="margin:0;">
  <img src="${src}" alt="${escapeHtml(caption)}" style="max-width:100%;height:auto;border-radius:12px;display:block;margin-bottom:12px;" />
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
      count = 1,
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
      count?: number;
    } = await req.json();

    const safeLength = (contentLength in lengthGuides ? contentLength : "Medium") as ContentLength;
    const lengthInstruction = lengthGuides[safeLength];

    if (provider === "gemini" || provider === "chatgpt") {
      const imageProvider: ImageProvider = provider === "chatgpt" ? "chatgpt" : "gemini";
      const imageModel = imageProvider === "chatgpt"
        ? Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1"
        : Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
      const imageApiKey = imageProvider === "chatgpt"
        ? Deno.env.get("OPENAI_API_KEY")
        : Deno.env.get("GEMINI_API_KEY");

      if (!imageApiKey) {
        throw new Error(
          imageProvider === "chatgpt"
            ? "Missing OPENAI_API_KEY secret."
            : "Missing GEMINI_API_KEY secret.",
        );
      }

      let imagePrompt = `Create a premium financial marketing visual for "${topic}".
Content type: ${contentType || "marketing visual"}.
Creative direction: ${instructions || "Clean, bold, high-contrast, professional financial aesthetic"}.
Output style: polished, trustworthy, modern.
Include no logos, no copyrighted trademarks, and no misleading claims in text.`;

      if (currentContent) {
        imagePrompt = `Based on the following financial article, create a highly relevant, premium marketing visual.
        
Article content:
"""
${currentContent.slice(0, 3000)}
"""

The visual should visually represent the key themes of this article for a ${contentType}.
Creative direction: ${instructions || "Clean, bold, high-contrast, professional financial aesthetic"}.
Style: Modern, financial advisor quality, trustworthy.
No text overlays unless essential. No logos. No faces if possible, focus on conceptual or high-end architectural/abstract financial themes.`;
      }

      // Generate multiple variations if count > 1
      const variationPromises = Array.from({ length: Math.min(count, 4) }).map((_, index) => {
        // Add slight variation to prompt to ensure distinct results if needed, 
        // though Gemini usually varies by default. We can tweak temperature or seed if API supported it fully.
        // For now, appending a variation instruction.
        const variationPrompt = `${imagePrompt}\n\nVariation ${index + 1}: ${index === 0 ? "Focus on broad conceptual themes." :
          index === 1 ? "Focus on detailed, realistic elements." :
            index === 2 ? "Use a more abstract, geometric style." :
              "Use a high-contrast, dramatic lighting style."
          }`;

        const generator = imageProvider === "chatgpt"
          ? generateImageWithChatGPT({
            apiKey: imageApiKey,
            model: imageModel,
            prompt: variationPrompt,
          })
          : generateImageWithGemini({
            apiKey: imageApiKey,
            model: imageModel,
            prompt: variationPrompt,
          });

        return generator.then(result => ({
          id: index,
          html: result.html,
          caption: result.caption,
        })).catch((e) => ({
          id: index,
          error: e.message,
        }));
      });

      const images = await Promise.all(variationPromises);
      const successfulImages = images.filter((img: any) => !img.error);

      if (successfulImages.length === 0) {
        throw new Error("Failed to generate any images.");
      }

      return new Response(
        JSON.stringify({
          data: {
            // For backward compatibility, return the first one as body/disclaimers
            title: `Visual Asset: ${topic}`,
            body: successfulImages[0].html,
            disclaimers: `Generated by ${imageProvider === "chatgpt" ? "ChatGPT Image" : "Gemini Image"} (${imageModel}). Investment content is for educational purposes only.`,
            // Return full array for client to select
            images: successfulImages,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let systemPrompt = legacyWealthStyle;
    let userContent = `Write a ${contentType} about ${topic}. \n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}

If the topic involves data, trends, asset allocation, or comparisons, you MUST append a JSON block to the very end of your response formatted exactly like this:
<script type="application/json" id="chart-data">
{"title": "Chart Title", "type": "bar", "dataLabel": "Metric 1 (e.g. 2023 Yield %)", "dataKey2": "value2", "dataLabel2": "Metric 2 (optional, e.g. 2024 Yield %)", "data": [{"name": "Category A", "value": 10, "value2": 15}, {"name": "Category B", "value": 20, "value2": 25}]}
</script>
If comparing two sets of metrics across categories, include dataKey2, dataLabel2, and value2. Otherwise, omit them. Do not put this script block inside markdown formatting. The type can be 'bar', 'line', or 'pie'.`;

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

    // Helper to generate a single text variation
    const generateVariation = async (index: number) => {
      let variationSystemPrompt = systemPrompt;
      let variationUserContent = userContent;

      // Add variation instructions if requesting multiple
      if (count > 1) {
        const variationInstruction =
          index === 0 ? "Focus on a balanced, standard professional approach." :
            index === 1 ? "Adopt a slightly more narrative, storytelling approach while maintaining authority." :
              index === 2 ? "Adopt a more analytical, data-focused structure." :
                "Focus on actionable key takeaways and practical application.";

        variationUserContent += `\n\nVARIATION INSTRUCTION: ${variationInstruction}`;
      }

      let text = "";
      if (textProvider === "kimi") {
        const nvidiaApiKey = Deno.env.get("NVIDIA_API_KEY");
        const kimiModel = Deno.env.get("KIMI_TEXT_MODEL") || "moonshotai/kimi-k2.5";
        if (!nvidiaApiKey) throw new Error("Missing NVIDIA_API_KEY secret.");

        text = await generateWithKimi({
          apiKey: nvidiaApiKey,
          model: kimiModel,
          systemPrompt: variationSystemPrompt,
          userContent: variationUserContent,
          maxTokens,
          temperature: action === "rewrite" ? 0.7 : 0.9, // Slightly higher temp for variations
          topP: 1.0,
        });
      } else {
        const claudeApiKey = Deno.env.get("ANTHROPIC_API_KEY");
        const claudeModel = Deno.env.get("CLAUDE_TEXT_MODEL") || "claude-sonnet-4-20250514";
        if (!claudeApiKey) throw new Error("Missing ANTHROPIC_API_KEY secret.");

        text = await generateWithClaude({
          apiKey: claudeApiKey,
          model: claudeModel,
          systemPrompt: variationSystemPrompt,
          userContent: variationUserContent,
          maxTokens,
          temperature: action === "rewrite" ? 0.6 : 1.0, // Higher temp for distinct variations
        });
      }
      return text;
    };

    // Generate multiple variations if count > 1
    const variationPromises = Array.from({ length: Math.min(count, 3) }).map((_, index) => {
      return generateVariation(index)
        .then(text => ({ id: index, text }))
        .catch(e => ({ id: index, error: e.message }));
    });

    const results = await Promise.all(variationPromises);
    const successfulResults = results.filter((r: any) => !r.error);

    if (successfulResults.length === 0) {
      throw new Error("Failed to generate any content.");
    }

    // Process results into title/body format
    const formattedResults = successfulResults.map((res: any) => {
      let rawText = res.text.trim();
      if (rawText.startsWith("```")) {
        // Strip the opening markdown tag
        rawText = rawText.replace(/^```[A-Za-z]*\n/i, "");
        // Strip the closing markdown tag
        rawText = rawText.replace(/\n```$/, "");
        rawText = rawText.trim();
      }

      const lines = rawText.split("\n");
      let title = lines[0]?.replace(/^#\s*/, "").replace(/\*\*/g, "").trim() || `Generated Content: ${topic}`;
      let body = lines.slice(1).join("\n").trim();
      if (!title || title.length < 5) {
        // Fallback if title is missing or empty
        title = `Deep Dive: ${topic}`;
      }

      const htmlBody = body.split("\n\n").map((block: string) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("###")) return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(/^###\s*/, "")}</h3>`;
        if (trimmed.startsWith("##")) return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(/^##\s*/, "")}</h2>`;
        if (trimmed.startsWith("#")) return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(/^#\s*/, "")}</h1>`;
        return `<p style="margin-bottom: 24px;">${trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`;
      }).join("\n");

      return {
        id: res.id,
        title,
        body: htmlBody || "<p>No content generated.</p>",
        disclaimers: `Generated by ${textProvider === 'kimi' ? 'Kimi K2.5' : 'Claude'}`,
      };
    });

    // If Rewrite mode, we just return the first one as raw text for now (handling extensions differently)
    if (action === "rewrite") {
      return new Response(
        JSON.stringify({
          data: {
            title: "",
            body: successfulResults[0].text,
            disclaimers: `Generated by ${textProvider === 'kimi' ? 'Kimi K2.5' : 'Claude'}`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        data: {
          // Backward compat
          title: formattedResults[0].title,
          body: formattedResults[0].body,
          disclaimers: formattedResults[0].disclaimers,
          // New options array
          options: formattedResults
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
