import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { socket } from '../services/socket';

function WaitingForResults({ stats, yourRole, questions }: { stats: any, yourRole: string | null, questions: any[] }) {

    const myStats = yourRole ? (stats[yourRole] || { score: 0, answeredCount: 0, correctCount: 0 }) : { score: 0, answeredCount: 0, correctCount: 0 };
    const opponentRole = yourRole === 'player1' ? 'player2' : 'player1';
    const opponentStats = stats[opponentRole] || { score: 0, answeredCount: 0, correctCount: 0 };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 text-indigo-900 p-6">
            <div className="text-4xl mb-4">🏁</div>
            <div className="text-2xl font-bold mb-2">Siz tugatdingiz!</div>
            <div className="text-lg text-indigo-600 mb-8">Raqibingiz javoblarini kutmoqdamiz...</div>

            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-center">
                        <div className="text-xs font-bold text-blue-400">SIZ</div>
                        <div className="text-2xl font-black text-blue-600">{myStats.correctCount} / {questions.length}</div>
                    </div>
                    <div className="text-2xl font-bold text-gray-300">VS</div>
                    <div className="text-center">
                        <div className="text-xs font-bold text-red-400">RAQIB</div>
                        <div className="text-2xl font-black text-red-600">{opponentStats.correctCount} / {questions.length}</div>
                    </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-indigo-500"
                        initial={{ width: "0%" }}
                        animate={{ width: `${(opponentStats.answeredCount / (questions.length || 1)) * 100}%` }}
                    />
                </div>
                <div className="text-center mt-2 text-xs text-gray-400">
                    Raqib {opponentStats.answeredCount} ta savolga javob berdi
                </div>
            </div>

            <p className="text-sm text-gray-400 mt-8">Natijalar tez orada chiqadi...</p>
        </div>
    );
}

