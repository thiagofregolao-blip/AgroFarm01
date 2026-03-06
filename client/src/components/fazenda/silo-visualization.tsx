import { useMemo, useState } from "react";
import { X } from "lucide-react";

const CROP_COLORS: Record<string, { fill: string; label: string; emoji: string }> = {
    soja: { fill: "#c89520", label: "Soja", emoji: "🌾" },
    milho: { fill: "#dbb830", label: "Milho", emoji: "🌽" },
    trigo: { fill: "#b87030", label: "Trigo", emoji: "🌾" },
    girassol: { fill: "#d4c040", label: "Girassol", emoji: "🌻" },
    arroz: { fill: "#7da830", label: "Arroz", emoji: "🌾" },
    sorgo: { fill: "#a85830", label: "Sorgo", emoji: "🌾" },
};

function getCropColor(crop: string) {
    return CROP_COLORS[crop.toLowerCase().trim()] || { fill: "#6b8e23", label: crop, emoji: "🌱" };
}

interface CropData { crop: string; weight: number; grossWeight: number; value: number; deliveryCount: number; }
interface SiloData { buyer: string; crops: CropData[]; totalWeight: number; totalGrossWeight: number; totalValue: number; deliveryCount: number; inputSpent: number; invoiceCount: number; percentOfHarvest: number; balance: number; }
interface RomaneioItem { id: string; buyer: string; crop: string; deliveryDate: string; finalWeight: string; netWeight: string; totalValue?: string; ticketNumber?: string; plotName?: string; truckPlate?: string; source?: string; }

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
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🏭</span>
                    <h2 className="text-lg font-bold text-emerald-800">Visão de Armazém</h2>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                    <span>Colheita total: <strong className="text-emerald-700">{(totalHarvest / 1000).toFixed(1)} ton</strong></span>
                    {totalInputSpent > 0 && <span>Insumos: <strong className="text-red-600">$ {totalInputSpent.toLocaleString("en", { minimumFractionDigits: 0 })}</strong></span>}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {silos.map((silo) => (
                    <SiloCard key={silo.buyer} silo={silo} totalHarvest={totalHarvest}
                        isSelected={selectedBuyer === silo.buyer}
                        onClick={() => setSelectedBuyer(selectedBuyer === silo.buyer ? null : silo.buyer)} />
                ))}
            </div>

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
                                            <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{r.crop}</span></td>
                                            <td className="p-3">{r.plotName || "—"}</td>
                                            <td className="text-right p-3 font-mono font-semibold">{parseFloat(r.finalWeight).toLocaleString()} kg</td>
                                            <td className="text-right p-3 font-mono text-emerald-700">{r.totalValue ? `$ ${parseFloat(r.totalValue).toFixed(2)}` : "—"}</td>
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

