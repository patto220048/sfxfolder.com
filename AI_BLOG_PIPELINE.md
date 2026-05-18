# 🤖 Hướng Dẫn Thiết Lập AI Content Pipeline Tự Chủ (Chi Phí Vận Hành $0)

Hệ thống AI Content Pipeline tự động hóa 100% quy trình: **Nghiên cứu từ khóa ➡️ Sinh nội dung dài 1500-2500 từ chuẩn SEO bằng AI ➡️ Đăng trực tiếp vào Supabase Database** để Next.js tự động cập nhật lên trang chủ và Sitemap.

---

## 📋 Mục lục
1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Thiết lập môi trường](#2-thiết-lập-môi-trường)
3. [Mã nguồn Script Tự Động Hóa (`scripts/generate-blog.js`)](#3-mã-nguồn-script-tự-động-hóa-scriptsgenerate-blogjs)
4. [Cách thức vận hành và mở rộng](#4-cách-thức-vận-hành-và-mở-rộng)

---

## 1. Yêu cầu hệ thống
Chúng ta sẽ sử dụng một script Node.js cục bộ chạy trực tiếp trên máy của bạn.
* **Next.js + Supabase:** Đã được thiết lập đầy đủ.
* **Anthropic Claude API Key:** Hoặc **OpenAI API Key** để AI viết bài (chi phí trung bình mỗi bài viết ~ $0.05 - $0.1).
* **Supabase Service Role Key:** Cho quyền ghi đè (bypass RLS) an toàn vào bảng `blog_posts` từ script cục bộ.

---

## 2. Thiết lập môi trường

1. Đảm bảo bạn đã cài đặt các thư viện cần thiết cho script bằng cách chạy lệnh sau trong thư mục dự án:
   ```bash
   npm install dotenv @supabase/supabase-js @google/generative-ai
   ```
   *(Hoặc cài đặt `@google/generative-ai` / `openai` / `@anthropic-ai/sdk` tùy thuộc vào nhà cung cấp LLM bạn ưu tiên)*

2. Mở file `.env.local` của dự án và đảm bảo có các biến môi trường sau:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-share-this
   GEMINI_API_KEY=your-gemini-api-key
   ```
   *(Chúng tôi sẽ demo bằng **Google Gemini Pro** - có gói miễn phí/chi phí siêu rẻ và hỗ trợ viết tiếng Anh/tiếng Việt cực kỳ tốt, bạn có thể dễ dàng chuyển sang Claude hoặc GPT-4o nếu muốn).*

---

## 3. Mã nguồn Script Tự Động Hóa (`scripts/generate-blog.js`)

Tạo một tệp mới có đường dẫn `scripts/generate-blog.js` và dán mã nguồn sau:

```javascript
/**
 * SFXFolder.com — AI Blog SEO Auto-Publishing Engine
 * Run: node scripts/generate-blog.js "free risers sound effects" "Sound Effects"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/generative-ai'); // Bạn có thể thay bằng Claude/OpenAI SDK

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Thiếu cấu hình Supabase trong .env.local!");
  process.exit(1);
}

// 1. Khởi tạo Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

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

  // 2. Viết Prompt tối ưu SEO tối đa cho AI
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

Return your response in STRICT JSON format with the following keys. Do NOT include markdown code blocks around the JSON in your response:
{
  "title": "An incredibly clickable, high-CTR title (under 60 characters)",
  "meta_title": "SEO-friendly meta title including the target keyword",
  "meta_description": "Compelling search snippet (140-155 characters) for high click-through rate",
  "summary": "A 2-sentence summary introducing the article",
  "content": "The full article in Markdown format",
  "cover_image": "A high-quality Unsplash image URL related to the topic (e.g. https://images.unsplash.com/photo-... or leave empty)"
}
`;

  try {
    // 3. Gọi Gemini/Claude API để viết bài
    // Bạn có thể viết logic này cho Claude (Anthropic API) tương ứng:
    console.log("⏳ Đang gọi AI Model sinh bài viết (có thể mất 15-30 giây)...");
    
    // Giả lập cuộc gọi API (Hoặc gọi thật nếu đã cấu hình API Key)
    let aiResponse;
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key') {
      const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } else {
      console.log("⚠️ Không phát hiện GEMINI_API_KEY. Chạy ở chế độ Mock-data bài viết thử nghiệm!");
      aiResponse = {
        title: `How to Optimize Your Video Workflow using ${keyword}`,
        meta_title: `Ultimate Guide: ${keyword} for Video Editors`,
        meta_description: `Learn how to master ${keyword} to cut your video editing time in half. Step-by-step sound design and layout tips.`,
        summary: `A comprehensive guide exploring how to leverage ${keyword} to create high-impact video edits, featuring pro-tips from over a decade of industry experience.`,
        content: `## Introduction\nIn today's fast-paced video production world, speed and quality are everything. Utilizing **${keyword}** effectively can elevate your edits from amateur to cinema-grade.\n\n## 1. Why Sound Design Matters\nSound design accounts for 50% of the viewer's experience. Using high-quality [Free Sound Effects](/sound-effects) or dynamic [Royalty-Free Music](/music) creates an immersive atmosphere that visual effects alone cannot achieve.\n\n### Practical Tips for Audio Editing:\n* Always fade audio cuts to avoid click sounds.\n* Level your dialogue at -12dB to -18dB.\n* Layer ambient background noise below your main tracks.\n\n## 2. Speeding Up Color Grading\nIf you want cinematic aesthetics in seconds, color grading presets and [Free LUTs](/preset-lut) are your best friends. They give your footage a consistent theme instantly.\n\n## Conclusion\nBy integrating ${keyword} into your day-to-day workflow, you save time, improve storytelling, and deliver videos that wow your clients. Explore SFXFolder today to download 100% free assets!`,
        cover_image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200"
      };
    }

    const slug = slugify(aiResponse.title);
    
    // 4. Ghi trực tiếp bài viết vào bảng Supabase blog_posts
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
```

---

## 4. Cách thức vận hành và mở rộng

### Chạy CLI viết bài nhanh:
Bạn chỉ cần mở terminal trong dự án và chạy:
```bash
node scripts/generate-blog.js "how to use cinematic sound effects in premiere pro" "Sound Effects"
```
Script sẽ ngay lập tức tự động sinh bài viết dài chuẩn SEO chuyên ngành, tạo ảnh bìa chất lượng cao, chèn link điều hướng tải tài nguyên và đăng thẳng lên trang sản xuất mà không cần bấm tay!

### Quy trình xây dựng Lịch trình Nội dung (Content Calendar) đề xuất:
1. **Tìm kiếm các bộ từ khóa ngách:** (ví dụ: *free transitions for premiere, cinematic whoosh sound effects free, luts cinematic pack free download*).
2. **Lên lịch hàng tuần:** Viết một file bash script nhỏ hoặc chạy tay lệnh trên định kỳ 2 bài viết/tuần.
3. Google sẽ lập tức thu thập các bài viết này từ Sitemap động đã liên kết, tăng thứ hạng SEO tự nhiên cực nhanh và thu hút thêm hàng ngàn lượt traffic miễn phí hàng tháng trỏ thẳng về `sfxfolder.com/v1/blog/[slug]`!
