import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Send, X, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import type { AnalysisLanguage, LesionCompartment } from '../types/dossier';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface EndoChatbotProps {
  language: AnalysisLanguage;
  activeGene?: string;
  activeCompartment?: LesionCompartment;
}

function hasArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Creative custom SVG emblem combining a diagnostic speech node,
 * cellular nucleus / DNA wave, and AI sparkle in EndoScope Ai pink tones.
 */
function CreativeBioChatIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="endoChatGrad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBCFE8" />
          <stop offset="50%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#DB2777" />
        </linearGradient>
      </defs>

      {/* Stylized asymmetric diagnostic bubble */}
      <path
        d="M18 4.5C10.544 4.5 4.5 10.1 4.5 17C4.5 20.17 5.78 23.06 7.89 25.25L6.5 30.8L12.35 28.62C14.12 29.19 16.02 29.5 18 29.5C25.456 29.5 31.5 23.9 31.5 17C31.5 10.1 25.456 4.5 18 4.5Z"
        fill="#1D0E1F"
        stroke="url(#endoChatGrad)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* Inner bio-helix / cellular wave */}
      <path
        d="M10.5 17C12.2 13.5 14.2 13.5 15.8 17C17.4 20.5 19.4 20.5 21.1 17C22.4 14.3 23.9 14.1 25.3 16.4"
        stroke="#F472B6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.5 17C12.2 20.5 14.2 20.5 15.8 17C17.4 13.5 19.4 13.5 21.1 17C22.4 19.7 23.9 19.9 25.3 17.6"
        stroke="#FBCFE8"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />

      {/* Cellular nodal points */}
      <circle cx="15.8" cy="17" r="1.4" fill="#EC4899" />
      <circle cx="21.1" cy="17" r="1.4" fill="#FBCFE8" />

      {/* Top-right diagnostic AI 4-point star */}
      <path
        d="M28.5 4.2L29.35 6.65L31.8 7.5L29.35 8.35L28.5 10.8L27.65 8.35L25.2 7.5L27.65 6.65L28.5 4.2Z"
        fill="#FBCFE8"
      />
    </svg>
  );
}

function renderInlineSegments(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#FAF2F7]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="rounded bg-[#0B070B] px-1 py-0.5 font-mono text-[11px] text-[#F472B6]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderFormattedReply(content: string) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (keyPrefix: string) => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={keyPrefix} className="space-y-1.5 my-1.5">
        {bulletBuffer.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="font-mono text-[11px] text-[#F472B6] mt-0.5 shrink-0">—</span>
            <span className="leading-relaxed">{renderInlineSegments(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets(`ul-${idx}`);
      return;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      return;
    }

    flushBullets(`ul-before-${idx}`);

    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <div key={`h-${idx}`} className="font-semibold text-[#F472B6] pt-1">
          {renderInlineSegments(headingMatch[1])}
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInlineSegments(line)}
      </p>
    );
  });

  flushBullets('ul-end');
  return <div className="space-y-2 text-[13px] text-[#DFCBD8]">{blocks}</div>;
}

const STARTER_PROMPTS_EN = [
  'What drives progesterone resistance in endometriosis lesions?',
  'How do macrophages and VEGF pathways promote neo-vascularization?',
  'What wet-lab assays validate ectopic stromal fibrosis?',
];

const STARTER_PROMPTS_AR = [
  'ما أسباب مقاومة البروجستيرون في بطانة الرحم المهاجرة؟',
  'كيف تساهم الخلايا البلعمية و VEGFA في تكوين أوعية دموية جديدة؟',
  'ما الفرق الجيني بين الأنسجة السليمة والمصابة في بطانة الرحم المهاجرة؟',
];

