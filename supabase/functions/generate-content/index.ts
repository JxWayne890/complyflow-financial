import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

type Provider = "claude" | "kimi" | "gemini" | "chatgpt";
type ImageProvider = "gemini" | "chatgpt";
type ContentLength = "Short" | "Medium" | "Long";
type Action = "generate" | "extend" | "rewrite";
type RewriteMode = "rewrite" | "shorten" | "expand" | "fix_compliance";

type RetrievedChunk = {
  id: string;
  source_id: string;
  title: string;
  source_type: string;
  canonical_url?: string | null;
  document_name?: string | null;
  page_number?: number | null;
  section_heading?: string | null;
  published_date?: string | null;
  chunk_text: string;
  chunk_index: number;
  authority_score?: number | null;
  retrieval_score: number;
};

type CitationRecord = {
  marker: string;
  source_id: string;
  title: string;
  url?: string | null;
  page?: number | null;
  section?: string | null;
  quoted_span: string;
  chunk_index: number;
  source_type: string;
  document_name?: string | null;
  published_date?: string | null;
  authority_score?: number | null;
};

type SourceRecord = {
  source_id: string;
  title: string;
  url?: string | null;
  source_type: string;
};

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

const legacyWealthBlogStyle = `
You are a senior wealth advisor at Legacy Wealth Management writing a premium blog article.
Tone: Professional, educational, authoritative, yet accessible. NOT salesy.

IMPORTANT OUTPUT FORMAT:
Write your blog as clean markdown. Do NOT use any structured markers, tags, or HTML.

# Blog Title Here

*A short subtitle or hook sentence in italics.*

## First Section Heading

Write 2-4 paragraphs of flowing narrative. Use **bold** for key terms.

Separate each paragraph with a blank line.

## Second Section Heading

More flowing content here...

## Continue with 3-5 sections total

More content as needed...

Rules:
- Start with # for the main title (one title only).
- Use ## for each section heading.
- Use **bold** for emphasis within paragraphs.
- Write in a flowing, human narrative. No AI-isms (avoid "In conclusion", "Delve", "Tapestry").
- Structure the article so it reads naturally with an opening section, then an interior visual, then more body copy, then a mid-article chart, then closing body text.
- Any factual claim, statistic, return reference, market observation, tax statement, legal statement, or regulatory statement must include an inline citation in plain text, such as "(Source: Federal Reserve, 2025)".
- End every blog with a final "## Sources" section that lists every cited source actually used in the article.
- If you include a chart JSON block, the "## Sources" section must appear immediately before the chart JSON block so it remains the last section of the readable article.
- In the "## Sources" section, put each source in its own paragraph and use markdown links when possible, for example: [Federal Reserve - Beige Book](https://www.federalreserve.gov/monetarypolicy/beigebook.htm)
- Prefer primary and authoritative sources such as the Federal Reserve, SEC, FINRA, IRS, BLS, BEA, Treasury, Census, OECD, IMF, World Bank, company filings, and major fund or index providers.
- If you cannot support a claim with a reputable source, remove the claim.
- DO NOT use bullet points with dashes/hyphens in the article body.
- DO NOT include disclaimers, stats blocks, or legal text.
- DO NOT include category labels, read time, or any metadata.
- DO NOT use any ---MARKER--- tags.
- Include at least 3-5 ## section headings.
- Separate every paragraph and heading with a blank line.
- Focus on wealth preservation, endowments, and alternative investments.
`;

const posterStyle = `
You are a creative director for a high-end financial firm.
Task: Describe a "Poster Style" visual asset or video script.
Style: Clean, bold font, high contrast, professional financial aesthetic.
Output: Provide a detailed visual description or script. Do not output markdown code blocks unless it's a script.
`;

const meritVideoStyle = `
You are a financial advisor creating an educational YouTube video script.
Tone: Conversational, reassuring, slightly informal but highly educational and trustworthy.
Structure:
1. **Title**: Start with a compelling, SEO-friendly video title on the first line.
2. **Hook**: Hook the viewer immediately ("In today's video we're going to talk about...").
3. **Lessons**: Break the topic down into clear, numbered lessons or mistakes.
4. **Outro**: End the script exactly with: "Thanks for watching and always remember you don't need more money, you need a better plan. Look forward to seeing you in the next video."

**MANDATORY FORMATTING**: 
- Start every major section or paragraph with a timestamp in brackets like [00:00].
- Use the format: [MM:SS] Followed by the spoken content.
- Do not use markdown code blocks.
`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatInlineMarkdown = (text: string) =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(\d+)\]/g, '<a href="#" data-cf-citation-marker="[$1]" style="color:#1d4ed8;text-decoration:none;font-weight:700;">[$1]</a>');

