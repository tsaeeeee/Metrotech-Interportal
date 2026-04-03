import type { Device, Rack } from '#/types/schema';

/**
 * Checks if a specific rack unit (U) position is occupied by any device.
 * @param uPosition - 1-indexed U position to check.
 * @param devices - Array of devices currently in the rack.
 */
export function isSlotOccupied(uPosition: number, devices: Device[]): boolean {
    return devices.some((device) => {
        const start = device.uPosition;
        const end = device.uPosition + device.uHeight - 1;
        return uPosition >= start && uPosition <= end;
    });
}

/**
 * Validates if a device can be placed at a specific position without collisions.
 * @param rack - The rack object (for capacity check).
 * @param devices - Current devices in the rack.
 * @param newPosition - The proposed 1-indexed U position.
 * @param newHeight - The height of the new device.
 * @param ignoreDeviceId - Optional ID to ignore (useful for move operations).
 */
export function canPlaceDevice(
    rack: Rack,
    devices: Device[],
    newPosition: number,
    newHeight: number,
    ignoreDeviceId?: string,
): { success: boolean; error?: string } {
    // 1. Boundary check
    if (newPosition < 1 || newPosition + newHeight - 1 > rack.uCapacity) {
        return {
            success: false,
            error: `Device exceeds rack boundaries (1-${rack.uCapacity}U).`,
        };
    }

    // 2. Collision check
    const targetRange = Array.from(
        { length: newHeight },
        (_, i) => newPosition + i,
    );
    const filteredDevices = ignoreDeviceId
        ? devices.filter((d) => d.id !== ignoreDeviceId)
        : devices;

    for (const u of targetRange) {
        if (isSlotOccupied(u, filteredDevices)) {
            return {
                success: false,
                error: `Slot ${u}U is already occupied.`,
            };
        }
    }

    return { success: true };
}
