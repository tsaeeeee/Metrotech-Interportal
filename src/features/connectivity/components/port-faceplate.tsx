import { cn } from '#/lib/utils';
import type { Device, Port } from '#/types/schema';

interface PortFaceplateProps {
    device: Device;
    onPortClick?: (port: Port) => void;
    activePortId?: string;
}

export function PortFaceplate({
    device,
    onPortClick,
    activePortId,
}: PortFaceplateProps) {
    // Group ports by rows if there are many (e.g. 48-port switch)
    const ports = device.ports || [];

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-black/40 rounded-sm border border-white/5">
            {ports.map((port) => (
                <button
                    key={port.id}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPortClick?.(port);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            onPortClick?.(port);
                        }
                    }}
                    className={cn(
                        'w-3 h-3 rounded-[1px] border cursor-pointer transition-all hover:scale-125 focus:outline-none focus:ring-1 focus:ring-white',
                        port.status === 'plugged'
                            ? 'bg-(--sea-teal) border-(--sea-aqua) shadow-[0_0_8px_rgba(45,212,191,0.4)]'
                            : 'bg-white/10 border-white/20 hover:border-white/40',
                        activePortId === port.id &&
                            'ring-2 ring-white ring-offset-1 ring-offset-black',
                    )}
                    title={`${port.name} (${port.type}) - ${port.status}`}
                    aria-label={`Select port ${port.name}`}
                />
            ))}
            {ports.length === 0 && (
                <span className="text-[10px] text-white/40 italic">
                    No ports defined
                </span>
            )}
        </div>
    );
}