export function EndoChatbot({ language, activeGene, activeCompartment }: EndoChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const [retryingNotice, setRetryingNotice] = useState(false);

  const requestReply = async (historyToSend: ChatMessage[]): Promise<string> => {
    const attemptFetch = async () => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map((m) => ({ role: m.role, content: m.content })),
          activeGene,
          activeCompartment,
          language,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      return { res, data };
    };

    let { res, data } = await attemptFetch();
    if (res.status === 429) {
      setRetryingNotice(true);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      ({ res, data } = await attemptFetch());
    }

    if (!res.ok || !data.reply) {
      throw new Error(data.error || `Server returned status ${res.status}`);
    }
    return data.reply;
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setError(null);
    setRetryingNotice(false);
    setIsSending(true);

    try {
      const replyText = await requestReply(nextHistory);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach EndoScope AI Assistant. Please try again.'
      );
    } finally {
      setRetryingNotice(false);
      setIsSending(false);
    }
  };

  const retryLastMessage = async () => {
    if (isSending || messages.length === 0) return;
    setError(null);
    setRetryingNotice(false);
    setIsSending(true);
    try {
      const replyText = await requestReply(messages);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach EndoScope AI Assistant. Please try again.'
      );
    } finally {
      setRetryingNotice(false);
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const isAr = language === 'ar';
  const starterPrompts = isAr ? STARTER_PROMPTS_AR : STARTER_PROMPTS_EN;

  return (
    <>
      {isOpen && (
        <section
          aria-label="Endometriosis AI Research Assistant"
          className="fixed bottom-24 right-5 z-50 flex w-[calc(100vw-2.5rem)] sm:w-[410px] h-[540px] max-h-[calc(100vh-7.5rem)] flex-col rounded-lg border border-[#311C33] bg-[#110A11] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-[#311C33] bg-[#160D17] px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CreativeBioChatIcon className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-[#FAF2F7] truncate">
                  EndoScope AI Chat
                </h2>
                <p className="text-[11px] text-[#A98CA0] truncate">
                  {activeGene
                    ? `Endometriosis Q&A · Context: ${activeGene}`
                    : isAr
                    ? 'اسأل أي سؤال عن بطانة الرحم المهاجرة'
                    : 'Ask anything about endometriosis biology'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError(null);
                  }}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  className="rounded-md p-1.5 text-[#A98CA0] transition-colors hover:bg-[#1F1221] hover:text-[#FAF2F7] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
                className="rounded-md p-1.5 text-[#A98CA0] transition-colors hover:bg-[#1F1221] hover:text-[#FAF2F7] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
            {messages.length === 0 ? (
              <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="rounded-md border border-[#311C33] bg-[#160D17] p-4 space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[#F472B6]">
                    {isAr ? 'مساعد أبحاث بطانة الرحم المهاجرة' : 'Endometriosis Knowledge Assistant'}
                  </div>
                  <p className="text-xs text-[#DFCBD8] leading-relaxed">
                    {isAr
                      ? 'اسألني عن أي شيء يخص بطانة الرحم المهاجرة: الجينات، أنواع الخلايا المناعية، المسارات الالتهابية والتليف، الأعراض والآليات المرضية، أو تصميم التجارب المعملية.'
                      : 'Ask any question about endometriosis—from disease mechanisms, immune and stromal crosstalk, and single-cell biomarkers to clinical pathology and wet-lab assays.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[#A98CA0]">
                    {isAr ? 'أسئلة مقترحة' : 'Suggested Questions'}
                  </div>
                  <div className="space-y-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="w-full rounded-md border border-[#311C33] bg-[#160D17] px-3 py-2.5 text-start text-xs text-[#DFCBD8] transition-colors hover:border-[#F472B6] hover:bg-[#1F1221] hover:text-[#FAF2F7] cursor-pointer leading-relaxed"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const msgRtl = hasArabicText(msg.content);
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      dir={msgRtl ? 'rtl' : 'ltr'}
                      className={`max-w-[88%] rounded-md px-3.5 py-2.5 text-[13px] ${
                        isUser
                          ? 'border border-[#9D174D] bg-[#261428] text-[#FAF2F7] leading-relaxed'
                          : 'border border-[#311C33] bg-[#160D17] text-[#DFCBD8]'
                      }`}
                    >
                      {isUser ? msg.content : renderFormattedReply(msg.content)}
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-md border border-[#311C33] bg-[#160D17] px-3.5 py-2.5 text-xs text-[#A98CA0]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F472B6]" aria-hidden="true" />
                  <span>
                    {retryingNotice
                      ? isAr
                        ? 'تم الوصول لحد الطلبات مؤقتاً — جاري إعادة المحاولة تلقائياً...'
                        : 'High demand — retrying automatically...'
                      : isAr
                      ? 'جاري صياغة الإجابة العلمية...'
                      : 'Synthesizing answer...'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-[#9D174D] bg-[#1A0D16] p-3 space-y-2 text-xs text-[#FBCFE8]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#FB7185] mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <button
                    type="button"
                    onClick={() => void retryLastMessage()}
                    className="inline-flex items-center gap-1.5 rounded border border-[#4D244F] bg-[#261428] px-2.5 py-1 text-[11px] font-medium text-[#FAF2F7] transition-colors hover:border-[#F472B6] cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3 text-[#F472B6]" aria-hidden="true" />
                    <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-[#311C33] bg-[#160D17] p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                dir="auto"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  isAr
                    ? 'اكتب سؤالك عن بطانة الرحم المهاجرة...'
                    : 'Ask about endometriosis...'
                }
                disabled={isSending}
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-md border border-[#311C33] bg-[#0B070B] px-3 py-2 text-xs text-[#FAF2F7] placeholder-[#7E6174] focus:border-[#F472B6] focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                aria-label="Send message"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F472B6] text-[#0B070B] transition-colors hover:bg-[#F9A8D4] disabled:bg-[#311C33] disabled:text-[#7E6174] cursor-pointer"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Creative Floating Bottom-Right Launcher Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) {
            window.setTimeout(() => inputRef.current?.focus(), 60);
          }
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close Endometriosis AI Chat' : 'Open Endometriosis AI Chat'}
        className={`group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-200 shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F472B6] ${
          isOpen
            ? 'border-[#F472B6] bg-[#261428] shadow-[#F472B6]/20'
            : 'border-[#4D244F] bg-[#160D17] hover:-translate-y-0.5 hover:border-[#F472B6] hover:bg-[#1F1221] shadow-[#EC4899]/15'
        }`}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-[#F472B6]" aria-hidden="true" />
        ) : (
          <CreativeBioChatIcon className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
        )}
      </button>
    </>
  );
}
