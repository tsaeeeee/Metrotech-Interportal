import fs from 'node:fs/promises';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'data/db.json');

async function migrate() {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const db = JSON.parse(data);

    db.floors = db.floors.map(
        (f: { order?: number } & Record<string, unknown>, i: number) => ({
            ...f,
            order: f.order ?? i + 1,
        }),
    );

    db.racks = db.racks.map(
        (r: { order?: number } & Record<string, unknown>, i: number) => ({
            ...r,
            order: r.order ?? i + 1,
        }),
    );

    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log(
        'Migration complete: All floors and racks now have an order property.',
    );
}

migrate().catch(console.error);
