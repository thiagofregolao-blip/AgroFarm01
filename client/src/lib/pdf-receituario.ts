import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReceituarioData {
  propertyName: string;
  appliedAt: Date;
  instructions?: string;
  products: Array<{
    productName: string;
    dosePerHa?: number;
    unit: string;
    plots: Array<{
      plotName: string;
      quantity: number;
    }>;
  }>;
  plots?: Array<{
    plotName: string;
    areaHa: number;
    crop?: string;
    coordinates?: string;
  }>;
  equipment?: {
    name: string;
    tankCapacityL?: number;
  };
  flowRateLha?: number;
}

// Formata número no padrão brasileiro
function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function generateReceituarioPDF(data: ReceituarioData): Blob {
  const doc = new jsPDF();
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ===== HEADER =====
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Recomendação de Produtos", margin, 18);

  doc.setFontSize(13);
  doc.text("Nova Prescrição", margin, 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);

  const dateStr = data.appliedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  doc.text(dateStr, margin, 33);

  // Property + crop info
  const firstPlot = data.plots?.[0];
  const crop = firstPlot?.crop || "";
  const infoLine = [data.propertyName, crop ? `Cultura: ${crop}` : ""].filter(Boolean).join(" • ");
  doc.text(infoLine, margin, 38);

  let yPos = 45;

  // ===== ÁREAS SECTION =====
  const totalArea = data.plots?.reduce((sum, p) => sum + p.areaHa, 0) || 0;

  if (data.plots && data.plots.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`ÁREAS (${fmtNum(totalArea)} de ${fmtNum(totalArea)} ha)`, margin, yPos);
    yPos += 3;

    const areasBody = data.plots.map(p => [
      data.propertyName,
      p.plotName,
      `${fmtNum(p.areaHa)} ha`,
      `${fmtNum(p.areaHa)} ha`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Região", "Área", "Área a Aplicar", "Área Total"]],
      body: areasBody,
      theme: "plain",
      headStyles: { fontStyle: "bold", textColor: [0, 0, 0], fontSize: 9, cellPadding: 2 },
      styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.3 },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== PRODUTOS SECTION =====
  const hasCalda = data.equipment?.tankCapacityL && data.flowRateLha;
  const tankCapacity = data.equipment?.tankCapacityL || 0;
  const flowRate = data.flowRateLha || 0;
  const caldaTotal = flowRate * totalArea;
  const tanques = tankCapacity > 0 ? caldaTotal / tankCapacity : 0;
  const tanquesCheios = Math.floor(tanques);

  // Count total products
  const totalProducts = data.products.length;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`PRODUTOS (${totalProducts} produto${totalProducts !== 1 ? "s" : ""})`, margin, yPos);
  yPos += 3;

  if (hasCalda) {
    // Full table with tank calculations
    const productRows = data.products.map((p, i) => {
      const dose = p.dosePerHa || 0;
      const qtdTotal = dose * totalArea;
      const qtdPorTanque = tanques > 0 ? qtdTotal / tanques : qtdTotal;
      const qtdUltimoTanque = qtdTotal - (tanquesCheios * qtdPorTanque);

      return [
        String(i + 1),
        p.productName,
        dose > 0 ? `${fmtNum(dose)} (${p.unit}/ha)` : "—",
        `${fmtNum(qtdTotal, 3)} ${p.unit}`,
        `${fmtNum(qtdPorTanque)} ${p.unit}`,
        `${fmtNum(Math.max(0, qtdUltimoTanque), 3)} ${p.unit}`,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["Ordem", "Produto", "Dose", "Quantidade\nTotal", "Quantidade\npor tanque", "Último\ntanque"]],
      body: productRows,
      theme: "plain",
      headStyles: { fontStyle: "bold", textColor: [0, 0, 0], fontSize: 8, cellPadding: 2 },
      styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.3 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 35 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 30, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
  } else {
    // Simple table without tank calculations
    const productRows = data.products.map((p, i) => {
      const totalQty = p.plots.reduce((sum, pl) => sum + pl.quantity, 0);
      return [
        String(i + 1),
        p.productName,
        p.dosePerHa ? `${fmtNum(p.dosePerHa)} (${p.unit}/ha)` : "—",
        `${fmtNum(totalQty)} ${p.unit}`,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["Ordem", "Produto", "Dose", "Quantidade Total"]],
      body: productRows,
      theme: "plain",
      headStyles: { fontStyle: "bold", textColor: [0, 0, 0], fontSize: 9, cellPadding: 2 },
      styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.3 },
      columnStyles: {
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: 40 },
        3: { cellWidth: 45, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
  }

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // ===== CALDA SECTION (only if equipment + flow rate) =====
  if (hasCalda) {
    const caldaUltimoTanque = (tanques - tanquesCheios) * tankCapacity;

    // Left column
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Vazão", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtNum(flowRate)} L/ha`, margin, yPos + 5);

    // Center column
    doc.setFont("helvetica", "bold");
    doc.text("Quantidade Total da Calda", margin + 55, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtNum(caldaTotal)} L`, margin + 55, yPos + 5);

    yPos += 14;

    // Bottom row
    doc.setFont("helvetica", "bold");
    doc.text("Capacidade do Tanque", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtNum(tankCapacity)} L`, margin, yPos + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Tanques Necessários", margin + 55, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtNum(tanques, 3)}`, margin + 55, yPos + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Quantidade no Último Tanque", margin + 110, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${fmtNum(caldaUltimoTanque)} L`, margin + 110, yPos + 5);

    yPos += 12;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
  }

  // ===== COMENTÁRIOS =====
  if (data.instructions) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Comentários", margin, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const instrLines = doc.splitTextToSize(data.instructions, contentWidth);
    doc.text(instrLines, margin, yPos);
    yPos += instrLines.length * 4 + 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
  }

  // ===== ASSINATURAS =====
  if (yPos > 240) {
    doc.addPage();
    yPos = 30;
  }

  const sigY = Math.max(yPos + 20, 240);
  const sigWidth = 70;

  // Left signature
  doc.setDrawColor(0, 0, 0);
  doc.line(margin + 10, sigY, margin + 10 + sigWidth, sigY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("Responsável Técnico", margin + 10 + sigWidth / 2, sigY + 5, { align: "center" });

  // Right signature
  doc.line(pageWidth - margin - 10 - sigWidth, sigY, pageWidth - margin - 10, sigY);
  doc.text("Agricultor", pageWidth - margin - 10 - sigWidth / 2, sigY + 5, { align: "center" });

  // ===== PAGE 2: MAP (if coordinates available) =====
  const plotsWithCoords = (data.plots || []).filter(p => p.coordinates);
  if (plotsWithCoords.length > 0) {
    doc.addPage();

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Recomendação de Produtos", margin, 18);
    doc.setFontSize(13);
    doc.text("Nova Prescrição", margin, 26);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(dateStr, margin, 33);
    doc.text(infoLine, margin, 38);

    // Draw map
    let mapY = 50;
    const mapHeight = 180;
    const mapWidth = contentWidth;

    // Parse all coordinates and find bounding box
    let allPoints: Array<{ lat: number; lng: number; plotIndex: number }> = [];
    plotsWithCoords.forEach((plot, idx) => {
      try {
        const coords = JSON.parse(plot.coordinates!);
        if (Array.isArray(coords)) {
          coords.forEach((c: any) => {
            allPoints.push({ lat: c.lat, lng: c.lng, plotIndex: idx });
          });
        }
      } catch {}
    });

    if (allPoints.length > 0) {
      const minLat = Math.min(...allPoints.map(p => p.lat));
      const maxLat = Math.max(...allPoints.map(p => p.lat));
      const minLng = Math.min(...allPoints.map(p => p.lng));
      const maxLng = Math.max(...allPoints.map(p => p.lng));

      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;

      // Colors for different plots
      const plotColors: Array<[number, number, number]> = [
        [180, 180, 180], [150, 150, 150], [120, 120, 120],
        [200, 200, 200], [160, 160, 160],
      ];

      plotsWithCoords.forEach((plot, idx) => {
        try {
          const coords = JSON.parse(plot.coordinates!);
          if (!Array.isArray(coords) || coords.length < 3) return;

          const color = plotColors[idx % plotColors.length];
          doc.setFillColor(...color);
          doc.setDrawColor(80, 80, 80);
          doc.setLineWidth(0.5);

          // Convert coordinates to page positions
          const points = coords.map((c: any) => ({
            x: margin + ((c.lng - minLng) / lngRange) * mapWidth,
            y: mapY + mapHeight - ((c.lat - minLat) / latRange) * mapHeight,
          }));

          // Draw polygon using lines
          doc.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            doc.lineTo(points[i].x, points[i].y);
          }
          doc.lineTo(points[0].x, points[0].y);
          doc.fill();

          // Label
          const centX = points.reduce((s: number, p: any) => s + p.x, 0) / points.length;
          const centY = points.reduce((s: number, p: any) => s + p.y, 0) / points.length;
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(plot.plotName, centX, centY, { align: "center" });
        } catch {}
      });
    }
  }

  // ===== FOOTER (all pages) =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `AgroFarm Digital - Gerado em ${new Date().toLocaleString("pt-BR")} - Página ${i} de ${pageCount}`,
      105, 290, { align: "center" }
    );
  }

  return doc.output("blob");
}

export function shareViaWhatsApp(pdfBlob: Blob, message: string): void {
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = pdfUrl;
  const filename = `receituario-${new Date().toISOString().split("T")[0]}.pdf`;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  const whatsappMessage = encodeURIComponent(
    `${message}\n\n📄 Receituário: O arquivo PDF foi baixado. Por favor, anexe-o manualmente ao enviar esta mensagem.`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
  window.open(whatsappUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
}

export function downloadPDF(pdfBlob: Blob, filename?: string): void {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `receituario-${new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function openPDF(pdfBlob: Blob): void {
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
