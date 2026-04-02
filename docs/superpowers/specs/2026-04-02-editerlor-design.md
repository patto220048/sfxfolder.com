# EditerLor — Design Specification

> Free Resources for Video Editors
> Web lưu trữ & chia sẻ tài nguyên edit video cho cộng đồng

---

## 1. Tổng quan

### 1.1 Mục đích
Xây dựng một trang web công khai cho cộng đồng editor, giúp tải nhanh các tài nguyên hỗ trợ edit video. Tất cả tài nguyên được phân chia theo thư mục rõ ràng, giao diện chuyên nghiệp với animation ấn tượng, và đặc biệt là **1-click download** — không popup, không redirect.

### 1.2 Đối tượng
- **Người dùng (Visitor):** Video editor, content creator — không cần đăng ký tài khoản
- **Admin:** Chủ web — quản lý upload, phân loại, thống kê

### 1.3 Thương hiệu
- **Tên:** EditerLor
- **Tagline:** Free Resources for Video Editors
- **URL mục tiêu:** editerlor.com (hoặc tương tự)

---

## 2. Tech Stack

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Frontend | **Next.js 14** (App Router) | SSR/SSG cho SEO, API routes cho backend |
| Database | **Firebase Firestore** | NoSQL linh hoạt, realtime, free tier |
| File Storage | **Firebase Storage** | CDN tích hợp, download nhanh |
| Admin Auth | **Firebase Authentication** | Chỉ admin đăng nhập |
| Hosting | **Vercel** | Deploy tự động từ Git, miễn phí |
| Styling | **Vanilla CSS** + CSS Modules | Toàn quyền kiểm soát animation |
| Icons | **Lucide React** | Nhẹ, đẹp, consistent |
| Fonts | **Google Fonts** (Space Grotesk + Inter) | Miễn phí, nhanh |

---

## 3. Thiết kế giao diện (UI/UX)

### 3.1 Phong cách: Dark + Neon Accent

#### Bảng màu

```
BACKGROUNDS
├── Primary BG:     #0A0A0F  (gần đen, hơi xanh tím)
├── Card BG:        #12121A  (nhỉnh hơn nền 1 chút)
├── Surface:        #1A1A2E  (navbar, sidebar, input)
└── Hover:          #252540  (hover state)

NEON ACCENTS
├── Cyan:           #00F0FF  (primary — buttons, search, active states)
├── Purple:         #A855F7  (secondary — links, tags, hover)
├── Pink:           #F43F5E  (tertiary — notifications, glow)
└── Glow effect:    box-shadow: 0 0 20px rgba(0,240,255,0.3)

TEXT
├── Primary:        #F1F5F9  (trắng ngà)
├── Secondary:      #94A3B8  (xám nhạt)
└── Muted:          #64748B  (placeholder, caption)

BORDERS
├── Default:        #1E293B
└── Active:         #00F0FF
```

#### Typography

```
Heading:    "Space Grotesk" — hiện đại, techy
Body:       "Inter" — dễ đọc, chuyên nghiệp
Monospace:  "JetBrains Mono" — file format, size display
```

### 3.2 Micro-Animations (tham khảo UIverse.io)

| # | Thành phần | Animation | CSS |
|---|---|---|---|
| 1 | Download Button | Gradient slide fill (cyan→purple) | `background-size: 200%` |
| 2 | Download Button | Ripple click neon | `::after` + `@keyframes ripple` |
| 3 | Download Button | Icon bounce khi hover | `translateY(-2px)` |
| 4 | Card | Glassmorphism lift + glow | `backdrop-filter: blur` + `translateY(-4px)` |
| 5 | Card | Glow tracking (ánh sáng theo cursor) | CSS vars + JS mousemove |
| 6 | Card | Blur-to-clear khi hover | `filter: blur(1px)` → `blur(0)` |
| 7 | Card Grid | Staggered entrance khi load | `animation-delay: calc(i * 50ms)` |
| 8 | Context Search | Pop-in scale + fade | `scale(0.9→1)` + `opacity` |
| 9 | Context Search | Rainbow rotating border | `conic-gradient` + `spin` |
| 10 | Sidebar Tree | Accordion smooth | `max-height` transition |
| 11 | Sidebar Tree | Active neon bar bên trái | `border-left` + glow |
| 12 | Category Card | Pulse glow theo accent color | `@keyframes pulse` |
| 13 | Logo | Glitch text effect | `clip-path` + offset `::before/::after` |
| 14 | Navbar | Glassmorphism blur khi scroll | `backdrop-filter: blur(12px)` |
| 15 | Loading | Orbiting neon dots | `@keyframes orbit` |

