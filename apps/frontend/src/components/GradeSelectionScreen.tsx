import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function GradeSelectionScreen() {
    const { setGrade } = useGameStore();

    const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    const handleGradeSelect = async (grade: number) => {
        await setGrade(grade);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50 p-4 font-sans selection:bg-indigo-100">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="premium-card p-10 w-full max-w-2xl relative z-10"
            >
                <div className="text-center mb-10 cursor-pointer active:scale-95 transition-transform" onClick={() => window.location.reload()}>
                    <h1 className="text-4xl font-black text-indigo-950 mb-2 tracking-tight">Sinfingizni Tanlang</h1>
                    <p className="text-indigo-400 font-bold">Siz nechanchi sinfda o'qiysiz?</p>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-8">
                    {grades.map((grade) => (
                        <motion.button
                            key={grade}
                            onClick={() => handleGradeSelect(grade)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="premium-card p-6 border-2 border-indigo-100 hover:border-indigo-500 transition-all group"
                        >
                            <div className="text-5xl font-black text-indigo-600 group-hover:text-indigo-700 transition-colors">
                                {grade}
                            </div>
                            <div className="text-xs font-black text-indigo-300 uppercase tracking-wider mt-2">
                                Sinf
                            </div>
                        </motion.button>
                    ))}
                </div>

                <div className="text-center text-xs text-indigo-300 font-bold">
                    💡 Siz faqat o'z sinfingiz o'quvchilari bilan o'ynaysiz
                </div>
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-10 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]"
            >
                Bilimlar Belashuvi • Sinf Tanlash
            </motion.p>
        </div>
    );
}
