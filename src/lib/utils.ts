/**
 * Simple conditional class merger utility for Metrotech Interportal.
 * Similar to clsx but with no dependencies.
 */
export function cn(...inputs: any[]): string {
    return inputs
        .flat()
        .filter(Boolean)
        .map((input) => {
            if (typeof input === 'string') return input;
            if (typeof input === 'object') {
                return Object.entries(input)
                    .filter(([_, value]) => Boolean(value))
                    .map(([key]) => key)
                    .join(' ');
            }
            return '';
        })
        .join(' ');
}
