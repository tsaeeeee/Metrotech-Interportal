export interface DataCenter {
    id: string;
    name: string;
    location: string;
}

export interface Floor {
    id: string;
    name: string;
    datacenterId: string;
}

export type DeviceType = 'server' | 'network' | 'pdu' | 'storage';

export interface Device {
    id: string;
    name: string;
    rackId: string;
    uHeight: number; // e.g., 1, 2, 4
    uPosition: number; // 1-indexed U-slot from bottom
    type: DeviceType;
    depth: 'full' | 'half';
}

export interface Rack {
    id: string;
    name: string;
    floorId: string;
    uCapacity: number; // e.g., 42
    devices: string[]; // List of device IDs for relational consistency
}

export interface Database {
    datacenters: DataCenter[];
    floors: Floor[];
    racks: Rack[];
    devices: Device[]; // Flat list of all devices
}
