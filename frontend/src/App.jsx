import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Plus, 
  MessageSquare, 
  User as UserIcon, 
  Bot, 
  Loader2,
  Trash2,
  Github,
  LogOut,
  Sparkles,
  Command,
  Menu,
  X
} from 'lucide-react';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';

const API_URL = '/api/chat';

function ChatInterface() {
  const [location, setLocation] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Get location implicitly via IP-API (non-intrusive)
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        setLocation({
          city: data.city,
          region: data.region,
          country: data.country_name
        });
        console.log('📍 Implicit location detected:', data.city);
      })
      .catch(err => console.error('Location detection failed:', err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const metadata = {
        location: location,
        time: new Date().toLocaleTimeString(),
        day: new Date().toLocaleDateString('tr-TR', { weekday: 'long' }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform
      };

      const response = await axios.post(API_URL, {
        user_id: user.user_id,
        message: input,
        metadata: metadata
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.message,
        model_used: response.data.model_used,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0b] text-gray-200 overflow-hidden font-sans selection:bg-purple-500/30">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Improved Glassmorphism & Responsive */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 glass border-r border-white/5 flex flex-col h-full z-50 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between">
          <button 
            onClick={clearChat}
            className="flex-1 flex items-center justify-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 text-sm font-medium group"
          >
            <Plus size={18} className="text-purple-400 group-hover:rotate-90 transition-transform duration-300" />
            Yeni Sohbet
          </button>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden ml-4 p-2 text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          <p className="px-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Konuşmalar</p>
          {messages.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500/10 to-transparent border-l-2 border-purple-500 rounded-r-xl text-sm text-gray-200 cursor-pointer hover:bg-white/5 transition-all">
              <MessageSquare size={16} className="text-purple-400" />
              <span className="truncate font-medium">Güncel Seans</span>
            </div>
          )}
        </div>

        <div className="p-6 mt-auto">
            <div className="glass-card rounded-3xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-semibold text-white">{user.username}</span>
                            <span className="text-[10px] text-gray-500">Premium Üye</span>
                        </div>
                    </div>
                    <button 
                        onClick={logout}
                        className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-gray-500 hover:text-red-400"
                        title="Çıkış Yap"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
                <div className="text-[10px] text-center text-gray-600 flex items-center justify-center gap-1.5 pt-2 border-t border-white/5">
                    <Sparkles size={10} className="text-purple-500" />
                    Powered by Ervis Engine v1.0
                </div>
            </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative z-10 w-full overflow-hidden">
        {/* Dynamic Background Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
        
        {/* Header - Glass Effect */}
        <header className="h-20 border-b border-white/5 flex items-center px-4 md:px-8 justify-between glass z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Menu size={24} />
            </button>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
                <Bot size={20} className="md:size-24 text-white" />
            </div>
            <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight leading-none">Ervis</h2>
                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-green-500 font-medium uppercase tracking-tighter mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    Aktif
                </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <Github size={18} />
            </button>
          </div>
        </header>

        {/* Messages List - Responsive Padding */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-6 md:space-y-8 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 flex items-center justify-center mb-8 border border-white/5 glass-card animate-pulse">
                <Bot size={48} className="text-purple-400 md:size-56" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black mb-4 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent px-2">Ervis'e Merhaba De</h1>
              <p className="text-gray-400 max-w-lg text-base md:text-lg font-light leading-relaxed px-4">
                Yapay zeka ile güçlendirilmiş dijital otonom asistanınız. 
                Bilgileri hatırlar, analiz eder ve sizin için en doğru cevabı bulur.
              </p>
              <div className="mt-8 md:mt-12 flex gap-2 md:gap-3 flex-wrap justify-center px-4">
                  {['"Bugün hava nasıl?"', '"Kiralık ev fiyatları?"', '"Maç sonucu?"'].map(s => (
                      <button key={s} onClick={() => setInput(s.replace(/"/g, ''))} className="px-4 py-2 md:px-5 md:py-2.5 rounded-2xl glass-card text-[12px] md:text-sm text-gray-400 hover:border-purple-500/30 hover:text-purple-400 transition-all font-medium whitespace-nowrap">
                          {s}
                      </button>
                  ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}
              >
                <div className={`flex gap-3 md:gap-6 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg ${
                    msg.role === 'user' 
                        ? 'bg-blue-600 shadow-blue-600/20' 
                        : 'bg-gradient-to-br from-purple-600 to-indigo-600 shadow-purple-600/20'
                  }`}>
                    {msg.role === 'user' ? <UserIcon size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={`flex flex-col flex-1 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 md:px-6 md:py-4 rounded-2xl md:rounded-3xl text-sm md:text-[15px] leading-relaxed relative ${
                      msg.role === 'user' 
                        ? 'bg-[#313136] text-white border border-white/5 shadow-xl' 
                        : 'glass-card text-gray-200 border border-white/10'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-p:leading-relaxed max-w-none prose-pre:bg-[#0a0a0b] prose-pre:border prose-pre:border-white/5 prose-code:text-purple-400">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === 'assistant' && msg.model_used && (
                      <div className="mt-2 flex items-center gap-2 px-2">
                        <span className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-500 font-medium">
                            <Sparkles size={10} className="text-purple-500" />
                            {msg.model_used}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="flex gap-6 max-w-[85%] items-center">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
                  <Bot size={20} />
                </div>
                <div className="flex items-center gap-3 text-sm text-purple-400 font-medium">
                  <Loader2 size={18} className="animate-spin" />
                  Düşünceler toplanıyor...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Command Center Style */}
        <div className="p-4 md:p-12 relative z-20">
          <form 
            onSubmit={handleSend}
            className="max-w-4xl mx-auto relative"
          >
            <div className="absolute inset-0 -m-1 bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-purple-600/20 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <div className="relative glass rounded-2xl md:rounded-[2rem] border border-white/10 shadow-2xl p-1.5 md:p-2 flex items-center group focus-within:border-purple-500/50 transition-all duration-500">
                <div className="hidden md:flex pl-4 pr-2 text-gray-500 group-focus-within:text-purple-400 transition-colors">
                    <Command size={22} />
                </div>
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Bir talimat ver..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none px-3 md:px-4 py-3 md:py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-0 text-base md:text-lg font-light transition-all disabled:opacity-50"
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-11 h-11 md:w-14 md:h-14 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:opacity-30 rounded-xl md:rounded-2xl text-white transition-all shadow-lg flex items-center justify-center shrink-0 active:scale-95 glow-hover"
                >
                  <Send size={20} className="md:size-24" />
                </button>
            </div>
          </form>
          <div className="mt-4 hidden md:flex justify-center items-center gap-6">
              <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-purple-500"></span>
                  Gelişmiş Hafıza Aktif
              </span>
              <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                  Gerçek Zamanlı Web Analizi
              </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-purple-600/20 animate-pulse flex items-center justify-center">
                <Bot className="text-purple-600 animate-bounce" size={48} />
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold tracking-[0.3em] text-gray-500 uppercase">
                Yükleniyor
            </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <ChatInterface />;
  }

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