// Helper: draw a single silo SVG (no legs, flat base, cone roof, chimney)
function drawSilo(
    uid: string,
    x: number, // left x of body
    w: number, // body width
    topY: number, // top of body
    botY: number, // bottom of body
    roofPeakY: number,
    fillPercent: number,
    cropFill: string,
    opacity: number,
    isBack: boolean,
) {
    const h = botY - topY;
    const cx = x + w / 2;
    const fillH = (fillPercent / 100) * h;
    const fillTop = botY - fillH;

    return (
        <g key={uid} opacity={opacity}>
            <defs>
                <linearGradient id={`bd-${uid}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8a9099" />
                    <stop offset="15%" stopColor="#b8c0c8" />
                    <stop offset="35%" stopColor="#d8dfe6" />
                    <stop offset="50%" stopColor="#e8eef4" />
                    <stop offset="65%" stopColor="#d8dfe6" />
                    <stop offset="85%" stopColor="#b0b8c0" />
                    <stop offset="100%" stopColor="#858d95" />
                </linearGradient>
                <linearGradient id={`rf-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#909aa5" />
                    <stop offset="30%" stopColor="#b0b8c2" />
                    <stop offset="50%" stopColor="#c5cdd5" />
                    <stop offset="70%" stopColor="#a8b0b8" />
                    <stop offset="100%" stopColor="#8a9199" />
                </linearGradient>
                <linearGradient id={`hl-${uid}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="white" stopOpacity="0" />
                    <stop offset="35%" stopColor="white" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.22" />
                    <stop offset="65%" stopColor="white" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`gn-${uid}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="black" stopOpacity="0.12" />
                    <stop offset="20%" stopColor="black" stopOpacity="0.04" />
                    <stop offset="45%" stopColor="white" stopOpacity="0.06" />
                    <stop offset="55%" stopColor="white" stopOpacity="0.03" />
                    <stop offset="80%" stopColor="black" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="black" stopOpacity="0.15" />
                </linearGradient>
                <clipPath id={`cl-${uid}`}>
                    <rect x={x} y={topY} width={w} height={h} rx="4" />
                </clipPath>
            </defs>

            {/* Body */}
            <rect x={x} y={topY} width={w} height={h} rx="4"
                fill={`url(#bd-${uid})`} stroke="#8a9199" strokeWidth="1" />

            {/* Horizontal panel lines */}
            {[0.167, 0.333, 0.5, 0.667, 0.833].map((pct, i) => (
                <line key={`h${i}`} x1={x + 1} y1={topY + h * pct} x2={x + w - 1} y2={topY + h * pct}
                    stroke="#a0a8b0" strokeWidth="0.5" opacity="0.45" />
            ))}
            {/* Vertical structural ribs */}
            {[0.2, 0.4, 0.6, 0.8].map((pct, i) => (
                <line key={`v${i}`} x1={x + w * pct} y1={topY + 1} x2={x + w * pct} y2={botY - 1}
                    stroke="#a0a8b0" strokeWidth="0.5" opacity="0.3" />
            ))}

            {/* Grain fill */}
            <g clipPath={`url(#cl-${uid})`}>
                <rect x={x} y={fillTop} width={w} height={fillH + 0.5} fill={cropFill} />
                <rect x={x} y={fillTop} width={w} height={fillH} fill={`url(#gn-${uid})`} />
                <rect x={x} y={fillTop} width={w} height="2.5" fill="white" opacity="0.18" rx="1" />
            </g>

            {/* 3D highlight */}
            <rect x={x} y={topY} width={w} height={h} rx="4" fill={`url(#hl-${uid})`} />

            {/* Base ring */}
            <rect x={x - 2} y={botY - 2} width={w + 4} height="4" rx="2" fill="#8a9199" stroke="#777" strokeWidth="0.4" />

            {/* Roof cone */}
            <polygon points={`${x - 3},${topY + 2} ${cx},${roofPeakY} ${x + w + 3},${topY + 2}`}
                fill={`url(#rf-${uid})`} stroke="#8a9199" strokeWidth="1" strokeLinejoin="round" />
            {/* Roof ridges */}
            <line x1={cx} y1={roofPeakY} x2={x + 12} y2={topY + 2} stroke="#b0b8c0" strokeWidth="0.4" opacity="0.5" />
            <line x1={cx} y1={roofPeakY} x2={x + w - 12} y2={topY + 2} stroke="#a0a8b0" strokeWidth="0.4" opacity="0.4" />
            <line x1={cx} y1={roofPeakY} x2={cx} y2={topY + 2} stroke="#b0b8c0" strokeWidth="0.4" opacity="0.4" />
            {/* Roof highlight */}
            <polygon points={`${x + 8},${topY + 2} ${cx - 2},${roofPeakY + 3} ${cx + 4},${topY + 2}`}
                fill="white" opacity="0.1" />

            {/* Chimney */}
            <rect x={cx - 4} y={roofPeakY - 8} width="8" height="10" rx="1.5"
                fill="#9aa2aa" stroke="#7a8290" strokeWidth="0.6" />
            <rect x={cx - 6} y={roofPeakY - 10} width="12" height="3" rx="1.5"
                fill="#8a9199" stroke="#6b7280" strokeWidth="0.4" />
            <rect x={cx - 2} y={roofPeakY - 7} width="2.5" height="8" rx="1" fill="white" opacity="0.12" />

            {/* Railing */}
            {!isBack && (
                <>
                    <line x1={x + 2} y1={topY} x2={x + 10} y2={topY - 8} stroke="#9aa2aa" strokeWidth="0.7" />
                    <line x1={x + w - 2} y1={topY} x2={x + w - 10} y2={topY - 8} stroke="#9aa2aa" strokeWidth="0.7" />
                    <line x1={x + 10} y1={topY - 8} x2={x + w - 10} y2={topY - 8} stroke="#9aa2aa" strokeWidth="0.5" opacity="0.5" />
                </>
            )}
        </g>
    );
}

function SiloCard({ silo, totalHarvest, isSelected, onClick }: { silo: SiloData; totalHarvest: number; isSelected: boolean; onClick: () => void }) {
    const tons = silo.totalWeight / 1000;
    const uid = silo.buyer.replace(/[^a-zA-Z0-9]/g, '_');

    const sortedCrops = useMemo(() => [...silo.crops].sort((a, b) => b.weight - a.weight), [silo.crops]);
    const cropSegments = useMemo(() => sortedCrops.map(c => ({
        ...c, percent: silo.totalWeight > 0 ? (c.weight / silo.totalWeight) * 100 : 0, color: getCropColor(c.crop),
    })), [sortedCrops, silo.totalWeight]);

    const hasInputs = silo.inputSpent > 0;

    // Split crops: primary (soja) goes to front silo, others go to back silo
    const primaryCrop = cropSegments[0]; // largest crop = front silo
    const secondaryCrops = cropSegments.slice(1);
    const hasSecondary = secondaryCrops.length > 0;
    const secondaryWeight = secondaryCrops.reduce((s, c) => s + c.weight, 0);
    const secondaryFillPct = silo.totalWeight > 0 ? Math.min(90, Math.max(10, (secondaryWeight / silo.totalWeight) * 100 * 1.5)) : 0;
    const primaryFillPct = Math.min(90, Math.max(10, (primaryCrop?.percent || 50) * 1.5));

    // SVG canvas
    const W = 160, H = 190;

    // Front silo (larger, in front-left)
    const fW = 82, fX = 10, fTop = 55, fBot = 165, fRoof = 14;
    // Back silo (smaller, to the right and slightly behind)
    const bW = 68, bX = 82, bTop = 45, bBot = 155, bRoof = 8;

    return (
        <div
            className={`group relative bg-white rounded-2xl border-2 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer
                ${isSelected ? "border-emerald-500 shadow-emerald-100 ring-2 ring-emerald-200" : "border-gray-200 hover:-translate-y-1"}`}
            onClick={onClick}
        >
            <div className="absolute top-2 right-2 z-10">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shadow-sm">
                    {silo.percentOfHarvest.toFixed(1)}%
                </span>
            </div>

            <div className="flex justify-center pt-2 pb-0">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                    {/* Ground shadow */}
                    <ellipse cx={W / 2 + 5} cy={fBot + 8} rx={65} ry="5" fill="black" opacity="0.06" />

                    {/* Back silo (secondary crops) - drawn first so it's behind */}
                    {hasSecondary && drawSilo(
                        `${uid}_back`, bX, bW, bTop, bBot, bRoof,
                        secondaryFillPct,
                        secondaryCrops[0]?.color.fill || "#dbb830",
                        0.85, true
                    )}

                    {/* Front silo (primary crop) */}
                    {drawSilo(
                        `${uid}_front`, fX, fW, fTop, fBot, fRoof,
                        primaryFillPct,
                        primaryCrop?.color.fill || "#c89520",
                        1, false
                    )}
                </svg>
            </div>

            <div className="px-3 pb-3 pt-0 text-center">
                <p className="font-bold text-sm text-gray-800 truncate mb-0.5" title={silo.buyer}>{silo.buyer}</p>
                <p className="text-xl font-extrabold text-emerald-700 leading-tight">
                    {tons < 10 ? tons.toFixed(2) : tons.toFixed(1)} <span className="text-xs font-normal text-gray-500">ton</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{silo.deliveryCount} {silo.deliveryCount === 1 ? "entrega" : "entregas"}</p>

                {/* Crop breakdown */}
                <div className="flex flex-col items-center gap-0.5 mt-2">
                    {cropSegments.map(seg => (
                        <div key={seg.crop} className="flex items-center gap-1.5 w-full justify-center">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shadow-sm flex-shrink-0" style={{ backgroundColor: seg.color.fill }} />
                            <span className="text-[11px] font-medium text-gray-700">{seg.color.emoji} {seg.crop}</span>
                            <span className="text-[10px] text-gray-500">{(seg.weight / 1000).toFixed(1)}t</span>
                            <span className="text-[9px] text-gray-400">({seg.deliveryCount}x)</span>
                        </div>
                    ))}
                </div>

                <div className="mt-2 space-y-0.5 text-[10px] border-t border-gray-100 pt-1.5">
                    {silo.totalValue > 0 && <p className="text-emerald-600 font-medium">💰 $ {silo.totalValue.toLocaleString("en", { maximumFractionDigits: 0 })}</p>}
                    {hasInputs && <p className="text-red-500">🧪 Insumos: $ {silo.inputSpent.toLocaleString("en", { maximumFractionDigits: 0 })}</p>}
                    {hasInputs && silo.totalValue > 0 && (
                        <p className={`font-bold ${silo.balance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {silo.balance >= 0 ? "📈" : "📉"} Saldo: $ {Math.abs(silo.balance).toLocaleString("en", { maximumFractionDigits: 0 })}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
