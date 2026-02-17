// Leaderboard Screen Component
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function LeaderboardScreen() {
    const { leaderboard, fetchLeaderboard, setLeaderboardView, profile, initiateAsyncChallenge } = useGameStore();
    const [selectedGrade, setSelectedGrade] = useState<number | null>(profile?.grade || 5);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [targetUser, setTargetUser] = useState<any>(null);

    useEffect(() => {
        fetchLeaderboard(selectedGrade || undefined);
    }, [selectedGrade]);

    useEffect(() => {
        if (selectedGrade) {
            fetch(`${window.location.origin}/auth/subjects/allowed?grade=${selectedGrade}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setSubjects(data.subjects);
                        if (data.subjects.length > 0) setSelectedSubjectId(data.subjects[0].id);
                    }
                });
        }
    }, [selectedGrade]);

    const handleChallengeClick = (user: any) => {
        if (user.id === profile?.id) return;
        setTargetUser(user);
        setIsChallengeModalOpen(true);
    };

    const confirmChallenge = () => {
        if (targetUser && selectedSubjectId) {
            initiateAsyncChallenge(targetUser.id, selectedSubjectId);
            setIsChallengeModalOpen(false);
            setLeaderboardView(false); // Go to game screen (which will be 'playing' status)
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header */}
            <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-md border-b border-indigo-50 shadow-sm p-4">
                <div className="max-w-md mx-auto flex items-center gap-4">
                    <button
                        onClick={() => setLeaderboardView(false)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        ←
                    </button>
                    <div className="flex-1 flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-black text-slate-800 leading-none">РЕЙТИНГ</h1>
                            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase">Global Leaderboard</p>
                        </div>
                        <button
                            onClick={() => setLeaderboardView(false)}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors border border-red-100"
                        >
                            Chiqish
                        </button>
                    </div>
                </div>
            </header>

            <div className="w-full max-w-md mx-auto px-4 pt-6 flex-1">
                {/* Grade Slider */}
                <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => (
                        <button
                            key={g}
                            onClick={() => setSelectedGrade(g)}
                            className={`px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap transition-all ${selectedGrade === g
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                                : 'bg-white text-slate-400 hover:bg-slate-100'
                                }`}
                        >
                            {g}-Sinf
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="space-y-3">
                    {leaderboard.map((user, index) => {
                        const isMe = user.id === profile?.id;
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={user.id}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${isMe
                                    ? 'bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-500/20'
                                    : 'bg-white border-slate-100 shadow-sm'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-amber-400 text-white' :
                                    index === 1 ? 'bg-slate-300 text-white' :
                                        index === 2 ? 'bg-amber-600/60 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    {index + 1}
                                </div>

                                <img
                                    src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.firstName}&background=random`}
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-50"
                                    alt={user.firstName}
                                />

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 truncate leading-tight">
                                        {user.firstName} {isMe && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded ml-1">SIZ</span>}
                                    </h4>
                                    <div className="flex gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            {user.wins} G' / {user.losses} M
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-black text-indigo-600 leading-none">{user.rating}</span>
                                    {!isMe && (
                                        <button
                                            onClick={() => handleChallengeClick(user)}
                                            className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-tighter active:scale-95"
                                        >
                                            Battle
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    {leaderboard.length === 0 && (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4">🔍</div>
                            <h3 className="text-slate-400 font-bold">Hozircha hech kim yo'q</h3>
                        </div>
                    )}
                </div>
            </div>

            {/* Challenge Modal */}
            {isChallengeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl"
                    >
                        <h3 className="text-lg font-black text-slate-800 text-center mb-4">OFFLAYN BATTLE</h3>
                        <p className="text-slate-500 text-sm text-center mb-6">
                            <span className="font-bold text-indigo-600">{targetUser?.firstName}</span> bilan bellashish uchun fanni tanlang:
                        </p>

                        <div className="space-y-2 mb-6">
                            {subjects.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSubjectId(s.id)}
                                    className={`w-full p-3 rounded-2xl text-left font-bold transition-all border ${selectedSubjectId === s.id
                                        ? 'bg-indigo-600 text-white border-transparent'
                                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                                        }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsChallengeModalOpen(false)}
                                className="flex-1 py-3 font-black text-slate-400 uppercase tracking-widest text-sm"
                            >
                                Bekor qilish
                            </button>
                            <button
                                onClick={confirmChallenge}
                                className="flex-[2] py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 text-sm active:scale-95 transition-transform"
                            >
                                BOSHLASH
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
