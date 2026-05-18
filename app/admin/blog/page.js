"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Search,
  Sparkles,
  Image as ImageIcon,
  CheckCircle,
  Eye,
  Key,
  ChevronRight,
  Globe,
  FileEdit,
  RefreshCw,
  Clock,
  History,
} from "lucide-react";
import {
  getAdminBlogPosts,
  addBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "@/app/lib/api";
import styles from "./page.module.css";

const fetcher = (url) => fetch(url).then((res) => res.json());

const STYLE_OPTIONS = [
  { id: "guide", label: "Cẩm nang chuyên sâu (Ultimate Guide)", desc: "Cấu trúc từng phần giải thích bản chất, nâng cao và lời khuyên." },
  { id: "tutorial", label: "Hướng dẫn thực hành (Step-by-Step)", desc: "Phù hợp để hướng dẫn phần mềm Premiere Pro, DaVinci, workflow." },
  { id: "listicle", label: "Danh sách tổng hợp (Listicle Matrix)", desc: "Bảng so sánh chi tiết ưu nhược điểm các công cụ, sfx, plugin." },
  { id: "case_study", label: "Phân tích Case Study (Workflow Study)", desc: "Quy trình thực tế của project thương mại, số liệu & bài học." },
  { id: "myth_busting", label: "Giải mã lầm tưởng (Myth Buster)", desc: "Phá vỡ các hiểu lầm dựng phim, danh sách kiểm tra trước export." },
];

const MODEL_OPTIONS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", brand: "Google", desc: "Tốc độ cực nhanh, tiết kiệm tối đa, nội dung chất lượng cao." },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", brand: "Google", desc: "Thông minh nhất, phân tích ngữ nghĩa sâu sắc, SEO chuẩn chỉ." },
  { id: "gpt-4o", name: "GPT-4o", brand: "OpenAI", desc: "Khả năng hành văn tự nhiên, mượt mà chuyên nghiệp." },
  { id: "gpt-4o-mini", name: "GPT-4o-mini", brand: "OpenAI", desc: "Nhanh gọn, hành văn tốt cho từ khóa đơn giản." },
];

const CATEGORY_OPTIONS = [
  "Sound Effects",
  "Presets & LUTs",
  "Transitions",
  "Royalty-Free Music",
  "Video Editing Tips",
  "DaVinci Resolve Tutorials",
  "Premiere Pro Masterclass",
];

