import { useMemo } from "react";

// Crop colors for silo segments
const CROP_COLORS: Record<string, { bg: string; text: string; emoji: string }> = {
    soja: { bg: "from-amber-400 to-amber-500", text: "text-amber-900", emoji: "🌾" },
    milho: { bg: "from-yellow-400 to-yellow-500", text: "text-yellow-900", emoji: "🌽" },
    trigo: { bg: "from-orange-300 to-orange-400", text: "text-orange-900", emoji: "🌾" },
    girassol: { bg: "from-yellow-300 to-yellow-400", text: "text-yellow-900", emoji: "🌻" },
    arroz: { bg: "from-lime-300 to-lime-400", text: "text-lime-900", emoji: "🌾" },
};

function getCropStyle(crop: string) {
    const key = crop.toLowerCase().trim();
    return CROP_COLORS[key] || { bg: "from-emerald-400 to-emerald-500", text: "text-emerald-900", emoji: "🌱" };
}

interface CropData {
    crop: string;
    weight: number;
    grossWeight: number;
    value: number;
    deliveryCount: number;
}

interface SiloData {
    buyer: string;
    crops: CropData[];
    totalWeight: number;
    totalGrossWeight: number;
    totalValue: number;
    deliveryCount: number;
    inputSpent: number;
    invoiceCount: number;
    percentOfHarvest: number;
    balance: number;
}

interface SiloVisualizationProps {
    silos: SiloData[];
    totalHarvest: number;
    totalValue: number;
    totalInputSpent: number;
}

export default function SiloVisualization({ silos, totalHarvest, totalValue, totalInputSpent }: SiloVisualizationProps) {
    if (!silos || silos.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🏭</span>
                    <h2 className="text-lg font-bold text-emerald-800">Visão de Armazém</h2>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                    <span>Colheita total: <strong className="text-emerald-700">{(totalHarvest / 1000).toFixed(1)} ton</strong></span>
                    {totalInputSpent > 0 && (
                        <span>Insumos: <strong className="text-red-600">$ {totalInputSpent.toLocaleString("en", { minimumFractionDigits: 0 })}</strong></span>
                    )}
                </div>
            </div>

            {/* Silos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {silos.map((silo) => (
                    <SiloCard key={silo.buyer} silo={silo} totalHarvest={totalHarvest} />
                ))}
            </div>
        </div>
    );
}

function SiloCard({ silo, totalHarvest }: { silo: SiloData; totalHarvest: number }) {
    const fillPercent = Math.min(100, silo.percentOfHarvest);
    const tons = silo.totalWeight / 1000;

    // Sort crops by weight descending for stacking
    const sortedCrops = useMemo(() =>
        [...silo.crops].sort((a, b) => b.weight - a.weight),
        [silo.crops]);

    // Calculate each crop's proportion within this silo
    const cropSegments = useMemo(() => {
        return sortedCrops.map(c => ({
            ...c,
            percent: silo.totalWeight > 0 ? (c.weight / silo.totalWeight) * 100 : 0,
            style: getCropStyle(c.crop),
        }));
    }, [sortedCrops, silo.totalWeight]);

    const hasInputs = silo.inputSpent > 0;
    const balancePositive = silo.balance >= 0;

    return (
        <div className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden hover:-translate-y-1">
            {/* Percentage badge */}
            <div className="absolute top-2 right-2 z-10">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shadow-sm">
                    {silo.percentOfHarvest.toFixed(1)}%
                </span>
            </div>

            {/* Silo visual */}
            <div className="relative mx-auto mt-4 mb-2 w-20 h-32 flex flex-col justify-end">
                {/* Silo container */}
                <div className="absolute inset-0 rounded-t-full rounded-b-lg border-2 border-gray-300 bg-gray-50 overflow-hidden">
                    {/* Fill from bottom */}
                    <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out overflow-hidden"
                        style={{ height: `${fillPercent}%` }}
                    >
                        {/* Crop segments stacked */}
                        <div className="absolute inset-0 flex flex-col-reverse">
                            {cropSegments.map((seg, i) => (
                                <div
                                    key={seg.crop}
                                    className={`bg-gradient-to-r ${seg.style.bg} relative`}
                                    style={{ height: `${seg.percent}%`, minHeight: seg.percent > 0 ? '4px' : '0' }}
                                >
                                    {/* Grain texture pattern */}
                                    <div className="absolute inset-0 opacity-20"
                                        style={{
                                            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)',
                                            backgroundSize: '4px 4px'
                                        }}
                                    />
                                    {/* Divider line between crops */}
                                    {i > 0 && <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/10" />}
                                </div>
                            ))}
                        </div>
                        {/* Top shine effect */}
                        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white/30 to-transparent" />
                    </div>

                    {/* Silo lines */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/3 top-0 bottom-0 w-[0.5px] bg-gray-200/50" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-[0.5px] bg-gray-200/50" />
                    </div>
                </div>

                {/* Silo cap (dome) */}
                <div className="absolute -top-1 left-1 right-1 h-4 bg-gradient-to-b from-gray-400 to-gray-300 rounded-t-full border border-gray-400 border-b-0">
                    <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-white/30 rounded-full mt-0.5" />
                </div>

                {/* Silo base */}
                <div className="absolute -bottom-1 left-0 right-0 h-2 bg-gradient-to-b from-gray-400 to-gray-500 rounded-b-lg" />
            </div>

            {/* Info section */}
            <div className="px-3 pb-3 pt-1 text-center">
                {/* Buyer name */}
                <p className="font-bold text-xs text-gray-800 truncate mb-1" title={silo.buyer}>
                    {silo.buyer}
                </p>

                {/* Weight */}
                <p className="text-lg font-extrabold text-emerald-700 leading-tight">
                    {tons < 10 ? tons.toFixed(2) : tons.toFixed(1)} <span className="text-xs font-normal text-gray-500">ton</span>
                </p>

                {/* Crop legend */}
                <div className="flex justify-center gap-1 mt-1.5 flex-wrap">
                    {cropSegments.map(seg => (
                        <span
                            key={seg.crop}
                            className={`px-1.5 py-0 rounded text-[9px] font-semibold bg-gradient-to-r ${seg.style.bg} text-white shadow-sm`}
                            title={`${seg.style.emoji} ${seg.crop}: ${(seg.weight / 1000).toFixed(1)} ton`}
                        >
                            {seg.style.emoji} {seg.crop}
                        </span>
                    ))}
                </div>

                {/* Value + Inputs */}
                <div className="mt-2 space-y-0.5 text-[10px]">
                    {silo.totalValue > 0 && (
                        <p className="text-emerald-600">
                            💰 $ {silo.totalValue.toLocaleString("en", { maximumFractionDigits: 0 })}
                        </p>
                    )}
                    {hasInputs && (
                        <p className="text-red-500">
                            🧪 Insumos: $ {silo.inputSpent.toLocaleString("en", { maximumFractionDigits: 0 })}
                        </p>
                    )}
                    {hasInputs && silo.totalValue > 0 && (
                        <p className={`font-bold ${balancePositive ? "text-emerald-700" : "text-red-600"}`}>
                            {balancePositive ? "📈" : "📉"} Saldo: $ {Math.abs(silo.balance).toLocaleString("en", { maximumFractionDigits: 0 })}
                        </p>
                    )}
                </div>

                {/* Delivery count */}
                <p className="text-[9px] text-gray-400 mt-1">
                    {silo.deliveryCount} entregas
                </p>
            </div>
        </div>
    );
}