---

## 4. Cấu trúc trang

### 4.1 Sitemap

```
EditerLor
├── /                          Trang chủ (8 danh mục)
├── /{category-slug}           Trang danh mục (sidebar tree + card grid)
├── /search                    Tìm kiếm toàn trang
├── /admin                     Admin Panel
│   ├── /admin/login           Đăng nhập
│   ├── /admin/dashboard       Thống kê
│   ├── /admin/resources       Quản lý tài nguyên
│   ├── /admin/resources/new   Thêm mới
│   ├── /admin/folders         Quản lý folder
│   ├── /admin/tags            Quản lý tags
│   └── /admin/settings        Cài đặt
└── /about                     Giới thiệu (optional)
```

### 4.2 Trang chủ

- Hero section: Logo glitch effect + tagline + search bar (neon glow border)
- Grid 4×2 hiển thị 8 danh mục
- Mỗi ô: icon + tên + accent color riêng + số lượng file + pulse glow
- Click vào ô → chuyển trang danh mục
- Không hiển thị "Mới nhất" hay "Phổ biến nhất" — trang chủ chỉ tập trung 8 danh mục

### 4.3 Trang danh mục (Layout chính)

**Layout 2 cột: Sidebar Tree (trái) + Card Grid (phải)**

#### Sidebar Tree (bên trái, ~250px)
- Hiển thị cây thư mục dạng tree folder
- Click ► để mở rộng folder con (accordion animation)
- Click tên folder → main content hiển thị cards trong folder đó
- Folder đang chọn: highlight accent color + neon bar trái
- Badge số lượng file `(12)` cạnh tên folder
- Mobile: sidebar ẩn → hamburger menu, swipe trái sang

#### Card Grid (bên phải)
- Breadcrumb ở trên: `Sound Effects > Transition > Whoosh`
- Grid responsive: 4 cột desktop, 3 tablet, 2 mobile
- Filter bar: lọc theo tags, format, sắp xếp
- Load more / infinite scroll

#### Resource Card
- Thumbnail / preview area (hover → auto preview)
- Tên file
- Format + kích thước (mp3 · 124KB)
- Tags
- Số lượt tải (⬇ 1,520)
- Nút DOWNLOAD — cyan neon glow, 1-click tải ngay

### 4.4 Context Search (Right-click Search)

- Right-click ở bất kỳ đâu trên web → hiện ô tìm kiếm tại vị trí cursor
- Override context menu mặc định của trình duyệt
- Auto-focus input, gõ ngay lập tức
- Kết quả realtime hiện bên dưới (debounce 200ms)
- Điều khiển:
  - `↑` `↓`: di chuyển highlight qua kết quả
  - `Enter`: chọn kết quả (mở/download)
  - `Esc` / click ngoài: đóng (fade out)
  - Click chuột: chọn trực tiếp
- Animation: pop-in scale 0.9→1 + rainbow rotating border
- Vị trí thông minh: tự đẩy trái/lên nếu gần cạnh màn hình

### 4.5 Preview theo loại tài nguyên

| Danh mục | Preview |
|---|---|
| Sound Effects, Music | Audio waveform player (play/pause, thanh tiến trình, volume) |
| Video Meme, Green Screen | Video player inline (hover play, click fullscreen) |
| Animation | Video/GIF loop tự động |
| Image & Overlay | Lightbox zoom, nền caro cho PNG transparent |
| Font | Text preview "Aa Bb Cc 123" với font đó |
| Preset & LUT | Before/After slider (ảnh gốc ↔ ảnh đã áp preset) |

---

## 5. Cơ sở dữ liệu (Firestore)

### 5.1 Collection: `resources`

```
resources/{resourceId}
├── name: string              // "Whoosh Transition"
├── slug: string              // "whoosh-transition"
├── description: string       // "Hiệu ứng whoosh cho transition"
├── category: string          // "sound-effects"
├── folder: string            // "Transition/Whoosh"
├── folderPath: string[]      // ["Transition", "Whoosh"]
├── tags: string[]            // ["transition", "whoosh"]
├── fileUrl: string           // Firebase Storage URL
├── fileSize: number          // bytes
├── fileFormat: string        // "mp3"
├── previewUrl: string        // URL preview (có thể = fileUrl)
├── thumbnailUrl: string      // Ảnh thumbnail
├── downloadCount: number     // Lượt tải
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── isPublished: boolean      // Ẩn/hiện
```

