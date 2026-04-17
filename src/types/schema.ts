export interface Floor {
    id: string;
    name: string;
    location: string;
}

export interface Room {
    id: string;
    name: string;
    floorId: string;
    width: number; // in meters
    height: number; // in meters
    order: number;
}

export type DeviceType = 'server' | 'network' | 'storage';
export type AssetStatus =
    | 'active'
    | 'maintenance'
    | 'decommissioned'
    | 'storage';
export type PortType = 'RJ45' | 'SFP+' | 'Fiber-LC' | 'Fiber-SC' | 'Power';
export type PortStatus = 'up' | 'down' | 'plugged';

export interface Port {
    id: string;
    name: string;
    type: PortType;
    deviceId: string;
    status: PortStatus;
}

export interface Connection {
    id: string;
    portAId: string;
    portBId: string;
    type: 'copper' | 'fiber' | 'power';
    color?: string;
    status: 'active' | 'staged' | 'faulty';
}

export interface Device {
    id: string;
    name: string;
    rackId: string;
    uHeight: number;
    uPosition: number;
    type: DeviceType;
    depth: 'full' | 'half';
    // New Metadata
    assetTag?: string;
    serialNumber?: string;
    model?: string;
    manufacturer?: string;
    status: AssetStatus;
    // Phase 3: Ports
    ports: Port[];
}

export interface Rack {
    id: string;
    name: string;
    roomId: string;
    uCapacity: number;
    devices: string[];
    // New Spatial Coordinates
    x: number;
    y: number;
    order: number;
}

export interface Database {
    floors: Floor[];
    rooms: Room[];
    racks: Rack[];
    devices: Device[];
    connections: Connection[]; // Phase 3: Cabling
    inventory: Device[]; // User's library of master assets
}
