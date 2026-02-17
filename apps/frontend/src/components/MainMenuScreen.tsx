import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import AdminDashboard from './AdminDashboard'; // Assuming AdminDashboard is in the same directory

export default function MainMenuScreen() {
    const { profile, setGrade, findMatch, isAdminView, setAdminView, setLeaderboardView, updateProfile, onlineUsers, fetchOnlineUsers, sendChallenge, incomingChallenge, respondChallenge, notifications, fetchNotifications, error } = useGameStore();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [challengedUserId, setChallengedUserId] = useState<number | null>(null);
    const [subjects, setSubjects] = useState<any[]>([]);

    useEffect(() => {
        if (profile) {
            setNewName(profile.firstName);
            fetchNotifications();
        }
    }, [profile]);

    // Fetch online users every 5 seconds
    useEffect(() => {
        if (profile?.grade) {
            fetchOnlineUsers();
            const interval = setInterval(fetchOnlineUsers, 5000);
            return () => clearInterval(interval);
        }
    }, [profile?.grade]);

    // Fetch subjects for grade
    useEffect(() => {
        if (profile?.grade) {
            const fetchSubjects = async () => {
                try {
                    const res = await fetch(`${window.location.origin}/auth/subjects/allowed?grade=${profile.grade}`);
                    const data = await res.json();
                    if (data.success) {
                        setSubjects(data.subjects || []);
                    }
                } catch (e) {
                    console.error("Failed to fetch subjects", e);
                }
            };
            fetchSubjects();
        }
    }, [profile?.grade]);

    const handleUpdateProfile = async () => {
        if (newName.trim()) {
            await updateProfile(newName);
            setIsEditModalOpen(false);
        }
    };

    const handleChallenge = (userId: number) => {
        setChallengedUserId(userId);
        sendChallenge(userId);
        // Reset local waiting state after 15s if no response (UI only)
        setTimeout(() => setChallengedUserId(null), 15000);
    };

    if (!profile) return <div>Yuklanmoqda...</div>;

    if (isAdminView) {
        return <AdminDashboard />;
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header with Stats */}
            <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-md border-b border-indigo-50 shadow-sm p-4">
                <div className="max-w-md mx-auto flex justify-between items-center">
                    <div
                        className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                        onClick={() => window.location.reload()}
                    >
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-200 text-white">
                            🏆
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-black text-slate-800 leading-none uppercase">BILIMLAR BELASHUVI</h1>
                                {notifications.length > 0 && (
                                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                )}
                            </div>
                            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase">Battle Quiz</p>
                        </div>
                    </div>

                    {/* Notifications Button */}
                    <button
                        onClick={() => setIsNotificationModalOpen(true)}
                        className="relative p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        🔔
                        {notifications.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
                                {notifications.length}
                            </span>
                        )}
                    </button>

                    <div className="flex gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reyting</span>
                            <span className="text-lg font-black text-indigo-600 leading-none">{profile.rating}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-100"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">O'rin</span>
                            <span className="text-lg font-black text-amber-500 leading-none">{profile.rank || '-'}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-100"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">G' / M</span>
                            <div className="flex gap-1 leading-none text-sm font-black">
                                <span className="text-emerald-500">{profile.wins}</span>
                                <span className="text-slate-300">/</span>
                                <span className="text-red-500">{profile.losses}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="w-full max-w-md px-6 pt-6 pb-24">
                {/* Profile Brief */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 mb-8 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100"
                >
                    <div className="relative">
                        <img
                            src={profile.photoUrl || `https://ui-avatars.com/api/?name=${profile.firstName || 'User'}&background=random`}
                            alt="Profile"
                            className="w-16 h-16 rounded-2xl object-cover"
                        />
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md border border-slate-50 text-xs"
                        >
                            ✏️
                        </button>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{profile.firstName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black uppercase">
                                {profile.grade || '?'}-Sinf
                            </span>
                            {profile.role === 'admin' && (
                                <button
                                    onClick={() => setAdminView(true)}
                                    className="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-black uppercase hover:bg-slate-900"
                                >
                                    Admin
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Leaderboard Button */}
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => setLeaderboardView(true)}
                    className="w-full mb-8 bg-indigo-600 p-4 rounded-[2rem] shadow-xl shadow-indigo-100 border border-indigo-500 flex items-center justify-between group active:scale-[0.98] transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            📊
                        </div>
                        <div className="text-left">
                            <h3 className="text-white font-black text-lg leading-tight uppercase">Global Reyting</h3>
                            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">O'rningizni ko'ring</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                        →
                    </div>
                </motion.button>

                {/* Grade Selector */}
                <div className="mb-8">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-3 pl-2">Sinfni O'zgartirish</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => (
                            <button
                                key={g}
                                onClick={() => setGrade(g)}
                                className={`
                                    min-w-[3rem] h-12 rounded-xl font-black text-sm transition-all flex-shrink-0
                                    ${profile.grade === g
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                                        : 'bg-white text-slate-400 hover:bg-slate-50'}
                                `}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Subjects Grid */}
                <div>
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 pl-2">Fanlar</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Random / All Subjects */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => findMatch()}
                            className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-lg shadow-indigo-200 text-left relative overflow-hidden group aspect-[4/3] flex flex-col justify-between"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-20 text-5xl group-hover:scale-110 transition-transform">🎲</div>
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl text-white backdrop-blur-sm">
                                ⚡
                            </div>
                            <div>
                                <h3 className="text-white font-black text-lg leading-tight">Tasodifiy</h3>
                                <p className="text-indigo-100 text-xs font-medium opacity-80">Barcha fanlar</p>
                            </div>
                        </motion.button>

                        {/* Mapped Subjects */}
                        {subjects.map((subject) => (
                            <motion.button
                                key={subject.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => findMatch(subject.id)}
                                className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 text-left relative overflow-hidden group aspect-[4/3] flex flex-col justify-between hover:border-indigo-100 transition-colors"
                            >
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors"></div>
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xl text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors relative z-10">
                                    📚
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-slate-800 font-black text-lg leading-tight group-hover:text-indigo-900 transition-colors">{subject.name}</h3>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                    {subjects.length === 0 && (
                        <div className="text-center py-10 px-6 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="text-4xl mb-3">👨‍💻</div>
                            <h3 className="text-slate-800 font-bold mb-2">Savollar qo'shilmoqda...</h3>
                            <p className="text-slate-500 text-sm">
                                Hozirda ushbu sinf uchun savollar bazasi shakllantirilmoqda. Tez orada barcha fanlar qo'shiladi!
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Online Users List (Fixed Bottom or somewhere appropriate? Maybe minimal ticker?) */}
            {/* Keeping it simple for now, maybe remove from main view to reduce clutter or add a "Online" tab/button if needed. 
                But user wanted "Grid of subjects". Let's put Online Users at bottom.
            */}

            <div className="w-full max-w-md px-6">
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4 pl-2">
                    ONLINE ({onlineUsers.length})
                </h3>
                <div className="space-y-2 pb-8">
                    {onlineUsers.slice(0, 5).map(user => (
                        <div key={user.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-sm font-bold text-indigo-600">
                                    {user.name?.[0] || '?'}
                                </div>
                                <span className="font-bold text-slate-700 text-sm">{user.name || 'Foydalanuvchi'}</span>
                            </div>
                            {challengedUserId === user.id ? (
                                <span className="text-xs text-slate-400 font-bold">Kutilmoqda...</span>
                            ) : (
                                <button
                                    onClick={() => handleChallenge(user.id)}
                                    className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                                >
                                    VS
                                </button>
                            )}
                        </div>
                    ))}
                    {onlineUsers.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-4">Hozircha hech kim yo'q</div>
                    )}
                </div>
            </div>

            {/* Edit Profile Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-6 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] w-full max-w-xs p-8 shadow-2xl">
                        <h3 className="text-xl font-black mb-6 text-center text-slate-800">Ismni o'zgartirish</h3>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 mb-4 focus:border-indigo-500 focus:outline-none font-bold text-center text-lg bg-slate-50"
                            placeholder="Ismingiz"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl"
                            >
                                BEKOR
                            </button>
                            <button
                                onClick={handleUpdateProfile}
                                className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200"
                            >
                                SAQLASH
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Modal */}
            {isNotificationModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-6 backdrop-blur-md text-slate-800">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 shadow-2xl flex flex-col max-h-[80vh]"
                    >
                        <div className="flex justify-between items-center mb-6 px-2">
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Xabarnomalar</h3>
                            <button
                                onClick={() => setIsNotificationModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                            {notifications.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-4xl mb-3 opacity-30">📭</div>
                                    <p className="text-slate-400 font-bold text-sm">Hozircha xabarlar yo'q</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-4 rounded-2xl border ${n.type === 'challenge_received' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'} transition-all`}
                                    >
                                        <div className="flex gap-3 text-left">
                                            <div className="text-2xl pt-1">
                                                {n.type === 'challenge_received' ? '⚔️' : '🔔'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-700 leading-tight mb-3">
                                                    {n.message}
                                                </p>

                                                <div className="flex gap-2">
                                                    {n.type === 'challenge_received' && n.data?.challengeId && (
                                                        <button
                                                            onClick={async () => {
                                                                await useGameStore.getState().joinAsyncChallenge(n.data.challengeId);
                                                                await useGameStore.getState().markNotificationsRead([n.id]);
                                                                setIsNotificationModalOpen(false);
                                                            }}
                                                            className="flex-1 bg-indigo-600 text-white text-[10px] font-black py-2 rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                                                        >
                                                            O'YNASH
                                                        </button>
                                                    )}
                                                    {n.type === 'challenge_completed' && n.data?.challengeId && (
                                                        <button
                                                            onClick={async () => {
                                                                await useGameStore.getState().joinAsyncChallenge(n.data.challengeId);
                                                                await useGameStore.getState().markNotificationsRead([n.id]);
                                                                setIsNotificationModalOpen(false);
                                                            }}
                                                            className="flex-1 bg-emerald-500 text-white text-[10px] font-black py-2 rounded-lg uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                                                        >
                                                            NATIJANI KO'RISH
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => useGameStore.getState().markNotificationsRead([n.id])}
                                                        className="flex-1 bg-white text-slate-400 text-[10px] font-bold py-2 rounded-lg border border-slate-200 uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        O'CHIRISH
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <button
                                onClick={() => {
                                    const ids = notifications.map(n => n.id);
                                    useGameStore.getState().markNotificationsRead(ids);
                                }}
                                className="mt-6 w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                            >
                                Hammasini o'qilgan deb belgilash
                            </button>
                        )}
                    </motion.div>
                </div>
            )}

            {/* Incoming Challenge Modal */}
            {incomingChallenge && (
                <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-6 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 shadow-2xl text-center animate-in slide-in-from-bottom duration-300">
                        <div className="text-5xl mb-6">⚔️</div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">BELLASHUV!</h3>
                        <p className="text-slate-500 mb-8 font-medium leading-relaxed">
                            <span className="font-bold text-indigo-600">{incomingChallenge.name}</span> sizni jangga chorlamoqda!
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => respondChallenge(incomingChallenge.id, 'accept')}
                                className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition-all text-sm uppercase tracking-widest"
                            >
                                QABUL QILISH
                            </button>
                            <button
                                onClick={() => respondChallenge(incomingChallenge.id, 'reject')}
                                className="w-full bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 active:scale-95 transition-all text-sm uppercase tracking-widest"
                            >
                                RAD ETISH
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal - Redesigned Premium Version */}
            {error && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[100] p-6 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 shadow-[0_20px_50px_rgba(79,70,229,0.15)] text-center border border-indigo-50"
                    >
                        <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">⚠️</span>
                        </div>

                        <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">DIQQAT!</h3>

                        <p className="text-slate-500 mb-8 font-medium leading-relaxed text-sm">
                            {error}
                        </p>

                        <button
                            onClick={() => useGameStore.setState({ error: null })}
                            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 active:scale-95 transition-all text-sm uppercase tracking-widest"
                        >
                            TUSHUNDIM
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

