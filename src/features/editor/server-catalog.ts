export type ServerFrontProfile =
    | 'caribou'
    | 'capybara'
    | 'bison'
    | 'crow'
    | 'cricket'
    | 'generic';

export interface ServerCatalogItem {
    value: string;
    label: string;
    family: string;
    brandHint?: 'CIARA' | 'Jabil';
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
        defaultUHeight: 1,
    },
    {
        value: '2x6 Crow 128C NVME-Q 1T',
        label: '2x6 Crow 128C NVME-Q 1T',
        family: 'Crow',
        brandHint: 'Jabil',
        bayCount: 6,
        profile: 'crow',
        defaultUHeight: 1,
    },
    {
        value: '2x7 Crow 128C NVME-Q 512G 100GE',
        label: '2x7 Crow 128C NVME-Q 512G 100GE',
        family: 'Crow',
        brandHint: 'Jabil',
        bayCount: 7,
        profile: 'crow',
        defaultUHeight: 1,
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
];

export function getServerCatalogItem(
    equipmentType?: string,
): ServerCatalogItem | undefined {
    if (!equipmentType) return undefined;
    return SERVER_CATALOG.find((item) => item.value === equipmentType);
}
