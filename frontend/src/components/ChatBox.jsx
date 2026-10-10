import React, { useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { saveAttachment, attachmentUrl } from "../utils/db";

const ADMIN_TRIGGER_HINT_LENGTH = 20;
const MAX_HISTORY_MESSAGES = 50;

export default function ChatBox({
  token,
  language,
  voice,
  onAiSpeech,
  onAdminUnlock,
  onLiveCall,
}) {
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
  const pdfInputRef = useRef(null);
  const genericFileRef = useRef(null);
  const textareaRef = useRef(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const composerRef = useRef(null);

  useEffect(() => {
    const keepComposerVisible = () => {
      if (document.activeElement?.matches?.("textarea")) {
        window.setTimeout(() => document.activeElement?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }), 80);
      }
    };
    window.addEventListener("resize", keepComposerVisible);
    window.visualViewport?.addEventListener("resize", keepComposerVisible);
    return () => {
      window.removeEventListener("resize", keepComposerVisible);
      window.visualViewport?.removeEventListener("resize", keepComposerVisible);
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 144) + "px";
    }
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, attachments]);

  async function handleFilePick(e, kind) {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      const currentBytes = attachments.reduce((total, item) => total + (item.size || 0), 0);
      if (file.size > 8 * 1024 * 1024 || currentBytes + file.size > 8 * 1024 * 1024) {
        setVoiceError("Keep the total attachments in one message under 8 MB so Aura can receive them.");
        continue;
      }

      try {
        const record = await saveAttachment(file);
        setAttachments((prev) => [
          ...prev,
          {
            ...record,
            kind,
            url: attachmentUrl(record),
          },
        ]);
        setVoiceError("");
      } catch (error) {
        setVoiceError(error?.message || "Could not load that file. Please try another file.");
      }
    }

    e.target.value = "";
  }

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported by this browser. Try Chrome on Android.");
      return;
    }
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setVoiceError("");
    const recognition = new SpeechRecognition();
    recognition.lang = ({
      hi: "hi-IN", en: "en-US", bn: "bn-IN", ta: "ta-IN",
      te: "te-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN",
      ur: "ur-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN",
    })[language] || language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ").trim();
      if (transcript) setInput(transcript);
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed"
        ? "Allow microphone access in your browser to use voice input."
        : "Voice input stopped. Please try again.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError("Could not start voice input. Please try again.");
    }
  }

  function removeAttachment(id) {
    setAttachments((prev) =>
      prev.filter((a) => a.id !== id)
    );
  }

  async function handleSend(e) {
    e.preventDefault();

    const trimmed = input.trim();

    if (!trimmed && attachments.length === 0) {
      return;
    }

    // Secret admin trigger
    if (
      trimmed.length <= ADMIN_TRIGGER_HINT_LENGTH &&
      trimmed.length > 0
    ) {
      try {
        const { adminToken } =
          await api.adminVerify(trimmed);

        setInput("");
        onAdminUnlock(adminToken);
        return;
      } catch {
        // Normal chat
      }
    }

    let encodedAttachments;
    try {
      encodedAttachments = await Promise.all(attachments.map(async (a) => {
        const blob = a.blob;
        if (!blob || blob.size > 8 * 1024 * 1024) {
          throw new Error("Each attachment must be smaller than 8 MB to send to Aura.");
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return {
          name: a.name,
          kind: a.kind,
          type: a.type || blob.type || "application/octet-stream",
          size: blob.size,
          data: btoa(binary),
          url: a.url,
        };
      }));
    } catch (err) {
      setVoiceError(err?.message || "Could not prepare the attachment. Please try again.");
      return;
    }

    const userMessage = {
      role: "user",
      text: trimmed || "(shared an attachment)",
      attachments: encodedAttachments,
    };

    // IMPORTANT:
    // Build the conversation including the NEW user message.
    const conversationWithUser = [
      ...messages,
      userMessage,
    ];

    // Keep only the latest 50 messages.
    const history = conversationWithUser
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.role,
        text: m.text,
      }));

    // Show user's message immediately.
    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");
    setAttachments([]);
    setSending(true);

    try {
      const { reply, emotion, audio } =
        await api.sendChat(token, {
          message:
            trimmed || "(shared an attachment)",
          language,
          voice,
          history,
          attachments: encodedAttachments.map(({ name, kind, type, size, data }) => ({ name, kind, type, size, data })),
        });

      const assistantMessage = {
        role: "assistant",
        text: reply,
        emotion,
      };

      setMessages((prev) =>
        [
          ...prev,
          assistantMessage,
        ].slice(-MAX_HISTORY_MESSAGES)
      );

      onAiSpeech({
        text: reply,
        emotion,
        audio,
      });
    } catch (err) {
      setMessages((prev) =>
        [
          ...prev,
          {
            role: "assistant",
            text: `Something went wrong: ${err.message}`,
            error: true,
          },
        ].slice(-MAX_HISTORY_MESSAGES)
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
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
                      <img
                        key={j}
                        src={a.url}
                        alt={a.name}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <span
                        key={j}
                        className="text-xs px-2 py-1 rounded bg-white/10"
                      >
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
            <div
              key={a.id}
              className="relative"
            >
              {a.kind === "image" ? (
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-14 w-14 object-cover rounded-lg"
                />
              ) : (
                <div className="h-14 w-20 flex items-center justify-center rounded-lg bg-midnight-800 text-xs px-1 text-center">
                  {a.name}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  removeAttachment(a.id)
                }
                className="absolute -top-1.5 -right-1.5 bg-black/70 rounded-full h-5 w-5 text-xs"
                aria-label={`Remove ${a.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {voiceError && (
        <p role="status" className="px-4 pb-2 text-xs text-coral-300">{voiceError}</p>
      )}

      <form
        onSubmit={handleSend}
        ref={composerRef} className="chat-composer sticky bottom-0 z-20 border-t border-white/10 bg-midnight-950/95 backdrop-blur-xl p-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-end gap-2"
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) =>
            handleFilePick(e, "image")
          }
        />

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) =>
            handleFilePick(e, "video")
          }
        />

        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
          multiple
          hidden
          onChange={(e) =>
            handleFilePick(e, "document")
          }
        />

        <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(e) => handleFilePick(e, "document")} />
        <input ref={genericFileRef} type="file" multiple hidden onChange={(e) => handleFilePick(e, "document")} />
        <div className="relative shrink-0">
          <button type="button" title="Add attachment" aria-label="Add attachment" aria-expanded={attachMenuOpen} onClick={() => setAttachMenuOpen((v) => !v)} className="h-12 w-12 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-3xl shrink-0">＋</button>
          {attachMenuOpen && <div className="absolute bottom-14 left-0 z-30 w-52 rounded-2xl border border-white/10 bg-midnight-900 p-2 shadow-2xl">
            <button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">🖼️ <span>Photo</span></button>
            <button type="button" onClick={() => { setAttachMenuOpen(false); videoInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">🎬 <span>Video</span></button>
            <button type="button" onClick={() => { setAttachMenuOpen(false); docInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">📄 <span>Document</span></button>
            <button type="button" onClick={() => { setAttachMenuOpen(false); pdfInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">📕 <span>PDF</span></button>
            <button type="button" onClick={() => { setAttachMenuOpen(false); genericFileRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10">📁 <span>Any file</span></button>
          </div>}
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onFocus={(e) => { window.setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); e.currentTarget.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, 250); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          placeholder="Share what's on your mind…"
          className="min-w-0 flex-1 resize-none overflow-y-auto rounded-3xl bg-midnight-800 border border-white/10 px-4 py-3 text-base leading-6 outline-none focus:border-lavender-400"
          style={{ maxHeight: "144px", minHeight: "48px" }}
        />
        <button type="button" onClick={() => setEmojiMenuOpen((v) => !v)} className="h-11 w-11 shrink-0 rounded-full border border-white/10 bg-white/5 text-xl" aria-label="Emoji">☺</button>
        <button type="submit" disabled={sending} className="h-12 w-12 shrink-0 rounded-full bg-lavender-500 hover:bg-lavender-400 disabled:opacity-50 flex items-center justify-center text-xl shadow-lg" aria-label="Send">➤</button>
      </form>
      {emojiMenuOpen && <div className="grid grid-cols-6 gap-1 px-3 pb-2">{["😀","😂","🥹","😊","😍","😎","😭","😡","👍","🙏","❤️","✨"].map((emoji) => <button key={emoji} type="button" onClick={() => { setInput((v) => v + emoji); setEmojiMenuOpen(false); }} className="rounded-lg p-2 text-xl hover:bg-white/10">{emoji}</button>)}</div>}
      <button type="button" onClick={onLiveCall} className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-2xl border border-teal-300/30 bg-teal-400/15 px-4 py-3 font-semibold text-teal-100 hover:bg-teal-400/25"><span>📞</span> Live Call</button>
    </div>
  );
}
