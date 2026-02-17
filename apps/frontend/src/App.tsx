import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import GameScreen from './components/GameScreen';
import LoginScreen from './components/LoginScreen';
import GradeSelectionScreen from './components/GradeSelectionScreen';
import MainMenuScreen from './components/MainMenuScreen';
import AdminDashboard from './components/AdminDashboard';
import LeaderboardScreen from './components/LeaderboardScreen.tsx';
import { connectSocket, disconnectSocket } from './services/socket';

function App() {
    useEffect(() => {
        connectSocket();
        useGameStore.getState().initializeListeners();
        useGameStore.getState().checkAuth(); // Check for persistent web login
        return () => disconnectSocket();
    }, []);

    const { roomId, status, profile, isAdminView, isLeaderboardView, isAsyncMode, isInitializing } = useGameStore();

    if (isInitializing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-50">
                <div className="flex flex-col items-center">
                    <div className="text-8xl mb-6 animate-bounce">🎯</div>
                    <div className="h-2 w-48 bg-indigo-100 rounded-full overflow-hidden relative">
                        <div
                            className="absolute top-0 left-0 h-full bg-indigo-600 animate-pulse"
                            style={{ width: "50%", animation: "loading-slide 1.5s infinite linear" }}
                        />
                    </div>
                    <p className="mt-4 text-indigo-400 font-bold animate-pulse">Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    // 0. If admin view is active
    if (isAdminView) {
        return <AdminDashboard />;
    }

    if (isLeaderboardView) {
        return <LeaderboardScreen />;
    }

    // 1. If no profile, show login
    if (!profile) {
        return <LoginScreen />;
    }

    // 2. If profile exists but no grade, show grade selection
    if (profile.grade === null) {
        return <GradeSelectionScreen />;
    }

    // 3. If searching for match, show searching state in GameScreen
    if (status === 'searching') {
        return <GameScreen />;
    }

    // 4. If in game (waiting, playing, finished), show GameScreen
    // Added isAsyncMode check so Offline Battles trigger without roomId
    if ((roomId || isAsyncMode) && (status === 'waiting' || status === 'playing' || status === 'finished')) {
        return <GameScreen />;
    }

    // 5. Default: show main menu
    return <MainMenuScreen />;
}

export default App;
