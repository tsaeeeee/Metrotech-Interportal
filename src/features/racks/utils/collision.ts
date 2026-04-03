import type { Device } from '#/types/schema';

/**
 * Checks if a specific U-range is occupied in a rack, excluding a specific device.
 */
export function isRangeOccupied(
    uPosition: number,
    uHeight: number,
    devices: Device[],
    excludeDeviceId?: string,
): boolean {
    const start = uPosition;
    const end = uPosition + uHeight - 1;

    return devices.some((device) => {
        if (device.id === excludeDeviceId) return false;

        const dStart = device.uPosition;
        const dEnd = device.uPosition + device.uHeight - 1;

        // Overlap check
        return start <= dEnd && dStart <= end;
    });
}

/**
 * Finds the first available U-position for a given height in a rack.
 */
export function findFirstAvailableU(
    height: number,
    capacity: number,
    devices: Device[],
): number | null {
    for (let u = 1; u <= capacity - height + 1; u++) {
        if (!isRangeOccupied(u, height, devices)) {
            return u;
        }
    }
    return null;
}
