import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bot, LogIn, UserPlus, Loader2, AlertCircle, Sparkles } from 'lucide-react';

const Login = ({ onToggleMode }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0b] px-4 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            <div className="max-w-md w-full z-10 animate-slide-in">
                <div className="text-center mb-8 md:mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-gradient-to-tr from-purple-600 to-indigo-600 mb-6 shadow-2xl shadow-purple-600/30">
                        <Bot size={40} className="text-white md:size-48" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">Ervis'e Dön</h1>
                    <p className="text-gray-500 font-light text-sm md:text-base">Dijital otonom asistanın seni bekliyor.</p>
                </div>

                <div className="glass-card p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-3xl">
                    <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                        {error && (
                            <div className="flex items-center gap-3 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl md:rounded-2xl text-red-400 text-xs md:text-sm animate-shake">
                                <AlertCircle size={18} className="shrink-0" />
                                {error}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-[10px] md:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">E-posta Adresi</label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-500/50 transition-all duration-300 font-light text-base md:text-lg"
                                placeholder="ornek@mail.com"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] md:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">Şifre</label>
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-500/50 transition-all duration-300 font-light text-base md:text-lg"
                                placeholder="••••••••"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 md:py-5 rounded-xl md:rounded-2xl transition-all shadow-xl shadow-purple-600/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 glow-hover text-base md:text-lg"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : (
                                <>
                                    <LogIn size={24} />
                                    Giriş Yap
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-10">
                    <p className="text-gray-500 font-medium tracking-tight">
                        Hesabın yok mu?{' '}
                        <button 
                            onClick={onToggleMode}
                            className="text-purple-400 hover:text-purple-300 font-bold ml-1 transition-colors"
                        >
                            Hemen Kayıt Ol
                        </button>
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-gray-700 uppercase tracking-widest font-black">
                        <Sparkles size={12} className="text-purple-900" />
                        Ervis Autonomous Assistant
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
