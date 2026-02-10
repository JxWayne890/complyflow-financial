import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { topic, contentType, instructions, provider = 'claude', contentLength = 'Medium', action = 'generate', currentContent = '', rewriteMode = 'rewrite', complianceNote = '' } = await req.json()

        // Define length guidelines
        const lengthGuides = {
            'Short': 'Length: Concise, around 300-500 words.',
            'Medium': 'Length: Balanced, around 600-1000 words.',
            'Long': 'Length: Comprehensive deep-dive, around 1200+ words.'
        };
        const lengthInstruction = lengthGuides[contentLength] || lengthGuides['Medium'];

        // 1. Get API Keys from Environment (Secrets)
        const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY')
        const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')

        if (!CLAUDE_KEY && provider === 'claude') {
            throw new Error('Claude API key not configured')
        }
        if (!GEMINI_KEY && provider === 'gemini') {
            throw new Error('Gemini API key not configured')
        }

        // 2. Define "Legacy Wealth" Style Guide (System Prompt)
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

        /* 
           Kimi K2.5 (NVIDIA API) Configuration 
           Key provided by user for testing. 
           In production, move to Deno.env.get('NVIDIA_API_KEY')
        */
        const NVIDIA_API_KEY = "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";

        let systemPrompt = legacyWealthStyle;
        let userContent = `Write a ${contentType} about ${topic}. \n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}`;

        // Switch prompt based on "provider" (mapped from frontend mode)
        if (provider === 'gemini') {
            systemPrompt = posterStyle;
            userContent = `Create a visual description or video script for: ${topic}. \n\nContext: ${instructions}`;
        }

        // Handle "Extend" action
        if (action === 'extend') {
            systemPrompt = legacyWealthStyle; // Ensure style guide is enforced
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

Return the FULL expanded article (do not just return the new parts).
`;
        }

        // Handle "Rewrite" action (Select & Fix)
        if (action === 'rewrite') {
            systemPrompt = legacyWealthStyle;

            const modePrompts = {
                'rewrite': `Rephrase and rewrite the following passage while keeping the same meaning, tone, and style. Do not add new information. Just make it read better.`,
                'shorten': `Make the following passage significantly more concise without losing any key information. Remove redundancy and tighten the language.`,
                'expand': `Expand the following passage with more depth, examples, and educational detail. Add at least 50% more content while maintaining the same tone.`,
                'fix_compliance': `Rewrite the following passage to address this compliance concern: "${complianceNote}". Keep the same educational intent but ensure it is fully SEC/FINRA compliant. Do not use promissory language, guarantees, or misleading claims.`
            };

            const modeInstruction = modePrompts[rewriteMode] || modePrompts['rewrite'];

            userContent = `
${modeInstruction}

Passage to rewrite:
"""
${currentContent}
"""

IMPORTANT: Return ONLY the rewritten passage. Do NOT include any titles, headers, preamble, or explanation. Just the rewritten text.
`;
        }

        // Unified call to NVIDIA API
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
                    { role: "user", content: userContent }
                ],
                max_tokens: 16384,
                temperature: 1.00,
                top_p: 1.00,
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

        // Parse Standard OpenAI/NVIDIA Response Format
        const content = data.choices?.[0]?.message?.content || '';

        // Simple parsing (Title = First line, Body = Rest) - Same logic as before to maintain frontend compatibility
        const lines = content.split('\n');
        let title = lines[0]?.replace(/^#\s*/, '').replace(/\*\*/g, '').trim() || 'Untitled Draft';
        let body = lines.slice(1).join('\n').trim();

        // Cleanup if Title ended up being empty or weird
        if (!title) title = `Generated Content: ${topic}`;

        // Improved Markdown to HTML conversion
        const htmlBody = body.split('\n\n')
            .map(block => {
                const trimmed = block.trim();
                if (!trimmed) return '';

                // Handle Headers
                if (trimmed.startsWith('###')) return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(/^###\s*/, '')}</h3>`;
                if (trimmed.startsWith('##')) return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(/^##\s*/, '')}</h2>`;
                if (trimmed.startsWith('#')) return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(/^#\s*/, '')}</h1>`;

                // Handle Bold
                const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                // Wrap in paragraph with significant bottom margin for cleanliness
                return `<p style="margin-bottom: 24px;">${formatted}</p>`;
            })
            .filter(b => b !== '')
            .join('\n');

        const result = {
            data: {
                title: title,
                body: htmlBody || '<p>No content generated.</p>',
                disclaimers: 'Generated by Kimi K2.5 (NVIDIA NIM). Investment advice is subject to market risk.'
            }
        };

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        // Return 200 OK with error message to ensure it's displayed in UI
        return new Response(
            JSON.stringify({ error: error.message || 'Internal Edge Function Error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
