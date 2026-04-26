import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind classes safely using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
