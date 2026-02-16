import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            topic,
            contentType,
            instructions,
            contentLength = 'Medium',
            action = 'generate',
            currentContent = '',
            rewriteMode = 'rewrite',
            complianceNote = ''
        } = await req.json()

        // Define length guidelines
        const lengthGuides = {
            'Short': 'Length: Concise, around 300-500 words.',
            'Medium': 'Length: Balanced, around 600-1000 words.',
            'Long': 'Length: Comprehensive deep-dive, around 1200+ words.'
        };
        const lengthInstruction = lengthGuides[contentLength] || lengthGuides['Medium'];

        const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY') || "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";

        // Define "Legacy Wealth" Style Guide (System Prompt)
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

        // Determine System Prompt and User Content
        let systemPrompt = legacyWealthStyle;
        let userContent = `Write a ${contentType} about ${topic}. \n\nLength Requirement: ${lengthInstruction}\n\nSpecific Instructions: ${instructions}`;

        // Handle Specialized Modes
        if (contentType && (contentType.toLowerCase().includes('video') || contentType.toLowerCase().includes('ad'))) {
            systemPrompt = posterStyle;
            userContent = `Create a visual description or video script for: ${topic}. \n\nContext: ${instructions}`;
        }

        if (action === 'extend') {
            systemPrompt = legacyWealthStyle;
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

        if (action === 'rewrite') {
            systemPrompt = legacyWealthStyle;
            const modePrompts = {
                'rewrite': `Rephrase and rewrite the following passage while keeping the same meaning, tone, and style.`,
                'shorten': `Make the following passage significantly more concise without losing key information.`,
                'expand': `Expand the following passage with more depth and educational detail.`,
                'fix_compliance': `Rewrite the following passage to address this compliance concern: "${complianceNote}". Ensure it is fully SEC/FINRA compliant. Do not use promissory language or guarantees.`
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

        // Exact Kimi k2.5 logic as requested
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

        if (data.error) {
            console.error("Kimi API Error:", data.error);
            throw new Error(`Kimi API Error: ${data.error.message || 'Unknown error'}`);
        }

        const generatedText = data.choices?.[0]?.message?.content || '';

        // --- PARSING & FORMATTING ---

        const lines = generatedText.split('\n');
        let title = lines[0]?.replace(/^#\s*/, '').replace(/\*\*/g, '').trim() || `Generated Content: ${topic}`;
        let body = lines.slice(1).join('\n').trim();

        // If title is empty/generic, use topic
        if (!title || title.length < 5) title = `Deep Dive: ${topic}`;

        // HTML Conversion
        const htmlBody = body.split('\n\n')
            .map(block => {
                const trimmed = block.trim();
                if (!trimmed) return '';
                if (trimmed.startsWith('###')) return `<h3 style="margin-top: 32px; margin-bottom: 16px; font-weight: 700;">${trimmed.replace(/^###\s*/, '')}</h3>`;
                if (trimmed.startsWith('##')) return `<h2 style="margin-top: 40px; margin-bottom: 20px; font-weight: 700;">${trimmed.replace(/^##\s*/, '')}</h2>`;
                if (trimmed.startsWith('#')) return `<h1 style="margin-top: 48px; margin-bottom: 24px; font-weight: 800;">${trimmed.replace(/^#\s*/, '')}</h1>`;
                const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return `<p style="margin-bottom: 24px;">${formatted}</p>`;
            })
            .join('\n');

        const result = {
            data: {
                title: title,
                body: htmlBody || '<p>No content generated.</p>',
                disclaimers: `Generated by Kimi 5 Pro (NVIDIA). Investment advice is subject to market risk.`
            }
        };

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error("Internal Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal Edge Function Error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
