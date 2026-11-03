import type { PlannerCell, PlannerLayout, PlannerRack } from './types';

export interface PlannedRoute {
    cells: PlannerCell[];
    runnerTiles: number;
    leadTiles: number;
    distanceMeters: number;
    estimatedMeters: number;
}

function key(point: PlannerCell): string {
    return `${point.x},${point.y}`;
}

function unkey(value: string): PlannerCell {
    const [x, y] = value.split(',').map(Number);
    return { x, y };
}

function neighbors(point: PlannerCell, width: number, height: number): PlannerCell[] {
    return [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
    ].filter((cell) =>
        cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height,
    );
}

interface Approach {
    path: PlannerCell[];
    steps: number;
}

function findApproaches(
    position: PlannerCell,
    runnerCells: Set<string>,
    obstacles: Set<string>,
    width: number,
    height: number,
    maxLead: number,
): Map<string, Approach> {
    const startKey = key(position);
    const queue: string[] = [startKey];
    const paths = new Map<string, string[]>([[startKey, [startKey]]]);
    const approaches = new Map<string, Approach>();
    let offset = 0;

    while (offset < queue.length) {
        const current = queue[offset++];
        const path = paths.get(current)!;
        const steps = path.length - 1;

        if (runnerCells.has(current)) {
            approaches.set(current, { steps, path: path.map(unkey) });
            // An access lead terminates at its first runner tile.
            // Never use free floor space to bridge disconnected runner segments.
            continue;
        }
        if (steps >= maxLead) continue;

        for (const next of neighbors(unkey(current), width, height)) {
            const nextKey = key(next);
            if (paths.has(nextKey) || obstacles.has(nextKey)) continue;
            paths.set(nextKey, [...path, nextKey]);
            queue.push(nextKey);
        }
    }
    return approaches;
}

/**
 * Calculate a floor-plan estimate. The middle section MUST follow explicitly
 * drawn, orthogonally connected runner tiles. The two access leads may pass
 * through free floor cells, but never through walls, blocked cells or racks.
 * This is not an engineering cable-length measurement.
 */
export function calculateFiberRoute(input: {
    layout: PlannerLayout;
    racks: PlannerRack[];
    sourceId: string;
    destinationId: string;
    width: number;
    height: number;
    tileCm: number;
    slackMeters: number;
    maxLeadTiles?: number;
}): PlannedRoute | null {
    const {
        layout, racks, sourceId, destinationId,
        width, height, tileCm, slackMeters, maxLeadTiles = 3,
    } = input;

    if (sourceId === destinationId || width < 1 || height < 1 || tileCm <= 0) {
        return null;
    }

    const source = racks.find((rack) => rack.id === sourceId);
    const destination = racks.find((rack) => rack.id === destinationId);
    if (
        !source || !destination ||
        source.x === null || source.y === null ||
        destination.x === null || destination.y === null
    ) return null;

    const runnerCells = new Set(layout.runners.map(key));
    if (runnerCells.size === 0) return null;

    const obstacles = new Set([
        ...layout.walls.map(key),
        ...layout.blocked.map(key),
        ...racks
            .filter((rack) =>
                rack.x !== null && rack.y !== null &&
                rack.id !== sourceId && rack.id !== destinationId,
            )
            .map((rack) => key({ x: rack.x!, y: rack.y! })),
    ]);

    const start = { x: source.x, y: source.y };
    const finish = { x: destination.x, y: destination.y };

    // Prevent leads from crossing the other endpoint's rack.
    const starts = findApproaches(
        start, runnerCells, new Set([...obstacles, key(finish)]),
        width, height, maxLeadTiles,
    );
    const ends = findApproaches(
        finish, runnerCells, new Set([...obstacles, key(start)]),
        width, height, maxLeadTiles,
    );
    if (starts.size === 0 || ends.size === 0) return null;

    const dist = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const root = new Map<string, string>();
    const queue: { position: string; distance: number }[] = [];

    for (const [cell, approach] of starts) {
        const initial = approach.steps * 10;
        if (initial < (dist.get(cell) ?? Infinity)) {
            dist.set(cell, initial);
            parent.set(cell, null);
            root.set(cell, cell);
            queue.push({ position: cell, distance: initial });
        }
    }

    let bestEnd: string | null = null;
    let bestCost = Infinity;

    // Runner tiles have unit cost, access leads have a higher cost.
    // This prefers physical runners over walking through open floor tiles.
    while (queue.length > 0) {
        queue.sort((a, b) => a.distance - b.distance);
        const current = queue.shift()!;
        if (current.distance !== dist.get(current.position)) continue;
        if (current.distance >= bestCost) break;

        const end = ends.get(current.position);
        if (end) {
            const total = current.distance + end.steps * 10;
            if (total < bestCost) {
                bestCost = total;
                bestEnd = current.position;
            }
        }

        for (const adjacent of neighbors(unkey(current.position), width, height)) {
            const next = key(adjacent);
            if (!runnerCells.has(next) || obstacles.has(next)) continue;
            const nextDistance = current.distance + 1;
            if (nextDistance < (dist.get(next) ?? Infinity)) {
                dist.set(next, nextDistance);
                parent.set(next, current.position);
                root.set(next, root.get(current.position)!);
                queue.push({ position: next, distance: nextDistance });
            }
        }
    }

    if (!bestEnd) return null;

    const runnerPath: PlannerCell[] = [];
    let cursor: string | null = bestEnd;
    while (cursor !== null) {
        runnerPath.push(unkey(cursor));
        cursor = parent.get(cursor) ?? null;
    }
    runnerPath.reverse();

    const startApproach = starts.get(root.get(bestEnd)!)!;
    const endApproach = ends.get(bestEnd)!;
    const complete = [
        ...startApproach.path,
        ...runnerPath.slice(1),
        ...endApproach.path.slice(0, -1).reverse(),
    ];

    const runnerTiles = Math.max(0, runnerPath.length - 1);
    const leadTiles = startApproach.steps + endApproach.steps;
    const distanceMeters = Math.round((runnerTiles + leadTiles) * tileCm) / 100;
    return {
        cells: complete,
        runnerTiles,
        leadTiles,
        distanceMeters,
        estimatedMeters: Math.round((distanceMeters + Math.max(0, slackMeters)) * 100) / 100,
    };
}
