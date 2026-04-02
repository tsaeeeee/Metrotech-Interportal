# Metrotech Interportal: DCIM Rack Builder

**Goal**: A specialized Data Center Infrastructure Management (DCIM) tool designed to visually map, plan, and manage server room layouts from the high-level Data Center view down to individual Rack Units (U).

## 🚀 Core Features
* **Visual Rack Management**: Create and edit server racks with configurable heights (42U, 48U, 52U).
* **Inventory Mapping**: Drag-and-drop devices (Servers, Switches, UPS) into specific Units.
* **Hierarchical Navigation**: Drill down through a structured path: `User` ➔ `Data Center` ➔ `Floor` ➔ `Rack`.
* **Portable Data**: Uses a local `db.json` for easy version control and portability.

## 🛠 Tech Stack
* **Framework**: React 19 + TanStack Start (Router + Query + SSR)
* **Styling**: Tailwind CSS 4.0
* **Tooling**: Biome (Linting & Formatting)
* **Icons**: Lucide React
* **Database**: Flat-file JSON via Node.js Server Functions