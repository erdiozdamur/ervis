import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  ChevronDown,
  Command,
  FileText,
  Github,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';

const API_URL = '/api/chat';
const CONVERSATIONS_URL = '/api/chat/conversations';
const CONVERSATION_FETCH_LIMIT = 24;
const HISTORY_FETCH_LIMIT = 40;
const UI_MESSAGE_LIMIT = 60;
const INPUT_MAX_CHARS = 1500;
const MESSAGE_RENDER_CHAR_LIMIT = 4000;

const trimMessages = (items, limit = UI_MESSAGE_LIMIT) => {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
};

const clampText = (value, limit = MESSAGE_RENDER_CHAR_LIMIT) => {
  const text = (value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
};

const isDefaultConversationTitle = (title) => {
  const normalized = (title || '').trim().toLowerCase();
  return !normalized || normalized === 'yeni oturum' || normalized === 'new session' || normalized === 'new chat';
};

function ChatInterface() {
  const [location, setLocation] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isHydratingConversations, setIsHydratingConversations] = useState(true);
  const [isHydratingHistory, setIsHydratingHistory] = useState(true);
  const { user, logout } = useAuth();
  const messagesEndRef = useRef(null);
  const deckRef = useRef(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        setLocation({
          city: data.city,
          region: data.region,
          country: data.country_name,
        });
      })
      .catch(() => setLocation(null));
  }, []);

  const createConversation = async (title = null) => {
    const response = await axios.post(CONVERSATIONS_URL, { title });
    return response.data;
  };

  const promoteConversation = (conversationId, fallbackTitle = 'Yeni Oturum') => {
    if (!conversationId) return;
    setConversations((prev) => {
      const existing = prev.find((item) => item.id === conversationId);
      const currentTime = new Date().toISOString();
      const nextItem = existing
        ? {
            ...existing,
            title: isDefaultConversationTitle(existing.title) ? clampText(fallbackTitle, 60) : existing.title,
            last_message_at: currentTime,
          }
        : {
            id: conversationId,
            title: clampText(fallbackTitle, 60),
            created_at: currentTime,
            last_message_at: currentTime,
          };
      return [nextItem, ...prev.filter((item) => item.id !== conversationId)].slice(0, CONVERSATION_FETCH_LIMIT);
    });
  };

  useEffect(() => {
    let active = true;
    const loadConversations = async () => {
      setIsHydratingConversations(true);
      try {
        const response = await axios.get(`${CONVERSATIONS_URL}?limit=${CONVERSATION_FETCH_LIMIT}`);
        if (!active) return;
        const list = response.data || [];
        if (list.length > 0) {
          setConversations(list);
          setActiveConversationId(list[0].id);
        } else {
          const created = await createConversation();
          if (!active) return;
          setConversations([created]);
          setActiveConversationId(created.id);
        }
      } catch {
        if (!active) return;
        setConversations([]);
        setActiveConversationId(null);
      } finally {
        if (active) setIsHydratingConversations(false);
      }
    };
    loadConversations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      if (!activeConversationId) {
        setMessages([]);
        setIsHydratingHistory(false);
        return;
      }
      setIsHydratingHistory(true);
      try {
        const response = await axios.get(`${CONVERSATIONS_URL}/${activeConversationId}/messages?limit=${HISTORY_FETCH_LIMIT}`);
        if (!active) return;
        const normalized = (response.data || []).map((item) => ({
          role: item.role,
          content: clampText(item.content),
          model_used: item.model_used || null,
          timestamp: item.timestamp || new Date().toISOString(),
        }));
        setMessages(trimMessages(normalized));
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setIsHydratingHistory(false);
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (rawContent) => {
    const content = clampText(rawContent, INPUT_MAX_CHARS);
    if (!content || isLoading || !activeConversationId) return;
    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => trimMessages([...prev, userMessage]));
    setInput('');
    setIsLoading(true);

    try {
      const metadata = {
        location,
        time: new Date().toLocaleTimeString(),
        day: new Date().toLocaleDateString('tr-TR', { weekday: 'long' }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
      };

      const response = await axios.post(API_URL, {
        user_id: user.user_id,
        message: userMessage.content,
        metadata,
        conversation_id: activeConversationId,
      });

      const resolvedConversationId = response.data.conversation_id || activeConversationId;
      setActiveConversationId(resolvedConversationId);
      promoteConversation(resolvedConversationId, userMessage.content);

      setMessages((prev) => trimMessages([
        ...prev,
        {
          role: 'assistant',
          content: clampText(response.data.message),
          model_used: response.data.model_used,
          timestamp: new Date().toISOString(),
        },
      ]));
    } catch (error) {
      if (error?.response?.status === 401) {
        logout();
        setMessages((prev) => trimMessages([
          ...prev,
          {
            role: 'assistant',
            content: 'Oturum süren dolmuş görünüyor. Güvenli şekilde çıkış yaptım, lütfen tekrar giriş yap.',
            timestamp: new Date().toISOString(),
          },
        ]));
        return;
      }

      setMessages((prev) => trimMessages([
        ...prev,
        {
          role: 'assistant',
          content: 'Sistemde geçici bir aksaklık var. Birkaç saniye sonra tekrar deneyelim.',
          timestamp: new Date().toISOString(),
        },
      ]));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!input.trim()) return;
    await sendMessage(input);
  };

  const clearChat = async () => {
    try {
      const created = await createConversation();
      setConversations((prev) => [created, ...prev].slice(0, CONVERSATION_FETCH_LIMIT));
      setActiveConversationId(created.id);
      setMessages([]);
      setIsSidebarOpen(false);
    } catch {
      // Ignore create failure to keep UI responsive.
    }
  };

  const renameConversation = async (conversation) => {
    const currentTitle = conversation?.title || 'Yeni Oturum';
    const nextTitle = window.prompt('Oturum adı', currentTitle);
    if (nextTitle === null) return;

    const trimmed = nextTitle.trim();
    if (!trimmed) return;

    try {
      const response = await axios.patch(`${CONVERSATIONS_URL}/${conversation.id}`, { title: trimmed });
      const updated = response.data;
      setConversations((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch {
      // Ignore rename failure to keep interaction smooth.
    }
  };

  const deleteConversation = async (conversation) => {
    const ok = window.confirm(`"${conversation.title || 'Yeni Oturum'}" oturumunu silmek istiyor musun?`);
    if (!ok) return;

    try {
      await axios.delete(`${CONVERSATIONS_URL}/${conversation.id}`);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);

      if (activeConversationId === conversation.id) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          const created = await createConversation();
          setConversations([created]);
          setActiveConversationId(created.id);
          setMessages([]);
        }
      }
    } catch {
      // Ignore delete failure to keep interaction smooth.
    }
  };

  useEffect(() => {
    if (!isDeckOpen) return undefined;
    const onClickOutside = (event) => {
      if (!deckRef.current?.contains(event.target)) {
        setIsDeckOpen(false);
      }
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') setIsDeckOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isDeckOpen]);

  const activeConversation = conversations.find((item) => item.id === activeConversationId) || null;
  const userMessageCount = messages.filter((msg) => msg.role === 'user').length;
  const assistantMessageCount = messages.filter((msg) => msg.role === 'assistant').length;
  const lastAssistantModel = [...messages].reverse().find((msg) => msg.role === 'assistant' && msg.model_used)?.model_used || 'N/A';
  const lastUpdatedText = activeConversation?.last_message_at
    ? new Date(activeConversation.last_message_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '--';

  const quickPrompts = [
    {
      id: 'summarize',
      label: 'Oturumu Özetle',
      prompt: 'Bu konuşmayı kararlar, açık konular ve önerilen sonraki 3 adım olarak özetle.',
    },
    {
      id: 'next-steps',
      label: 'Sonraki Adımlar',
      prompt: 'Bu oturuma göre uygulanabilir bir aksiyon planı çıkar. Öncelik, tahmini süre ve risk notu ekle.',
    },
    {
      id: 'improve',
      label: 'Kalite Denetimi',
      prompt: 'Bu konuşmadaki zayıf noktaları bul ve daha iyi bir yanıt stratejisi öner.',
    },
  ];

  const runQuickPrompt = async (prompt, autoSend = false) => {
    setInput(prompt);
    setIsDeckOpen(false);
    if (autoSend) {
      await sendMessage(prompt);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden text-[var(--text-main)]">
      <div className="ambient-grid pointer-events-none absolute inset-0 opacity-70" />

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/55 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`surface-panel fixed inset-y-0 left-0 z-40 flex w-[84vw] max-w-[320px] transform flex-col border-r border-[rgba(122,146,182,0.26)] p-4 transition-transform duration-300 sm:p-5 lg:relative lg:z-10 lg:w-[300px] lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={clearChat}
            className="btn-accent flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm"
          >
            <Plus size={16} />
            Yeni Oturum
          </button>
          <button
            type="button"
            className="btn-ghost rounded-xl p-2 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Akış</p>
            <span className="rounded-full bg-[rgba(107,212,255,0.16)] px-2 py-1 text-[10px] text-[var(--accent-2)]">
              {messages.length} mesaj
            </span>
          </div>

          <div className="chat-scroll flex-1 space-y-2 overflow-y-auto pr-1">
            {isHydratingConversations ? (
              <div className="surface-card rounded-2xl p-3 text-xs text-[var(--text-muted)]">Oturumlar yükleniyor...</div>
            ) : conversations.length > 0 ? (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex w-full items-start gap-2 rounded-2xl border p-2 transition ${
                    activeConversationId === conversation.id
                      ? 'border-[rgba(126,168,255,0.45)] bg-[rgba(126,168,255,0.14)]'
                      : 'border-[rgba(122,146,182,0.24)] bg-[rgba(13,23,37,0.7)] hover:border-[rgba(122,146,182,0.42)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(conversation.id);
                      setIsSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold">{conversation.title || 'Yeni Oturum'}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {new Date(conversation.last_message_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => renameConversation(conversation)}
                    className="btn-ghost rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    title="Oturumu yeniden adlandır"
                    aria-label="Oturumu yeniden adlandır"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(conversation)}
                    className="btn-ghost rounded-lg p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    title="Oturumu sil"
                    aria-label="Oturumu sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="surface-card rounded-2xl p-4 text-sm text-[var(--text-muted)]">
                Oturum bulunamadı. Yeni oturum açarak devam edebilirsin.
              </div>
            )}
          </div>

          <div className="surface-card mt-4 rounded-2xl p-4 lg:mb-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.username}</p>
                <p className="text-xs text-[var(--text-muted)]">Ervis Operator</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="btn-ghost rounded-xl p-2 text-[var(--accent-2)] hover:text-[var(--text-main)]"
                title="Çıkış Yap"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="surface-panel relative mx-3 mt-3 flex h-16 items-center justify-between rounded-2xl px-3 sm:mx-4 sm:px-5 lg:mx-6">
          <div className="flex items-center gap-3" ref={deckRef}>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="btn-ghost rounded-xl p-2 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="rounded-xl bg-[linear-gradient(135deg,var(--accent-1),var(--accent-2))] p-2 text-slate-900">
              <Bot size={18} />
            </div>
            <button
              type="button"
              onClick={() => setIsDeckOpen((prev) => !prev)}
              className="group rounded-xl px-1 py-0.5 text-left"
              aria-label="Ervis Command Deck actions"
            >
              <div className="flex items-center gap-2">
                <p className="type-headline text-base font-bold sm:text-lg">Ervis Command Deck</p>
                <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${isDeckOpen ? 'rotate-180' : ''}`} />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span className="pulse-dot" />
                Canlı
              </div>
            </button>

            {isDeckOpen && (
              <div className="surface-panel absolute left-0 top-14 z-50 w-[min(92vw,430px)] rounded-2xl p-3 shadow-2xl">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={clearChat}
                    className="btn-ghost rounded-xl px-3 py-2 text-left text-xs"
                  >
                    <span className="font-semibold">Yeni Oturum</span>
                    <span className="mt-1 block text-[var(--text-muted)]">Boş bir çalışma alanı aç</span>
                  </button>
                  <button
                    type="button"
                    disabled={!activeConversation}
                    onClick={() => activeConversation && renameConversation(activeConversation)}
                    className="btn-ghost rounded-xl px-3 py-2 text-left text-xs disabled:opacity-45"
                  >
                    <span className="font-semibold">Oturumu Yeniden Adlandır</span>
                    <span className="mt-1 block text-[var(--text-muted)]">Aktif konuşma başlığını güncelle</span>
                  </button>
                  <button
                    type="button"
                    disabled={!activeConversation}
                    onClick={() => activeConversation && deleteConversation(activeConversation)}
                    className="btn-ghost rounded-xl px-3 py-2 text-left text-xs disabled:opacity-45"
                  >
                    <span className="font-semibold">Oturumu Sil</span>
                    <span className="mt-1 block text-[var(--text-muted)]">Aktif oturumu kalıcı sil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runQuickPrompt(quickPrompts[0].prompt, true)}
                    disabled={isLoading || !activeConversationId}
                    className="btn-ghost rounded-xl px-3 py-2 text-left text-xs disabled:opacity-45"
                  >
                    <span className="font-semibold">Akıllı Özet Üret</span>
                    <span className="mt-1 block text-[var(--text-muted)]">Karar + risk + sonraki adımlar</span>
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-[rgba(122,146,182,0.24)] bg-[rgba(14,22,36,0.65)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    <FileText size={13} />
                    Session Insights
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-[rgba(122,146,182,0.12)] px-2 py-2">
                      <p className="text-[var(--text-muted)]">Mesaj</p>
                      <p className="mt-1 font-semibold">{messages.length}</p>
                    </div>
                    <div className="rounded-lg bg-[rgba(122,146,182,0.12)] px-2 py-2">
                      <p className="text-[var(--text-muted)]">Model</p>
                      <p className="mt-1 truncate font-semibold">{lastAssistantModel}</p>
                    </div>
                    <div className="rounded-lg bg-[rgba(122,146,182,0.12)] px-2 py-2">
                      <p className="text-[var(--text-muted)]">Kullanıcı/Asistan</p>
                      <p className="mt-1 font-semibold">{userMessageCount}/{assistantMessageCount}</p>
                    </div>
                    <div className="rounded-lg bg-[rgba(122,146,182,0.12)] px-2 py-2">
                      <p className="text-[var(--text-muted)]">Son Güncelleme</p>
                      <p className="mt-1 font-semibold">{lastUpdatedText}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    <ListChecks size={13} />
                    Quick Commands
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => runQuickPrompt(item.prompt, true)}
                        disabled={isLoading || !activeConversationId}
                        className="btn-ghost rounded-xl px-3 py-2 text-xs disabled:opacity-45"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-ghost rounded-xl p-2"
            title="Github"
            aria-label="Github"
          >
            <Github size={18} />
          </button>
        </header>

        <section className="chat-scroll relative flex-1 overflow-y-auto px-3 pb-5 pt-4 sm:px-4 lg:px-6">
          {isHydratingHistory ? (
            <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center">
              <div className="surface-card inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[var(--accent-2)]">
                <Loader2 size={16} className="animate-spin" />
                Sohbet geçmişi yükleniyor...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center text-center">
              <div className="fade-rise rounded-[2rem] border border-[rgba(126,168,255,0.42)] bg-[linear-gradient(135deg,rgba(126,168,255,0.28),rgba(107,212,255,0.3))] p-5 text-slate-950 shadow-2xl shadow-slate-950/40 sm:p-7">
                <Bot size={44} className="mx-auto" />
              </div>
              <h1 className="type-headline fade-rise stagger-1 mt-6 text-3xl font-extrabold sm:text-5xl">
                Komut ver, Ervis sahayı alsın.
              </h1>
              <p className="fade-rise stagger-2 mt-4 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
                Hafıza odaklı, bağlamı kaybetmeyen ve güncel bilgiyle çalışan otonom asistan deneyimi.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2 sm:gap-3">
                {['Bugün İstanbul hava nasıl?', 'Bu hafta görevlerim neler?', 'Product Owner için sprint ritmi öner'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setInput(sample)}
                    className="btn-ghost rounded-xl px-3 py-2 text-xs sm:text-sm"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-1">
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.timestamp}-${idx}`}
                  className={`fade-rise flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}
                  >
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:text-[15px] ${
                        msg.role === 'user'
                          ? 'border-[rgba(126,168,255,0.46)] bg-[rgba(126,168,255,0.18)] text-blue-50'
                          : 'surface-card'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert max-w-none prose-p:my-2 prose-p:text-[var(--text-main)] prose-pre:border prose-pre:border-[rgba(122,146,182,0.28)] prose-pre:bg-[#101a2a] prose-code:text-[var(--accent-3)]">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="rounded-full bg-[rgba(159,178,212,0.14)] px-2 py-1">
                        {msg.role === 'user' ? 'Sen' : 'Ervis'}
                      </span>
                      {msg.role === 'assistant' && msg.model_used && (
                        <span className="rounded-full bg-[rgba(107,212,255,0.16)] px-2 py-1 text-[var(--accent-2)]">
                          <Sparkles size={10} className="mr-1 inline" />
                          {msg.model_used}
                        </span>
                      )}
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="fade-rise flex justify-start">
                  <div className="surface-card inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[var(--accent-2)]">
                    <Loader2 size={16} className="animate-spin" />
                    Yanıt hazırlanıyor...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <footer className="px-3 pb-3 sm:px-4 lg:px-6 lg:pb-5">
          <form onSubmit={handleSend} className="mx-auto w-full max-w-4xl">
            <div className="surface-panel rounded-2xl p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden rounded-xl bg-[rgba(107,212,255,0.14)] p-2 text-[var(--accent-2)] sm:block">
                  <Command size={18} />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ervis'e bir talimat ver..."
                  maxLength={INPUT_MAX_CHARS}
                  disabled={isLoading}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-3 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.46)] sm:h-12 sm:text-base"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="btn-accent h-11 w-11 rounded-xl disabled:cursor-not-allowed disabled:opacity-45 sm:h-12 sm:w-12"
                >
                  <Send size={17} className="mx-auto" />
                </button>
              </div>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState('login');

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="surface-card fade-rise rounded-3xl px-10 py-8 text-center">
          <Loader2 className="mx-auto mb-3 animate-spin text-[var(--accent-2)]" size={30} />
          <p className="type-headline text-sm font-semibold tracking-[0.14em] text-[var(--text-muted)]">LOADING COMMAND DECK</p>
        </div>
      </div>
    );
  }

  if (user) return <ChatInterface />;

  return mode === 'login' ? (
    <Login onToggleMode={() => setMode('register')} />
  ) : (
    <Register onToggleMode={() => setMode('login')} />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
