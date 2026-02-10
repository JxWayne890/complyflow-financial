import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { existingTopics = [] } = await req.json()

        const NVIDIA_API_KEY = "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";

        const systemPrompt = `You are the Chief Compliance Officer (CCO) and Content Strategist for a Registered Investment Advisor (RIA) called Legacy Wealth Management.

Your task is to generate NEW blog/LinkedIn topic ideas that are fully compliant with SEC marketing rules and the firm's internal compliance guidelines.

=== COMPLIANCE GUIDELINES ===

PERMISSIBLE CONTENT TYPES:
- Educational blog posts
- Market commentary (balanced & factual)
- Exit planning educational pieces
- Estate & succession planning topics
- Tax planning strategies (general, not individual tax advice)
- Investment process explanations
- Wealth transfer case studies (anonymous, illustrative)
- Alternative investments education
- Energy investments education
- Business valuation and sales education

TOPIC AREAS:
Investment education, exit planning, wealth management, alternative investments, business sales, valuation, economic commentary, retirement planning, tax strategy, estate planning, insurance, charitable giving, structured notes, private equity, real estate, energy investments.

LANGUAGE RULES:
- Use "may", "could", "might" — NEVER "will", "guaranteed", "certain"
- Focus on education, NOT product promotion
- Use factual, balanced data
- No superlatives ("best", "safest", "guaranteed")
- No predictions or guarantees of returns
- No testimonials or client endorsements
- No unsubstantiated claims about performance
- No "salesy" product pitches
- No specific investment recommendations to general public

TARGET AUDIENCES (assign one per topic):
- General Public: General financial education, retirement, behavioral finance, market commentary
- Accredited Investors: Higher-level investment discussions, alternatives education
- Qualified Purchasers: Advanced alternative investment commentary, private placement education

CATEGORIES TO USE (assign one per topic):
Market Updates, Personal Finance, Alternative Investments, Tax Strategy, Estate Planning, Financial Planning, Energy Investments, About Legacy, Lifestyle

=== END COMPLIANCE GUIDELINES ===

INSTRUCTIONS:
1. Generate exactly 6 new, unique topic ideas.
2. Each topic must be educational and compliant with the above guidelines.
3. Do NOT duplicate any of the existing topics provided.
4. Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
5. Each object must have: "category" (from the list above), "topic" (the title string), "audience" (General Public, Accredited Investors, or Qualified Purchasers).

Example output format:
[{"category":"Tax Strategy","topic":"Year-End Charitable Giving Strategies That May Reduce Your Tax Burden","audience":"General Public"},{"category":"Alternative Investments","topic":"Understanding Private Credit: A Primer for Accredited Investors","audience":"Accredited Investors"}]`;

        const userMessage = `Here are the existing topics (do NOT duplicate any of these):
${existingTopics.map((t: string) => `- ${t}`).join('\n')}

Now generate 6 brand new, compliant topic ideas as a JSON array.`;

        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NVIDIA_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                model: "moonshotai/kimi-k2.5",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 4096,
                temperature: 0.9,
                top_p: 0.95,
                stream: false
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('NVIDIA API Error:', data);
            return new Response(
                JSON.stringify({ error: `NVIDIA Provider Error: ${data.error?.message || response.statusText}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const rawContent = data.choices?.[0]?.message?.content || '[]';

        // Extract JSON array from the response (handle potential markdown wrapping)
        let jsonStr = rawContent.trim();
        // Strip markdown code fence if present
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let topics = [];
        try {
            topics = JSON.parse(jsonStr);
        } catch (parseErr) {
            console.error('Failed to parse topics JSON:', jsonStr);
            return new Response(
                JSON.stringify({ error: 'AI returned malformed topic data. Please try again.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ topics }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message || 'Internal Edge Function Error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
})
