"use client";

import { useState, useEffect } from "react";
import { Send, Mail, CheckCircle, Clock, Search, RefreshCw, AlertCircle, Plus, X, Trash2, Bookmark } from "lucide-react";
import styles from "./page.module.css";

export default function SupportClient() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [filter, setFilter] = useState("all"); // all, pending, replied, draft
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notification, setNotification] = useState(null);

  // Compose Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeData, setComposeData] = useState({
    recipientName: "",
    recipientEmail: "",
    subject: "",
    message: "",
  });
  const [sendingManual, setSendingManual] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${filter}&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.data || []);
        if (data.data && data.data.length > 0 && !selectedMsg) {
          setSelectedMsg(data.data[0]);
          setReplyText(data.data[0].draft_reply || "");
        }
      } else {
        showNotification("Lỗi tải danh sách: " + (data.error || "Unknown"), "error");
      }
    } catch (err) {
      showNotification("Lỗi kết nối server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMessages();
  };

  const showNotification = (text, type = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSelectMsg = (msg) => {
    setSelectedMsg(msg);
    setReplyText(msg.draft_reply || "");
  };

  const handleDeleteMsg = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa thư này không? Hành động này không thể hoàn tác.")) return;

    try {
      const res = await fetch(`/api/admin/support?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showNotification("Đã xóa thư thành công", "success");
        const remaining = messages.filter((m) => m.id !== id);
        setMessages(remaining);
        if (selectedMsg?.id === id) {
          setSelectedMsg(remaining[0] || null);
          setReplyText(remaining[0]?.draft_reply || "");
        }
      } else {
        showNotification("Lỗi xóa thư: " + (data.error || "Thất bại"), "error");
      }
    } catch (err) {
      showNotification("Lỗi kết nối máy chủ", "error");
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedMsg) return;
    setSavingDraft(true);
    try {
      const res = await fetch("/api/admin/support/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedMsg.id,
          draftMessage: replyText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification("Đã lưu bản nháp thành công", "success");
        const updatedMsg = { ...selectedMsg, draft_reply: replyText };
        setSelectedMsg(updatedMsg);
        setMessages(messages.map((m) => (m.id === selectedMsg.id ? updatedMsg : m)));
      } else {
        showNotification("Lỗi lưu nháp: " + (data.error || "Thất bại"), "error");
      }
    } catch (err) {
      showNotification("Không thể kết nối máy chủ", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedMsg) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedMsg.id,
          replyMessage: replyText,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showNotification("Đã gửi email phản hồi thành công!", "success");
        setReplyText("");
        const updatedMsg = {
          ...selectedMsg,
          status: "replied",
          reply_message: replyText,
          draft_reply: null,
          replied_at: new Date().toISOString(),
        };
        setSelectedMsg(updatedMsg);
        setMessages(messages.map((m) => (m.id === selectedMsg.id ? updatedMsg : m)));
      } else {
        showNotification("Lỗi gửi email: " + (data.error || "Thất bại"), "error");
      }
    } catch (err) {
      showNotification("Không thể kết nối đến máy chủ", "error");
    } finally {
      setSending(false);
    }
  };

  const handleSendManualEmail = async (e) => {
    e.preventDefault();
    if (!composeData.recipientEmail || !composeData.subject || !composeData.message) {
      showNotification("Vui lòng điền đầy đủ Email, Tiêu đề và Nội dung thư", "error");
      return;
    }

    setSendingManual(true);
    try {
      const res = await fetch("/api/admin/support/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composeData),
      });

      const data = await res.json();

      if (res.ok) {
        showNotification("Đã gửi email thành công!", "success");
        setShowComposeModal(false);
        setComposeData({ recipientName: "", recipientEmail: "", subject: "", message: "" });
        fetchMessages();
      } else {
        showNotification("Lỗi gửi mail: " + (data.error || "Thất bại"), "error");
      }
    } catch (err) {
      showNotification("Không thể kết nối máy chủ", "error");
    } finally {
      setSendingManual(false);
    }
  };

  const handleSaveManualDraft = async () => {
    if (!composeData.message) {
      showNotification("Vui lòng nhập nội dung thư để lưu nháp", "error");
      return;
    }
    setSendingManual(true);
    try {
      const res = await fetch("/api/admin/support/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isManualDraft: true,
          recipientEmail: composeData.recipientEmail,
          subject: composeData.subject,
          draftMessage: composeData.message,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification("Đã lưu thư nháp mới", "success");
        setShowComposeModal(false);
        setComposeData({ recipientName: "", recipientEmail: "", subject: "", message: "" });
        fetchMessages();
      } else {
        showNotification("Lỗi lưu nháp: " + (data.error || "Thất bại"), "error");
      }
    } catch (err) {
      showNotification("Lỗi kết nối máy chủ", "error");
    } finally {
      setSendingManual(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getBadgeClass = (status) => {
    if (status === "replied") return styles.badgeReplied;
    if (status === "draft") return styles.badgeDraft;
    return styles.badgePending;
  };

  const getBadgeLabel = (status) => {
    if (status === "replied") return "Đã trả lời";
    if (status === "draft") return "Thư nháp";
    return "Chờ xử lý";
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Support Mail Management</h1>
          <p className={styles.subtitle}>Quản lý, trả lời và lưu thư nháp với khách hàng qua SFXFolder Support Email</p>
        </div>
        <button className={styles.composeHeaderBtn} onClick={() => setShowComposeModal(true)}>
          <Plus size={18} /> Soạn Thư Mới
        </button>
      </div>

      {notification && (
        <div
          style={{
            padding: "12px 20px",
            marginBottom: "20px",
            borderRadius: "8px",
            background: notification.type === "success" ? "rgba(46, 213, 115, 0.15)" : "rgba(255, 71, 87, 0.15)",
            border: `1px solid ${notification.type === "success" ? "#2ed573" : "#ff4757"}`,
            color: notification.type === "success" ? "#2ed573" : "#ff4757",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          {notification.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notification.text}</span>
        </div>
      )}

      <div className={styles.layout}>
        {/* Left Pane: Sidebar List */}
        <div className={styles.sidebarList}>
          <div className={styles.filterHeader}>
            <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
              <input
                type="text"
                placeholder="Tìm tên, email, nội dung..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${filter === "all" ? styles.activeTab : ""}`}
                onClick={() => setFilter("all")}
              >
                Tất cả
              </button>
              <button
                className={`${styles.tab} ${filter === "pending" ? styles.activeTab : ""}`}
                onClick={() => setFilter("pending")}
              >
                Chờ xử lý
              </button>
              <button
                className={`${styles.tab} ${filter === "replied" ? styles.activeTab : ""}`}
                onClick={() => setFilter("replied")}
              >
                Đã trả lời
              </button>
              <button
                className={`${styles.tab} ${filter === "draft" ? styles.activeTab : ""}`}
                onClick={() => setFilter("draft")}
              >
                Thư nháp
              </button>
            </div>
          </div>

          <div className={styles.msgList}>
            {loading ? (
              <div className={styles.loadingSpinner}>
                <RefreshCw size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : messages.length === 0 ? (
              <div className={styles.emptyState} style={{ padding: "40px 20px" }}>
                <Mail size={32} style={{ marginBottom: "12px", opacity: 0.4 }} />
                <span>Không tìm thấy thư liên hệ nào</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.msgCard} ${selectedMsg?.id === msg.id ? styles.selectedCard : ""}`}
                  onClick={() => handleSelectMsg(msg)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.senderName}>{msg.name}</span>
                    <span className={`${styles.badge} ${getBadgeClass(msg.status)}`}>
                      {getBadgeLabel(msg.status)}
                    </span>
                  </div>
                  <div className={styles.senderEmail}>{msg.email}</div>
                  <div className={styles.msgSnippet}>
                    {msg.draft_reply ? `📝 [Nháp]: ${msg.draft_reply}` : msg.message}
                  </div>
                  <div className={styles.msgDate}>{formatDate(msg.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Message Details & Reply Panel */}
        <div className={styles.detailPanel}>
          {selectedMsg ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selectedMsg.name}</h2>
                  <div className={styles.metaInfo}>
                    <span>📧 {selectedMsg.email}</span>
                    <span>🕒 {formatDate(selectedMsg.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`${styles.badge} ${getBadgeClass(selectedMsg.status)}`} style={{ padding: "6px 12px", fontSize: "12px" }}>
                    {getBadgeLabel(selectedMsg.status)}
                  </span>
                  <button className={styles.deleteBtn} onClick={() => handleDeleteMsg(selectedMsg.id)} title="Xóa thư này">
                    <Trash2 size={16} /> Xóa thư
                  </button>
                </div>
              </div>

              {/* Customer Inquiry Box */}
              <div className={styles.messageBox}>
                <div className={styles.boxLabel}>Nội dung câu hỏi / Ghi chú:</div>
                <div className={styles.messageText}>{selectedMsg.message}</div>
              </div>

              {/* Display Previous Reply if existing */}
              {selectedMsg.status === "replied" && selectedMsg.reply_message && (
                <div className={styles.previousReply}>
                  <div className={styles.boxLabel} style={{ color: "#2ed573", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle size={16} /> Đã gửi phản hồi ({formatDate(selectedMsg.replied_at)}):
                  </div>
                  <div className={styles.messageText}>{selectedMsg.reply_message}</div>
                </div>
              )}

              {/* Reply Form */}
              <div className={styles.replyBox}>
                <div className={styles.boxLabel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{selectedMsg.status === "replied" ? "Gửi phản hồi bổ sung:" : "Soạn email phản hồi khách hàng:"}</span>
                  {selectedMsg.draft_reply && (
                    <span style={{ color: "#70a1ff", fontSize: "11px" }}>📌 Đã có bản nháp được lưu</span>
                  )}
                </div>
                <textarea
                  className={styles.replyTextarea}
                  placeholder={`Chào ${selectedMsg.name},\n\nCảm ơn bạn đã liên hệ với SFXFolder...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className={styles.replyActions}>
                  <button type="button" className={styles.saveDraftBtn} onClick={handleSaveDraft} disabled={savingDraft}>
                    {savingDraft ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Bookmark size={16} />}
                    Lưu nháp
                  </button>
                  <button className={styles.sendBtn} onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                    {sending ? (
                      <>
                        <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Đang gửi...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Gửi Email Phản Hồi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Mail size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
              <span>Chọn một thư từ danh sách bên trái để xem và trả lời</span>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSE EMAIL MODAL */}
      {showComposeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Soạn Email Mới (Gửi từ support@sfxfolder.com)</h3>
              <button className={styles.closeBtn} onClick={() => setShowComposeModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendManualEmail}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tên người nhận (Không bắt buộc)</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Nguyễn Văn A"
                    value={composeData.recipientName}
                    onChange={(e) => setComposeData({ ...composeData, recipientName: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email người nhận (*)</label>
                  <input
                    type="email"
                    required
                    className={styles.formInput}
                    placeholder="khachhang@gmail.com"
                    value={composeData.recipientEmail}
                    onChange={(e) => setComposeData({ ...composeData, recipientEmail: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tiêu đề Email (*)</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="Thông báo từ SFXFolder..."
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nội dung Email (*)</label>
                  <textarea
                    required
                    className={styles.replyTextarea}
                    style={{ minHeight: "140px" }}
                    placeholder="Nhập nội dung thư muốn gửi..."
                    value={composeData.message}
                    onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.saveDraftBtn} onClick={handleSaveManualDraft} disabled={sendingManual}>
                  <Bookmark size={16} /> Lưu nháp
                </button>
                <button type="submit" className={styles.sendBtn} disabled={sendingManual}>
                  {sendingManual ? (
                    <>
                      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Gửi Email Ngay
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