### 5.2 Collection: `categories`

```
categories/{categoryId}
├── name: string              // "Sound Effects"
├── slug: string              // "sound-effects"
├── icon: string              // "volume-2" (Lucide)
├── color: string             // "#00F0FF"
├── description: string
├── order: number             // Thứ tự hiển thị
├── resourceCount: number     // Tự động cập nhật
└── allowedFormats: string[]  // ["mp3", "wav", "ogg"]
```

### 8 danh mục mặc định:

| # | Slug | Tên | Color | Icon |
|---|------|-----|-------|------|
| 1 | sound-effects | Sound Effects | #00F0FF (Cyan) | volume-2 |
| 2 | music | Music | #A855F7 (Purple) | music |
| 3 | video-meme | Video Meme | #FBBF24 (Yellow) | film |
| 4 | green-screen | Green Screen | #22C55E (Green) | monitor |
| 5 | animation | Animation | #F43F5E (Pink) | sparkles |
| 6 | image-overlay | Image & Overlay | #F97316 (Orange) | image |
| 7 | font | Font | #E2E8F0 (Silver) | type |
| 8 | preset-lut | Preset & LUT | #6366F1 (Indigo) | sliders |

### 5.3 Collection: `folders`

```
folders/{folderId}
├── name: string              // "Whoosh"
├── categorySlug: string      // "sound-effects"
├── parentFolder: string|null // "Transition" (null nếu root)
├── path: string              // "Transition/Whoosh"
├── order: number
└── resourceCount: number
```

### 5.4 Collection: `settings`

```
settings/general
├── siteName: string          // "EditerLor"
├── tagline: string           // "Free Resources for Video Editors"
├── seoDescription: string
├── logoUrl: string
├── contactEmail: string
├── socialLinks: object       // { facebook, discord, youtube }
└── updatedAt: Timestamp
```

---

## 6. Admin Panel

### 6.1 Đăng nhập
- URL ẩn: `/admin` (không có link từ trang chính)
- Firebase Auth (email + password)
- Chỉ 1 tài khoản admin

### 6.2 Dashboard
- Tổng số file, tổng lượt download, số danh mục
- Biểu đồ download theo tuần
- Top downloads hôm nay

### 6.3 Upload tài nguyên
- **Upload đơn:** Kéo thả file → chọn danh mục, folder, tags, mô tả → Publish
- **Upload hàng loạt (Batch):** Kéo nhiều file → áp dụng chung danh mục/folder/tags → Upload tất cả
- **Auto-generate:** Tên từ filename, format/size tự detect, thumbnail tự tạo, slug tự tạo
- **Preview file tách biệt:** Có thể upload file preview riêng (audio cắt 10s, video cắt 5s)

### 6.4 Quản lý tài nguyên
- Bảng danh sách: tên, danh mục, lượt tải, hành động (sửa/xóa)
- Lọc theo danh mục, tìm kiếm theo tên
- Chọn nhiều → xóa hàng loạt / chuyển folder
- Phân trang

### 6.5 Quản lý Folder
- Hiển thị tree folder theo từng danh mục
- CRUD: tạo, sửa, xóa, sắp xếp (kéo thả)
- Hỗ trợ nested folder (folder con)

### 6.6 Quản lý Tags
- Danh sách tags đang dùng
- Thêm/xóa tags

### 6.7 Settings
- Tên web, tagline, SEO description
- Upload/thay logo
- Email liên hệ, social links
- Đổi mật khẩu admin

---

## 7. Tính năng chính

### 7.1 Tìm kiếm nâng cao
- Search bar trên navbar + hero trang chủ
- Context Search (right-click) với keyboard navigation
- Tìm theo tên, tags, mô tả
- Lọc theo danh mục, format file
- Sắp xếp: mới nhất, nhiều lượt tải nhất

### 7.2 Preview trước khi tải
- Hover card → auto play preview
- Click → mở preview chi tiết
- Mỗi loại tài nguyên có kiểu preview riêng (xem mục 4.5)

