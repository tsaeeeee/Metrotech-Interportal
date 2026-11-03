import { describe, expect, it } from 'vitest';
import { calculateFiberRoute } from './routing';
import type { PlannerLayout, PlannerRack } from './types';

const empty: PlannerLayout = {
    runners: [], perforated: [], walls: [], blocked: [], entries: [],
};
const makeRack = (id: string, x: number, y: number): PlannerRack => ({
    id, name: id, roomId: 'room', floorId: 'floor', uCapacity: 42,
    deviceCount: 0, x, y,
});
const compute = (
    layout: PlannerLayout,
    racks: PlannerRack[] = [makeRack('a', 1, 1), makeRack('b', 5, 1)],
) => calculateFiberRoute({
    layout, racks, sourceId: 'a', destinationId: 'b',
    width: 8, height: 5, tileCm: 60, slackMeters: 2,
});

describe('fiber runner route', () => {
    it('does not invent a physical route without runners', () => {
        expect(compute(empty)).toBeNull();
    });

    it('follows a connected runner and includes both access leads', () => {
        const layout = {
            ...empty,
            runners: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 })),
        };
        const result = compute(layout);
        expect(result).not.toBeNull();
        expect(result?.leadTiles).toBe(2);
        expect(result?.runnerTiles).toBe(4);
        expect(result?.distanceMeters).toBe(3.6);
        expect(result?.estimatedMeters).toBe(5.6);
        expect(result?.cells[0]).toEqual({ x: 1, y: 1 });
        expect(result?.cells[result.cells.length - 1]).toEqual({ x: 5, y: 1 });
    });

    it('rejects disconnected fiber runners', () => {
        const layout = {
            ...empty,
            runners: [{ x: 1, y: 2 }, { x: 2, y: 2 },
                { x: 4, y: 2 }, { x: 5, y: 2 }],
            walls: [{ x: 3, y: 2 }],
        };
        expect(compute(layout, [makeRack('a', 1, 2), makeRack('b', 5, 2)]))
            .toBeNull();
    });

    it('never walks through a wall or another rack', () => {
        const layout = {
            ...empty,
            runners: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 })),
        };
        const blocked = { ...layout, walls: [{ x: 3, y: 2 }] };
        expect(compute(blocked, [makeRack('a', 1, 2), makeRack('b', 5, 2)]))
            .toBeNull();
        expect(compute(layout, [
            makeRack('a', 1, 2), makeRack('b', 5, 2), makeRack('c', 3, 2),
        ])).toBeNull();
    });
});
