import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';

type ConciergeMode = 'balanced' | 'deep' | 'fast' | 'lite';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  model?: string;
  content: string;
}

const STARTER_PROMPTS = [
  'Suggest a gift bundle under 2,500 ETB from Hawassa shops',
  'Write an Amharic & English promo caption for Sidama coffee',
  'Compare delivery vs pickup options across Piazza and Tabor',
];

const PERSONA_PRESETS = [
  {
    id: 'shopper',
    label: 'Shopper Guide',
    instruction:
      'You are a friendly Hawasa Gebeya shopping concierge helping customers pick authentic Sidama coffee, Habesha Netela, spices, and electronics in ETB.',
  },
  {
    id: 'merchant',
    label: 'Merchant Coach',
    instruction:
      'You are an Ethiopian e-commerce advisor helping Hawassa shop owners write bilingual (English/Amharic/Oromo) listings, manage stock, and grow local sales.',
  },
  {
    id: 'logistics',
    label: 'Delivery Planner',
    instruction:
      'You help coordinate Hawassa neighborhood fulfillment across Piazza, Menhariya, Gebeya Dar, Tabor, Datto, and Arab Sefer.',
  },
];

function renderFormattedLine(line: string, keyPrefix: string) {
  const segments = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-bold">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
      return (
        <em key={`${keyPrefix}-i-${i}`} className="italic">
          {seg.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{seg}</React.Fragment>;
  });
}

function FormattedChatText({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={`sp-${idx}`} className="h-1" />;
        if (line === '---') {
          return <hr key={`hr-${idx}`} className="border-[#E7E5E4] dark:border-[#2A3630] my-1.5" />;
        }
        if (/^#{1,3}\s+/.test(line)) {
          const cleanHeading = line.replace(/^#{1,3}\s+/, '');
          return (
            <div key={`h-${idx}`} className="font-bold text-stone-900 dark:text-stone-100 pt-1">
              {renderFormattedLine(cleanHeading, `h-${idx}`)}
            </div>
          );
        }
        if (/^[*-]\s+/.test(line)) {
          const cleanItem = line.replace(/^[*-]\s+/, '');
          return (
            <div key={`li-${idx}`} className="flex gap-1.5 pl-1">
              <span className="text-[#047857] dark:text-[#10B981] font-bold">•</span>
              <span className="flex-1">{renderFormattedLine(cleanItem, `li-${idx}`)}</span>
            </div>
          );
        }
        return <div key={`p-${idx}`}>{renderFormattedLine(line, `p-${idx}`)}</div>;
      })}
    </div>
  );
}

export const ConciergeChatScreen: React.FC = () => {
  const { goBack, firebaseUser, language } = useMarketplace();

  const [mode, setMode] = useState<ConciergeMode>('balanced');
  const [personaId, setPersonaId] = useState<string>('shopper');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      model: 'gemini-4-hydrogen',
      content:
        'Selam! I am your Hawasa Gebeya AI Concierge. Ask me about local Sidama coffee, Habesha textiles, shop bundles, or neighborhood delivery across Hawassa.',
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const loadCloudHistory = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/sql/chat', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: { id: number; role: 'user' | 'model'; model: string; content: string }[];
      };
      if (data.messages && data.messages.length > 0) {
        setMessages(
          data.messages.map((m) => ({
            id: `sql-${m.id}`,
            role: m.role,
            model: m.model,
            content: m.content,
          }))
        );
      }
    } catch {
      // Keep local welcome state if offline
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadCloudHistory();
  }, [loadCloudHistory]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    setInput('');
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome-msg')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const activePersona = PERSONA_PRESETS.find((p) => p.id === personaId);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          mode,
          systemInstruction: activePersona?.instruction,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach the Gemini assistant.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          model: data.model,
          content: data.text,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        await fetch('/api/sql/chat', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network error on clear
      }
    }
    setMessages([
      {
        id: 'welcome-msg',
        role: 'model',
        model: 'gemini-4-hydrogen',
        content: 'Conversation cleared. How can I help with Hawasa Gebeya today?',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-3 py-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center min-w-0">
            <h1 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
              <span>Gebeya AI Concierge</span>
            </h1>
            <p className="text-[10px] text-stone-500 dark:text-stone-400">Multi-turn Gemini Assistant</p>
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            aria-label="Clear conversation"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Persona & Model Mode Selectors */}
        <div className="grid grid-cols-2 gap-2 pb-0.5">
          <select
            aria-label="Assistant Persona"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-[11px] font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
          >
            {PERSONA_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">
                {p.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Gemini Reasoning Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as ConciergeMode)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-[11px] font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
          >
            <option value="balanced" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">Balanced (Hydrogen)</option>
            <option value="deep" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">Deep Think (XHIGH)</option>
            <option value="fast" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">Fast (Hydrogen Low)</option>
            <option value="lite" className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">Ultra-Fast (Flash Lite)</option>
          </select>
        </div>
      </header>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div className="flex-1 overflow-y-auto mobile-scroll p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'model' && (
              <div className="w-7 h-7 rounded-xl bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] rounded-br-sm whitespace-pre-line'
                  : 'bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-xs text-stone-800 dark:text-stone-200 rounded-bl-sm'
              }`}
            >
              {m.role === 'model' ? <FormattedChatText content={m.content} /> : m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-xl bg-[#E7E5E4] dark:bg-[#2A3630] text-stone-700 dark:text-stone-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <div className="w-7 h-7 rounded-xl bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}

        {messages.length <= 2 && !loading && (
          <div className="pt-2 space-y-1.5">
            <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Try asking:</div>
            <div className="flex flex-col gap-1.5">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-3 py-2 rounded-xl bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shadow-xs text-xs text-stone-700 dark:text-stone-300 hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/15 hover:border-[#047857]/40 dark:hover:border-[#10B981]/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-3 bg-white dark:bg-[#1C2420] border-t border-[#E7E5E4] dark:border-[#2A3630] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Hawassa shops, products, or prices..."
          aria-label="Message Hawasa Gebeya AI Concierge"
          className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-500 dark:placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] flex items-center justify-center disabled:opacity-50 shrink-0 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
