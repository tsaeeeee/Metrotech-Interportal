import { describe, expect, it } from 'vitest';
import type { Device, Rack } from '#/types/schema';
import { canPlaceDevice, isSlotOccupied } from './validation';

describe('Rack Validation Logic', () => {
    const mockRack: Rack = {
        id: 'rk-1',
        name: 'Test Rack',
        floorId: 'fl-1',
        uCapacity: 42,
        devices: ['dv-1'],
        x: 0,
        y: 0,
    };

    const mockDevices: Device[] = [
        {
            id: 'dv-1',
            name: 'Existing Server',
            rackId: 'rk-1',
            uHeight: 2,
            uPosition: 10, // Occupies slots 10, 11
            type: 'server',
            depth: 'full',
            status: 'active',
            ports: [],
        },
    ];

    describe('isSlotOccupied', () => {
        it('should return true for occupied slots', () => {
            expect(isSlotOccupied(10, mockDevices)).toBe(true);
            expect(isSlotOccupied(11, mockDevices)).toBe(true);
        });

        it('should return false for empty slots', () => {
            expect(isSlotOccupied(1, mockDevices)).toBe(false);
            expect(isSlotOccupied(9, mockDevices)).toBe(false);
            expect(isSlotOccupied(12, mockDevices)).toBe(false);
        });
    });

    describe('canPlaceDevice', () => {
        it('should allow placement in empty slots', () => {
            const result = canPlaceDevice(mockRack, mockDevices, 1, 2);
            expect(result.success).toBe(true);
        });

        it('should block placement if overlapping with existing device (start)', () => {
            const result = canPlaceDevice(mockRack, mockDevices, 9, 2); // 9, 10
            expect(result.success).toBe(false);
            expect(result.error).toContain('Slot 10U is already occupied');
        });

        it('should block placement if overlapping with existing device (end)', () => {
            const result = canPlaceDevice(mockRack, mockDevices, 11, 2); // 11, 12
            expect(result.success).toBe(false);
            expect(result.error).toContain('Slot 11U is already occupied');
        });

        it('should block placement if exceeding rack boundaries (top)', () => {
            const result = canPlaceDevice(mockRack, mockDevices, 42, 2); // 42, 43
            expect(result.success).toBe(false);
            expect(result.error).toContain('Device exceeds rack boundaries');
        });

        it('should allow move operation if ignoring target device', () => {
            // Move dv-1 from 10 to 11 (normally would collide with itself)
            const result = canPlaceDevice(mockRack, mockDevices, 11, 2, 'dv-1');
            expect(result.success).toBe(true);
        });
    });
});
