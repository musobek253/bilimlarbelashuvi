import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Telegram WebApp is initialized via script tag in index.html and accessed via window.Telegram.WebApp
// preventing potential crash from @telegram-apps/sdk package if environment is not compatible.

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
