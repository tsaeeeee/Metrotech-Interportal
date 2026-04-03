import type React from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden outline-none focus:outline-none">
            {/* Backdrop */}
            <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity w-full h-full border-none cursor-default"
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
                aria-label="Close drawer"
            />

            {/* Drawer Content */}
            <div className="relative w-full max-w-md h-full bg-(--sea-ink) border-l border-white/10 shadow-2xl transition-transform duration-300 transform translate-x-0">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <h2 className="text-xl font-semibold text-white">
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 text-white/80">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
