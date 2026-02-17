
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function AdminDashboard() {
    const {
        adminUsers, fetchAdminUsers, adminUpdateUser, adminDeleteUser,
        adminQuestions, fetchAdminQuestions, adminAddQuestion, adminUpdateQuestion, adminBulkDeleteQuestions, adminDeleteQuestion,
        setAdminView
    } = useGameStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<any>(null);
    const [view, setView] = useState<'users' | 'questions' | 'subjects' | 'config' | 'import'>(
        localStorage.getItem('adminDashboardTab') as any || 'users'
    );
    const [uploadErrors, setUploadErrors] = useState<{ row: number, error: string }[]>([]);
    const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [editingQuestion, setEditingQuestion] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        fetchAdminUsers();
        fetchAdminQuestions();
    }, []);

    const filteredUsers = adminUsers.filter(user =>
        (user.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toString().includes(searchTerm) ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleUpdateRole = (user: any) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        if (confirm(`${user.firstName}ni ${newRole} darajasiga o'tkazmoqchimisiz?`)) {
            adminUpdateUser(user.id, { role: newRole });
        }
    };

    const handleSaveBalance = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser) {
            adminUpdateUser(editingUser.id, { balance: Number(editingUser.balance) });
            setEditingUser(null);
        }
    };

    const [newSubject, setNewSubject] = useState({ name: '', code: '' });
    const [configGrade, setConfigGrade] = useState(5);
    const [configSubjects, setConfigSubjects] = useState<string[]>([]);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string>('');

    const {
        adminSubjects, fetchAdminSubjects, adminCreateSubject,
        adminGetGradeConfig, adminUpdateGradeConfig,
        adminUploadQuestions
    } = useGameStore();

    useEffect(() => {
        fetchAdminSubjects();
    }, []);

    useEffect(() => {
        localStorage.setItem('adminDashboardTab', view);
    }, [view]);

    useEffect(() => {
        // Load config when grade changes or view changes to config
        if (view === 'config') {
            adminGetGradeConfig(configGrade).then(setConfigSubjects);
        }
        if (view === 'questions') {
            fetchAdminQuestions();
        }
    }, [configGrade, view]);
    useEffect(() => {
        // Reset selection when filtering or changing view
        setSelectedIds([]);
    }, [filterSubjectId, filterGrade, view]);

    const handleCreateSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newSubject.name && newSubject.code) {
            await adminCreateSubject(newSubject.name, newSubject.code);
            setNewSubject({ name: '', code: '' });
        }
    };

    const handleConfigSave = async () => {
        await adminUpdateGradeConfig(configGrade, configSubjects);
        alert("Sinf sozlamalari saqlandi!");
    };

    const handleToggleSubject = (code: string) => {
        const lowerCode = code.toLowerCase();
        if (configSubjects.includes(lowerCode)) {
            setConfigSubjects(configSubjects.filter(c => c !== lowerCode));
        } else {
            setConfigSubjects([...configSubjects, lowerCode]);
        }
    };

    const handleSaveEditedQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingQuestion) return;

        const form = e.target as HTMLFormElement;
        const qText = (form.elements.namedItem('q') as HTMLInputElement).value;
        const answer = (form.elements.namedItem('a') as HTMLInputElement).value;
        const subjectId = (form.elements.namedItem('subjectId') as HTMLSelectElement).value;
        const difficulty = (form.elements.namedItem('difficulty') as HTMLSelectElement).value;

        const optA = (form.elements.namedItem('optA') as HTMLInputElement).value;
        const optB = (form.elements.namedItem('optB') as HTMLInputElement).value;
        const optC = (form.elements.namedItem('optC') as HTMLInputElement).value;
        const optD = (form.elements.namedItem('optD') as HTMLInputElement).value;

        const allowedGradesStr = (form.elements.namedItem('allowedGrades') as HTMLInputElement).value;
        let allowedGrades: number[] = [];
        if (allowedGradesStr) {
            if (allowedGradesStr.includes('-')) {
                const [start, end] = allowedGradesStr.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(start) && !isNaN(end)) for (let i = start; i <= end; i++) allowedGrades.push(i);
            } else if (allowedGradesStr.includes(',')) {
                allowedGrades = allowedGradesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            } else {
                const val = parseInt(allowedGradesStr.trim());
                if (!isNaN(val)) allowedGrades = [val];
            }
        }

        const options = (optA || optB || optC || optD) ? [optA, optB, optC, optD] : [];

        await adminUpdateQuestion(editingQuestion.id, {
            q: qText,
            answer,
            subjectId: Number(subjectId),
            difficulty: Number(difficulty),
            options: options.length > 0 ? options : undefined,
            allowedGrades: allowedGrades.length > 0 ? allowedGrades : undefined
        });

        setEditingQuestion(null);
        alert("Savol yangilandi!");
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;

        setUploadStatus('Yuklanmoqda...');
        setUploadErrors([]);
        const res = await adminUploadQuestions(uploadFile);
        if (res.success) {
            setUploadStatus(`Yakunlandi! ${res.imported} ta savol qo'shildi. ${res.errors ? res.errors + ' ta xato.' : ''}`);
            if (res.errorDetails && res.errorDetails.length > 0) {
                setUploadErrors(res.errorDetails);
            }
            setUploadFile(null);
            fetchAdminQuestions();
        } else {
            setUploadStatus('Xatolik yuz berdi.');
        }
    };

    const currentQuestions = adminQuestions.filter(q => {
        const matchesSearch = q.q && q.q.trim() !== '';
        const matchesSubject = filterSubjectId === 'all' || String(q.subjectId) === filterSubjectId;
        const qGrades = Array.isArray(q.allowedGrades) ? q.allowedGrades : [q.difficulty];
        const matchesGrade = filterGrade === 'all' || qGrades.some(g => String(g) === filterGrade);
        return matchesSearch && matchesSubject && matchesGrade;
    }).slice().reverse();

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Admin Header */}
            <header className="bg-slate-900 text-white p-6 shadow-2xl sticky top-0 z-30">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
                            🛡️
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight leading-tight">BOSHQARUV PANELI</h1>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tizim Ma'lumotlari</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setAdminView(false)}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm transition-all border border-slate-700"
                    >
                        CHIQISH
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">JAMI O'YINCHILAR</p>
                        <h3 className="text-4xl font-black text-slate-900">{adminUsers.length}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">MAVJUD FANLAR</p>
                        <h3 className="text-4xl font-black text-indigo-600">{adminSubjects.length}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">SAVOLLAR BAZASI</p>
                        <h3 className="text-4xl font-black text-emerald-600">{adminQuestions.length}</h3>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                    {['users', 'questions', 'subjects', 'config', 'import'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setView(tab as any)}
                            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all whitespace-nowrap ${view === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            {tab === 'users' && 'Foydalanuvchilar'}
                            {tab === 'questions' && 'Savollar'}
                            {tab === 'subjects' && 'Fanlar'}
                            {tab === 'config' && 'Sinf Sozlamalari'}
                            {tab === 'import' && 'Import (Excel)'}
                        </button>
                    ))}
                </div>

                {view === 'users' && (
                    /* User Management Section */
                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Foydalanuvchilar</h2>
                            <div className="relative w-full md:w-80">
                                <input
                                    type="text"
                                    placeholder="ID yoki ism bo'yicha qidiruv..."
                                    className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-30">🔍</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        <th className="px-8 py-5">Foydalanuvchi</th>
                                        <th className="px-8 py-5">Sinf</th>
                                        <th className="px-8 py-5 text-center">Natijalar</th>
                                        <th className="px-8 py-5">Balans</th>
                                        <th className="px-8 py-5">Status</th>
                                        <th className="px-8 py-5 text-right">Amallar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-lg font-bold text-indigo-600 shadow-sm">
                                                        {user.firstName?.[0] || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-extrabold text-slate-800">{user.firstName || 'Nomsiz'}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono tracking-tighter">ID: {user.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">
                                                    {user.grade || '?'}-Sinf
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <div className="text-center">
                                                        <div className="text-xs font-black text-emerald-600">{user.wins}</div>
                                                        <div className="text-[8px] text-slate-400 uppercase font-bold">W</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-xs font-black text-red-600">{user.losses}</div>
                                                        <div className="text-[8px] text-slate-400 uppercase font-bold">L</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <button
                                                    onClick={() => setEditingUser(user)}
                                                    className="flex items-center gap-1.5 font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 hover:scale-105 transition-transform"
                                                >
                                                    🪙 {user.balance}
                                                </button>
                                            </td>
                                            <td className="px-8 py-5">
                                                <button
                                                    onClick={() => handleUpdateRole(user)}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${user.role === 'admin'
                                                        ? 'bg-indigo-600 text-white shadow-indigo-200'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {user.role === 'admin' ? 'BOSS' : 'USER'}
                                                </button>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => adminDeleteUser(user.id)}
                                                    className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'questions' && (
                    /* Question Management Section */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Add Question Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sticky top-32">
                                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                                    <span>➕</span> Yangi Savol
                                </h2>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const form = e.target as HTMLFormElement;
                                    const q = (form.elements.namedItem('q') as HTMLInputElement).value;
                                    const a = (form.elements.namedItem('a') as HTMLInputElement).value;
                                    const subjectId = (form.elements.namedItem('subjectId') as HTMLSelectElement).value;
                                    const difficulty = (form.elements.namedItem('difficulty') as HTMLSelectElement).value;

                                    const optA = (form.elements.namedItem('optA') as HTMLInputElement).value;
                                    const optB = (form.elements.namedItem('optB') as HTMLInputElement).value;
                                    const optC = (form.elements.namedItem('optC') as HTMLInputElement).value;
                                    const optD = (form.elements.namedItem('optD') as HTMLInputElement).value;

                                    const allowedGradesStr = (form.elements.namedItem('allowedGrades') as HTMLInputElement).value;
                                    let allowedGrades: number[] = [];
                                    if (allowedGradesStr) {
                                        try {
                                            if (allowedGradesStr.includes('-')) {
                                                const [start, end] = allowedGradesStr.split('-').map(s => parseInt(s.trim()));
                                                if (!isNaN(start) && !isNaN(end)) {
                                                    for (let i = start; i <= end; i++) allowedGrades.push(i);
                                                }
                                            } else if (allowedGradesStr.includes(',')) {
                                                allowedGrades = allowedGradesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            } else {
                                                const val = parseInt(allowedGradesStr.trim());
                                                if (!isNaN(val)) allowedGrades = [val];
                                            }
                                        } catch (e) {
                                            console.error("Grade parse error", e);
                                        }
                                    }

                                    let options: string[] = [];
                                    if (optA || optB || optC || optD) {
                                        options = [optA || '', optB || '', optC || '', optD || ''];
                                    }

                                    if (q && a && subjectId) {
                                        adminAddQuestion({
                                            q,
                                            a,
                                            subjectId: Number(subjectId),
                                            difficulty: Number(difficulty),
                                            options: options.length > 0 ? options : undefined,
                                            allowedGrades: allowedGrades.length > 0 ? allowedGrades : undefined
                                        });
                                        form.reset();
                                        alert("Savol qo'shildi!");
                                    } else {
                                        alert("Savol, Javob va Fan tanlanishi shart!");
                                    }
                                }}>
                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fan va Sinf</label>
                                        <div className="flex gap-2">
                                            <select name="subjectId" className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold text-slate-700" required>
                                                <option value="">Fan tanlang</option>
                                                {adminSubjects.map((s: any) => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                            <select name="difficulty" className="w-24 px-4 py-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold text-slate-700" defaultValue="5">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => (
                                                    <option key={g} value={g}>{g}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Qo'shimcha Sinflar (Ixtiyoriy)</label>
                                        <input
                                            name="allowedGrades" // We'll parse this manually
                                            placeholder="Masalan: 6-11 yoki 6,7,8 (Bo'sh qolsa faqat tanlangan sinf)"
                                            className="w-full px-5 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-slate-700"
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Savol Matni</label>
                                        <textarea
                                            name="q"
                                            placeholder="Masalan: O'zbekistonning poytaxti?"
                                            className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-slate-800 min-h-[100px] resize-none"
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Variantlar (Ixtiyoriy)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input name="optA" placeholder="A variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                            <input name="optB" placeholder="B variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                            <input name="optC" placeholder="C variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                            <input name="optD" placeholder="D variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">To'g'ri Javob</label>
                                        <input
                                            name="a"
                                            type="text"
                                            placeholder="0, 1, 2, 3 yoki A, B (vergul bilan)"
                                            className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-black text-slate-800"
                                            required
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            * Variantlar bo'lsa: A=0, B=1, C=2, D=3. Matnli javob ham mumkin.
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                                    >
                                        SAQLASH
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                                <div className="p-8 border-b border-slate-50">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-slate-300 transition-all accent-indigo-600"
                                                checked={currentQuestions.length > 0 && selectedIds.length === currentQuestions.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds(currentQuestions.map(q => String(q.id) || ''));
                                                    } else {
                                                        setSelectedIds([]);
                                                    }
                                                }}
                                            />
                                            <h2 className="text-xl font-black text-slate-800 whitespace-nowrap">Mavjud Savollar ({currentQuestions.length})</h2>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {/* Subject Filter */}
                                            <select
                                                value={filterSubjectId}
                                                onChange={(e) => setFilterSubjectId(e.target.value)}
                                                className="px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                                            >
                                                <option value="all">Barcha fanlar</option>
                                                {adminSubjects.map(sub => (
                                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                ))}
                                            </select>

                                            {/* Grade Filter */}
                                            <select
                                                value={filterGrade}
                                                onChange={(e) => setFilterGrade(e.target.value)}
                                                className="px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                                            >
                                                <option value="all">Barcha sinflar</option>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => (
                                                    <option key={g} value={g}>{g}-sinf</option>
                                                ))}
                                            </select>

                                            {/* Clear Filters */}
                                            {(filterSubjectId !== 'all' || filterGrade !== 'all') && (
                                                <button
                                                    onClick={() => {
                                                        setFilterSubjectId('all');
                                                        setFilterGrade('all');
                                                    }}
                                                    className="px-4 py-2 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl font-bold text-xs hover:bg-red-100 transition-all"
                                                >
                                                    TOZALASH ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {currentQuestions.map((q) => {
                                        const subjectName = adminSubjects.find(s => String(s.id) === String(q.subjectId))?.name || "Nomalum Fan";

                                        // Format Grades Display
                                        let gradeDisplay = `${q.difficulty}-sinf`;
                                        if (Array.isArray(q.allowedGrades) && q.allowedGrades.length > 1) {
                                            const sorted = [...q.allowedGrades].sort((a, b) => a - b);
                                            if (sorted.length > 2 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) {
                                                gradeDisplay = `${sorted[0]}-${sorted[sorted.length - 1]}-sinf`;
                                            } else {
                                                gradeDisplay = `${sorted.join(', ')}-sinf`;
                                            }
                                        }

                                        const isSelected = selectedIds.includes(String(q.id));
                                        return (
                                            <div key={q.id || Math.random()} className={`p-6 hover:bg-slate-50/50 transition-all flex items-center group gap-4 ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded border-slate-300 transition-all accent-indigo-600"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const sid = String(q.id);
                                                        if (isSelected) {
                                                            setSelectedIds(selectedIds.filter(id => id !== sid));
                                                        } else if (q.id) {
                                                            setSelectedIds([...selectedIds, sid]);
                                                        }
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">ID: {q.id}</span>
                                                        <div className="font-bold text-slate-800 text-lg">{q.q}</div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black">
                                                            {subjectName}
                                                        </span>
                                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black">
                                                            {gradeDisplay}
                                                        </span>
                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black">
                                                            Javob: {q.answer || q.a}
                                                        </span>
                                                        {q.type && (
                                                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold uppercase">
                                                                {q.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {q.options && q.options.length > 0 && (
                                                        <div className="mt-3 grid grid-cols-2 gap-2 max-w-md">
                                                            {q.options.map((opt: string, idx: number) => (
                                                                <div key={idx} className={`text-xs p-2 rounded border ${
                                                                    // Highlight if answer matches index or value
                                                                    (String(q.answer) === String(idx) ||
                                                                        String(q.answer).toLowerCase() === ['a', 'b', 'c', 'd'][idx] ||
                                                                        String(q.answer).toLowerCase() === opt.toLowerCase())
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                                                                        : 'bg-slate-50 border-slate-100 text-slate-500'
                                                                    }`}>
                                                                    <span className="font-bold mr-1">{['A', 'B', 'C', 'D'][idx]}:</span> {opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setEditingQuestion(q)}
                                                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="Tahrirlash"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => q.id && adminDeleteQuestion(q.id)}
                                                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="O'chirish"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {currentQuestions.length === 0 && (
                                        <div className="p-12 text-center text-slate-400">
                                            Hozircha savollar yo'q.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'subjects' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-[2.5rem] shadow-xl p-8">
                            <h2 className="text-xl font-black text-slate-800 mb-6">Yangi Fan Qo'shish</h2>
                            <form onSubmit={handleCreateSubject}>
                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fan Nomi</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100"
                                        value={newSubject.name}
                                        onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                                        placeholder="Masalan: Matematika"
                                        required
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fan Kodi (Lotincha, kichik)</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100"
                                        value={newSubject.code}
                                        onChange={e => setNewSubject({ ...newSubject, code: e.target.value.toLowerCase() })}
                                        placeholder="Masalan: math"
                                        required
                                    />
                                </div>
                                <button type="submit" className="w-full py-4 font-black text-white bg-indigo-600 rounded-2xl">SAQLASH</button>
                            </form>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-xl p-8">
                            <h2 className="text-xl font-black text-slate-800 mb-6">Mavjud Fanlar</h2>
                            <ul className="space-y-4">
                                {adminSubjects.map((s: any) => (
                                    <li key={s.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between">
                                        <span className="font-bold text-slate-800">{s.name}</span>
                                        <span className="text-sm font-mono text-slate-400">{s.code}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {view === 'config' && (
                    <div className="bg-white rounded-[2.5rem] shadow-xl p-8">
                        <h2 className="text-xl font-black text-slate-800 mb-6">Sinf Sozlamalari</h2>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sinfni Tanlang</label>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setConfigGrade(g)}
                                        className={`w-12 h-12 rounded-xl font-black ${configGrade === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-lg font-bold mb-4">{configGrade}-Sinf uchun fanlar</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {adminSubjects.map((s: any) => (
                                    <label key={s.id} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${configSubjects.includes(s.code.toLowerCase()) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={configSubjects.includes(s.code.toLowerCase())}
                                            onChange={() => handleToggleSubject(s.code)}
                                        />
                                        <span className={`font-bold ${configSubjects.includes(s.code.toLowerCase()) ? 'text-indigo-700' : 'text-slate-600'}`}>{s.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleConfigSave} className="px-8 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-200">
                            SOZLAMALARNI SAQLASH
                        </button>
                    </div>
                )}

                {view === 'import' && (
                    <div className="bg-white rounded-[2.5rem] shadow-xl p-8 max-w-2xl mx-auto">
                        <h2 className="text-xl font-black text-slate-800 mb-6">Savollarni Yuklash (Excel)</h2>
                        <form onSubmit={handleFileUpload}>
                            <div className="mb-6 border-dashed border-4 border-slate-200 rounded-3xl p-10 text-center relative hover:bg-slate-50 transition-all">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="text-4xl mb-4">📂</div>
                                <p className="font-bold text-slate-500">
                                    {uploadFile ? uploadFile.name : "Excel faylni tanlang yoki shu yerga tashlang"}
                                </p>
                            </div>
                            {uploadStatus && (
                                <div className={`mt-4 p-4 rounded-2xl text-center font-bold ${uploadStatus.includes('Xatolik') ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {uploadStatus}
                                </div>
                            )}

                            {uploadErrors.length > 0 && (
                                <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 max-h-60 overflow-y-auto">
                                    <h4 className="text-red-700 font-bold mb-2 text-sm uppercase tracking-wider">Xatoliklar tafsiloti:</h4>
                                    <ul className="space-y-1">
                                        {uploadErrors.map((err, i) => (
                                            <li key={i} className="text-xs text-red-600 flex gap-2">
                                                <span className="font-black min-w-[3rem] opacity-70">{err.row}-qator:</span>
                                                <span>{err.error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={!uploadFile}
                                className="w-full py-4 font-black text-white bg-indigo-600 rounded-2xl disabled:opacity-50"
                            >
                                YUKLASH
                            </button>
                        </form>
                        <div className="mt-8 text-sm text-slate-400">
                            <p className="font-bold mb-2">Excel Fayl Talablari:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Ustunlar: <b>savol, javob, fan, sinf</b> (yoki Question, Answer...)</li>
                                <li>"fan" - admin panelidagi fan kodi (code) bilan bir xil bo'lishi kerak.</li>
                                <li>"sinf" - 1-11 oraliqdagi raqam.</li>
                            </ul>
                        </div>
                    </div>
                )}
            </main>

            {/* Edit Balance Modal */}
            <AnimatePresence>
                {editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl"
                        >
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                💰 Balansni o'zgartirish
                            </h3>
                            <form onSubmit={handleSaveBalance}>
                                <div className="mb-6">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Yangi miqdor</label>
                                    <input
                                        type="number"
                                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none text-2xl font-black text-slate-800"
                                        value={editingUser.balance}
                                        onChange={(e) => setEditingUser({ ...editingUser, balance: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="flex-1 py-4 font-bold text-slate-400 bg-slate-100 rounded-2xl"
                                    >
                                        BEKOR QILISH
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200"
                                    >
                                        SAQLASH
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Edit Question Modal */}
            <AnimatePresence>
                {editingQuestion && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl my-8"
                        >
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                ✏️ Savolni tahrirlash
                            </h3>
                            <form onSubmit={handleSaveEditedQuestion}>
                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fan va Sinf</label>
                                    <div className="flex gap-2">
                                        <select name="subjectId" defaultValue={editingQuestion.subjectId} className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold text-slate-700" required>
                                            {adminSubjects.map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <select name="difficulty" defaultValue={editingQuestion.difficulty} className="w-24 px-4 py-3 bg-slate-50 rounded-xl border-2 border-slate-100 font-bold text-slate-700">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Qo'shimcha Sinflar</label>
                                    <input
                                        name="allowedGrades"
                                        defaultValue={editingQuestion.allowedGrades?.join(',')}
                                        placeholder="Masalan: 6-11 yoki 6,7,8"
                                        className="w-full px-5 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 font-bold text-slate-700"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Savol Matni</label>
                                    <textarea
                                        name="q"
                                        defaultValue={editingQuestion.q}
                                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-slate-800 min-h-[100px] resize-none"
                                        required
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Variantlar</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input name="optA" defaultValue={editingQuestion.options?.[0] || ''} placeholder="A variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                        <input name="optB" defaultValue={editingQuestion.options?.[1] || ''} placeholder="B variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                        <input name="optC" defaultValue={editingQuestion.options?.[2] || ''} placeholder="C variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                        <input name="optD" defaultValue={editingQuestion.options?.[3] || ''} placeholder="D variant" className="px-3 py-2 bg-slate-50 rounded-xl border-2 border-slate-100 font-medium" />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">To'g'ri Javob</label>
                                    <input
                                        name="a"
                                        defaultValue={editingQuestion.answer}
                                        className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-black text-slate-800"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingQuestion(null)}
                                        className="flex-1 py-4 font-bold text-slate-400 bg-slate-100 rounded-2xl"
                                    >
                                        BEKOR QILISH
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4 font-black text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200"
                                    >
                                        SAQLASH
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Actions Floating Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && view === 'questions' && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40"
                    >
                        <div className="bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-slate-700 backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-black text-sm">
                                    {selectedIds.length}
                                </span>
                                <span className="font-extrabold text-sm uppercase tracking-widest text-slate-300">Savol tanlandi</span>
                            </div>
                            <div className="w-px h-8 bg-slate-700" />
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setSelectedIds([])}
                                    className="px-4 py-2 text-xs font-black uppercase text-slate-400 hover:text-white transition-colors"
                                >
                                    BEKOR QILISH
                                </button>
                                <button
                                    onClick={async () => {
                                        await adminBulkDeleteQuestions(selectedIds);
                                        setSelectedIds([]);
                                    }}
                                    className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-xl font-black text-xs uppercase shadow-lg shadow-red-500/20 transition-all"
                                >
                                    🗑️ O'CHIRISH
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
