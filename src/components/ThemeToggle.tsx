import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';

function getInitialMode(): ThemeMode {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }

    return 'light';
}

function applyThemeMode(mode: ThemeMode) {
    const resolved = mode;

    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = resolved;
}

export default function ThemeToggle() {
    const [mode, setMode] = useState<ThemeMode>('light');

    useEffect(() => {
        const initialMode = getInitialMode();
        setMode(initialMode);
        applyThemeMode(initialMode);
    }, []);

    function toggleMode() {
        const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
        setMode(nextMode);
        applyThemeMode(nextMode);
        window.localStorage.setItem('theme', nextMode);
    }

    const label = `Theme mode: ${mode}. Click to switch to ${mode === 'light' ? 'dark' : 'light'} mode.`;

    return (
        <button
            type="button"
            onClick={toggleMode}
            aria-label={label}
            title={label}
            className="rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-sm font-semibold text-(--sea-ink) shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-(--lagoon)"
        >
            {mode === 'dark' ? 'Dark' : 'Light'}
        </button>
    );
}