const extractBlogSourcesMarkdown = (markdownBody: string) => {
  const match = /(^|\n)(##\s+Sources\b[^\n]*)([\s\S]*)/i.exec(markdownBody);
  if (!match || typeof match.index !== "number") {
    return {
      articleMarkdown: markdownBody.trim(),
      sourcesMarkdown: "",
    };
  }

  const headingStart = match.index + (match[1] ? match[1].length : 0);
  const afterHeading = markdownBody.slice(headingStart + match[2].length);
  const nextHeading = /\n##\s+/i.exec(afterHeading);
  const sourcesEnd = nextHeading
    ? headingStart + match[2].length + nextHeading.index
    : markdownBody.length;

  const sourcesMarkdown = markdownBody.slice(headingStart, sourcesEnd).trim();
  const articleMarkdown = `${markdownBody.slice(0, headingStart).trim()}\n\n${markdownBody.slice(sourcesEnd).trim()}`
    .trim()
    .replace(/\n{3,}/g, "\n\n");

  return { articleMarkdown, sourcesMarkdown };
};

const buildBlogSourcesSectionHtml = (params: {
  markdownBody: string;
  sourcesMarkdown: string;
}) => {
  let sourceEntries: string[] = [];

  if (params.sourcesMarkdown) {
    sourceEntries = params.sourcesMarkdown
      .replace(/^##\s+Sources\b[^\n]*/i, "")
      .trim()
      .split(/\n\s*\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (sourceEntries.length === 0) {
  const cited = new Set<string>();
  const citationRegex = /\((?:Source|Sources)\s*:\s*([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(params.markdownBody)) !== null) {
    const text = (match[1] || '').trim();
    if (text) cited.add(text);
  }
    sourceEntries = Array.from(cited);
  }

  const sourcesHtml = sourceEntries.length > 0
    ? sourceEntries
      .map((entry) => `<p style="margin-bottom: 14px; line-height: 1.8; color: #334155;">${formatInlineMarkdown(entry)}</p>`)
      .join('\n')
    : `<p style="margin-bottom: 14px; line-height: 1.8; color: #334155;">Sources were not provided. Please add a \\\"## Sources\\\" section listing the references used.</p>`;

  return `<h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-top: 40px; margin-bottom: 16px;">Sources</h2>\n${sourcesHtml}`;
};

const SOURCE_MARKER_PREFIX = "src_";

const normalizeText = (value: string) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractQueryTerms = (query: string) => {
  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "about", "have", "has", "are", "was",
    "were", "will", "should", "would", "could", "there", "their", "than", "then", "also", "when", "where", "which",
    "what", "why", "how", "can", "not", "use", "using", "into", "over", "under", "after", "before", "between",
  ]);

  return normalizeText(query)
    .split(" ")
    .filter((term) => term.length >= 3 && !stopWords.has(term))
    .slice(0, 24);
};

const officialDomainBoost = (url?: string | null) => {
  if (!url) return 0;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host.endsWith(".gov") ||
      host.endsWith(".mil") ||
      host.includes("sec.gov") ||
      host.includes("finra.org") ||
      host.includes("irs.gov") ||
      host.includes("federalreserve.gov") ||
      host.includes("treasury.gov") ||
      host.includes("bls.gov") ||
      host.includes("bea.gov")
    ) {
      return 2.5;
    }
    if (host.endsWith(".edu")) return 1.2;
    return 0;
  } catch {
    return 0;
  }
};

const sourceTypeBoost = (sourceType: string) => {
  const value = (sourceType || "").toLowerCase();
  if (["regulatory", "government", "legal", "carrier_policy", "official_web", "filing", "statute"].includes(value)) {
    return 2;
  }
  if (["pdf", "document", "uploaded_document", "stored_chunk"].includes(value)) {
    return 1;
  }
  return 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeRetrievalScore = (chunk: Omit<RetrievedChunk, "retrieval_score">, queryTerms: string[]) => {
  const haystack = normalizeText(`${chunk.title} ${chunk.section_heading || ""} ${chunk.chunk_text}`);
  const titleHaystack = normalizeText(chunk.title || "");
  const sectionHaystack = normalizeText(chunk.section_heading || "");

  let lexical = 0;
  for (const term of queryTerms) {
    if (titleHaystack.includes(term)) lexical += 2.5;
    if (sectionHaystack.includes(term)) lexical += 1.5;
    if (haystack.includes(term)) lexical += 1;
  }

  const authority = typeof chunk.authority_score === "number"
    ? clamp(chunk.authority_score / 25, 0, 2)
    : 0;

  return lexical + authority + sourceTypeBoost(chunk.source_type) + officialDomainBoost(chunk.canonical_url);
};

const dedupeChunks = (chunks: RetrievedChunk[]) => {
  const seen = new Set<string>();
  const deduped: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const normalizedBody = normalizeText(chunk.chunk_text).slice(0, 320);
    const dedupeKey = `${chunk.source_id}:${chunk.chunk_index}:${normalizedBody}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(chunk);
  }

  return deduped;
};

const makeSourceIdFromUrl = (url: string, index: number) => {
  const encoded = btoa(url).replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  return `${SOURCE_MARKER_PREFIX}web_${index}_${encoded || "source"}`;
};

const chunkLongText = (text: string, maxChars = 900, overlap = 120) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const out: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + maxChars);
    const slice = normalized.slice(cursor, end).trim();
    if (slice) out.push(slice);
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return out;
};

const fetchOfficialWebChunks = async (urls: string[], queryTerms: string[]) => {
  const chunks: RetrievedChunk[] = [];
  const safeUrls = urls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 6);

  for (let i = 0; i < safeUrls.length; i++) {
    const url = safeUrls[i];
    let hostname = "";
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }

    if (
      !hostname.endsWith(".gov") &&
      !hostname.endsWith(".mil") &&
      !hostname.endsWith(".edu") &&
      !hostname.includes("sec.gov") &&
      !hostname.includes("finra.org") &&
      !hostname.includes("irs.gov")
    ) {
      continue;
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "ComplyFlowGroundedRetriever/1.0",
        },
      });
      if (!response.ok) continue;

      const html = await response.text();
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || hostname;
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 28000);

      const parts = chunkLongText(text, 900, 120);
      const sourceId = makeSourceIdFromUrl(url, i);
      for (let index = 0; index < parts.length; index++) {
        const base: Omit<RetrievedChunk, "retrieval_score"> = {
          id: `${sourceId}_${index}`,
          source_id: sourceId,
          title,
          source_type: "official_web",
          canonical_url: url,
          document_name: null,
          page_number: null,
          section_heading: null,
          published_date: null,
          chunk_text: parts[index],
          chunk_index: index,
          authority_score: 0.8,
        };

        chunks.push({
          ...base,
          retrieval_score: computeRetrievalScore(base, queryTerms),
        });
      }
    } catch {
      // Ignore individual fetch failures and continue retrieval.
    }
  }

  return chunks;
};

const retrieveGroundingChunks = async (params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  orgId: string;
  topic: string;
  instructions: string;
  currentContent: string;
  sourceUrls?: string[];
}) => {
  const query = `${params.topic}\n${params.instructions || ""}\n${(params.currentContent || "").slice(0, 1200)}`.trim();
  const queryTerms = extractQueryTerms(query);

  const { data: storedChunks, error } = await params.supabaseAdmin
    .from("citation_source_chunks")
    .select("id, source_id, title, source_type, canonical_url, document_name, page_number, section_heading, published_date, chunk_text, chunk_index, authority_score")
    .eq("org_id", params.orgId)
    .eq("is_active", true)
    .limit(450);

  if (error) {
    throw new Error(`Failed to retrieve source chunks: ${error.message}`);
  }

  const scoredStored = (storedChunks || []).map((row: any) => {
    const base: Omit<RetrievedChunk, "retrieval_score"> = {
      id: row.id,
      source_id: row.source_id,
      title: row.title,
      source_type: row.source_type,
      canonical_url: row.canonical_url,
      document_name: row.document_name,
      page_number: row.page_number,
      section_heading: row.section_heading,
      published_date: row.published_date,
      chunk_text: row.chunk_text,
      chunk_index: row.chunk_index,
      authority_score: row.authority_score,
    };
    return {
      ...base,
      retrieval_score: computeRetrievalScore(base, queryTerms),
    };
  });

  const webChunks = await fetchOfficialWebChunks(params.sourceUrls || [], queryTerms);
  const merged = dedupeChunks([...scoredStored, ...webChunks])
    .sort((a, b) => b.retrieval_score - a.retrieval_score);

  const topChunks = merged.slice(0, 14);
  const strongestScore = topChunks[0]?.retrieval_score || 0;
  const hasStrongGrounding = topChunks.length >= 2 && strongestScore >= 2.5;

  return {
    query,
    chunks: topChunks,
    hasStrongGrounding,
  };
};

const parseLooseJson = (raw: string) => {
  let candidate = raw.trim();
  if (candidate.startsWith("```")) {
    candidate = candidate.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n```$/, "").trim();
  }
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(candidate);
};

const buildGroundingContextForPrompt = (chunks: RetrievedChunk[]) => {
  return chunks.map((chunk, idx) => {
    const marker = `${idx + 1}`.padStart(2, "0");
    return [
      `ChunkRef: ${marker}`,
      `source_id: ${chunk.source_id}`,
      `chunk_index: ${chunk.chunk_index}`,
      `title: ${chunk.title}`,
      `source_type: ${chunk.source_type}`,
      `canonical_url: ${chunk.canonical_url || ""}`,
      `document_name: ${chunk.document_name || ""}`,
      `page_number: ${chunk.page_number ?? ""}`,
      `section_heading: ${chunk.section_heading || ""}`,
      `published_date: ${chunk.published_date || ""}`,
      `authority_score: ${chunk.authority_score ?? ""}`,
      `chunk_text: ${chunk.chunk_text}`,
    ].join("\n");
  }).join("\n\n---\n\n");
};

const toValidMarker = (value: string, fallbackIndex: number) => {
  if (/^\[\d+\]$/.test(value || "")) return value;
  return `[${fallbackIndex}]`;
};

const normalizeInlineSpace = (value: string) => value.replace(/\s+/g, " ").trim();

const buildAuditableQuotedSpan = (candidate: string, chunk: RetrievedChunk) => {
  const chunkText = normalizeInlineSpace(chunk.chunk_text || "");
  const cleanCandidate = normalizeInlineSpace(candidate || "");

  if (cleanCandidate) {
    const normalizedCandidate = normalizeText(cleanCandidate);
    const normalizedChunk = normalizeText(chunkText);
    if (normalizedCandidate && normalizedChunk.includes(normalizedCandidate)) {
      return cleanCandidate.slice(0, 380);
    }
  }

  return chunkText.slice(0, 280);
};

const validateAndHydrateCitations = (params: {
  rawCitations: any[];
  retrievedChunks: RetrievedChunk[];
}) => {
  const chunkKeyMap = new Map<string, RetrievedChunk>();
  params.retrievedChunks.forEach((chunk) => {
    chunkKeyMap.set(`${chunk.source_id}::${chunk.chunk_index}`, chunk);
  });

  const seenMarkers = new Set<string>();
  const citations: CitationRecord[] = [];

  (params.rawCitations || []).forEach((raw, index) => {
    const sourceId = String(raw?.source_id || "").trim();
    const chunkIndex = Number.isFinite(Number(raw?.chunk_index)) ? Number(raw.chunk_index) : NaN;
    if (!sourceId || Number.isNaN(chunkIndex)) return;

    const chunk = chunkKeyMap.get(`${sourceId}::${chunkIndex}`);
    if (!chunk) return;

    const marker = toValidMarker(String(raw?.marker || ""), index + 1);
    if (seenMarkers.has(marker)) return;
    seenMarkers.add(marker);

    const citation: CitationRecord = {
      marker,
      source_id: chunk.source_id,
      title: chunk.title,
      url: chunk.canonical_url || null,
      page: chunk.page_number ?? null,
      section: chunk.section_heading || null,
      quoted_span: buildAuditableQuotedSpan(String(raw?.quoted_span || ""), chunk),
      chunk_index: chunk.chunk_index,
      source_type: chunk.source_type,
      document_name: chunk.document_name || null,
      published_date: chunk.published_date || null,
      authority_score: chunk.authority_score ?? null,
    };

    citations.push(citation);
  });

  return citations;
};

const buildSourcesFromCitations = (citations: CitationRecord[]) => {
  const map = new Map<string, SourceRecord>();
  for (const citation of citations) {
    if (!map.has(citation.source_id)) {
      map.set(citation.source_id, {
        source_id: citation.source_id,
        title: citation.title,
        url: citation.url || null,
        source_type: citation.source_type,
      });
    }
  }
  return Array.from(map.values());
};

const normalizeAnswerCitationMarkers = (answerText: string, citations: CitationRecord[]) => {
  if (!citations.length) {
    return {
      answerText: answerText.replace(/\[(\d+)\]/g, "").trim(),
      citations,
    };
  }

  const markerMap = new Map<string, string>();
  const normalizedCitations = citations.map((citation, index) => {
    const normalizedMarker = `[${index + 1}]`;
    markerMap.set(citation.marker, normalizedMarker);
    return { ...citation, marker: normalizedMarker };
  });

  let normalizedText = answerText;
  for (const [originalMarker, normalizedMarker] of markerMap.entries()) {
    if (originalMarker !== normalizedMarker) {
      normalizedText = normalizedText.split(originalMarker).join(normalizedMarker);
    }
  }

  const allowedMarkers = new Set(normalizedCitations.map((citation) => citation.marker));
  normalizedText = normalizedText.replace(/\[(\d+)\]/g, (marker) => {
    return allowedMarkers.has(marker) ? marker : "";
  });

  return {
    answerText: normalizedText.trim(),
    citations: normalizedCitations,
  };
};

const appendGroundedSourcesToHtml = (params: {
  htmlBody: string;
  citations: CitationRecord[];
  sources: SourceRecord[];
  sourceLimitations: string;
}) => {
  const citationRows = params.citations.length > 0
    ? params.citations.map((citation) => {
      const locationParts = [
        citation.page ? `p. ${citation.page}` : "",
        citation.section ? `${citation.section}` : "",
      ].filter(Boolean).join(" | ");
      const secondary = locationParts || citation.url || citation.document_name || "No location metadata";

      return `<p style="margin-bottom: 14px; line-height: 1.75; color: #334155;">
<strong>${citation.marker}</strong> ${escapeHtml(citation.title)}${secondary ? ` — ${escapeHtml(secondary)}` : ""}<br/>
<span style="color:#64748b;">${escapeHtml(citation.quoted_span)}</span>
</p>`;
    }).join("\n")
    : `<p style="margin-bottom: 14px; line-height: 1.75; color: #334155;">I could not verify this from the available sources.</p>`;

  const sourceRows = params.sources.length > 0
    ? params.sources.map((source) => {
      const link = source.url
        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(source.url)}</a>`
        : "No URL available";
      return `<p style="margin-bottom: 10px; line-height: 1.7; color: #334155;"><strong>${escapeHtml(source.title)}</strong> (${escapeHtml(source.source_type)})<br/>${link}</p>`;
    }).join("\n")
    : `<p style="margin-bottom: 10px; line-height: 1.7; color: #334155;">No verifiable sources were returned.</p>`;

  const limitation = params.sourceLimitations
    ? `<p style="margin-bottom: 14px; line-height: 1.75; color: #8b5e00;">${escapeHtml(params.sourceLimitations)}</p>`
    : "";

  return `${params.htmlBody}
<h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-top: 42px; margin-bottom: 16px;">Citations</h2>
${citationRows}
<h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-top: 36px; margin-bottom: 16px;">Sources</h2>
${sourceRows}
${limitation}`;
};