### 7.3 1-Click Download
- Nhấn nút Download → file tải ngay (không popup, không redirect)
- Gọi API tăng downloadCount ở background
- Nút có animation xác nhận (ripple + icon ✓ 1s)

### 7.4 Hiển thị số lượt tải
- Mỗi card hiển thị số lượt tải
- Tự động cập nhật khi có download mới

---

## 8. Responsive Design

| Breakpoint | Layout |
|---|---|
| Desktop (≥1200px) | Grid 4 cột, sidebar tree cố định |
| Tablet (768-1199px) | Grid 3 cột, sidebar thu hẹp |
| Mobile (<768px) | Grid 2 cột, sidebar → hamburger slide-in |

---

## 9. SEO

- SSG/SSR cho tất cả trang public
- Meta title + description cho mỗi trang
- Open Graph tags cho chia sẻ social
- Semantic HTML5
- URL thân thiện: `/{category-slug}/{resource-slug}`
- Auto-generate sitemap.xml
- robots.txt

---

## 10. Kế hoạch triển khai

### Phase 1 — Nền tảng (Tuần 1-2)
- Setup Next.js 14 + Firebase project
- Thiết kế UI system (colors, fonts, CSS variables, components cơ bản)
- Trang chủ: hero + 8 danh mục grid
- Layout sidebar tree + card grid
- Admin: đăng nhập + upload đơn cơ bản

### Phase 2 — Tính năng chính (Tuần 3-4)
- 1-Click Download + đếm lượt tải
- Preview inline (audio/video/image/font/preset)
- Context Search (right-click + keyboard navigation)
- Search bar + filter & sort
- Admin: batch upload + quản lý folder + quản lý tags
- Responsive mobile

### Phase 3 — Hoàn thiện (Tuần 5)
- Admin Dashboard (thống kê, biểu đồ)
- Admin Settings
- SEO optimization (meta, sitemap, OG tags)
- Performance (lazy load, image optimization, CDN)
- Tất cả 15 micro-animations
- Deploy Vercel + kết nối domain

---

## 11. Cấu trúc thư mục dự án

```
f:\re-src-web\
├── public/
│   ├── fonts/
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.js              // Root layout (navbar + footer)
│   │   ├── page.js                // Trang chủ
│   │   ├── [category]/
│   │   │   └── page.js            // Trang danh mục (sidebar + grid)
│   │   ├── search/
│   │   │   └── page.js            // Trang tìm kiếm
│   │   ├── admin/
│   │   │   ├── login/page.js
│   │   │   ├── dashboard/page.js
│   │   │   ├── resources/page.js
│   │   │   ├── resources/new/page.js
│   │   │   ├── folders/page.js
│   │   │   ├── tags/page.js
│   │   │   └── settings/page.js
│   │   └── api/
│   │       ├── resources/route.js
│   │       ├── download/route.js
│   │       ├── upload/route.js
│   │       └── search/route.js
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.js
│   │   │   ├── Footer.js
│   │   │   └── Sidebar.js
│   │   ├── ui/
│   │   │   ├── ResourceCard.js
│   │   │   ├── CategoryCard.js
│   │   │   ├── DownloadButton.js
│   │   │   ├── ContextSearch.js
│   │   │   ├── SearchBar.js
│   │   │   ├── TreeFolder.js
│   │   │   ├── AudioPlayer.js
│   │   │   ├── VideoPlayer.js
│   │   │   └── FilterBar.js
│   │   └── admin/
│   │       ├── AdminSidebar.js
│   │       ├── UploadForm.js
│   │       ├── BatchUpload.js
│   │       ├── ResourceTable.js
│   │       ├── FolderManager.js
│   │       └── StatsCard.js
│   ├── lib/
│   │   ├── firebase.js            // Firebase config
│   │   ├── firestore.js           // Firestore helpers
│   │   └── storage.js             // Storage helpers
│   ├── hooks/
│   │   ├── useResources.js
│   │   ├── useFolders.js
│   │   ├── useSearch.js
│   │   └── useAuth.js
│   └── styles/
│       ├── globals.css            // Design tokens, reset, base styles
│       ├── animations.css         // Tất cả 15 micro-animations
│       └── components/            // CSS Modules per component
├── .env.local                     // Firebase keys
├── next.config.js
└── package.json
```

---

*Spec created: 2026-04-02*
*Project: EditerLor*
*Author: Brainstorming session*
