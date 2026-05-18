import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Verify admin authentication
 */
async function verifyAdmin() {
  const { user: adminUser } = await getServerUser();
  if (!adminUser) return { error: "Unauthorized", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { adminUser };
}

/**
 * Build a structured, high-quality prompt based on style selection
 */
function buildStylePrompt(keyword, categoryName, style) {
  let structureGuidelines = "";

  switch (style) {
    case "tutorial":
      structureGuidelines = `
STYLE: Actionable Practical Tutorial (Step-by-Step Guide)
REQUIRED STRUCTURE:
1. Hook & Problem Scenario: Describe a frustrating problem video editors face regarding "${keyword}" and the instant value of solving it.
2. The Anatomy / Prerequisites: What do creators need before starting (software version, assets, system specs).
3. Comprehensive Step-by-Step Breakdown (Minimum 5 detailed steps):
   - Steps must be highly detailed, explaining the "why" and "how".
   - Include exact settings, values, or keyboard shortcuts.
4. Troubleshooting & Pro Tips: Detail 3-4 common mistakes editors make with "${keyword}" and exactly how to bypass them.
5. Practical Challenges / Takeaway Exercises: A quick challenge to get the reader to practice today.
6. Conclusion: A neat summary reinforcing the mastery of the workflow.
`;
      break;

    case "listicle":
      structureGuidelines = `
STYLE: Ultimate Curated Listicle & Round-up (Deep-Dive Comparison)
REQUIRED STRUCTURE:
1. Introduction: The state of the industry, why lists online are generic, and why this curated list is different.
2. High-level Comparison Matrix: A neat markdown table comparing the top 5-7 tools/methods for "${keyword}" (rating, best for, price, learning curve).
3. The Deep Dive (Detail each item):
   - For each item, include: Overview, Key Features, Pros & Cons, and "Best suited for..."
   - Write fully detailed, rich paragraphs for each option rather than brief bullet points.
4. The Editorial Verdict: A clear, objective recommendation based on different user personas (e.g., Beginners vs. Hollywood Pros).
5. Conclusion & Actionable Next Steps.
`;
      break;

    case "case_study":
      structureGuidelines = `
STYLE: Real-world Case Study & Analytical Breakdown (Workflow & Results Analysis)
REQUIRED STRUCTURE:
1. Executive Summary & The Challenge: A creative background story of a project that struggled with sound design/video editing, specifically targeting "${keyword}".
2. The Strategy & Hypothesis: The planned approach to solve this challenge using advanced techniques.
3. Step-by-Step Implementation Timeline:
   - Phase 1: Planning and Asset Gathering.
   - Phase 2: Technical Execution (exact settings, timeline organization, layer structure).
   - Phase 3: Mixing and Fine-Tuning.
4. Before/After Results (Data & Impact): Clear, measurable results (e.g., audience retention increased by 35%, client approval on first draft). Use a markdown table.
5. Critical Lessons Learned: 4 key takeaways that the reader can apply to their own commercial work.
6. Summary & Conversion CTA.
`;
      break;

    case "myth_busting":
      structureGuidelines = `
STYLE: Myth-Busting & In-Depth Technical Review (Debunking Misconceptions)
REQUIRED STRUCTURE:
1. Introduction: The common misconceptions floating around the video editing community regarding "${keyword}".
2. Myth #1 to Myth #4:
   - The Myth statement (e.g., "Myth: Sound design doesn't matter for short-form reels").
   - The Reality: A thorough, evidence-based refutation.
   - The Science/Technical Why: Deep dive into the audio/video engine mechanics or user psychology.
3. Masterclass Best Practices: 5 bulletproof guidelines based on empirical truths rather than rumors.
4. Comprehensive Checklist: A markdown list/table checklist for editors to run through before exporting their timeline.
5. Conclusion: A strong, empowering closing statement.
`;
      break;

    case "guide":
    default:
      structureGuidelines = `
STYLE: Definitive Deep-Dive Ultimate Guide
REQUIRED STRUCTURE:
1. Intriguing Hook & Introduction: Why this topic is critical to the survival of a modern digital creator.
2. The Core Philosophy / Fundamentals: Detailed explanation of the baseline principles of "${keyword}".
3. Advanced Workflows & Layering:
   - Deep dive into advanced workflows.
   - Layering techniques, frequency balancing, visual alignment.
4. Expert Tips & Industry Secrets: Hard-earned tips from seasoned directors and editors.
5. Common Pitfalls & How to Avoid Them: 5 distinct pitfalls.
6. Summary & Actionable Blueprint Checklist.
`;
      break;
  }

  return `
You are an elite SEO Content Specialist, expert copywriter, and a seasoned professional Video Editor.
Write a massive, incredibly comprehensive, and high-quality SEO-optimized article (1500 to 2500 words) targeted at the keyword: "${keyword}".
The article belongs to the category: "${categoryName}" for SFXFolder, a premium platform providing free sound effects, transitions, presets, LUTs, and music for video editors.

${structureGuidelines}

SEO WRITING REQUIREMENTS (MUST FOLLOW):
- Word Count Check: You MUST write at least 1500-2000 words. Keep your paragraphs detailed, rich, and informative. Expand extensively on concepts, audio engineering theories, pacing, frame rates, software workflows (Premiere Pro, DaVinci Resolve, After Effects, CapCut Pro), and step-by-step settings.
- Tone: Professional, authoritative, highly engaging, conversational, yet extremely credible.
- Subheadings: Use descriptive H2 and H3 headings. Never use H1 (the title will be H1).
- Keyword Integration: Naturally integrate the keyword "${keyword}" in the first 100 words, in at least one subheading, and 3-5 times throughout the content. Do not stuff keywords unnaturally.
- Internal Linking Context: Mention relevant SFXFolder categories to drive conversions:
  * For presets/LUTs: "/preset-lut" (Presets & LUTs)
  * For sound effects: "/sound-effects" (Sound Effects / SFX)
  * For music: "/music" (Royalty-Free Music)
- Language: Write the entire article in English (US) with excellent grammar, natural flow, and standard professional video editing terminology.

RESPONSE FORMAT (CRITICAL):
Format your entire response using the exact markers below. Do not wrap the response in markdown blocks or JSON. Start directly with the markers:

===TITLE===
[A highly clickable, high-CTR English title under 65 characters. Exclude quotes.]

===METATITLE===
[SEO meta title containing the target keyword. Under 60 characters.]

===METADESCRIPTION===
[Compelling SEO meta description (140-155 characters) in English to drive search clicks.]

===SUMMARY===
[A short 2-sentence summary introducing the article.]

===IMAGEPROMPT===
[A highly detailed, gorgeous, and cinematic AI image generation prompt in English (40-60 words) for the cover photo of this article. Describe a modern, high-contrast, visually engaging concept suitable for video editors/creators. Do not include style buzzwords like "photorealistic", instead describe visual elements, colors, depth of field, neon hues, and clean professional workspace details. Exclude quotes.]

===COVERIMAGE===
[Leave this line blank, our system will generate the cover image separately]

===CONTENT===
[The entire article in Markdown format starting here. Do not escape newlines or quotes. Use headings, lists, bold text, and code blocks for technical settings correctly.]
`;
}

/**
 * Call OpenAI API via standard HTTPS fetch
 */
async function callOpenAI(modelName, prompt, apiKey) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName || "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional blog writer. Always output exactly in the requested format with markers.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorBody}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

/**
 * Call Gemini API using @google/generative-ai
 */
async function callGemini(modelName, prompt, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Default to gemini-2.5-flash if not specified
  const model = genAI.getGenerativeModel({ model: modelName || "gemini-2.5-flash" });

  let attempts = 0;
  const maxAttempts = 3;
  let delay = 2000;
  let result;

  while (attempts < maxAttempts) {
    try {
      result = await model.generateContent(prompt);
      break;
    } catch (e) {
      attempts++;
      console.warn(`[Gemini API] Attempt ${attempts}/${maxAttempts} failed: ${e.message}`);
      if (attempts >= maxAttempts) throw e;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  const text = result.response.text();
  return text;
}

/**
 * Helper function to extract text between markers
 */
function extractSection(text, tag, nextTag) {
  const startMarker = `===${tag}===`;
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return "";
  const start = startIdx + startMarker.length;
  let end = text.length;
  if (nextTag) {
    const endMarker = `===${nextTag}===`;
    const endIdx = text.indexOf(endMarker);
    if (endIdx !== -1) {
      end = endIdx;
    }
  }
  return text.substring(start, end).trim();
}

/**
 * POST handler to generate text
 */
export async function POST(req) {
  try {
    // 1. Verify admin auth
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse request body and custom keys from headers
    const body = await req.json();
    const { keyword, category, model, structureStyle } = body;

    if (!keyword) {
      return NextResponse.json({ error: "Target keyword is required" }, { status: 400 });
    }

    const customGeminiKey = req.headers.get("x-custom-gemini-key") || null;
    const customOpenAIKey = req.headers.get("x-custom-openai-key") || null;

    const selectedCategory = category || "Video Editing";
    const selectedModel = model || "gemini-2.5-flash";
    const selectedStyle = structureStyle || "guide";

    console.log(`[AI GenText] Keyword: "${keyword}", Model: "${selectedModel}", Style: "${selectedStyle}"`);

    // 3. Build detailed style prompt
    const prompt = buildStylePrompt(keyword, selectedCategory, selectedStyle);

    // 4. Execute AI Generation
    let aiText = "";
    const isGoogleModel = selectedModel.includes("gemini") || selectedModel.includes("google");

    if (isGoogleModel) {
      const apiKey = customGeminiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "your_gemini_api_key") {
        return NextResponse.json(
          { error: "Vui lòng nhập Gemini API Key trong phần cài đặt của Admin panel trước khi viết bài!" },
          { status: 400 }
        );
      }
      aiText = await callGemini(selectedModel, prompt, apiKey);
    } else {
      // Assume OpenAI model (e.g. gpt-4o)
      const apiKey = customOpenAIKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Vui lòng nhập OpenAI API Key trong phần cài đặt của Admin panel trước khi viết bài!" },
          { status: 400 }
        );
      }
      aiText = await callOpenAI(selectedModel, prompt, apiKey);
    }

    // 5. Parse response markers
    const title = extractSection(aiText, "TITLE", "METATITLE");
    const meta_title = extractSection(aiText, "METATITLE", "METADESCRIPTION");
    const meta_description = extractSection(aiText, "METADESCRIPTION", "SUMMARY");
    
    let summary = extractSection(aiText, "SUMMARY", "IMAGEPROMPT");
    if (!summary) {
      summary = extractSection(aiText, "SUMMARY", "COVERIMAGE");
    }
    
    const image_prompt = extractSection(aiText, "IMAGEPROMPT", "COVERIMAGE");
    const content = extractSection(aiText, "CONTENT", null);

    // Validate parsed results
    if (!title || !content) {
      console.warn("[AI GenText] Marker extraction failed. Attempting JSON parsing fallback...", aiText.substring(0, 300));
      // Attempt JSON parser fallback
      try {
        const cleanText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonFallback = JSON.parse(cleanText);
        if (jsonFallback.title && jsonFallback.content) {
          return NextResponse.json(jsonFallback);
        }
      } catch (jsonErr) {
        // Fallback: If both fail, return raw text or throw error
        throw new Error("Failed to extract structured AI article. Please try again or modify your keyword.");
      }
    }

    // 6. Return standard structured response
    return NextResponse.json({
      title,
      meta_title: meta_title || `${title} — SFXFolder`,
      meta_description: meta_description || summary || `In-depth guide to ${keyword} for professional video editors and content creators.`,
      summary: summary || `Discover how to master ${keyword} to optimize your video editing workflow and timeline organization.`,
      content,
      image_prompt: image_prompt || "",
      wordCount: content ? content.split(/\s+/).length : 0,
    });
  } catch (err) {
    console.error("[AI GenText] Core Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
