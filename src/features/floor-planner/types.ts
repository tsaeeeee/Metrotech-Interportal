export interface PlannerCell {
    x: number;
    y: number;
}

export interface PlannerLayout {
    runners: PlannerCell[];
    perforated: PlannerCell[];
    walls: PlannerCell[];
    blocked: PlannerCell[];
    entries: PlannerCell[];
}

export type PlannerLayer = keyof PlannerLayout;

export interface PlannerFloor {
    id: string;
    datacenterId: string;
    name: string;
    gridWidth: number;
    gridHeight: number;
    tileCm: number;
    layout: PlannerLayout;
    version: number;
}

export interface PlannerRoom {
    id: string;
    name: string;
    floorId: string;
}

export interface PlannerRack {
    id: string;
    name: string;
    roomId: string;
    floorId: string | null;
    uCapacity: number;
    deviceCount: number;
    x: number | null;
    y: number | null;
}

export interface PlannerOverview {
    datacenter: {
        id: string;
        name: string;
        code: string;
        location: string;
    };
    floors: PlannerFloor[];
    rooms: PlannerRoom[];
    racks: PlannerRack[];
}
