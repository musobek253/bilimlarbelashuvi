import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';

// Declare Telegram WebApp type
declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                initData: string;
                initDataUnsafe: any;
                ready: () => void;
                expand: () => void;
            };
        };
    }
}

export default function LoginScreen() {
    const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
    const [webSessionId, setWebSessionId] = useState<string | null>(null);

    useEffect(() => {
        const checkMode = async () => {
            const tg = (window as any).Telegram?.WebApp;
            if (!tg || !tg.initData) {
                console.log('❌ No Telegram data found in LoginScreen - enabling Web Login mode');
                const sessionId = Math.random().toString(36).substring(2, 15);
                setWebSessionId(sessionId);
            }
        };
        checkMode();
    }, []);

    // Poll for Web Login status
    useEffect(() => {
        if (!webSessionId) return;

        const interval = setInterval(async () => {
            try {
                const BACKEND_URL = window.location.origin.includes('localhost')
                    ? 'http://localhost:3000'
                    : window.location.origin;

                const res = await fetch(`${BACKEND_URL}/auth/check-login?sessionId=${webSessionId}`);
                const data = await res.json();

                if (data.success && data.token) {
                    clearInterval(interval);
                    setLoadingProfile(true);
                    // Manually set token and profile in store (we need to expose a method or reuse login logic)
                    // Since "login" expects initData, we might need a direct "setSession" method
                    // For now, let's assume we can save token to localStorage and reload OR use a new store method

                    // Hack: We can't use login(initData) because we have a token directly.
                    // We need to update gameStore to accept a token login or just set the state.
                    // Let's use a custom action if possible, or just hack it:
                    localStorage.setItem('token', data.token); // If store reads from here

                    // Actually, useGameStore.getState().setToken(data.token) if exists?
                    // Let's check gameStore.ts separately. For now, we will just call a new method we will add: loginWithToken
                    // But first, let's see if we can just pass the token to login? No, login takes initData string.

                    // Temporary: reload page to let store pick up token if it persists? 
                    // Better: Add `loginWithToken` to store.

                    // For now, let's assume I'll add `loginWithToken` to store in next step.
                    // @ts-ignore
                    useGameStore.getState().loginWithToken(data.token, data.user);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [webSessionId]);

    if (loadingProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-6"></div>
                <h2 className="text-2xl font-bold text-indigo-800 animate-pulse">Yuklanmoqda...</h2>
                <p className="mt-2 text-indigo-400">Tizimga kirilmoqda...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 p-4 font-sans selection:bg-indigo-100">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="premium-card p-10 w-full max-w-md relative z-10 text-center"
            >
                <div className="text-6xl mb-6">🎯</div>
                <h1 className="text-4xl font-black text-indigo-950 mb-3 tracking-tight">Bilimlar Belashuvi</h1>
                <p className="text-indigo-400 font-bold mb-8">Telegram orqali kirish</p>

                {webSessionId ? (
                    <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm">
                        <p className="text-sm text-indigo-600 font-bold mb-4">
                            Kirish uchun pastdagi tugmani bosing va Telegram botda "Start" ni bosing:
                        </p>
                        <a
                            href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Bilomdonuz_bot'}?start=login_${webSessionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-4 bg-[#0088cc] hover:bg-[#0077b5] text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-200 mb-4"
                        >
                            Telegram Orqali Kirish ✈️
                        </a>
                        <p className="text-xs text-slate-400 font-bold">
                            Yoki QR kodni skanerlang (kelajakda)
                        </p>
                    </div>
                ) : (
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                        <p className="text-sm text-indigo-600 font-bold">
                            💡 Telegram Mini App orqali kirish tavsiya etiladi
                        </p>
                    </div>
                )}
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-10 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]"
            >
                Bilimlar Belashuvi • Kirish
            </motion.p>
        </div>
    );
}
