import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

function getInitialMode(): ThemeMode {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

function applyThemeMode(mode: ThemeMode) {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
}

export default function ThemeToggle() {
    const [mode, setMode] = useState<ThemeMode>('dark');

    useEffect(() => {
        const initialMode = getInitialMode();
        setMode(initialMode);
        applyThemeMode(initialMode);
    }, []);

    const toggleMode = () => {
        const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
        setMode(nextMode);
        applyThemeMode(nextMode);
        window.localStorage.setItem('theme', nextMode);
    };

    return (
        <button
            type="button"
            onClick={toggleMode}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={mode === 'dark'}
            className="metrotech-theme-button"
        >
            <span className="inline-flex items-center gap-2">
                {mode === 'dark' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
                Appearance
            </span>
            <span className="text-[11px] opacity-70">{mode === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
    );
}