export default function BlogAdminPage() {
  const { data: posts = [], isLoading: loading, mutate } = useSWR("/api/admin/blog", fetcher);

  // States for general list filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Editor states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    summary: "",
    content: "",
    cover_image: "",
    status: "draft",
    meta_title: "",
    meta_description: "",
  });

  // AI Generator Panel states
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiKeyword, setAiKeyword] = useState("");
  const [aiCategory, setAiCategory] = useState("Video Editing Tips");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiStyle, setAiStyle] = useState("guide");
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageModel, setImageModel] = useState("pollinations");

  // Custom Keys management states
  const [keysOpen, setKeysOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    gemini: "",
    openai: "",
  });

  // Editor view: 'edit' or 'preview'
  const [activeTab, setActiveTab] = useState("edit");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Load API keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedGemini = localStorage.getItem("sfx_custom_gemini_key") || "";
      const savedOpenAI = localStorage.getItem("sfx_custom_openai_key") || "";
      setApiKeys({ gemini: savedGemini, openai: savedOpenAI });
    }
  }, []);

  // Save API keys to localStorage
  const handleSaveKeys = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("sfx_custom_gemini_key", apiKeys.gemini);
      localStorage.setItem("sfx_custom_openai_key", apiKeys.openai);
    }
    setSuccess("Đã lưu an toàn API Keys vào trình duyệt của bạn!");
    setTimeout(() => setSuccess(""), 3000);
    setKeysOpen(false);
  };

  // Safe slugify helper on title change
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => {
      const newSlug = !editingPost
        ? val
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
        : prev.slug;
      return {
        ...prev,
        title: val,
        slug: newSlug,
      };
    });
  };

  const openAddModal = () => {
    setEditingPost(null);
    setFormData({
      title: "",
      slug: "",
      summary: "",
      content: "",
      cover_image: "",
      status: "draft",
      meta_title: "",
      meta_description: "",
    });
    setError("");
    setActiveTab("edit");
    setEditorOpen(true);
  };

  const openEditModal = async (post) => {
    setSaving(true);
    setError("");
    try {
      // Fetch full post details from API
      const res = await fetch(`/api/admin/blog/${post.id}`);
      if (!res.ok) throw new Error("Không thể tải chi tiết bài viết");
      const fullPost = await res.json();

      setEditingPost(fullPost);
      setFormData({
        title: fullPost.title || "",
        slug: fullPost.slug || "",
        summary: fullPost.summary || "",
        content: fullPost.content || "",
        cover_image: fullPost.cover_image || "",
        status: fullPost.status || "draft",
        meta_title: fullPost.meta_title || "",
        meta_description: fullPost.meta_description || "",
      });
      setActiveTab("edit");
      setEditorOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editingPost) {
        await updateBlogPost(editingPost.id, formData);
      } else {
        await addBlogPost(formData);
      }
      await mutate();
      setSuccess("Bài viết đã được lưu thành công!");
      setTimeout(() => setSuccess(""), 3000);
      setEditorOpen(false);
    } catch (err) {
      setError(err.message || "Gặp lỗi khi lưu bài viết");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (confirm(`Bạn có chắc chắn muốn xóa bài viết "${post.title}"? Thao tác này không thể hoàn tác.`)) {
      setSaving(true);
      try {
        await deleteBlogPost(post.id);
        await mutate();
      } catch (err) {
        alert(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  // Trigger AI Text Generation
  const handleAIGenerateText = async () => {
    if (!aiKeyword.trim()) {
      alert("Vui lòng nhập từ khóa mục tiêu!");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKeys.gemini) headers["x-custom-gemini-key"] = apiKeys.gemini;
      if (apiKeys.openai) headers["x-custom-openai-key"] = apiKeys.openai;

      const res = await fetch("/api/admin/blog/generate-text", {
        method: "POST",
        headers,
        body: JSON.stringify({
          keyword: aiKeyword,
          category: aiCategory,
          model: aiModel,
          structureStyle: aiStyle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gặp lỗi khi gọi AI sinh bài viết");

      // Auto populate fields in editor
      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        slug: data.title
          ? data.title
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
          : prev.slug,
        summary: data.summary || prev.summary,
        content: data.content || prev.content,
        meta_title: data.meta_title || prev.meta_title,
        meta_description: data.meta_description || prev.meta_description,
      }));

      // Pre-fill image prompt
      setImagePrompt(`Cinematic professional sound design, ${aiKeyword}, workspace video editing desk with high quality gear, realistic photography, neon audio bars, 8k resolution`);

      setAiPanelOpen(false);
      setActiveTab("edit");
      setEditorOpen(true);
      setSuccess("Đã sinh nội dung AI chất lượng cao thành công!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Trigger Cover Image Generation via AI Models
  const handleAIGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      alert("Vui lòng nhập Prompt mô tả ảnh cần sinh!");
      return;
    }

    setGeneratingImage(true);
    setError("");

    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKeys.gemini) headers["x-custom-gemini-key"] = apiKeys.gemini;
      if (apiKeys.openai) headers["x-custom-openai-key"] = apiKeys.openai;

      const res = await fetch("/api/admin/blog/generate-image", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: imagePrompt,
          slug: formData.slug || `sfx-blog-${Date.now()}`,
          model: imageModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo ảnh bìa AI");

      setFormData((prev) => ({
        ...prev,
        cover_image: data.cover_image,
      }));

      setSuccess("Đã tạo ảnh bìa bằng AI và lưu trữ thành công!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  // Filter list of blog posts
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.summary?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || post.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.page}>
      {/* HEADER SECTION */}
      <header className={styles.header}>
        <div style={{ flex: 1 }}>
          <h1 className={styles.title}>Quản trị Blog AI</h1>
          <p className={styles.subtitle}>
            Tạo bài viết tự động chuẩn SEO 1500-2000 từ, quản lý danh sách bài viết & sinh ảnh bìa Imagen 4.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setKeysOpen(true)} className={styles.keyBtn} title="Quản lý API Keys">
            <Key size={18} />
            <span>API Keys</span>
          </button>
          <button onClick={() => setAiPanelOpen(true)} className={styles.sparklesBtn}>
            <Sparkles size={18} />
            <span>Viết bài bằng AI</span>
          </button>
          <button onClick={openAddModal} className={styles.addBtn}>
            <Plus size={18} />
            <span>Bài viết thủ công</span>
          </button>
        </div>
      </header>

      {/* SUCCESS MESSAGE POPUP */}
      {success && (
        <div className={styles.toast}>
          <CheckCircle size={18} className={styles.toastIcon} />
          <span>{success}</span>
        </div>
      )}

      {/* FILTER & STATS ROW */}
      <div className={styles.statsRow}>
        <div className={styles.filterGroup}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusSelect}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đã xuất bản (Published)</option>
            <option value="draft">Bản nháp (Draft)</option>
          </select>
        </div>

        <div className={styles.statsSummary}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Tổng số</span>
            <span className={styles.statValue}>{posts.length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Đã đăng</span>
            <span className={styles.statValue}>
              {posts.filter((p) => p.status === "published").length}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Bản nháp</span>
            <span className={styles.statValue}>
              {posts.filter((p) => p.status === "draft").length}
            </span>
          </div>
        </div>
      </div>

      {/* LIST TABLE AREA */}
      {loading && posts.length === 0 ? (
        <div className={styles.loadingArea}>
          <Loader2 className={`${styles.spinner} animate-spin`} />
          <p>Đang tải danh sách bài viết...</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bài viết</th>
                <th>Slug</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th style={{ width: "160px" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div className={styles.postMetaCell}>
                      {post.cover_image ? (
                        <img src={post.cover_image} alt="" className={styles.tableThumb} />
                      ) : (
                        <div className={styles.tableThumbPlaceholder}>
                          <FileText size={18} />
                        </div>
                      )}
                      <div className={styles.postMetaText}>
                        <strong className={styles.postTitleText}>{post.title}</strong>
                        <p className={styles.postSummaryText}>{post.summary || "Không có tóm tắt"}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code>/v1/blog/{post.slug}</code>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        post.status === "published" ? styles.published : styles.draft
                      }`}
                    >
                      {post.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.timeCell}>
                      <Clock size={12} />
                      <span>{new Date(post.created_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <a
                        href={`/v1/blog/${post.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.actionBtn}
                        title="Xem ngoài web"
                      >
                        <Globe size={15} />
                      </a>
                      <button
                        className={styles.actionBtn}
                        onClick={() => openEditModal(post)}
                        title="Chỉnh sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(post)}
                        title="Xóa bài"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.emptyCell}>
                    Không tìm thấy bài viết nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DIALOG 1: API KEYS CONFIGURATION */}
      {keysOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <Key size={18} className={styles.modalHeaderIcon} />
                Cấu hình API Keys cá nhân
              </h2>
              <button className={styles.closeBtn} onClick={() => setKeysOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveKeys} className={styles.form}>
              <div className={styles.alertWarning}>
                <AlertTriangle size={16} />
                <span>
                  Các API Key của bạn được lưu an toàn trong trình duyệt (localStorage), không truyền thô qua server để
                  đảm bảo bảo mật tối đa.
                </span>
              </div>

              <div className={styles.inputGroup}>
                <label>Gemini API Key (Tạo bài viết & Sinh ảnh)</label>
                <input
                  type="password"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys((p) => ({ ...p, gemini: e.target.value }))}
                  placeholder="Nhập AIzaSy..."
                />
              </div>

              <div className={styles.inputGroup}>
                <label>OpenAI API Key (Tùy chọn cho GPT models)</label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys((p) => ({ ...p, openai: e.target.value }))}
                  placeholder="Nhập sk-proj-..."
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setKeysOpen(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Lưu thiết lập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 2: AI WRITING WIZARD */}
      {aiPanelOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalLarge}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <Sparkles size={18} className={styles.modalHeaderIcon} style={{ color: "#a855f7" }} />
                Trình tạo bài viết chuẩn SEO bằng AI
              </h2>
              <button className={styles.closeBtn} onClick={() => setAiPanelOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroupFull}>
                  <label>Từ khóa chính chuẩn SEO (Target Keyword)</label>
                  <input
                    type="text"
                    value={aiKeyword}
                    onChange={(e) => setAiKeyword(e.target.value)}
                    required
                    placeholder="Ví dụ: how to use cinematic sound effects in premiere pro"
                  />
                  <p className={styles.helpText}>AI sẽ viết sâu sắc xoay quanh từ khóa này để tối ưu hóa SEO tối đa.</p>
                </div>

                <div className={styles.inputGroup}>
                  <label>Chuyên mục tham chiếu (Category Reference)</label>
                  <select value={aiCategory} onChange={(e) => setAiCategory(e.target.value)} className={styles.select}>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Mô hình AI viết bài</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={styles.select}>
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.brand})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* STYLE SELECTOR (CRITICAL REQUIREMENT) */}
              <div className={styles.styleSelectorSection}>
                <label className={styles.sectionLabel}>Lựa chọn Phong cách & Cấu trúc viết bài (Tránh lặp lại cấu trúc)</label>
                <div className={styles.styleGrid}>
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`${styles.styleCard} ${aiStyle === style.id ? styles.activeStyle : ""}`}
                      onClick={() => setAiStyle(style.id)}
                    >
                      <div className={styles.styleCardHeader}>
                        <div className={styles.styleRadio} />
                        <strong>{style.label}</strong>
                      </div>
                      <p>{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className={styles.errorMsg}>
                  <AlertTriangle size={14} style={{ marginRight: 4 }} />
                  {error}
                </div>
              )}

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setAiPanelOpen(false)}>
                  Đóng
                </button>
                <button type="button" onClick={handleAIGenerateText} className={styles.sparklesBtn} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className={`${styles.spinner} animate-spin`} size={16} />
                      <span>Đang phân tích & viết bài (15-30s)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Bắt đầu tạo bài viết (1500-2000 chữ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 3: LIVE POST EDITOR & SPLIT SCREEN PREVIEW */}
      {editorOpen && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.editorContainer}>
            <div className={styles.editorHeader}>
              <div>
                <h2>{editingPost ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"}</h2>
                <p>Nhập thông tin hoặc sử dụng các công cụ AI hỗ trợ dựng bài viết chất lượng cao.</p>
              </div>
              <div className={styles.editorHeaderActions}>
                <div className={styles.tabToggle}>
                  <button
                    type="button"
                    className={activeTab === "edit" ? styles.activeTab : ""}
                    onClick={() => setActiveTab("edit")}
                  >
                    <FileEdit size={14} />
                    <span>Nội dung & Thiết lập</span>
                  </button>
                  <button
                    type="button"
                    className={activeTab === "preview" ? styles.activeTab : ""}
                    onClick={() => setActiveTab("preview")}
                  >
                    <Eye size={14} />
                    <span>Live Preview (Định dạng hiển thị)</span>
                  </button>
                </div>
                <button className={styles.closeBtn} onClick={() => setEditorOpen(false)}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className={styles.editorMain}>
              {activeTab === "edit" ? (
                <form onSubmit={handleSubmit} className={styles.editorSplitLayout}>
                  {/* Left Column: Post content */}
                  <div className={styles.editorLeftCol}>
                    <div className={styles.inputGroup}>
                      <label>Tiêu đề bài viết (Title)</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={handleTitleChange}
                        required
                        placeholder="Tiêu đề bài viết..."
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Slug đường dẫn (URL Key)</label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                        required
                        placeholder="tieu-de-viet-bai"
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Tóm tắt ngắn (Summary)</label>
                      <textarea
                        value={formData.summary}
                        onChange={(e) => setFormData((p) => ({ ...p, summary: e.target.value }))}
                        rows={2}
                        placeholder="Mô tả ngắn hiển thị trên thẻ bài viết..."
                      />
                    </div>

                    <div className={styles.inputGroup} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <label>Nội dung chi tiết (Markdown hỗ trợ)</label>
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                        required
                        className={styles.contentTextArea}
                        placeholder="## Giới thiệu..."
                      />
                      <div className={styles.wordCountIndicator}>
                        Số từ: {formData.content ? formData.content.split(/\s+/).length : 0} từ (Đề xuất: 1500-2000 từ)
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Metadata & AI image generation */}
                  <div className={styles.editorRightCol}>
                    {/* Status selection */}
                    <div className={styles.cardGlass}>
                      <h3>Cài đặt xuất bản</h3>
                      <div className={styles.inputGroup}>
                        <label>Trạng thái</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                          className={styles.select}
                        >
                          <option value="draft">Bản nháp (Draft)</option>
                          <option value="published">Xuất bản (Published)</option>
                        </select>
                      </div>
                    </div>

                    {/* SEO Metadata settings */}
                    <div className={styles.cardGlass}>
                      <h3>SEO Metadata</h3>
                      <div className={styles.inputGroup}>
                        <label>SEO Meta Title</label>
                        <input
                          type="text"
                          value={formData.meta_title}
                          onChange={(e) => setFormData((p) => ({ ...p, meta_title: e.target.value }))}
                          placeholder="Meta title..."
                        />
                      </div>
                      <div className={styles.inputGroup}>
                        <label>SEO Meta Description</label>
                        <textarea
                          value={formData.meta_description}
                          onChange={(e) => setFormData((p) => ({ ...p, meta_description: e.target.value }))}
                          rows={3}
                          placeholder="Meta description..."
                        />
                      </div>
                    </div>

                    {/* AI Cover image integration */}
                    <div className={styles.cardGlass}>
                      <h3>Ảnh bìa bài viết (Cover Image)</h3>
                      <div className={styles.inputGroup}>
                        <label>URL Ảnh hiện tại</label>
                        <input
                          type="text"
                          value={formData.cover_image}
                          onChange={(e) => setFormData((p) => ({ ...p, cover_image: e.target.value }))}
                          placeholder="https://..."
                        />
                      </div>

                      {formData.cover_image && (
                        <div className={styles.coverPreviewContainer}>
                          <img src={formData.cover_image} alt="Cover preview" className={styles.coverPreviewImg} />
                        </div>
                      )}

                      {/* AI Cover Image Generator Action */}
                      <div className={styles.imageGeneratorBox}>
                        <div className={styles.inputGroup} style={{ marginBottom: "12px" }}>
                          <label>Mô hình sinh ảnh AI</label>
                          <select
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value)}
                            className={styles.select}
                          >
                            <option value="pollinations">Mô hình AI Miễn phí (Flux - Khuyên dùng)</option>
                            <option value="imagen-4.0-generate-001">Imagen 4 Standard (Google - Cần Key Paid)</option>
                            <option value="imagen-4.0-ultra-generate-001">Imagen 4 Ultra (Google - Cần Key Paid)</option>
                            <option value="imagen-4.0-fast-generate-001">Imagen 4 Fast (Google - Cần Key Paid)</option>
                            <option value="dall-e-3">DALL-E 3 (OpenAI - Cần Key)</option>
                            <option value="dall-e-2">DALL-E 2 (OpenAI - Cần Key)</option>
                          </select>
                        </div>
                        <label>Mô tả ảnh cần vẽ (AI Image Prompt)</label>
                        <textarea
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          rows={3}
                          placeholder="Mô tả bức ảnh bạn muốn vẽ (Khuyên dùng tiếng Anh để AI vẽ đẹp nhất)..."
                        />
                        <button
                          type="button"
                          onClick={handleAIGenerateImage}
                          className={styles.sparklesBtn}
                          disabled={generatingImage}
                        >
                          {generatingImage ? (
                            <>
                              <Loader2 className={`${styles.spinner} animate-spin`} size={15} />
                              <span>Đang vẽ ảnh và upload (10-15s)...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={15} />
                              <span>Sinh ảnh bằng AI</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className={styles.errorMsg}>
                        <AlertTriangle size={14} style={{ marginRight: 4 }} />
                        {error}
                      </div>
                    )}

                    <div className={styles.editorSaveActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        style={{ flex: 1 }}
                        onClick={() => setEditorOpen(false)}
                      >
                        Hủy
                      </button>
                      <button type="submit" className={styles.saveBtn} style={{ flex: 2 }} disabled={saving}>
                        {saving ? "Đang lưu..." : "Lưu bài viết"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* LIVE PREVIEW TAB IN FULL BEAUTY */
                <div className={styles.previewContainer}>
                  <div className={styles.previewHeaderArea}>
                    <div className={styles.previewMeta}>
                      <span className={styles.previewStatus}>{formData.status.toUpperCase()}</span>
                      <h1 className={styles.previewTitle}>{formData.title || "Tiêu đề bài viết thử nghiệm"}</h1>
                      <p className={styles.previewSummary}>{formData.summary || "Tóm tắt bài viết..."}</p>
                    </div>
                    {formData.cover_image && (
                      <img src={formData.cover_image} alt="" className={styles.previewHeroImage} />
                    )}
                  </div>

                  <div className={styles.previewContent}>
                    {formData.content ? (
                      /* Minimal Markdown rendering simulation */
                      <div className={styles.markdownBody}>
                        {formData.content.split("\n").map((line, idx) => {
                          if (line.startsWith("## ")) {
                            return <h2 key={idx}>{line.replace("## ", "")}</h2>;
                          }
                          if (line.startsWith("### ")) {
                            return <h3 key={idx}>{line.replace("### ", "")}</h3>;
                          }
                          if (line.startsWith("- ") || line.startsWith("* ")) {
                            return <li key={idx}>{line.replace(/^[-*]\s+/, "")}</li>;
                          }
                          if (line.trim() === "---") {
                            return <hr key={idx} />;
                          }
                          if (line.trim() === "") return <div key={idx} style={{ height: "1.2rem" }} />;
                          return <p key={idx}>{line}</p>;
                        })}
                      </div>
                    ) : (
                      <p style={{ textAlign: "center", color: "#6b7280", padding: "40px" }}>
                        Chưa có nội dung để hiển thị preview.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
