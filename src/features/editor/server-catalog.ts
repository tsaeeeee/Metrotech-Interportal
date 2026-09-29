export type ServerFrontProfile =
    | 'caribou'
    | 'capybara'
    | 'bison'
    | 'crow'
    | 'cricket'
    | 'supermicro'
    | 'supermicro-gpu'
    | 'generic';

export interface ServerCatalogItem {
    value: string;
    label: string;
    family: string;
    brandHint?: 'CIARA' | 'Jabil' | 'Supermicro';
    bayCount: number;
    profile: ServerFrontProfile;
    defaultUHeight: number;
}

export const SERVER_CATALOG: ServerCatalogItem[] = [
    {
        value: '1x1 Caribou NVME-C',
        label: '1x1 Caribou NVME-C',
        family: 'Caribou',
        brandHint: 'CIARA',
        bayCount: 1,
        profile: 'caribou',
        defaultUHeight: 1,
    },
    {
        value: '1x11 Capybara NVMe-P 1TB',
        label: '1x11 Capybara NVMe-P 1TB',
        family: 'Capybara',
        bayCount: 11,
        profile: 'capybara',
        defaultUHeight: 1,
    },
    {
        value: '1x11 Caribou NVMe-L',
        label: '1x11 Caribou NVMe-L',
        family: 'Caribou',
        brandHint: 'CIARA',
        bayCount: 11,
        profile: 'caribou',
        defaultUHeight: 1,
    },
    {
        value: '1x11 Caribou NVMe-P',
        label: '1x11 Caribou NVMe-P',
        family: 'Caribou',
        brandHint: 'CIARA',
        bayCount: 11,
        profile: 'caribou',
        defaultUHeight: 1,
    },
    {
        value: '1x11 Caribou NVMe-W',
        label: '1x11 Caribou NVMe-W',
        family: 'Caribou',
        bayCount: 11,
        profile: 'caribou',
        defaultUHeight: 1,
    },
    {
        value: '1x6 Caribou NVMe-J',
        label: '1x6 Caribou NVMe-J',
        family: 'Caribou',
        brandHint: 'CIARA',
        bayCount: 6,
        profile: 'caribou',
        defaultUHeight: 1,
    },
    {
        value: '2x6 Crow 128C NVME-Q 512G 100GE',
        label: '2x6 Crow 128C NVME-Q 512G 100GE',
        family: 'Crow',
        brandHint: 'Jabil',
        bayCount: 6,
        profile: 'crow',
        defaultUHeight: 2,
    },
    {
        value: '2x6 Crow 128C NVME-Q 1T',
        label: '2x6 Crow 128C NVME-Q 1T',
        family: 'Crow',
        brandHint: 'Jabil',
        bayCount: 6,
        profile: 'crow',
        defaultUHeight: 2,
    },
    {
        value: '2x7 Crow 128C NVME-Q 512G 100GE',
        label: '2x7 Crow 128C NVME-Q 512G 100GE',
        family: 'Crow',
        brandHint: 'Jabil',
        bayCount: 7,
        profile: 'crow',
        defaultUHeight: 2,
    },
    {
        value: 'Ciara 1x3 Cricket NVME-K 256G VPU-gen1',
        label: 'Ciara 1x3 Cricket NVME-K 256G VPU-gen1',
        family: 'Cricket',
        brandHint: 'CIARA',
        bayCount: 3,
        profile: 'cricket',
        defaultUHeight: 1,
    },
    {
        value: '1x4 Bison NVMe-I 128G',
        label: '1x4 Bison NVMe-I 128G',
        family: 'Bison',
        brandHint: 'CIARA',
        bayCount: 4,
        profile: 'bison',
        defaultUHeight: 1,
    },
    {
        value: '1x8 Bison NVMe-K 128G',
        label: '1x8 Bison NVMe-K 128G',
        family: 'Bison',
        brandHint: 'CIARA',
        bayCount: 8,
        profile: 'bison',
        defaultUHeight: 1,
    },
    {
        value: '1x8 Bison NVMe-N 256G',
        label: '1x8 Bison NVMe-N 256G',
        family: 'Bison',
        brandHint: 'CIARA',
        bayCount: 8,
        profile: 'bison',
        defaultUHeight: 1,
    },
    {
        value: 'Supermicro 2U Server',
        label: 'Supermicro 2U Server',
        family: 'Supermicro',
        brandHint: 'Supermicro',
        bayCount: 12,
        profile: 'supermicro',
        defaultUHeight: 2,
    },
    {
        value: 'Supermicro GPU 4U Server',
        label: 'Supermicro GPU 4U Server',
        family: 'Supermicro GPU',
        brandHint: 'Supermicro',
        bayCount: 8,
        profile: 'supermicro-gpu',
        defaultUHeight: 4,
    },
];

export function getServerCatalogItem(
    equipmentType?: string,
): ServerCatalogItem | undefined {
    if (!equipmentType) return undefined;
    return SERVER_CATALOG.find((item) => item.value === equipmentType);
}


export function inferServerRackHeight(
    equipmentType?: string,
    fallback = 1,
): number {
    if (!equipmentType) return fallback;

    const catalogItem = getServerCatalogItem(equipmentType);
    if (catalogItem) return catalogItem.defaultUHeight;

    const prefix = equipmentType.match(/^(\d+)x/i);
    if (prefix) {
        const uHeight = Number(prefix[1]);
        if (Number.isFinite(uHeight) && uHeight > 0 && uHeight <= 12) {
            return uHeight;
        }
    }

    if (/supermicro.*gpu/i.test(equipmentType)) return 4;
    if (/supermicro/i.test(equipmentType)) return 2;

    return fallback;
}
