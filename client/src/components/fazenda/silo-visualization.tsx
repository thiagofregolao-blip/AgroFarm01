import { useMemo, useState } from "react";
import { X } from "lucide-react";

// Crop colors for silo fill
const CROP_COLORS: Record<string, { fill: string; label: string; emoji: string }> = {
    soja: { fill: "#d4a017", label: "Soja", emoji: "🌾" },
    milho: { fill: "#e6c422", label: "Milho", emoji: "🌽" },
    trigo: { fill: "#c87533", label: "Trigo", emoji: "🌾" },
    girassol: { fill: "#e8d44d", label: "Girassol", emoji: "🌻" },
    arroz: { fill: "#8db600", label: "Arroz", emoji: "🌾" },
};

function getCropColor(crop: string) {
    return CROP_COLORS[crop.toLowerCase().trim()] || { fill: "#6b8e23", label: crop, emoji: "🌱" };
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

interface RomaneioItem {
    id: string;
    buyer: string;
    crop: string;
    deliveryDate: string;
    finalWeight: string;
    netWeight: string;
    totalValue?: string;
    ticketNumber?: string;
    plotName?: string;
    truckPlate?: string;
    source?: string;
}

interface SiloVisualizationProps {
    silos: SiloData[];
    totalHarvest: number;
    totalValue: number;
    totalInputSpent: number;
    romaneios?: RomaneioItem[];
}

export default function SiloVisualization({ silos, totalHarvest, totalValue, totalInputSpent, romaneios = [] }: SiloVisualizationProps) {
    const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null);

    if (!silos || silos.length === 0) return null;

    const selectedSilo = silos.find(s => s.buyer === selectedBuyer);
    const selectedRomaneios = romaneios.filter(r => r.buyer === selectedBuyer);

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {silos.map((silo) => (
                    <SiloCard
                        key={silo.buyer}
                        silo={silo}
                        totalHarvest={totalHarvest}
                        isSelected={selectedBuyer === silo.buyer}
                        onClick={() => setSelectedBuyer(selectedBuyer === silo.buyer ? null : silo.buyer)}
                    />
                ))}
            </div>

            {/* Romaneios Detail Panel */}
            {selectedBuyer && selectedSilo && (
                <div className="bg-white rounded-xl border border-emerald-200 shadow-md overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
                        <div>
                            <h3 className="font-bold text-emerald-800">{selectedSilo.buyer}</h3>
                            <p className="text-xs text-gray-500">{selectedSilo.deliveryCount} entregas • {(selectedSilo.totalWeight / 1000).toFixed(2)} ton</p>
                        </div>
                        <button onClick={() => setSelectedBuyer(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <X className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>
                    {selectedRomaneios.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="text-left p-3 font-medium">Data</th>
                                        <th className="text-left p-3 font-medium">Cultura</th>
                                        <th className="text-left p-3 font-medium">Talhão</th>
                                        <th className="text-right p-3 font-medium">Peso Final</th>
                                        <th className="text-right p-3 font-medium">Valor</th>
                                        <th className="text-left p-3 font-medium">Ticket</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRomaneios.map((r) => (
                                        <tr key={r.id} className="border-t border-gray-50 hover:bg-emerald-50/30">
                                            <td className="p-3">{new Date(r.deliveryDate).toLocaleDateString("pt-BR")}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{r.crop}</span>
                                            </td>
                                            <td className="p-3">{r.plotName || "—"}</td>
                                            <td className="text-right p-3 font-mono font-semibold">{parseFloat(r.finalWeight).toLocaleString()} kg</td>
                                            <td className="text-right p-3 font-mono text-emerald-700">
                                                {r.totalValue ? `$ ${parseFloat(r.totalValue).toFixed(2)}` : "—"}
                                            </td>
                                            <td className="p-3 text-gray-500">{r.ticketNumber || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400 text-sm">Nenhum romaneio detalhado disponível para este silo.</div>
                    )}
                </div>
            )}
        </div>
    );
}

function SiloCard({ silo, totalHarvest, isSelected, onClick }: { silo: SiloData; totalHarvest: number; isSelected: boolean; onClick: () => void }) {
    const fillPercent = Math.min(95, Math.max(8, silo.percentOfHarvest * 1.5));
    const tons = silo.totalWeight / 1000;

    const sortedCrops = useMemo(() =>
        [...silo.crops].sort((a, b) => b.weight - a.weight),
        [silo.crops]);

    const cropSegments = useMemo(() => {
        return sortedCrops.map(c => ({
            ...c,
            percent: silo.totalWeight > 0 ? (c.weight / silo.totalWeight) * 100 : 0,
            color: getCropColor(c.crop),
        }));
    }, [sortedCrops, silo.totalWeight]);

    const hasInputs = silo.inputSpent > 0;

    // SVG Silo dimensions
    const W = 120;
    const H = 180;
    const bodyX = 15;
    const bodyW = W - 30; // 90
    const bodyTop = 55;
    const bodyBottom = 155;
    const bodyH = bodyBottom - bodyTop; // 100
    const roofPeakY = 12;
    const roofBaseY = bodyTop;
    const cx = W / 2;

    // Fill height from bottom
    const fillH = (fillPercent / 100) * bodyH;
    const fillTop = bodyBottom - fillH;

    return (
        <div
            className={`group relative bg-white rounded-2xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer
                ${isSelected ? "border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-200" : "border-gray-200 hover:-translate-y-1"}`}
            onClick={onClick}
        >
            {/* Percentage badge */}
            <div className="absolute top-2 right-2 z-10">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shadow-sm">
                    {silo.percentOfHarvest.toFixed(1)}%
                </span>
            </div>

            {/* SVG Silo */}
            <div className="flex justify-center pt-3 pb-1">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="drop-shadow-sm">
                    <defs>
                        {/* Metal gradient for body */}
                        <linearGradient id={`metal-${silo.buyer}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#b0b8c0" />
                            <stop offset="20%" stopColor="#d4dbe2" />
                            <stop offset="40%" stopColor="#e8edf2" />
                            <stop offset="60%" stopColor="#d4dbe2" />
                            <stop offset="80%" stopColor="#b8c0c8" />
                            <stop offset="100%" stopColor="#a0a8b0" />
                        </linearGradient>
                        {/* Roof gradient */}
                        <linearGradient id={`roof-${silo.buyer}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8a9199" />
                            <stop offset="50%" stopColor="#a8b0b8" />
                            <stop offset="100%" stopColor="#c0c8d0" />
                        </linearGradient>
                        {/* Clip for fill inside body */}
                        <clipPath id={`body-clip-${silo.buyer}`}>
                            <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx="3" />
                        </clipPath>
                    </defs>

                    {/* === ROOF (Cone) === */}
                    <polygon
                        points={`${bodyX},${roofBaseY} ${cx},${roofPeakY} ${bodyX + bodyW},${roofBaseY}`}
                        fill={`url(#roof-${silo.buyer})`}
                        stroke="#7a8290"
                        strokeWidth="1.2"
                    />
                    {/* Roof ridge lines */}
                    <line x1={cx} y1={roofPeakY} x2={bodyX + 10} y2={roofBaseY} stroke="#9aa2aa" strokeWidth="0.5" opacity="0.6" />
                    <line x1={cx} y1={roofPeakY} x2={bodyX + bodyW - 10} y2={roofBaseY} stroke="#9aa2aa" strokeWidth="0.5" opacity="0.6" />
                    <line x1={cx} y1={roofPeakY} x2={cx} y2={roofBaseY} stroke="#9aa2aa" strokeWidth="0.5" opacity="0.6" />

                    {/* Chimney/vent on top */}
                    <rect x={cx - 4} y={roofPeakY - 8} width="8" height="10" rx="1" fill="#6b7280" stroke="#555" strokeWidth="0.5" />
                    <line x1={cx - 6} y1={roofPeakY - 8} x2={cx + 6} y2={roofPeakY - 8} stroke="#555" strokeWidth="1" />

                    {/* === BODY (Cylinder) === */}
                    <rect
                        x={bodyX}
                        y={bodyTop}
                        width={bodyW}
                        height={bodyH}
                        rx="3"
                        fill={`url(#metal-${silo.buyer})`}
                        stroke="#8a9199"
                        strokeWidth="1.2"
                    />

                    {/* Horizontal panel lines (metal sheets) */}
                    {[0.2, 0.4, 0.6, 0.8].map((pct, i) => (
                        <line
                            key={i}
                            x1={bodyX}
                            y1={bodyTop + bodyH * pct}
                            x2={bodyX + bodyW}
                            y2={bodyTop + bodyH * pct}
                            stroke="#9aa2aa"
                            strokeWidth="0.6"
                            opacity="0.5"
                        />
                    ))}

                    {/* Vertical structural lines */}
                    {[0.33, 0.66].map((pct, i) => (
                        <line
                            key={i}
                            x1={bodyX + bodyW * pct}
                            y1={bodyTop}
                            x2={bodyX + bodyW * pct}
                            y2={bodyBottom}
                            stroke="#9aa2aa"
                            strokeWidth="0.4"
                            opacity="0.4"
                        />
                    ))}

                    {/* === GRAIN FILL (clipped inside body) === */}
                    <g clipPath={`url(#body-clip-${silo.buyer})`}>
                        {(() => {
                            let currentY = bodyBottom;
                            return cropSegments.map((seg) => {
                                const segH = (seg.percent / 100) * fillH;
                                const y = currentY - segH;
                                currentY = y;
                                return (
                                    <rect
                                        key={seg.crop}
                                        x={bodyX}
                                        y={y}
                                        width={bodyW}
                                        height={segH}
                                        fill={seg.color.fill}
                                        opacity="0.85"
                                    />
                                );
                            });
                        })()}
                        {/* Grain texture overlay */}
                        <rect x={bodyX} y={fillTop} width={bodyW} height={fillH} fill="url(#grain-pattern)" opacity="0.15" />
                        {/* Top surface shine */}
                        <rect x={bodyX} y={fillTop} width={bodyW} height="3" fill="white" opacity="0.25" rx="1" />
                    </g>

                    {/* === BASE === */}
                    <rect x={bodyX - 3} y={bodyBottom} width={bodyW + 6} height="6" rx="2" fill="#7a8290" stroke="#666" strokeWidth="0.5" />

                    {/* Legs */}
                    <line x1={bodyX + 8} y1={bodyBottom + 6} x2={bodyX + 5} y2={bodyBottom + 18} stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1={bodyX + bodyW - 8} y1={bodyBottom + 6} x2={bodyX + bodyW - 5} y2={bodyBottom + 18} stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1={cx} y1={bodyBottom + 6} x2={cx} y2={bodyBottom + 18} stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />

                    {/* Railing on roof */}
                    <line x1={bodyX + 2} y1={roofBaseY - 2} x2={bodyX + 12} y2={roofBaseY - 12} stroke="#8a9199" strokeWidth="0.8" />
                    <line x1={bodyX + bodyW - 2} y1={roofBaseY - 2} x2={bodyX + bodyW - 12} y2={roofBaseY - 12} stroke="#8a9199" strokeWidth="0.8" />
                </svg>
            </div>

            {/* Info section */}
            <div className="px-3 pb-3 pt-0 text-center">
                <p className="font-bold text-xs text-gray-800 truncate mb-0.5" title={silo.buyer}>
                    {silo.buyer}
                </p>
                <p className="text-lg font-extrabold text-emerald-700 leading-tight">
                    {tons < 10 ? tons.toFixed(2) : tons.toFixed(1)} <span className="text-xs font-normal text-gray-500">ton</span>
                </p>

                {/* Crop legend */}
                <div className="flex justify-center gap-1 mt-1 flex-wrap">
                    {cropSegments.map(seg => (
                        <span
                            key={seg.crop}
                            className="px-1.5 py-0 rounded text-[9px] font-semibold text-white shadow-sm"
                            style={{ backgroundColor: seg.color.fill }}
                            title={`${seg.color.emoji} ${seg.crop}: ${(seg.weight / 1000).toFixed(1)} ton`}
                        >
                            {seg.color.emoji} {seg.crop}
                        </span>
                    ))}
                </div>

                {/* Value + Inputs */}
                <div className="mt-1.5 space-y-0.5 text-[10px]">
                    {silo.totalValue > 0 && (
                        <p className="text-emerald-600">💰 $ {silo.totalValue.toLocaleString("en", { maximumFractionDigits: 0 })}</p>
                    )}
                    {hasInputs && (
                        <p className="text-red-500">🧪 Insumos: $ {silo.inputSpent.toLocaleString("en", { maximumFractionDigits: 0 })}</p>
                    )}
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">{silo.deliveryCount} entregas</p>
            </div>
        </div>
    );
}