const parseGroundedDraftResponse = (params: {
  rawText: string;
  retrievedChunks: RetrievedChunk[];
  defaultLimitations: string;
}) => {
  const parsed = parseLooseJson(params.rawText);
  const answerText = String(parsed?.answer_text || "").trim();
  const title = String(parsed?.title || "").trim();
  const rawCitations = Array.isArray(parsed?.citations) ? parsed.citations : [];
  const hydratedCitations = validateAndHydrateCitations({
    rawCitations,
    retrievedChunks: params.retrievedChunks,
  });
  const normalized = normalizeAnswerCitationMarkers(answerText, hydratedCitations);
  const sources = buildSourcesFromCitations(normalized.citations);
  const sourceLimitations = String(parsed?.source_limitations || params.defaultLimitations || "").trim();
  const chartData = parsed?.chart_data && typeof parsed.chart_data === "object" ? parsed.chart_data : null;

  return {
    title,
    answerText: normalized.answerText,
    citations: normalized.citations,
    sources,
    sourceLimitations,
    chartData,
    groundingStatus: normalized.citations.length > 0 ? "grounded" : "limited",
  };
};

// ── LWM Blog HTML Template Builder ──
function buildLwmBlogHtml(structured: {
  title: string;
  subtitle: string;
  category: string;
  readTime: string;
  lead: string;
  sections: { heading: string; body: string }[];
  pullquote: { text: string; attribution: string };
  insight: string;
  stats: { number: string; label: string }[];
  disclaimer: string;
  chartData?: any;
}): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

  // Convert markdown-like bold to HTML
  const md = (text: string) => formatInlineMarkdown(text);

  // Build section HTML
  const sectionsHtml = structured.sections.map(s => {
    const heading = s.heading.replace(/^##\s*/, '').replace(/\*\*/g, '');
    const paragraphs = s.body.split('\n\n').filter(p => p.trim()).map(p =>
      `<p>${md(p.trim())}</p>`
    ).join('\n  ');
    return `
  <span class="h2-accent"></span>
  <h2>${heading}</h2>
  ${paragraphs}`;
  }).join('\n\n  <div class="divider"><span class="compass">◆</span></div>\n');

  // Build stats HTML
  const statsHtml = structured.stats.slice(0, 3).map(s => `
    <div class="stat">
      <div class="stat-n">${s.number}</div>
      <div class="stat-l">${s.label}</div>
    </div>`).join('\n');

  // Build chart HTML if chart data exists
  let chartHtml = '';
  if (structured.chartData) {
    chartHtml = `
  <div class="chart-wrap">
    <div class="ct">${structured.chartData.title || 'Data Overview'}</div>
    <div class="cs">${structured.chartData.dataLabel || 'Values'}</div>
    <canvas id="lwm-chart" height="260"></canvas>
    <div class="csrc">Source: Legacy Wealth Management Research</div>
  </div>
  <script>
  (function() {
    const ctx = document.getElementById('lwm-chart');
    if (!ctx) return;
    const chartData = ${JSON.stringify(structured.chartData)};
    new Chart(ctx, {
      type: chartData.type || 'bar',
      data: {
        labels: chartData.data.map(d => d.name),
        datasets: [{
          label: chartData.dataLabel || 'Value',
          data: chartData.data.map(d => d.value),
          backgroundColor: ['#1a365f','#4c6b36','#b3822f','#75426a','#1f5c7a','#7a2828'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  })();
  </script>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${structured.title} | Legacy Wealth Management</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  :root {
    --navy:       #1a365f;
    --dark-navy:  #1f2758;
    --steel:      #a2bbc3;
    --light-steel:#dbe6e7;
    --off-white:  #f4f4f4;
    --gold:       #b3822f;
    --purple:     #75426a;
    --sage:       #83a762;
    --dark-sage:  #4c6b36;
    --yellow:     #fcf178;
    --text-dark:  #1a1a2a;
    --text-mid:   #3a4a5a;
    --text-light: #647180;
    --border:     #dbe6e7;
    --white:      #ffffff;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Poppins', sans-serif;
    background: var(--off-white);
    color: var(--text-dark);
    font-size: 16px;
    line-height: 1.85;
  }
  .site-header {
    background: var(--navy);
    padding: 0;
    border-bottom: 3px solid var(--gold);
  }
  .header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 18px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .header-logo { font-family: 'Oswald', sans-serif; color: var(--gold); font-size: 1.4rem; font-weight: 600; letter-spacing: 0.08em; }
  .header-right { text-align: right; }
  .header-right .tagline {
    color: var(--steel);
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-family: 'Oswald', sans-serif;
    font-weight: 300;
  }
  .header-right .website {
    color: var(--gold);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    font-family: 'Oswald', sans-serif;
    font-weight: 400;
  }
  .spectrum-banner {
    display: flex;
    height: 44px;
    overflow: hidden;
  }
  .sb { flex: 1; display: flex; align-items: center; justify-content: center;
         font-family: 'Oswald', sans-serif; font-size: 0.68rem; font-weight: 500;
         letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.9); }
  .sb1 { background: #1a365f; }
  .sb2 { background: #1f3e6a; }
  .sb3 { background: #4c6b36; }
  .sb4 { background: #8a6020; }
  .sb5 { background: #7a2828; }
  .hero {
    background: var(--dark-navy);
    padding: 80px 32px 68px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 100% 70% at 50% 0%, rgba(179,130,47,0.13) 0%, transparent 65%),
      url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0 L60 30 L30 60 L0 30 Z' fill='none' stroke='rgba(162,187,195,0.04)' stroke-width='1'/%3E%3C/svg%3E");
  }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--gold);
    color: var(--gold);
    font-family: 'Oswald', sans-serif;
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    padding: 6px 18px;
    margin-bottom: 30px;
    position: relative;
  }
  .hero h1 {
    font-family: 'Oswald', sans-serif;
    color: var(--white);
    font-size: clamp(2.4rem, 5.5vw, 4rem);
    font-weight: 600;
    line-height: 1.1;
    max-width: 800px;
    margin: 0 auto 18px;
    position: relative;
    letter-spacing: 0.02em;
  }
  .hero h1 span { color: var(--gold); }
  .hero-sub {
    color: var(--steel);
    max-width: 560px;
    margin: 0 auto 38px;
    font-size: 0.98rem;
    font-weight: 300;
    line-height: 1.8;
    position: relative;
  }
  .hero-meta {
    display: flex; justify-content: center; gap: 28px; flex-wrap: wrap; position: relative;
  }
  .hero-meta span {
    color: rgba(162,187,195,0.6);
    font-size: 0.76rem;
    letter-spacing: 0.07em;
    font-family: 'Oswald', sans-serif;
    font-weight: 300;
  }
  .hero-meta span b { color: var(--gold); font-weight: 500; }
  .container { max-width: 880px; margin: 0 auto; padding: 0 28px; }
  .article { padding: 68px 0 80px; }
  .lead {
    font-family: 'Poppins', sans-serif;
    font-size: 1.08rem;
    color: var(--text-mid);
    font-weight: 300;
    font-style: italic;
    border-left: 4px solid var(--gold);
    padding-left: 24px;
    margin-bottom: 52px;
    line-height: 1.9;
  }
  h2 {
    font-family: 'Oswald', sans-serif;
    color: var(--navy);
    font-size: 1.85rem;
    font-weight: 600;
    margin: 60px 0 16px;
    line-height: 1.2;
    letter-spacing: 0.03em;
  }
  .h2-accent {
    display: block;
    width: 44px;
    height: 3px;
    background: linear-gradient(90deg, var(--gold), var(--dark-sage));
    margin-bottom: 14px;
  }
  h3 {
    font-family: 'Oswald', sans-serif;
    color: var(--dark-navy);
    font-size: 1.2rem;
    font-weight: 500;
    margin: 34px 0 10px;
    letter-spacing: 0.02em;
  }
  p { margin-bottom: 20px; color: var(--text-mid); font-weight: 300; }
  strong { font-weight: 600; color: var(--navy); }
  .divider {
    display: flex; align-items: center; gap: 14px; margin: 52px 0;
  }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .divider .compass { color: var(--gold); font-size: 1.1rem; }
  .pullquote {
    background: var(--navy);
    color: var(--white);
    padding: 28px 36px;
    margin: 44px 0;
    border-left: 5px solid var(--gold);
    font-family: 'Poppins', sans-serif;
    font-size: 1.08rem;
    font-style: italic;
    font-weight: 300;
    line-height: 1.7;
    position: relative;
  }
  .pullquote::before {
    content: '\\201C';
    position: absolute;
    top: -10px; left: 24px;
    font-size: 5rem;
    color: var(--gold);
    opacity: 0.25;
    line-height: 1;
    font-family: Georgia, serif;
  }
  .pullquote cite {
    display: block;
    color: var(--gold);
    font-size: 0.75rem;
    font-style: normal;
    font-family: 'Oswald', sans-serif;
    letter-spacing: 0.1em;
    margin-top: 14px;
    font-weight: 400;
  }
  .insight {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--light-steel);
    border: 1px solid var(--steel);
    border-left: 4px solid var(--dark-sage);
    padding: 18px 22px;
    margin: 30px 0;
  }
  .insight .ico { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
  .insight p { margin: 0; font-size: 0.9rem; color: var(--text-mid); }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
    gap: 16px;
    margin: 36px 0;
  }
  .stat {
    background: var(--navy);
    padding: 26px 18px;
    text-align: center;
    border-top: 3px solid var(--gold);
    position: relative;
  }
  .stat-n { font-family: 'Oswald', sans-serif; font-size: 2.4rem; color: var(--gold); line-height: 1; margin-bottom: 8px; font-weight: 500; }
  .stat-l { color: var(--steel); font-size: 0.75rem; line-height: 1.45; font-weight: 300; }
  .chart-wrap {
    background: var(--white);
    border: 1px solid var(--border);
    border-top: 3px solid var(--navy);
    padding: 32px;
    margin: 42px 0;
    box-shadow: 0 2px 16px rgba(26,54,95,0.07);
  }
  .ct { font-family: 'Oswald', sans-serif; color: var(--navy); font-size: 1.1rem; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.02em; }
  .cs { font-size: 0.8rem; color: var(--text-light); margin-bottom: 22px; font-weight: 300; }
  .csrc { font-size: 0.71rem; color: #aaa; font-style: italic; margin-top: 14px; }
  canvas { max-width: 100%; }
  .disclaimer {
    background: var(--dark-navy);
    color: rgba(162,187,195,0.7);
    padding: 40px 44px;
    font-size: 0.78rem;
    line-height: 1.8;
    border-top: 3px solid var(--gold);
    margin-top: 64px;
  }
  .disclaimer strong {
    color: var(--gold);
    font-family: 'Oswald', sans-serif;
    font-size: 0.82rem;
    display: block;
    margin-bottom: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 500;
  }
  .site-footer {
    background: var(--navy);
    border-top: 1px solid rgba(179,130,47,0.3);
    padding: 22px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .footer-logo { font-family: 'Oswald', sans-serif; color: var(--gold); font-size: 1rem; font-weight: 500; opacity: 0.8; }
  .footer-copy {
    color: rgba(162,187,195,0.45);
    font-size: 0.72rem;
    letter-spacing: 0.07em;
    font-family: 'Oswald', sans-serif;
    font-weight: 300;
  }
  .footer-web {
    color: var(--gold);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    font-family: 'Oswald', sans-serif;
    font-weight: 400;
  }
  @media (max-width: 640px) {
    .stats { grid-template-columns: 1fr 1fr; }
    .chart-wrap { padding: 18px 14px; }
    h2 { font-size: 1.55rem; }
    .hero h1 { font-size: 2rem; }
    .disclaimer { padding: 28px 22px; }
    .header-inner { justify-content: center; text-align: center; }
    .header-right { text-align: center; }
    .site-footer { justify-content: center; text-align: center; }
  }
</style>
</head>
<body>

<header class="site-header">
  <div class="header-inner">
    <div class="header-logo">LEGACY WEALTH MANAGEMENT</div>
    <div class="header-right">
      <div class="tagline">Preserving Wealth Across Generations</div>
      <div class="website">legacywealthmanagement.com</div>
    </div>
  </div>
</header>

<div class="spectrum-banner">
  <div class="sb sb1">Conservative</div>
  <div class="sb sb2">Moderate</div>
  <div class="sb sb3">Balanced</div>
  <div class="sb sb4">Growth</div>
  <div class="sb sb5">Aggressive</div>
</div>

<section class="hero">
  <div class="hero-badge">◆ ${structured.category} ◆</div>
  <h1>${structured.title}</h1>
  <p class="hero-sub">${structured.subtitle}</p>
  <div class="hero-meta">
    <span><b>Legacy Wealth Management</b></span>
    <span>${dateStr}</span>
    <span>${structured.readTime}</span>
  </div>
</section>

<article class="article">
  <div class="container">

    <p class="lead">${md(structured.lead)}</p>

    ${sectionsHtml}

    <div class="pullquote">
      ${md(structured.pullquote.text)}
      <cite>— ${structured.pullquote.attribution}</cite>
    </div>

    <div class="insight">
      <span class="ico">💡</span>
      <p>${md(structured.insight)}</p>
    </div>

    <div class="stats">
      ${statsHtml}
    </div>

    ${chartHtml}

  </div>
</article>

<div class="container">
  <div class="disclaimer">
    <strong>Important Disclosure</strong>
    ${structured.disclaimer}
  </div>
</div>

<footer class="site-footer">
  <div class="footer-logo">LEGACY WEALTH MANAGEMENT</div>
  <div class="footer-copy">&copy; ${today.getFullYear()} Legacy Wealth Management. All Rights Reserved.</div>
  <div class="footer-web">legacywealthmanagement.com</div>
</footer>

</body>
</html>`;
}

// Parse AI structured text into template data
function parseStructuredBlog(rawText: string, topic: string): {
  title: string;
  subtitle: string;
  category: string;
  readTime: string;
  lead: string;
  sections: { heading: string; body: string }[];
  pullquote: { text: string; attribution: string };
  insight: string;
  stats: { number: string; label: string }[];
  disclaimer: string;
  chartData?: any;
} {
  const getBlock = (marker: string): string => {
    const regex = new RegExp(`---${marker}---\\s*([\\s\\S]*?)(?=---[A-Z_]+---|$)`);
    const match = rawText.match(regex);
    return match ? match[1].trim() : '';
  };

  const title = getBlock('TITLE') || `Deep Dive: ${topic}`;
  const subtitle = getBlock('SUBTITLE') || 'Expert analysis from Legacy Wealth Management.';
  const category = getBlock('CATEGORY') || 'INVESTING';
  const readTime = getBlock('READ_TIME') || '8 MIN READ';
  const lead = getBlock('LEAD') || '';

  // Parse sections
  const sectionsRaw = rawText.split('---SECTION---').slice(1);
  const sections = sectionsRaw.map(s => {
    // Stop at next marker
    const cleaned = s.replace(/---[A-Z_]+---[\s\S]*$/, '').trim();
    const lines = cleaned.split('\n');
    const headingLine = lines.find(l => l.trim().startsWith('##')) || '';
    const heading = headingLine.replace(/^##\s*/, '').replace(/\*\*/g, '').trim();
    const body = lines.filter(l => !l.trim().startsWith('##')).join('\n').trim();
    return { heading: heading || 'Key Considerations', body };
  }).filter(s => s.body.length > 0);

  // Parse pullquote
  const pullquoteRaw = getBlock('PULLQUOTE');
  const pullquoteLines = pullquoteRaw.split('\n').filter(l => l.trim());
  const pullquote = {
    text: pullquoteLines[0] || 'Sound financial planning is the foundation of lasting wealth.',
    attribution: pullquoteLines[1] || 'LEGACY WEALTH MANAGEMENT',
  };

  const insight = getBlock('INSIGHT') || 'Consult with your financial advisor to discuss how these strategies apply to your specific situation.';

  // Parse stats
  const statsRaw = getBlock('STATS');
  const stats = statsRaw.split('\n').filter(l => l.includes('|')).map(l => {
    const [num, label] = l.split('|').map(s => s.trim());
    return { number: num, label };
  }).slice(0, 3);

  // Ensure we have 3 stats
  while (stats.length < 3) {
    stats.push({ number: '—', label: 'Data point' });
  }

  const disclaimer = getBlock('DISCLAIMER') ||
    'This material is for informational purposes only and does not constitute investment advice. Past performance is not indicative of future results. Consult with a qualified financial advisor before making investment decisions.';

  return { title, subtitle, category, readTime, lead, sections, pullquote, insight, stats, disclaimer };
}

function parseUnstructuredBlog(title: string, rawText: string): any {
  const blocks = rawText.split('\n\n').filter(b => b.trim());
  const lead = blocks.length > 0 && !blocks[0].startsWith('#') ? blocks[0].replace(/\*\*/g, '') : 'An in-depth perspective on current market conditions and strategic planning.';

  const sections = [];
  let currentBody: string[] = [];
  let currentHeading = 'Key Considerations';

  const startIndex = blocks.length > 0 && !blocks[0].startsWith('#') ? 1 : 0;

  for (let i = startIndex; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (block.startsWith('##') || block.startsWith('#')) {
      if (currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n\n') });
      }
      currentHeading = block.replace(/^#+\s*/, '');
      currentBody = [];
    } else {
      currentBody.push(block);
    }
  }

  if (currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n\n') });
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Analysis', body: rawText });
  }

  return {
    title,
    subtitle: 'Expert analysis and wealth preservation strategies.',
    category: 'INSIGHTS',
    readTime: '5 MIN READ',
    lead,
    sections,
    pullquote: {
      text: "Disciplined investing and long-term planning remain the foundations of lasting wealth.",
      attribution: "LEGACY WEALTH MANAGEMENT"
    },
    insight: "We encourage you to review these concepts with your advisor to ensure alignment with your goals.",
    stats: [
      { number: '1', label: 'Priority Focus' },
      { number: '100%', label: 'Commitment' },
      { number: '360°', label: 'Perspective' }
    ],
    disclaimer: 'This material is for informational purposes only and does not constitute investment advice. Past performance is not indicative of future results. Consult with a qualified financial advisor before making investment decisions.'
  };
}

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
      videoDuration,
      orgId,
      requestId,
      sourceUrls = [],
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
      videoDuration?: number;
      orgId?: string;
      requestId?: string;
      sourceUrls?: string[];
    } = await req.json();

    const safeLength = (contentLength in lengthGuides ? contentLength : "Medium") as ContentLength;
    const lengthInstruction = lengthGuides[safeLength];
    const normalizedOrgId = (orgId || "").trim();
    const normalizedRequestId = (requestId || "").trim() || null;

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
Output style: polished, trustworthy, modern. Must be full color, not black-and-white.
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret.");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const isBlogType = contentType && contentType.toLowerCase() === 'blog';
    const shouldGround = isBlogType && action === "generate";
    let retrievedChunks: RetrievedChunk[] = [];
    let retrievalQuery = "";
    let groundingStatus: "grounded" | "limited" | "ungrounded" = "ungrounded";
    let sourceLimitations = "";

    if (shouldGround) {
      if (!normalizedOrgId) {
        throw new Error("Missing orgId for grounded citation retrieval.");
      }

      const retrieval = await retrieveGroundingChunks({
        supabaseAdmin,
        orgId: normalizedOrgId,
        topic,
        instructions,
        currentContent,
        sourceUrls,
      });

      retrievedChunks = retrieval.chunks;
      retrievalQuery = retrieval.query;
      groundingStatus = retrieval.hasStrongGrounding ? "grounded" : (retrievedChunks.length > 0 ? "limited" : "ungrounded");
      sourceLimitations = retrieval.hasStrongGrounding
        ? ""
        : "Retrieved evidence was limited or weak for this request.";

      if (!retrieval.hasStrongGrounding) {
        const failureMessage = "I could not verify this from the available sources.";
        const payload = {
          answer_text: failureMessage,
          citations: [],
          sources: [],
          source_limitations: sourceLimitations || "No sufficiently strong grounding material was found.",
          grounding_status: "ungrounded",
          title: `Unverified: ${topic}`,
          body: `<p>${failureMessage}</p><p style="color:#7c2d12;">${escapeHtml(sourceLimitations || "No sufficiently strong grounding material was found.")}</p>`,
          disclaimers: "",
        };

        if (normalizedOrgId) {
          await supabaseAdmin
            .from("grounding_audit_logs")
            .insert({
              org_id: normalizedOrgId,
              request_id: normalizedRequestId,
              topic,
              query_text: retrievalQuery,
              provider,
              used_chunks: [],
              citations: [],
              sources: [],
              source_limitations: payload.source_limitations,
              grounding_status: "ungrounded",
            });
        }

        return new Response(
          JSON.stringify({ data: payload }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    let systemPrompt = isBlogType ? legacyWealthBlogStyle : legacyWealthStyle;
    let userContent = isBlogType
      ? `Write a premium blog article about: ${topic}.\n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}\n\nRemember: Write in clean markdown with # for title, ## for section headings, and regular paragraphs. Do NOT use ---MARKER--- tags.\n\nCitation Requirement: Every factual or numerical claim must include an inline citation in plain text like "(Source: Federal Reserve, 2025)". End the article with a final ## Sources section listing every cited source actually used. Put each source in its own paragraph, and use markdown links when possible. If you cannot support a claim with a credible source, remove the claim. If you include a chart JSON block, the ## Sources section must appear immediately before the chart JSON block.\n\nIf the topic involves data, trends, asset allocation, or comparisons, you MUST also append a JSON chart block at the very end of your response. Choose the most appropriate chart type from these options:\n\n1. "bar" — standard vertical bar chart (default, good for simple comparisons)\n2. "stackedBar" — stacked vertical bars (good for composition breakdowns like asset allocation). Requires stackKeys and stackLabels arrays.\n3. "horizontalBar" — horizontal bars (good for ranking/factor comparisons, each bar gets a unique color)\n4. "areaLine" — line with shaded area fill (good for trends over time, probability curves)\n5. "multiLine" — multiple lines with subtle area fills (good for glide paths, multi-series time data). Use dataKey2/dataKey3 for additional series.\n6. "line" — standard line chart (good for simple trends)\n7. "pie" — donut/pie chart\n\nFormat the JSON exactly like this:\n<script type="application/json" id="chart-data">\n{"title": "Chart Title", "subtitle": "One-line description of what data shows", "type": "bar", "dataLabel": "Series Name", "source": "Source: Research Group; Data Provider. Note about methodology.", "data": [{"name": "A", "value": 10}]}\n</script>\n\nStacked bar example: {"type": "stackedBar", "stackKeys": ["value", "value2", "value3"], "stackLabels": ["Equities", "Fixed Income", "Cash / Alts."], "data": [{"name": "Conservative", "value": 20, "value2": 65, "value3": 15}]}\nGrouped bar example: {"type": "bar", "dataKey2": "value2", "dataLabel": "Fund Return", "dataLabel2": "Investor Return", "yAxisPercent": true, "data": [{"name": "U.S. Equity", "value": 9.8, "value2": 7.9}]}\nMulti-line example: {"type": "multiLine", "dataKey2": "value2", "dataKey3": "value3", "dataLabel": "Equities (%)", "dataLabel2": "Fixed Income (%)", "dataLabel3": "Cash (%)", "data": [{"name": "Age 25", "value": 95, "value2": 4, "value3": 1}]}\nArea-line example: {"type": "areaLine", "dataLabel": "Historical Frequency (%)", "data": [{"name": "1 Year", "value": 29}]}`
      : `Write a ${contentType} about ${topic}. \n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}

If the topic involves data, trends, asset allocation, or comparisons, you MUST append a JSON block to the very end of your response formatted exactly like this:
<script type="application/json" id="chart-data">
{"title": "Chart Title", "type": "bar", "dataLabel": "Metric 1 (e.g. 2023 Yield %)", "dataKey2": "value2", "dataLabel2": "Metric 2 (optional, e.g. 2024 Yield %)", "data": [{"name": "Category A", "value": 10, "value2": 15}, {"name": "Category B", "value": 20, "value2": 25}]}
</script>
If comparing two sets of metrics across categories, include dataKey2, dataLabel2, and value2. Otherwise, omit them. Do not put this script block inside markdown formatting. The type can be 'bar', 'line', or 'pie'.`;

    if (shouldGround) {
      const retrievalContext = buildGroundingContextForPrompt(retrievedChunks);
      systemPrompt = `${legacyWealthBlogStyle}

Grounding policy (must follow):
- Use ONLY retrieved chunk evidence provided by the user context.
- Never cite, reference, or imply any source that is not in retrieved chunks.
- If sources conflict, explicitly describe the conflict with citations on both sides.
- If a statement is inference/synthesis, label that sentence with "(Inference)" and cite supporting chunks.
- If evidence is incomplete, state that uncertainty briefly under "source_limitations".`;

      userContent = `User request topic: ${topic}
Length requirement: ${lengthInstruction}
Additional user instructions: ${instructions || "None"}

Retrieved chunks (approved evidence only):
${retrievalContext}

Return STRICT JSON with exactly these keys:
{
  "title": "string",
  "answer_text": "markdown article with inline citation markers like [1], [2]",
  "citations": [
    {
      "marker": "[1]",
      "source_id": "src_...",
      "chunk_index": 3,
      "quoted_span": "short excerpt copied from the supporting chunk"
    }
  ],
  "source_limitations": "short note when confidence is reduced; empty string when confidence is high",
  "chart_data": {
    "title": "Chart title",
    "subtitle": "One-line description",
    "type": "bar",
    "dataLabel": "Series label",
    "data": [{"name":"A","value":10}]
  }
}

JSON constraints:
- "citations" must only reference source_id + chunk_index pairs that exist in retrieved chunks.
- Every factual compliance claim should include at least one citation marker.
- Keep quoted_span short (max ~240 chars), and it must appear in the cited chunk.
- If a chart is not needed, set "chart_data" to null.
- Do not include Markdown code fences.
- Do not output any text before or after the JSON.`;
    }

    if (contentType && (contentType.toLowerCase() === "video script" || contentType.toLowerCase() === "video_script")) {
      systemPrompt = meritVideoStyle;

      // Build video-specific length instruction
      let videoLengthInstruction = "";
      if (safeLength === "Short") {
        const mins = videoDuration || 1;
        videoLengthInstruction = `This is a SHORT-FORM video script. Target duration: exactly ${mins} minute${mins > 1 ? 's' : ''}. ` +
          `This is for YouTube Shorts, Instagram Reels, TikTok, or Facebook Reels. ` +
          `Be extremely concise and punchy. Get to the point fast. ` +
          `Use only 2-4 timestamp segments. The final timestamp should not exceed ${mins}:00.`;
      } else if (safeLength === "Medium") {
        videoLengthInstruction = `This is a MEDIUM-LENGTH video script. Target duration: approximately 8-9 minutes. ` +
          `Cover the topic thoroughly with 6-10 clear segments. ` +
          `Use timestamps from [00:00] through approximately [08:00]-[09:00].`;
      } else {
        videoLengthInstruction = `This is a LONG-FORM video script. Target duration: 10 minutes MINIMUM, can go up to 15-20 minutes. ` +
          `Provide a comprehensive, in-depth educational walkthrough. ` +
          `Use many timestamp segments. Go deep on each point with examples and analogies.`;
      }

      userContent = `Create a YouTube video script about: ${topic}. \n\n${videoLengthInstruction}\n\nContext/Instructions: ${instructions}`;
    } else if (
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

      let parsedGroundedTitle = "";
      let parsedGroundedBody = rawText;
      let groundedCitations: CitationRecord[] = [];
      let groundedSources: SourceRecord[] = [];
      let draftSourceLimitations = sourceLimitations;
      let draftGroundingStatus: "grounded" | "limited" | "ungrounded" = groundingStatus;
      let groundedChartData: any = null;

      if (shouldGround) {
        try {
          const grounded = parseGroundedDraftResponse({
            rawText,
            retrievedChunks,
            defaultLimitations: sourceLimitations,
          });
          parsedGroundedTitle = grounded.title;
          parsedGroundedBody = grounded.answerText;
          groundedCitations = grounded.citations;
          groundedSources = grounded.sources;
          draftSourceLimitations = grounded.sourceLimitations;
          draftGroundingStatus = grounded.groundingStatus;
          groundedChartData = grounded.chartData;
        } catch {
          parsedGroundedTitle = `Unverified: ${topic}`;
          parsedGroundedBody = "I could not verify this from the available sources.";
          groundedCitations = [];
          groundedSources = [];
          draftSourceLimitations = "The writing output could not be parsed into a grounded citation response.";
          draftGroundingStatus = "ungrounded";
          groundedChartData = null;
        }
      }

      const lines = (shouldGround ? parsedGroundedBody : rawText).split("\n");
      let title = (shouldGround ? parsedGroundedTitle : "")
        || lines[0]?.replace(/^#\s*/, "").replace(/\*\*/g, "").trim()
        || `Generated Content: ${topic}`;
      let body = shouldGround
        ? parsedGroundedBody.trim()
        : lines.slice(1).join("\n").trim();
      if (shouldGround && !body) {
        body = "I could not verify this from the available sources.";
        draftGroundingStatus = "ungrounded";
      }
      if (!title || title.length < 5) {
        // Fallback if title is missing or empty
        title = `Deep Dive: ${topic}`;
      }

      let htmlBody: string;
      let finalTitle = title;

      // Check if this is a blog — convert markdown to clean simple HTML (white bg, black text)
      if (isBlogType) {
        // Extract chart data before parsing
        const chartRegex = /<script[^>]*id=["']chart-data["'][^>]*>([\s\S]*?)<\/script>/i;
        const chartMatch = body.match(chartRegex);
        let chartData = groundedChartData;
        let bodyForParsing = body;
        if (chartMatch && !groundedChartData) {
          try {
            let jsonStr = chartMatch[1].trim().replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
            chartData = JSON.parse(jsonStr);
          } catch (_e) { /* ignore parse errors */ }
          bodyForParsing = body.replace(chartMatch[0], '').trim();
        }

        // Strip any leftover structured markers (---TITLE---, ---SECTION---, etc.)
        let cleanText = bodyForParsing;
        cleanText = cleanText.replace(/---[A-Z_]+---/g, '').trim();
        const { articleMarkdown, sourcesMarkdown } = extractBlogSourcesMarkdown(cleanText);
        const markdownForBody = articleMarkdown;

        // Process line by line to properly detect headers even with single line breaks
        const outputParts: string[] = [];
        const allLines = markdownForBody.split('\n');
        let currentParagraph: string[] = [];

        const flushParagraph = () => {
          if (currentParagraph.length > 0) {
            const text = currentParagraph.join(' ').trim();
            if (text) {
              outputParts.push(`<p style="margin-bottom: 20px; line-height: 1.8; color: #334155;">${formatInlineMarkdown(text)}</p>`);
            }
            currentParagraph = [];
          }
        };

        for (const line of allLines) {
          const trimmed = line.trim();

          // Skip empty lines (they signal paragraph breaks)
          if (!trimmed) {
            flushParagraph();
            continue;
          }

          // Detect headers
          if (trimmed.startsWith('### ')) {
            flushParagraph();
            const text = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
            outputParts.push(`<h3 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-top: 32px; margin-bottom: 12px;">${text}</h3>`);
          } else if (trimmed.startsWith('## ')) {
            flushParagraph();
            const text = trimmed.replace(/^##\s*/, '').replace(/\*\*/g, '');
            outputParts.push(`<h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-top: 40px; margin-bottom: 16px;">${text}</h2>`);
          } else if (trimmed.startsWith('# ')) {
            flushParagraph();
            const text = trimmed.replace(/^#\s*/, '').replace(/\*\*/g, '');
            if (!finalTitle || finalTitle === title) {
              finalTitle = text;
            }
            outputParts.push(`<h1 style="font-size: 1.8rem; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 8px;">${text}</h1>`);
          } else {
            // Regular text line — accumulate into paragraph
            currentParagraph.push(trimmed);
          }
        }
        flushParagraph();

        htmlBody = outputParts.join('\n');

        if (!htmlBody) {
          htmlBody = '<p>No content generated.</p>';
        }

        // Prepend the title as a big bold heading at the very top of the body
        htmlBody = `<h1 style="font-size: 2.2rem; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 20px; line-height: 1.15; letter-spacing: -0.02em;">${finalTitle}</h1>\n` + htmlBody;

        if (shouldGround) {
          htmlBody = appendGroundedSourcesToHtml({
            htmlBody,
            citations: groundedCitations,
            sources: groundedSources,
            sourceLimitations: draftSourceLimitations,
          });
        } else {
          // Always render the sources section as the final visible section of the article.
          htmlBody += `\n${buildBlogSourcesSectionHtml({ markdownBody: cleanText, sourcesMarkdown })}`;
        }

        // Append chart data as a script tag so the frontend can extract it
        if (chartData) {
          htmlBody += `\n<script type="application/json" id="chart-data">\n${JSON.stringify(chartData)}\n</script>`;
        }
      } else {
        // Non-blog: use existing simple HTML formatting
        htmlBody = body.split("\n\n").map((block: string) => {
          const trimmed = block.trim();
          if (!trimmed) return "";

          const timestampRegex = /^\[?(\d{1,2}:\d{2})\]?/;
          const match = trimmed.match(timestampRegex);

          if (match) {
            const timestamp = match[1];
            const content = trimmed.replace(timestampRegex, "").trim();
            return `
              <div style="margin-bottom: 24px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #2563eb;">
                <div style="color: #2563eb; font-weight: 700; margin-bottom: 4px; font-size: 14px;">${timestamp}</div>
                <p style="margin: 0; color: #334155; line-height: 1.6;">${formatInlineMarkdown(content)}</p>
              </div>
            `;
          }

          if (trimmed.startsWith("###")) return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(/^###\s*/, "")}</h3>`;
          if (trimmed.startsWith("##")) return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(/^##\s*/, "")}</h2>`;
          if (trimmed.startsWith("#")) return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(/^#\s*/, "")}</h1>`;
          return `<p style="margin-bottom: 24px;">${formatInlineMarkdown(trimmed)}</p>`;
        }).join("\n");
      }

      return {
        id: res.id,
        title: finalTitle,
        body: htmlBody || "<p>No content generated.</p>",
        disclaimers: "",
        answer_text: shouldGround ? parsedGroundedBody : body,
        citations: groundedCitations,
        sources: groundedSources,
        source_limitations: draftSourceLimitations,
        grounding_status: shouldGround ? draftGroundingStatus : "grounded",
        chart_data: groundedChartData || null,
      };
    });

    // If Rewrite mode, we just return the first one as raw text for now (handling extensions differently)
    if (action === "rewrite") {
      return new Response(
        JSON.stringify({
          data: {
            title: "",
            body: successfulResults[0].text,
            disclaimers: "",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (shouldGround && normalizedOrgId) {
      const firstResult = formattedResults[0];
      const usedKeys = new Set(
        (firstResult.citations || []).map((citation: CitationRecord) => `${citation.source_id}::${citation.chunk_index}`),
      );
      const usedChunks = retrievedChunks
        .filter((chunk) => usedKeys.has(`${chunk.source_id}::${chunk.chunk_index}`))
        .map((chunk) => ({
          source_id: chunk.source_id,
          title: chunk.title,
          source_type: chunk.source_type,
          canonical_url: chunk.canonical_url || null,
          document_name: chunk.document_name || null,
          page_number: chunk.page_number ?? null,
          section_heading: chunk.section_heading || null,
          published_date: chunk.published_date || null,
          chunk_text: chunk.chunk_text,
          chunk_index: chunk.chunk_index,
          authority_score: chunk.authority_score ?? null,
        }));

      await supabaseAdmin
        .from("grounding_audit_logs")
        .insert({
          org_id: normalizedOrgId,
          request_id: normalizedRequestId,
          topic,
          query_text: retrievalQuery,
          provider,
          used_chunks: usedChunks,
          citations: firstResult.citations || [],
          sources: firstResult.sources || [],
          source_limitations: firstResult.source_limitations || null,
          grounding_status: firstResult.grounding_status || "limited",
        });
    }

    return new Response(
      JSON.stringify({
        data: {
          // Backward compat
          title: formattedResults[0].title,
          body: formattedResults[0].body,
          disclaimers: formattedResults[0].disclaimers,
          answer_text: formattedResults[0].answer_text,
          citations: formattedResults[0].citations,
          sources: formattedResults[0].sources,
          source_limitations: formattedResults[0].source_limitations,
          grounding_status: formattedResults[0].grounding_status,
          chart_data: formattedResults[0].chart_data,
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
