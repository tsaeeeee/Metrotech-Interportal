import type { Modifier } from '@dnd-kit/core';

/**
 * Snaps the drag transform to a vertical grid of 24px (1U).
 * Also restricts movement to the vertical axis (X=0).
 */
export const createSnapToUModifier = (uHeight: number = 24): Modifier => {
    return ({ transform }) => {
        return {
            ...transform,
            y: Math.round(transform.y / uHeight) * uHeight,
        };
    };
};

export const restrictToVerticalAxis: Modifier = ({ transform }) => {
    return {
        ...transform,
        x: 0,
    };
};
