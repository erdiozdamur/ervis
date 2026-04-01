import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  ChevronDown,
  Command,
  FileText,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  Pencil,
  Plus,
  Settings,
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
const KNOWLEDGE_DOCUMENTS_URL = '/api/knowledge/documents';
const KNOWLEDGE_DOCUMENT_UPLOAD_URL = '/api/knowledge/documents/upload';
const CHAT_ATTACHMENT_EXTRACT_URL = '/api/chat/attachments/extract';
const CONVERSATION_FETCH_LIMIT = 24;
const HISTORY_FETCH_LIMIT = 40;
const UI_MESSAGE_LIMIT = 60;
const INPUT_MAX_CHARS = 2000;
const MESSAGE_RENDER_CHAR_LIMIT = 4000;
const CHAT_ATTACHMENT_MAX_COUNT = 6;

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
  const [viewMode, setViewMode] = useState('chat');
  const [location, setLocation] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatAttachments, setChatAttachments] = useState([]);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [isHydratingConversations, setIsHydratingConversations] = useState(true);
  const [isHydratingHistory, setIsHydratingHistory] = useState(true);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isKnowledgeSubmitting, setIsKnowledgeSubmitting] = useState(false);
  const [isKnowledgeFileReading, setIsKnowledgeFileReading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeSuccess, setKnowledgeSuccess] = useState('');
  const [hasKnowledgeLoadAttempted, setHasKnowledgeLoadAttempted] = useState(false);
  const [embeddingSettings, setEmbeddingSettings] = useState({
    model: 'text-embedding-3-large',
    chunk_size: 1000,
    chunk_overlap: 150,
    min_chunk_size: 250,
    max_chunk_size: 1800,
    split_strategy: 'recursive',
    separators: '\\n\\n,\\n,. , ',
    preserve_paragraphs: true,
    normalize_whitespace: true,
    lowercase: false,
    remove_urls: false,
    remove_tables: false,
    language_hint: 'tr',
    top_k_index: 8,
    score_threshold: 0.2,
    re_rank_enabled: true,
    re_rank_top_n: 24,
    batch_size: 32,
    max_tokens_per_chunk: 800,
  });
  const [autoTunedLabel, setAutoTunedLabel] = useState('');
  const [summaryDrafts, setSummaryDrafts] = useState({});
  const [docForm, setDocForm] = useState({
    title: '',
    domain: 'product',
    product: '',
    version_tag: '',
    source_type: 'manual',
    source_ref: '',
    language: 'tr',
    content: '',
  });
  const { user, logout } = useAuth();
  const messagesEndRef = useRef(null);
  const deckRef = useRef(null);
  const inputRef = useRef(null);
  const attachmentInputRef = useRef(null);

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

  const autoTuneEmbeddingSettings = (text, extension = '') => {
    const length = (text || '').trim().length;
    const isPdf = extension === 'pdf';
    if (length > 25000 || isPdf) {
      return {
        model: 'text-embedding-3-large',
        chunk_size: 1400,
        chunk_overlap: 180,
        min_chunk_size: 300,
        max_chunk_size: 2200,
        split_strategy: 'recursive',
        separators: '\\n\\n,\\n,. , ',
        preserve_paragraphs: true,
        normalize_whitespace: true,
        lowercase: false,
        remove_urls: false,
        remove_tables: false,
        language_hint: docForm.language || 'tr',
        top_k_index: 10,
        score_threshold: 0.18,
        re_rank_enabled: true,
        re_rank_top_n: 30,
        batch_size: 48,
        max_tokens_per_chunk: 1000,
      };
    }
    return {
      model: 'text-embedding-3-small',
      chunk_size: 900,
      chunk_overlap: 120,
      min_chunk_size: 200,
      max_chunk_size: 1400,
      split_strategy: 'recursive',
      separators: '\\n\\n,\\n,. , ',
      preserve_paragraphs: true,
      normalize_whitespace: true,
      lowercase: false,
      remove_urls: false,
      remove_tables: false,
      language_hint: docForm.language || 'tr',
      top_k_index: 8,
      score_threshold: 0.2,
      re_rank_enabled: true,
      re_rank_top_n: 20,
      batch_size: 32,
      max_tokens_per_chunk: 750,
    };
  };

  const summarizeDocumentWithAgent = (rawText) => {
    const text = (rawText || '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const preview = text.slice(0, 380);
    return `Agent özeti: ${preview}${text.length > 380 ? '…' : ''}`;
  };

  const loadKnowledgeDocuments = async ({ suppressError = false } = {}) => {
    setIsKnowledgeLoading(true);
    if (!suppressError) setKnowledgeError('');
    try {
      const response = await axios.get(`${KNOWLEDGE_DOCUMENTS_URL}?limit=100`);
      setKnowledgeDocs(response.data || []);
    } catch {
      if (!suppressError) {
        setKnowledgeError('Dokümanlar yüklenirken bir sorun oluştu.');
      }
    } finally {
      setHasKnowledgeLoadAttempted(true);
      setIsKnowledgeLoading(false);
    }
  };

  const submitKnowledgeDocument = async (event) => {
    event.preventDefault();
    if (!docForm.title.trim()) {
      setKnowledgeError('Doküman başlığı zorunludur.');
      return;
    }
    if ((docForm.content || '').trim().length < 40) {
      setKnowledgeError('Doküman içeriği en az 40 karakter olmalı.');
      return;
    }
    setIsKnowledgeSubmitting(true);
    setKnowledgeError('');
    setKnowledgeSuccess('');
    try {
      const payload = {
        title: docForm.title.trim(),
        content: docForm.content.trim(),
        domain: docForm.domain || null,
        product: docForm.product.trim() || null,
        version_tag: docForm.version_tag.trim() || null,
        source_type: docForm.source_type || 'manual',
        source_ref: docForm.source_ref.trim() || null,
        language: docForm.language || 'tr',
      };
      const response = await axios.post(KNOWLEDGE_DOCUMENTS_URL, payload);
      const created = response.data;
      setKnowledgeDocs((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      const generatedSummary = summarizeDocumentWithAgent(payload.content);
      setSummaryDrafts((prev) => ({ ...prev, [created.id]: generatedSummary }));
      setKnowledgeSuccess(`Doküman işlendi: ${created.chunk_count} parça indekslendi.`);
      setDocForm((prev) => ({ ...prev, title: '', content: '' }));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setKnowledgeError(typeof detail === 'string' ? detail : 'Doküman kaydı başarısız oldu.');
    } finally {
      setIsKnowledgeSubmitting(false);
    }
  };

  const handleKnowledgeFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const maxFileSize = 3 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setKnowledgeError('Dosya boyutu en fazla 3MB olabilir.');
      return;
    }

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const supportedExtensions = ['txt', 'md', 'markdown', 'csv', 'json', 'log', 'pdf'];
    if (!supportedExtensions.includes(extension)) {
      setKnowledgeError('Yalnızca txt, md, csv, json, log ve pdf dosyaları destekleniyor.');
      return;
    }

    setKnowledgeError('');
    setKnowledgeSuccess('');
    setIsKnowledgeFileReading(true);
    try {
      const tuned = autoTuneEmbeddingSettings('', extension);
      setEmbeddingSettings(tuned);
      setAutoTunedLabel('Agent, dosya türüne göre embedding ayarlarını optimize etti.');
      if (extension === 'pdf') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', docForm.title.trim() || file.name.replace(/\.[^/.]+$/, ''));
        formData.append('domain', docForm.domain || 'product');
        formData.append('product', docForm.product.trim());
        formData.append('version_tag', docForm.version_tag.trim());
        formData.append('language', docForm.language || 'tr');
        formData.append('source_ref', docForm.source_ref.trim());

        const response = await axios.post(KNOWLEDGE_DOCUMENT_UPLOAD_URL, formData);
        const created = response.data;
        setKnowledgeDocs((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
        setKnowledgeSuccess(`PDF işlendi: ${created.chunk_count} parça indekslendi.`);
        setDocForm((prev) => ({
          ...prev,
          title: '',
          content: '',
          source_type: 'file',
          source_ref: file.name,
        }));
        return;
      }

      const text = await file.text();
      const normalized = (text || '').trim();
      if (normalized.length < 40) {
        setKnowledgeError('Dosya içeriği indeksleme için en az 40 karakter olmalı.');
        return;
      }
      const tunedForContent = autoTuneEmbeddingSettings(normalized, extension);
      setEmbeddingSettings(tunedForContent);
      setAutoTunedLabel('Agent, doküman içeriğine göre embedding ayarlarını optimize etti.');
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '');
      setDocForm((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : defaultTitle,
        content: normalized,
        source_type: 'file',
        source_ref: file.name,
      }));
      setKnowledgeSuccess(`Dosya yüklendi: ${file.name}. İçerik forma aktarıldı.`);
    } catch {
      setKnowledgeError('Dosya okunurken bir sorun oluştu.');
    } finally {
      setIsKnowledgeFileReading(false);
    }
  };

  const removeKnowledgeDocument = async (doc) => {
    const ok = window.confirm(`"${doc.title}" dokümanını silmek istiyor musun?`);
    if (!ok) return;
    try {
      await axios.delete(`${KNOWLEDGE_DOCUMENTS_URL}/${doc.id}`);
      setKnowledgeDocs((prev) => prev.filter((x) => x.id !== doc.id));
      setKnowledgeSuccess('Doküman silindi.');
    } catch {
      setKnowledgeError('Doküman silinemedi.');
    }
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

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = '0px';
    const nextHeight = Math.min(inputRef.current.scrollHeight, 220);
    inputRef.current.style.height = `${nextHeight}px`;
  }, [input]);

  const sendMessage = async (rawContent) => {
    const content = clampText(rawContent, INPUT_MAX_CHARS);
    if ((!content && chatAttachments.length === 0) || isLoading || !activeConversationId) return;
    const visibleUserContent = content || `Ek dosya gönderildi (${chatAttachments.length})`;
    const userMessage = {
      role: 'user',
      content: visibleUserContent,
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
        attachments: chatAttachments.map((item) => ({
          filename: item.filename,
          mime_type: item.mime_type,
          content: item.content,
        })),
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
      setChatAttachments([]);
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
    if (!input.trim() && chatAttachments.length === 0) return;
    await sendMessage(input);
  };

  const handleInputKeyDown = async (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if ((!input.trim() && chatAttachments.length === 0) || isLoading) return;
    await sendMessage(input);
  };

  const removeChatAttachment = (id) => {
    setChatAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleChatAttachmentSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const remainingSlots = CHAT_ATTACHMENT_MAX_COUNT - chatAttachments.length;
    const targetFiles = files.slice(0, Math.max(0, remainingSlots));
    if (targetFiles.length === 0) return;

    setIsAttachmentUploading(true);
    try {
      const uploaded = [];
      for (const file of targetFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(CHAT_ATTACHMENT_EXTRACT_URL, formData);
        uploaded.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filename: response.data.filename,
          mime_type: response.data.mime_type,
          content: response.data.content,
          char_count: response.data.char_count,
        });
      }
      setChatAttachments((prev) => [...prev, ...uploaded].slice(0, CHAT_ATTACHMENT_MAX_COUNT));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessages((prev) => trimMessages([
        ...prev,
        {
          role: 'assistant',
          content: typeof detail === 'string' ? `Dosya eklenemedi: ${detail}` : 'Dosya eklenirken bir hata oluştu.',
          timestamp: new Date().toISOString(),
        },
      ]));
    } finally {
      setIsAttachmentUploading(false);
    }
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

  useEffect(() => {
    if (viewMode !== 'knowledge') return;
    if (!hasKnowledgeLoadAttempted) {
      loadKnowledgeDocuments({ suppressError: true });
      return;
    }
    loadKnowledgeDocuments();
  }, [viewMode]);

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

  const getCommandDeckStatus = () => {
    if (isLoading) {
      return {
        title: 'Yanıt hazırlanıyor',
        detail: 'Asistan aktif yanıt üretiyor',
      };
    }

    if (isHydratingHistory || isHydratingConversations) {
      return {
        title: 'Sohbet yükleniyor',
        detail: 'Oturum verileri senkronize ediliyor',
      };
    }

    if (input.trim()) {
      return {
        title: 'Taslak hazır',
        detail: `${input.trim().slice(0, 48)}${input.trim().length > 48 ? '…' : ''}`,
      };
    }

    if (activeConversation?.title) {
      return {
        title: 'Aktif oturum',
        detail: clampText(activeConversation.title, 48),
      };
    }

    return {
      title: 'Beklemede',
      detail: 'Bir komut yazarak başlayabilirsin',
    };
  };

  const commandDeckStatus = getCommandDeckStatus();

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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('settings')}
                  className="btn-ghost rounded-xl p-2 text-[var(--accent-2)] hover:text-[var(--text-main)]"
                  title="Ayarlar"
                >
                  <Settings size={16} />
                </button>
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
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="surface-panel relative mx-3 mt-3 flex h-16 items-center justify-between rounded-2xl px-3 sm:mx-4 sm:px-5 lg:mx-6" ref={deckRef}>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="btn-ghost rounded-xl p-2 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={clearChat}
              className="btn-accent btn-new-chat inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold lg:hidden"
              title="Yeni Sohbet"
              aria-label="Yeni Sohbet"
            >
              <Plus size={18} />
              <span>Yeni Sohbet</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeckOpen((prev) => !prev)}
              className="group min-w-0 rounded-xl px-1 py-0.5 text-left"
              aria-label="Komut paneli durumu"
            >
              <p className="type-headline truncate whitespace-nowrap text-base font-bold leading-none sm:text-lg">{commandDeckStatus.title}</p>
              <div className="mt-1 hidden items-center gap-2 text-[11px] text-[var(--text-muted)] sm:flex">
                <span className="pulse-dot" />
                <span className="truncate">{commandDeckStatus.detail}</span>
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
            onClick={() => setIsDeckOpen((prev) => !prev)}
            className="btn-ghost inline-flex h-10 items-center gap-2 rounded-xl px-3"
            title="Sohbet Paneli"
            aria-label="Sohbet Paneli"
          >
            <Command size={18} />
            <span className="hidden text-sm font-semibold sm:inline">Panel</span>
            <ChevronDown size={16} />
          </button>
        </header>

        {viewMode === 'chat' ? (
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
                Komut ver, Ervis halletsin.
              </h1>
              <p className="fade-rise stagger-2 mt-4 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
                Hafıza odaklı, bağlamı kaybetmeyen ve güncel bilgiyle çalışan otonom asistan deneyimi.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2 sm:gap-3">
                {["Bugün İstanbul'da hava nasıl?", 'Bu hafta görevlerim neler?', 'Product Owner için sprint ritmi önerisi ver.'].map((sample) => (
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
        ) : viewMode === 'settings' ? (
          <section className="chat-scroll relative flex-1 overflow-y-auto px-3 pb-5 pt-4 sm:px-4 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              <div className="surface-card rounded-2xl p-4">
                <h2 className="text-lg font-bold">Ayarlar</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Bağlam yönetimi: dokümanların vektörel bağlama dönüştürülmesi için embedding modeli ve tüm indeksleme ayarları.
                </p>
              </div>
              <div className="surface-card rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Bağlam Yönetimi</h3>
                  <span className="text-xs text-[var(--accent-2)]">{autoTunedLabel || 'Elle güncellenebilir'}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs">Embedding modeli
                    <select value={embeddingSettings.model} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, model: e.target.value }))} className="mt-1 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none">
                      <option value="text-embedding-3-large">text-embedding-3-large</option>
                      <option value="text-embedding-3-small">text-embedding-3-small</option>
                    </select>
                  </label>
                  <label className="text-xs">Split strategy
                    <select value={embeddingSettings.split_strategy} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, split_strategy: e.target.value }))} className="mt-1 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none">
                      <option value="recursive">recursive</option>
                      <option value="token">token</option>
                      <option value="sentence">sentence</option>
                    </select>
                  </label>
                  {['chunk_size', 'chunk_overlap', 'min_chunk_size', 'max_chunk_size', 'top_k_index', 're_rank_top_n', 'batch_size', 'max_tokens_per_chunk', 'score_threshold'].map((key) => (
                    <label key={key} className="text-xs">{key}
                      <input value={embeddingSettings[key]} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, [key]: key === 'score_threshold' ? Number(e.target.value) : Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none" />
                    </label>
                  ))}
                  <label className="text-xs sm:col-span-2">Separators
                    <input value={embeddingSettings.separators} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, separators: e.target.value }))} className="mt-1 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none" />
                  </label>
                  <label className="text-xs">Language hint
                    <input value={embeddingSettings.language_hint} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, language_hint: e.target.value }))} className="mt-1 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none" />
                  </label>
                  {['preserve_paragraphs', 'normalize_whitespace', 'lowercase', 'remove_urls', 'remove_tables', 're_rank_enabled'].map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={embeddingSettings[key]} onChange={(e) => setEmbeddingSettings((p) => ({ ...p, [key]: e.target.checked }))} />
                      {key}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="chat-scroll relative flex-1 overflow-y-auto px-3 pb-5 pt-4 sm:px-4 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              <div className="surface-card rounded-2xl p-4">
                <h2 className="text-lg font-bold">Knowledge Studio</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Uzun dokümanları ekleyip asistanın ürün bilgisini yönetebilirsin.
                </p>
                {knowledgeError && <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200">{knowledgeError}</p>}
                {knowledgeSuccess && <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">{knowledgeSuccess}</p>}
              </div>

              <form onSubmit={submitKnowledgeDocument} className="surface-card rounded-2xl p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={docForm.title}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Doküman başlığı"
                    className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[rgba(126,168,255,0.46)]"
                  />
                  <select
                    value={docForm.domain}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, domain: e.target.value }))}
                    className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none"
                  >
                    <option value="product">product</option>
                    <option value="business">business</option>
                    <option value="tech">tech</option>
                    <option value="ops">ops</option>
                    <option value="legal">legal</option>
                  </select>
                  <input
                    value={docForm.product}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, product: e.target.value }))}
                    placeholder="Ürün (opsiyonel)"
                    className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[rgba(126,168,255,0.46)]"
                  />
                  <input
                    value={docForm.version_tag}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, version_tag: e.target.value }))}
                    placeholder="Versiyon etiketi (opsiyonel)"
                    className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[rgba(126,168,255,0.46)]"
                  />
                  <input
                    value={docForm.source_ref}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, source_ref: e.target.value }))}
                    placeholder="Kaynak link/id (opsiyonel)"
                    className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[rgba(126,168,255,0.46)] sm:col-span-2"
                  />
                </div>
                <textarea
                  value={docForm.content}
                  onChange={(e) => setDocForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Doküman içeriğini yapıştır (min 40 karakter)..."
                  rows={10}
                  className="mt-3 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[rgba(126,168,255,0.46)]"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--text-muted)]">
                    İçerik uzunluğu: {docForm.content.trim().length} karakter
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="btn-ghost cursor-pointer rounded-xl px-3 py-2 text-xs">
                      {isKnowledgeFileReading ? 'Dosya okunuyor...' : 'Dosya Yükle'}
                      <input
                        type="file"
                        accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf"
                        className="hidden"
                        onChange={handleKnowledgeFileSelect}
                        disabled={isKnowledgeFileReading || isKnowledgeSubmitting}
                      />
                    </label>
                    <button type="submit" disabled={isKnowledgeSubmitting || isKnowledgeFileReading} className="btn-accent rounded-xl px-4 py-2 text-sm disabled:opacity-45">
                    {isKnowledgeSubmitting ? 'İşleniyor...' : 'Dokümanı İndeksle'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="surface-card rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Dokümanlar</h3>
                  <button type="button" onClick={loadKnowledgeDocuments} className="btn-ghost rounded-xl px-3 py-2 text-xs">
                    Yenile
                  </button>
                </div>
                {isKnowledgeLoading ? (
                  <div className="inline-flex items-center gap-2 text-sm text-[var(--accent-2)]">
                    <Loader2 size={14} className="animate-spin" />
                    Dokümanlar yükleniyor...
                  </div>
                ) : knowledgeDocs.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Henüz doküman yok. Üstten ilk dokümanı ekleyebilirsin.</p>
                ) : (
                  <div className="space-y-2">
                    {knowledgeDocs.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-[rgba(122,146,182,0.24)] bg-[rgba(12,20,34,0.65)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{doc.title}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              domain: {doc.domain || 'n/a'} · product: {doc.product || 'n/a'} · chunk: {doc.chunk_count}
                            </p>
                            <textarea
                              value={summaryDrafts[doc.id] ?? doc.summary ?? ''}
                              onChange={(e) => setSummaryDrafts((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                              placeholder="Agent özeti burada görünür, istersen düzenleyebilirsin."
                              rows={3}
                              className="mt-2 w-full rounded-xl border border-[rgba(122,146,182,0.24)] bg-transparent px-2 py-2 text-xs outline-none focus:border-[rgba(126,168,255,0.46)]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeKnowledgeDocument(doc)}
                            className="btn-ghost rounded-xl p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {viewMode === 'chat' && (
          <footer className="px-3 pb-3 sm:px-4 lg:px-6 lg:pb-5">
            <form onSubmit={handleSend} className="mx-auto w-full max-w-4xl">
              <div className="surface-panel rounded-2xl p-2 sm:p-3">
                {chatAttachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {chatAttachments.map((file) => (
                      <span key={file.id} className="inline-flex items-center gap-2 rounded-full bg-[rgba(107,212,255,0.16)] px-3 py-1 text-xs text-[var(--accent-2)]">
                        <FileText size={12} />
                        <span className="max-w-[200px] truncate">{file.filename}</span>
                        <span className="text-[10px] opacity-80">{file.char_count} karakter</span>
                        <button type="button" onClick={() => removeChatAttachment(file.id)} className="rounded-full p-0.5 hover:bg-[rgba(255,255,255,0.14)]">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={isLoading || isAttachmentUploading || chatAttachments.length >= CHAT_ATTACHMENT_MAX_COUNT}
                    className="btn-ghost h-11 w-11 rounded-xl disabled:cursor-not-allowed disabled:opacity-45 sm:h-12 sm:w-12"
                    title="Dosya ekle"
                  >
                    {isAttachmentUploading ? <Loader2 size={16} className="mx-auto animate-spin" /> : <Paperclip size={16} className="mx-auto" />}
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleChatAttachmentSelect}
                    accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,.html,.xml,.yaml,.yml,.ini,.cfg,.sql,.py,.js,.ts,.tsx,.jsx,.java,.go,.rs,.rb,.php,.c,.h,.cpp,.hpp,.sh,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,text/plain,text/markdown,text/csv,application/json,application/pdf,text/html,application/xml,text/xml,image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
                  />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Ervis'e bir talimat ver..."
                    maxLength={INPUT_MAX_CHARS}
                    disabled={isLoading}
                    rows={1}
                    className="min-h-[44px] max-h-[220px] min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[rgba(126,168,255,0.46)] sm:min-h-[48px] sm:text-base"
                  />
                  <button
                    type="submit"
                    disabled={(!input.trim() && chatAttachments.length === 0) || isLoading || isAttachmentUploading}
                    className="btn-accent h-11 w-11 rounded-xl disabled:cursor-not-allowed disabled:opacity-45 sm:h-12 sm:w-12"
                  >
                    <Send size={17} className="mx-auto" />
                  </button>
                </div>
              </div>
            </form>
          </footer>
        )}
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