const GameScreen = () => {
    const { submitAnswer, status, players, yourRole, winner, resetGame, questions, stats, profile, isAsyncMode, activeAsyncChallengeId } = useGameStore();

    useEffect(() => {
        console.log(`[DEBUG GameScreen] State Update: status=${status}, questions=${questions?.length}, stats_p1=${stats.player1.answeredCount}, stats_p2=${stats.player2.answeredCount}, winner=${winner}`);
    }, [status, questions, stats, winner]);

    // Game State
    const [timeLeft, setTimeLeft] = useState(30);
    const [userInput, setUserInput] = useState('');

    // Result variables (hoisted for scope access)
    let resultText = '';
    let resultColor = '';
    let subText = '';

    // Role-based stats
    const myStats = yourRole ? (stats[yourRole] || { answeredCount: 0, score: 0, correctCount: 0 }) : { answeredCount: 0, score: 0, correctCount: 0 };
    const opponentRole = yourRole === 'player1' ? 'player2' : 'player1';
    const opponentStats = stats[opponentRole] || { answeredCount: 0, score: 0, correctCount: 0 };

    const currentQuestionIndex = myStats.answeredCount;
    const currentQuestion = questions[currentQuestionIndex];
    console.log("[DEBUG GameScreen] currentQuestionIndex:", currentQuestionIndex, "currentQuestion:", !!currentQuestion);

    const [feedback, setFeedback] = useState<{ show: boolean, isCorrect: boolean, correctVal?: string | number, message?: string, clickedIndex?: number } | null>(null);
    const [questionStartTime, setQuestionStartTime] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (status !== 'playing') return;

        // FIX: Removed if (feedback?.show) return; bail-out.
        // Even if feedback is showing, we MUST reset isSubmitting and timer 
        // when currentQuestionIndex changes, otherwise the UI locks up.
        console.log("[DEBUG GameScreen] New question transition. Index:", currentQuestionIndex);
        let initialTime = 20;
        if (currentQuestion && currentQuestion.options && currentQuestion.options.length > 0) {
            initialTime = 25;
        }

        // Only set time on question change IF not just finishing feedback
        // Actually, we should rely on question index change to reset timer
        // This effect runs on index change
        setTimeLeft(initialTime);
        setTimeLeft(initialTime);
        setFeedback(null); // Clear feedback on question change just in case
        setUserInput(''); // Clear input
        setQuestionStartTime(Date.now());
        setIsSubmitting(false); // Reset submission state for new question
    }, [currentQuestionIndex, status]); // Removed currentQuestion from dep to avoid loop, though index covers it

    useEffect(() => {
        if (status !== 'playing') return;
        if (feedback?.show) return; // Pause timer during feedback

        if (timeLeft <= 0) {
            handleTimeout();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, status, feedback?.show]);

    const processAnswer = useCallback((isCorrect: boolean, val: string | number, clickedIndex?: number) => {
        if (isSubmitting) return; // Prevent double submission
        setIsSubmitting(true);

        // 1. Show Feedback
        let correctVal: string | number = currentQuestion.a;
        // If options exist, show the text of correct option
        if (currentQuestion.options && currentQuestion.options.length > 0) {
            correctVal = currentQuestion.options[Number(currentQuestion.a)];
        }

        setFeedback({
            show: true,
            isCorrect,
            correctVal,
            message: isCorrect ? "To'g'ri!" : "Xato!",
            clickedIndex
        });

        // 2. Wait and Submit
        const duration = (Date.now() - questionStartTime) / 1000;
        console.log("[DEBUG GameScreen] Submitting answer. Index:", currentQuestionIndex, "isCorrect:", isCorrect);
        setTimeout(() => {
            submitAnswer(isCorrect, currentQuestionIndex, val, duration);
            setFeedback(null);
            setUserInput('');
            setIsSubmitting(false); // Defensive reset
            console.log("[DEBUG GameScreen] submission delay finished. isSubmitting -> false");
        }, 1500); // 1.5s delay
    }, [currentQuestion, currentQuestionIndex, submitAnswer, questionStartTime]);

    const handleTimeout = useCallback(() => {
        if (isSubmitting) return; // Prevent double timeout loop
        setIsSubmitting(true);

        // Timeout -> No feedback, just move on? Or show "Vaqt tugadi!"
        // Let's show "Vaqt tugadi" red feedback
        setFeedback({
            show: true,
            isCorrect: false,
            message: "Vaqt tugadi!",
            correctVal: currentQuestion?.options ? currentQuestion.options[Number(currentQuestion.a)] : currentQuestion?.a
        });

        const duration = (Date.now() - questionStartTime) / 1000;
        setTimeout(() => {
            // FIX: Pass currentQuestionIndex instead of undefined so server knows which question timed out
            console.log("[DEBUG GameScreen] Timeout submission delay finished. Index:", currentQuestionIndex);
            submitAnswer(false, currentQuestionIndex, "TIMEOUT", duration);
            setFeedback(null);
            setUserInput('');
            setIsSubmitting(false); // Defensive reset
        }, 1500);
    }, [submitAnswer, currentQuestion, questionStartTime, isSubmitting, currentQuestionIndex]);

    const handleInput = (val: string | number) => {
        if (status !== 'playing' || feedback?.show) return;
        const newVal = val.toString();
        if (newVal === 'C') {
            setUserInput('');
            return;
        }
        setUserInput((prev) => {
            const updated = prev + newVal;
            if (updated.length > 3) return updated;
            return updated;
        });
    };

    const handleSubmit = () => {
        if (!userInput || !currentQuestion || feedback?.show) return;
        const answer = parseInt(userInput);
        let isCorrect = false;
        if (currentQuestion.answers && currentQuestion.answers.length > 0) {
            isCorrect = currentQuestion.answers.includes(answer);
        } else {
            isCorrect = answer === currentQuestion.a;
        }
        processAnswer(isCorrect, userInput);
    };

    const handleOptionClick = (index: number) => {
        if (!currentQuestion || feedback?.show) return;
        let isCorrect = false;
        if (currentQuestion.answers && currentQuestion.answers.length > 0) {
            isCorrect = currentQuestion.answers.includes(index);
        } else {
            isCorrect = index === currentQuestion.a;
        }
        const val = currentQuestion.options ? currentQuestion.options[index] : String(index);
        processAnswer(isCorrect, val, index);
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (feedback?.show) return; // Ignore keys during feedback
            if (!currentQuestion?.options || currentQuestion.options.length === 0) {
                if (e.key >= '0' && e.key <= '9') handleInput(e.key);
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Backspace') setUserInput(prev => prev.slice(0, -1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [userInput, currentQuestion, feedback?.show]);


    // If playing but no questions... (existing logic skipped for brevity)
    if (status === 'playing' && (!currentQuestion)) {
        // ... (Keep existing No Questions logic)
        if (questions.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 text-indigo-900 p-6">
                    <div className="text-6xl mb-4">😕</div>
                    <div className="text-2xl font-bold mb-2 text-center">Savollar Topilmadi</div>
                    <button onClick={resetGame} className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">Chiqish</button>
                </div>
            );
        }
        if (questions.length > 0 && myStats.answeredCount >= questions.length) {
            return <WaitingForResults stats={stats} yourRole={yourRole} questions={questions} />;
        }
        return <div className="flex flex-col items-center justify-center min-h-screen">Yuklanmoqda...</div>;
    }

    if (status === 'finished') {
        const myId = profile?.id;
        const winnerId = String(winner);

        // Logic for Speed Win detection
        const myScore = myStats.score;
        const opScore = opponentStats.score;

        // Custom Win Reason Message
        if (winnerId === 'async_pending') {
            resultText = "Kutilmoqda...";
            resultColor = "text-amber-500";
            subText = "Raqib hali o'yinni tugatmagan. Natijalar tez orada chiqadi!";
        } else if (winnerId && winnerId !== 'draw' && winnerId !== 'null' && winnerId !== 'undefined') {
            if (winnerId === String(myId)) {
                resultText = "G'alaba!";
                resultColor = "text-green-600";

                // Check if speed win: Scores are tied
                if (myScore === opScore) {
                    subText = "⚡ Tez tugatganingiz uchun g'olibsiz!";
                } else {
                    subText = "Tabriklaymiz!";
                }
            } else {
                resultText = "Mag'lubiyat...";
                resultColor = "text-red-600";

                if (myScore === opScore) {
                    subText = "🐢 Raqib tezroq tugatdi";
                } else {
                    subText = "Keyingi safar albatta yutasiz!";
                }
            }
        } else if (winnerId === 'draw') {
            resultText = "Durrang!";
            resultColor = "text-gray-600";
            subText = "Kuchlar teng keldi!";
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 animate-in fade-in duration-500">
                <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                    <h2 className={`text-4xl font-black mb-2 ${resultColor} drop-shadow-sm`}>{resultText}</h2>
                    <p className="text-slate-500 mb-8 font-medium">{subText}</p>

                    <div className="flex justify-center items-end gap-6 mb-8">
                        {/* Me */}
                        <div className="flex flex-col items-center">
                            <div className="relative mb-2">
                                <img
                                    src={profile?.photoUrl || `https://ui-avatars.com/api/?name=${profile?.firstName}&background=random`}
                                    className={`w-16 h-16 rounded-2xl object-cover border-4 ${winnerId === String(myId) ? 'border-yellow-400' : 'border-white'} shadow-lg`}
                                />
                                {winnerId === String(myId) && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl drop-shadow-md">👑</div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-xs font-black px-2 py-0.5 rounded-lg border-2 border-white">
                                    SIZ
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-800">{myScore}</div>
                        </div>

                        <div className="text-2xl font-black text-slate-300 pb-4">VS</div>

                        {/* Opponent */}
                        <div className="flex flex-col items-center">
                            <div className="relative mb-2">
                                <div className={`w-16 h-16 rounded-2xl ${winnerId === String(players.opponent?.id) ? 'bg-yellow-50 border-yellow-400' : 'bg-slate-100 border-white'} flex items-center justify-center text-2xl shadow-inner border-4`}>
                                    {(isAsyncMode && winnerId === 'async_pending') ? '⏳' :
                                        (winnerId === String(players.opponent?.id) ? '👑' :
                                            (winnerId === 'draw' ? '🤝' : '💀'))}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-slate-400 text-white text-xs font-black px-2 py-0.5 rounded-lg border-2 border-white">
                                    RAQIB
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-400">
                                {isAsyncMode && winnerId === 'async_pending' ? '?' : opponentStats.score}
                            </div>
                        </div>
                    </div>

                    {isAsyncMode && winnerId === 'async_pending' ? (
                        <button
                            onClick={resetGame}
                            className="w-full bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm"
                        >
                            BOSH MENYUGA QAYTISH
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                // Mark as viewed if async
                                if (isAsyncMode && activeAsyncChallengeId) {
                                    useGameStore.getState().markChallengeAsViewed(activeAsyncChallengeId);
                                }
                                resetGame();
                            }}
                            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-95 transition-all uppercase tracking-widest text-sm"
                        >
                            DAVOM ETISH
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Timeout / No Match Found
    if (status === 'timeout') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full border border-gray-100">
                    <div className="text-6xl mb-4">🤷‍♂️</div>
                    <h2 className="text-2xl font-black text-indigo-900 mb-2">Raqib topilmadi</h2>
                    <p className="text-gray-500 mb-8 font-medium">
                        Hozircha hech kim o'ynamayapti. Birozdan so'ng qayta urinib ko'ring.
                    </p>

                    <button
                        onClick={resetGame}
                        className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all uppercase tracking-widest text-sm"
                    >
                        MENYUGA QAYTISH
                    </button>
                </div>
            </div>
        );
    }

    // Matchmaking / Waiting UI (Rebranded)
    if (!currentQuestion) {
        if (!profile?.grade) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                    <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full border border-gray-100">
                        <div className="text-6xl mb-4">🎓</div>
                        <h2 className="text-2xl font-black text-indigo-900 mb-2">Sinfingizni Tanlang</h2>
                        <p className="text-gray-500 mb-6 font-medium text-sm">
                            Reyting va mos raqiblarni topish uchun sinfingizni belgilang.
                        </p>

                        <div className="grid grid-cols-4 gap-2 mb-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((g) => (
                                <button
                                    key={g}
                                    onClick={async () => {
                                        await useGameStore.getState().setGrade(g);
                                        await useGameStore.getState().fetchRank();
                                    }}
                                    className="h-12 rounded-xl bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                >
                                    {g}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={resetGame}
                            className="text-gray-400 text-xs font-bold uppercase hover:text-red-500 transition-colors"
                        >
                            Chiqish
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
                {/* Header */}
                <header className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        <h1 className="text-xl font-extrabold text-indigo-900 tracking-tight">Bilimlar Belashuvi</h1>
                    </div>
                    <button
                        onClick={resetGame}
                        className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-red-50 hover:text-red-500 transition-all text-sm"
                    >
                        Chiqish
                    </button>
                </header>

                <main className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 relative">
                    {/* My Team */}
                    <div className="premium-card p-8 w-full max-w-sm flex flex-col items-center border-t-8 border-t-blue-500">
                        <h2 className="text-blue-600 font-black text-2xl mb-4">1-Jamoa</h2>
                        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-5xl border-4 border-blue-50 mb-4">
                            👤
                        </div>
                        <div className="font-bold text-xl text-gray-800">{players.me?.name || "Siz"}</div>
                        {profile?.rank && profile.grade && (
                            <div className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                {profile.grade}-sinf • {profile.rank}-o'rin
                            </div>
                        )}
                        <div className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-bold">TAYYOR</div>
                    </div>

                    {/* VS Animation */}
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-indigo-200 animate-pulse">
                            VS
                        </div>
                        <div className="h-12 w-1 bg-indigo-100 mt-2"></div>
                    </div>

                    {/* Opponent Team Section */}
                    <div className="premium-card p-8 w-full max-w-sm flex flex-col items-center border-t-8 border-t-red-500 min-h-[300px] justify-center">
                        <h2 className="text-red-600 font-black text-2xl mb-4 text-center">2-Jamoa</h2>
                        <div className="flex flex-col items-center animate-pulse">
                            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-5xl border-4 border-gray-50 mb-4">
                                🕵️‍♂️
                            </div>
                            <div className="text-lg text-gray-400 font-medium italic">Raqib jamoa qidirilmoqda...</div>
                            <p className="mt-2 text-xs text-gray-300">Iltimos kuting</p>
                        </div>
                    </div>
                </main>

                <footer className="p-8 text-center text-gray-400 text-sm">
                    {currentQuestionIndex >= 10 ? "O'yin tugadi, natijalar hisoblanmoqda..." : "Yangi bilimlar sari olg'a!"}
                </footer>
            </div>
        );
    }
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans relative">

            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-2 bg-indigo-600 rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-200 min-w-[60px]">
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 leading-none mb-0.5">SAVOL</span>
                            <span className="text-lg font-black leading-none">
                                {currentQuestionIndex + 1}<span className="text-indigo-300 text-sm">/{questions.length}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            if (confirm("O'yinni tark etmoqchimisiz?")) {
                                if (socket.id) { // Ensure socket exists before using it
                                    await fetch(`${window.location.origin}/game/leave`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ roomId: useGameStore.getState().roomId, socketId: socket.id })
                                    });
                                }
                                resetGame();
                            }
                        }}
                        className="bg-red-50 text-red-500 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-red-100"
                    >
                        Chiqish
                    </button>
                    <div className={`text-2xl font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-indigo-300'}`}>
                        {timeLeft}
                    </div>
                </div>
            </div>

            {/* Split Screen Application */}
            <div className="flex-1 flex flex-col relative overflow-hidden">

                {/* Main Game Area */}
                <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                    {/* Opponent Status */}
                    <div className="w-full flex items-center justify-between bg-red-50 p-3 rounded-2xl border border-red-100 mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border-2 border-red-200 flex items-center justify-center text-xl shadow-sm">🕵️‍♂️</div>
                            <div>
                                <div className="text-xs font-bold text-red-400 uppercase">Raqib (2-Jamoa)</div>
                                <div className="text-sm font-bold text-gray-700">{players.opponent?.name || 'Raqib'}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-400">Hisob</div>
                            <div className="text-xl font-black text-red-500">{opponentStats.correctCount} / {questions.length}</div>
                        </div>
                    </div>

                    {/* Question Card & Input Area */}
                    <div className="flex-1 flex flex-col justify-center items-center w-full max-w-sm mx-auto">
                        <div className="premium-card p-6 w-full mb-4 border-t-4 border-t-blue-500 shadow-lg flex flex-col justify-center min-h-[120px]">
                            <h3 className="text-center text-blue-400 text-xs font-black mb-2 uppercase tracking-widest">SAVOL {currentQuestionIndex + 1} / {questions.length}</h3>
                            {feedback?.show && feedback.message && (
                                <div className={`mb-2 text-center text-lg font-black animate-pulse ${feedback.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                                    {feedback.message}
                                </div>
                            )}
                            <div className="text-center">
                                <span className="text-3xl sm:text-4xl font-black text-indigo-900 leading-tight">{currentQuestion.q}</span>
                            </div>
                        </div>

                        {/* Options or Numpad */}
                        {currentQuestion.options && currentQuestion.options.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 w-full">
                                {currentQuestion.options.map((opt, idx) => (
                                    <motion.button
                                        key={idx}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleOptionClick(idx)}
                                        disabled={feedback?.show}
                                        className={`border-2 font-bold py-4 px-6 rounded-2xl shadow-sm text-left transition-all flex items-center gap-3 ${feedback?.show
                                            ? (idx === Number(currentQuestion.a)
                                                ? 'bg-green-500 border-green-600 text-white shadow-lg'
                                                : (idx === feedback.clickedIndex
                                                    ? 'bg-red-500 border-red-600 text-white opacity-100 shadow-lg'
                                                    : 'bg-slate-50 border-slate-100 text-slate-300 opacity-40'))
                                            : 'bg-white border-indigo-50 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-800'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${feedback?.show && (idx === Number(currentQuestion.a) || idx === feedback.clickedIndex) ? 'bg-white text-indigo-900' : 'bg-indigo-100 text-indigo-600'
                                            }`}>
                                            {['A', 'B', 'C', 'D'][idx]}
                                        </div>
                                        <span className="flex-1 text-sm sm:text-base leading-snug">{opt}</span>
                                    </motion.button>
                                ))}
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className={`h-12 w-full border-2 rounded-xl flex items-center justify-center text-3xl font-black shadow-inner mb-4 transition-all ${feedback?.show
                                    ? (feedback.isCorrect ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white')
                                    : 'bg-white border-blue-100 text-gray-700'
                                    }`}>
                                    {userInput || (feedback?.show ? '' : <span className="text-gray-200 opacity-50">?</span>)}
                                </div>
                                <div className="grid grid-cols-3 gap-2 w-full">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <button key={num} onClick={() => handleInput(num)} disabled={feedback?.show} className="h-12 xs:h-14 rounded-xl bg-white shadow-sm border-b-4 border-gray-200 text-2xl font-black text-gray-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">{num}</button>
                                    ))}
                                    <button onClick={() => handleInput('C')} disabled={feedback?.show} className="h-12 xs:h-14 rounded-xl bg-red-100 text-red-600 shadow-sm border-b-4 border-red-300 text-xl font-black active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">C</button>
                                    <button onClick={() => handleInput(0)} disabled={feedback?.show} className="h-12 xs:h-14 rounded-xl bg-white shadow-sm border-b-4 border-gray-200 text-2xl font-black text-gray-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">0</button>
                                    <button onClick={handleSubmit} disabled={feedback?.show} className="h-12 xs:h-14 rounded-xl bg-blue-500 text-white shadow-sm border-b-4 border-blue-700 text-xl font-black active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50">Go</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GameScreen;
