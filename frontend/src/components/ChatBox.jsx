import React, { useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { saveAttachment, attachmentUrl } from "../utils/db";

const ADMIN_TRIGGER_HINT_LENGTH = 20; // avoids matching on every keystroke of a long message

export default function ChatBox({ token, language, voice, onAiSpeech, onAdminUnlock }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I'm here to listen. How are you feeling today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const scrollRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, attachments]);

  async function handleFilePick(e, kind) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const record = await saveAttachment(file);
      setAttachments((prev) => [...prev, { ...record, kind, url: attachmentUrl(record) }]);
    }
    e.target.value = "";
  }

  function removeAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    // --- Secret admin trigger: exact match only, checked server-side ---
    if (trimmed.length <= ADMIN_TRIGGER_HINT_LENGTH && trimmed.length > 0) {
      try {
        const { adminToken } = await api.adminVerify(trimmed);
        setInput("");
        onAdminUnlock(adminToken);
        return;
      } catch {
        // Not the admin phrase — fall through to normal chat flow.
      }
    }

    const userMessage = {
      role: "user",
      text: trimmed,
      attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, url: a.url })),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const { reply, emotion, audio } = await api.sendChat(token, {
        message: trimmed || "(shared an attachment)",
        language,
        voice,
        history,
      });

      setMessages((prev) => [...prev, { role: "assistant", text: reply, emotion }]);
      onAiSpeech({ text: reply, emotion, audio });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Something went wrong: ${err.message}`, error: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-lavender-500/20 border border-lavender-400/30"
                  : m.error
                  ? "bg-coral-500/10 border border-coral-400/30 text-coral-300"
                  : "bg-midnight-800 border border-white/10"
              }`}
            >
              {m.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {m.attachments.map((a, j) =>
                    a.kind === "image" ? (
                      <img key={j} src={a.url} alt={a.name} className="h-16 w-16 object-cover rounded-lg" />
                    ) : (
                      <span key={j} className="text-xs px-2 py-1 rounded bg-white/10">
                        📎 {a.name}
                      </span>
                    )
                  )}
                </div>
              )}
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-midnight-800 border border-white/10 text-white/40 text-sm">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {attachments.map((a) => (
            <div key={a.id} className="relative">
              {a.kind === "image" ? (
                <img src={a.url} alt={a.name} className="h-14 w-14 object-cover rounded-lg" />
              ) : (
                <div className="h-14 w-20 flex items-center justify-center rounded-lg bg-midnight-800 text-xs px-1 text-center">
                  {a.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="absolute -top-1.5 -right-1.5 bg-black/70 rounded-full h-5 w-5 text-xs"
                aria-label={`Remove ${a.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-white/10 p-3 flex items-center gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFilePick(e, "image")}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => handleFilePick(e, "video")}
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
          multiple
          hidden
          onChange={(e) => handleFilePick(e, "document")}
        />

        <button
          type="button"
          title="Attach image"
          onClick={() => imageInputRef.current?.click()}
          className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center text-lg"
        >
          🖼️
        </button>
        <button
          type="button"
          title="Attach video"
          onClick={() => videoInputRef.current?.click()}
          className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center text-lg"
        >
          🎬
        </button>
        <button
          type="button"
          title="Attach document"
          onClick={() => docInputRef.current?.click()}
          className="h-9 w-9 rounded-full hover:bg-white/10 flex items-center justify-center text-lg"
        >
          📄
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Share what's on your mind…"
          className="flex-1 rounded-full bg-midnight-800 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-lavender-400"
        />
        <button
          type="submit"
          disabled={sending}
          className="h-10 w-10 rounded-full bg-lavender-500 hover:bg-lavender-400 disabled:opacity-50 flex items-center justify-center"
          aria-label="Send"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
