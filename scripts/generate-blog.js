/**
 * SFXFolder.com — AI Blog SEO Auto-Publishing Engine
 * Run: node scripts/generate-blog.js "free risers sound effects" "Sound Effects"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Nhập thư viện Google Generative AI (Hỗ trợ viết bài chi phí $0 hoặc cực kỳ thấp)
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  // Thư viện chưa được cài đặt
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Thiếu cấu hình Supabase trong .env.local!");
  process.exit(1);
}

// Hạn chế lỗi Node.js < 22 thiếu WebSocket cho Supabase Realtime (chúng ta không dùng Realtime ở đây)
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class {};
}

// Khởi tạo Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const SITE_URL = 'https://sfxfolder.com';

// Hàm tự động tạo slug thân thiện SEO
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu tiếng Việt
    .replace(/\s+/g, '-')           // Thay khoảng trắng bằng dấu -
    .replace(/[^\w\-]+/g, '')       // Loại bỏ ký tự đặc biệt
    .replace(/\-\-+/g, '-')         // Loại bỏ nhiều dấu - liên tiếp
    .replace(/^-+/, '')             // Loại bỏ dấu - ở đầu
    .replace(/-+$/, '');            // Loại bỏ dấu - ở cuối
}

async function run() {
  const keyword = process.argv[2];
  const categoryName = process.argv[3] || "Video Editing";

  if (!keyword) {
    console.log("👉 Vui lòng cung cấp từ khóa mục tiêu!");
    console.log("Ví dụ: node scripts/generate-blog.js \"how to color grade with luts\" \"Preset & LUT\"");
    process.exit(1);
  }

  console.log(`🤖 Bắt đầu sinh bài viết chuẩn SEO cho từ khóa: "${keyword}"...`);

  // Viết Prompt tối ưu SEO tối đa cho AI
  const prompt = `
You are an elite SEO Content Specialist and a professional Video Editor.
Write a comprehensive, deep-dive article (1500 to 2500 words) targeted at the keyword: "${keyword}".
The article is categorized under: "${categoryName}" for the website SFXFolder (which provides free sound effects, transitions, presets, LUTs, and music for video editors).

Guidelines:
1. Tone: Professional, authoritative, actionable, and engaging.
2. Structure: Use H2 and H3 headings. Do NOT use H1 (the title will be H1).
3. Include an engaging introduction that hooks the reader.
4. Provide concrete, step-by-step tips or examples based on real-world video editing workflow.
5. Create a seamless, logical internal link reference to the category "${categoryName}" pages (e.g. "/preset-lut" for Presets/LUTs, "/sound-effects" for SFX, "/music" for royalty-free music) to drive conversion and downloads.
6. Write in complete Markdown syntax. Make sure headers, lists, code snippets, and bold text are correctly formatted.
7. Ensure the article is extremely rich, detailed, and meets the word count requirement (1500-2500 words). Expand on concepts, technical instructions, workflows, and audio theories.

Format your entire response using the exact markers below. Do not wrap the response in markdown blocks or JSON:

===TITLE===
[An incredibly clickable, high-CTR title under 60 characters. Do not include quotes.]

===METATITLE===
[SEO-friendly meta title including the target keyword. Under 60 characters.]

===METADESCRIPTION===
[Compelling search snippet (140-155 characters) for high click-through rate.]

===SUMMARY===
[A short 2-sentence summary introducing the article.]

===COVERIMAGE===
[A high-quality Unsplash image URL related to the topic (e.g. https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200 or leave blank)]

===CONTENT===
[The full article in Markdown format starting here. Do not escape newlines or quotes. Write naturally.]
`;

  try {
    let aiResponse;
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key' && GoogleGenerativeAI) {
      console.log("⏳ Đang gọi Gemini API sinh bài viết (có thể mất 15-30 giây)...");
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      let attempts = 0;
      const maxAttempts = 4;
      let delay = 3000;
      let result;
      
      while (attempts < maxAttempts) {
        try {
          result = await model.generateContent(prompt);
          break;
        } catch (e) {
          attempts++;
          console.warn(`⚠️ Lần thử ${attempts}/${maxAttempts} thất bại: ${e.message}`);
          if (attempts >= maxAttempts) throw e;
          console.log(`⏳ Đang chờ ${delay / 1000} giây trước khi thử lại...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
      
      const text = result.response.text();
      
      // Helper function to extract content between markers
      const extractSection = (tag, nextTag) => {
        const startMarker = `===${tag}===`;
        const startIdx = text.indexOf(startMarker);
        if (startIdx === -1) return '';
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
      };

      const extractedTitle = extractSection('TITLE', 'METATITLE');
      const extractedMetaTitle = extractSection('METATITLE', 'METADESCRIPTION');
      const extractedMetaDesc = extractSection('METADESCRIPTION', 'SUMMARY');
      const extractedSummary = extractSection('SUMMARY', 'COVERIMAGE');
      const extractedCover = extractSection('COVERIMAGE', 'CONTENT');
      const extractedContent = extractSection('CONTENT', null);

      if (!extractedTitle || !extractedContent) {
        try {
          // JSON fallback
          const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          aiResponse = JSON.parse(cleanText);
        } catch (jsonErr) {
          throw new Error("Could not parse AI response using markers or JSON. Response started with: " + text.substring(0, 200));
        }
      } else {
        aiResponse = {
          title: extractedTitle,
          meta_title: extractedMetaTitle,
          meta_description: extractedMetaDesc,
          summary: extractedSummary,
          cover_image: extractedCover || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200",
          content: extractedContent
        };
      }
    } else {
      console.log("⚠️ Không phát hiện GEMINI_API_KEY hoặc chưa cài thư viện. Chạy ở chế độ Mock-data bài viết thử nghiệm!");
      aiResponse = {
        title: keyword,
        meta_title: `Ultimate Guide: ${keyword} for Video Editors`,
        meta_description: `Learn how to master ${keyword} to cut your video editing time in half. Step-by-step sound design, mixing, and layouts tips.`,
        summary: `A comprehensive guide exploring how to leverage ${keyword} to create high-impact video edits, featuring pro-tips from over a decade of industry experience.`,
        content: `## Introduction
When we think of great cinema or viral digital videos, our minds naturally drift to the stunning visuals—the sharp transitions, the vivid color grading, and the fast-paced cuts. However, professional creators know a secret: **audio is 50% of the viewing experience**. In fact, a video with mediocre visuals and excellent sound will almost always hold retention better than a gorgeous 4K video with poor, shallow, or unbalanced audio. 

This is where the power of **${keyword}** comes in. In this comprehensive guide, we will dive deep into how you can harness high-quality soundscapes to instantly elevate your production value, hook your audience in the first three seconds, and keep them engaged throughout your entire video workflow. Whether you are editing a high-energy YouTube vlog, a cinematic travel film, a social media TikTok/Reel, or a corporate video, these principles will help you edit faster and produce sound designs that truly wow your audience.

---

## 1. What Exactly is ${keyword}?
Before we unpack the technical steps, let's establish a clear understanding of what **${keyword}** represents in the modern content ecosystem. In high-level audio production, this term refers to the deliberate selection, timing, and layering of sonic assets to emphasize physical movement, create atmospheric tension, and reinforce structural changes. 

In a world where viewer attention spans are shorter than ever, using sound design is no longer optional. It serves as an invisible guide, directing the viewer's eyes and emotional response exactly where you want them. Without appropriate sound effects, transitions feel abrupt, visual effects look cheap, and pacing feels sluggish. By masterfully incorporating **${keyword}**, you create a cohesive audio-visual bond that makes your final export feel premium and cinematic.

---

## 2. The Science of Auditory Psychology in Video Editing
Why do certain videos keep us glued to our screens while others make us swipe away in seconds? The answer lies in auditory psychology. Sound triggers emotional regions of the brain much faster than sight. A low-frequency riser build-up, for example, triggers anticipation and heart-rate elevation, while a sudden, crisp hit releases that tension and signals a shift in scene or narrative direction.

When building your audio timeline, keep these three psychological pillars in mind:
*   **Anticipation:** Use smooth, reverse-crescendo sound effects (like risers or whooshes) just before a major cut or transition. This prepares the brain for change and prevents visual jarring.
*   **Emphasis:** Highlight key moments (like text overlays, logo reveals, or dramatic gestures) with a dedicated sound impact. A subtle "woosh-hit" combination makes abstract graphics feel tactile and heavy.
*   **Cohesion:** Ambient background tracks (like forest winds, coffee shop chatter, or room tone) provide a continuous sound bed. This masks any cuts in your dialogue tracks and glues different camera angles together.

---

## 3. Five Essential Sound Design Categories Every Editor Needs
To build a truly rich soundscape, you cannot rely on just a single sound effect. You must understand the five primary pillars of sound design and how to layer them together in your timeline:

### A. Whooshes & Transition Sounds
These are short, directional sound sweeps. They mimic the physical sound of an object flying past the camera lens. Use them to mask fast camera pans, whip cuts, zoom transitions, or graphics flying onto the screen.

### B. Hits & Cinematic Impacts
These are heavy, low-frequency sounds (often featuring deep bass, sub-booms, or dramatic orchestral hits). They mark a significant transition point, the climax of a scene, or a bold title card reveal. Use them sparingly so they do not lose their impact.

### C. Foley & Practical Effects
Foley includes everyday real-world sounds—footsteps, keyboard clicks, paper rustling, glasses clinking, and clothes rustling. Adding these subtle layers beneath your main dialogue makes your scenes feel incredibly realistic and authentic.

### D. Ambient & Environmental Bed
This is the continuous background noise that defines the space of your video. Whether it is a rainy night, a quiet room, or a busy city street, the ambient bed establishes context instantly before anyone even speaks.

### E. Music & Melodic Beds
Music drives the emotional pace of your story. Integrating [Royalty-Free Music](/music) alongside your sound effects creates a rich, full-bodied sonic experience that binds the entire production together.

---

## 4. Step-by-Step Audio Editing Guide in Premiere Pro & DaVinci Resolve
Now let's translate these concepts into a concrete, professional editing workflow inside your favorite Non-Linear Editor (NLE). Follow this step-by-step layout to clean up your timeline and prevent messy audio tracks:

### Step 1: Organize Your Audio Tracks
Never dump your audio assets randomly on the same track. A clean timeline should be organized like this:
*   **Track A1 & A2:** Dialogues, Voiceovers, and primary speech tracks.
*   **Track A3 & A4:** Foley, footsteps, and close-up practical effects.
*   **Track A5 & A6:** Whooshes, sweeps, and transition sound effects.
*   **Track A7 & A8:** Cinematic impacts, bass drops, and hits.
*   **Track A9 & A10:** Ambient background noise and environmental beds.
*   **Track A11 & A12:** Main background music tracks.

### Step 2: Use Crossfades on Every Single Cut
One of the easiest ways to spot an amateur video is hearing a tiny "click" or "pop" sound at the boundary of an audio edit. To prevent this, apply a very short **Constant Power** or **Crossfade** transition (usually 2 to 4 frames long) at every single cut on your dialogue and ambient tracks. This ensures a seamless, noise-free transition.

### Step 3: Frequency Separation & EQ
Avoid letting your sound effects compete with your main voiceover. Your voiceover sits primary in the mid-range frequencies (typically between 100Hz to 3kHz). Use a **Parametric Equalizer** to carve out a slight dip in your background music and sound effects in this frequency range, allowing the human voice to cut through cleanly.

### Step 4: The Power of Submixing
Group your similar tracks together into **Submixes** (e.g., all SFX into a single SFX Submix, and all Music into a Music Submix). This allows you to apply master compression, volume adjustments, or limiting to an entire category of sounds simultaneously, saving hours of manual automation.

---

## 5. Audio Normalization Standards: Target LUFS for YouTube and Social Media
Have you ever uploaded a video to YouTube, only to find it sounds significantly quieter or louder than other videos on the platform? This is due to YouTube's strict **loudness normalization** algorithm. 

YouTube normalizes all audio to a target of **-14 LUFS** (Loudness Units Full Scale). If your audio is louder than -14 LUFS, YouTube will automatically turn down the volume of your video, which can sometimes squish your dynamic range. 

Here is how to optimize your audio output settings:
1.  Use a Loudness Meter on your master output track.
2.  Aim for your integrated overall loudness to sit around **-14 LUFS** to **-16 LUFS**.
3.  Set your **True Peak** limit to **-1.0 dBTP** to prevent digital clipping and distortion on mobile devices.
4.  Keep your dialogue sitting comfortably between **-10dB** and **-15dB** on the standard level meters.

---

## 6. Accessing Premium Assets for Your Video Production
Creating high-end audio layouts requires high-quality source files. Low-bitrate or compressed audio files will sound muddy and unprofessional when played on high-end speakers or headphones. 

At **SFXFolder**, we provide premium, studio-grade sound assets designed specifically for modern content creators:
*   **Need Sound Design?** Explore and download hundreds of [Free Sound Effects](/sound-effects) including whooshes, transitions, and cinematic hits.
*   **Need Fast Color Grading?** Check out our extensive collection of high-fidelity [Free LUTs & Presets](/preset-lut) to give your video an instant cinematic color theme.
*   **Need Music?** Browse our catalog of curated, high-impact [Royalty-Free Music](/music) tracks.

All assets on SFXFolder are 100% royalty-free, completely free to download, and ready for commercial use on YouTube, Facebook, and commercial client projects.

---

## Conclusion
Mastering the art of **${keyword}** is one of the most powerful and cost-effective ways to set your content apart in a crowded marketplace. By organizing your timeline, using psychological sound layers, and adhering to professional export standards, you will double your viewer engagement and elevate your personal brand. Explore the extensive libraries on SFXFolder today, grab your free assets, and make your next video sound spectacular!`,
        cover_image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200"
      };
    }

    const slug = slugify(aiResponse.title);
    
    // Ghi trực tiếp bài viết vào bảng Supabase blog_posts
    console.log("💾 Đang xuất bản bài viết lên Supabase...");
    const { data, error } = await supabase
      .from('blog_posts')
      .upsert({
        title: aiResponse.title,
        slug: slug,
        content: aiResponse.content,
        summary: aiResponse.summary,
        cover_image: aiResponse.cover_image,
        meta_title: aiResponse.meta_title,
        meta_description: aiResponse.meta_description,
        status: 'published' // Ghi nhận trạng thái published để hiện ngay lên web
      }, { onConflict: 'slug' })
      .select();

    if (error) {
      throw error;
    }

    console.log(`\n🎉 BÀI VIẾT ĐÃ ĐƯỢC XUẤT BẢN THÀNH CÔNG!`);
    console.log(`📌 Tiêu đề: ${data[0].title}`);
    console.log(`🔗 URL: ${SITE_URL}/v1/blog/${data[0].slug}`);
    console.log(`📅 Ngày tạo: ${data[0].created_at}`);

  } catch (err) {
    console.error("❌ Lỗi trong quá trình sinh bài viết:", err.message);
  }
}

run();
