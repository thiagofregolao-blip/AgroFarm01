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

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Underlined bold text helper (mimics the original PDF style)
function drawUnderlinedText(doc: jsPDF, text: string, x: number, y: number, fontSize = 10) {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(text, x, y);
  const textWidth = doc.getTextWidth(text);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(x, y + 1, x + textWidth, y + 1);
}

export function generateReceituarioPDF(data: ReceituarioData): Blob {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;

  const dateStr = data.appliedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const firstPlot = data.plots?.[0];
  const crop = firstPlot?.crop || "";
  const totalArea = data.plots?.reduce((sum, p) => sum + p.areaHa, 0) || 0;

  // ===== HEADER =====
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Recomendação de Produtos", margin, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Nova Prescrição", margin, 28);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(dateStr, margin, 35);

  // Property + crop line
  const infoLine = [data.propertyName, crop ? `Cultura: ${crop}` : ""].filter(Boolean).join(" • ");
  doc.text(infoLine, margin, 40);

  let yPos = 48;

  // ===== ÁREAS SECTION =====
  if (data.plots && data.plots.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("ÁREAS ", margin, yPos);
    const areasLabelW = doc.getTextWidth("ÁREAS ");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`(${fmtNum(totalArea)} de ${fmtNum(totalArea)} ha)`, margin + areasLabelW, yPos);
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
      theme: "grid",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      // Make "Área a Aplicar" bold
      didParseCell: (hookData: any) => {
        if (hookData.section === 'head') {
          // Underline effect for header — just bold is enough
        }
        if (hookData.section === 'body' && hookData.column.index === 2) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== PRODUTOS SECTION =====
  const hasCalda = !!(data.equipment?.tankCapacityL && data.flowRateLha);
  const tankCapacity = data.equipment?.tankCapacityL || 0;
  const flowRate = data.flowRateLha || 0;
  const caldaTotal = flowRate * totalArea;
  const tanques = tankCapacity > 0 ? caldaTotal / tankCapacity : 0;
  const tanquesCheios = Math.floor(tanques);

  const totalProducts = data.products.length;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PRODUTOS ", margin, yPos);
  const prodLabelW = doc.getTextWidth("PRODUTOS ");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(`(${totalProducts} produto${totalProducts !== 1 ? "s" : ""})`, margin + prodLabelW, yPos);
  yPos += 3;

  if (hasCalda) {
    const productRows = data.products.map((p, i) => {
      const dose = p.dosePerHa || 0;
      // If no dose, use actual quantity from plots instead of calculating from dose * area
      const qtdTotal = dose > 0 ? dose * totalArea : p.plots.reduce((sum, pl) => sum + pl.quantity, 0);
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
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 3,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: 40, halign: "left" },
        2: { cellWidth: 27, halign: "center" },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: 28, halign: "center" },
      },
      tableWidth: contentWidth,
      didDrawCell: (hookData: any) => {
        // Draw horizontal lines only (no vertical borders in body)
        const { cell, row, section } = hookData;
        if (section === "head") {
          // Bottom border for header
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.4);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        } else if (section === "body") {
          // Thin bottom border for each row
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.15);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
      },
      margin: { left: margin, right: margin },
    });
  } else {
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
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 60, halign: "left" },
        2: { cellWidth: 40, halign: "center" },
        3: { cellWidth: 42, halign: "center" },
      },
      tableWidth: contentWidth,
      didDrawCell: (hookData: any) => {
        const { cell, section } = hookData;
        if (section === "head") {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.4);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        } else if (section === "body") {
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.15);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
      },
      margin: { left: margin, right: margin },
    });
  }

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ===== CALDA SECTION =====
  if (hasCalda) {
    const caldaUltimoTanque = (tanques - tanquesCheios) * tankCapacity;

    // Row 1: Vazão + Calda Total
    drawUnderlinedText(doc, "Vazão", margin, yPos, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${fmtNum(flowRate)} L/ha`, margin, yPos + 6);

    drawUnderlinedText(doc, "Quantidade Total da Calda", margin + 60, yPos, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${fmtNum(caldaTotal)} L`, margin + 60, yPos + 6);

    yPos += 16;

    // Row 2: Capacidade + Tanques + Último Tanque
    drawUnderlinedText(doc, "Capacidade do Tanque", margin, yPos, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${fmtNum(tankCapacity)} L`, margin, yPos + 6);

    drawUnderlinedText(doc, "Tanques Necessários", margin + 60, yPos, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${fmtNum(tanques, 3)}`, margin + 60, yPos + 6);

    drawUnderlinedText(doc, "Quantidade no Último Tanque", margin + 120, yPos, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${fmtNum(caldaUltimoTanque)} L`, margin + 120, yPos + 6);

    yPos += 14;

    // Separator
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  }

  // ===== COMENTÁRIOS =====
  if (data.instructions) {
    drawUnderlinedText(doc, "Comentários", margin, yPos, 10);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const instrLines = doc.splitTextToSize(data.instructions, contentWidth);
    doc.text(instrLines, margin, yPos);
    yPos += instrLines.length * 4 + 3;

    // Separator
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
  }

  // ===== ASSINATURAS =====
  if (yPos > 230) {
    doc.addPage();
    yPos = 40;
  }

  const sigY = Math.max(yPos + 30, 245);
  const sigLineWidth = 65;

  // Left signature
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin + 15, sigY, margin + 15 + sigLineWidth, sigY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("Responsável Técnico", margin + 15 + sigLineWidth / 2, sigY + 5, { align: "center" });

  // Right signature
  doc.line(pageWidth - margin - 15 - sigLineWidth, sigY, pageWidth - margin - 15, sigY);
  doc.text("Agricultor", pageWidth - margin - 15 - sigLineWidth / 2, sigY + 5, { align: "center" });

  // ===== PAGE 2: MAP =====
  const plotsWithCoords = (data.plots || []).filter(p => {
    if (!p.coordinates) return false;
    try {
      const coords = JSON.parse(p.coordinates);
      return Array.isArray(coords) && coords.length >= 3;
    } catch {
      return false;
    }
  });

  if (plotsWithCoords.length > 0) {
    doc.addPage();

    // Repeat header on page 2
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Recomendação de Produtos", margin, 20);
    doc.setFontSize(12);
    doc.text("Nova Prescrição", margin, 28);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, margin, 35);
    doc.text(infoLine, margin, 40);

    // Map area
    const mapY = 55;
    const mapWidth = contentWidth;
    const mapHeight = 180;

    // Parse all coordinates
    const allCoords: Array<{ lat: number; lng: number }> = [];
    const plotPolygons: Array<{ coords: Array<{ lat: number; lng: number }>; name: string }> = [];

    plotsWithCoords.forEach(plot => {
      try {
        const coords = JSON.parse(plot.coordinates!);
        if (Array.isArray(coords) && coords.length >= 3) {
          plotPolygons.push({ coords, name: plot.plotName });
          coords.forEach((c: any) => allCoords.push({ lat: c.lat, lng: c.lng }));
        }
      } catch {}
    });

    if (allCoords.length > 0) {
      const minLat = Math.min(...allCoords.map(p => p.lat));
      const maxLat = Math.max(...allCoords.map(p => p.lat));
      const minLng = Math.min(...allCoords.map(p => p.lng));
      const maxLng = Math.max(...allCoords.map(p => p.lng));

      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;

      // Add padding (10%)
      const padLat = latRange * 0.1;
      const padLng = lngRange * 0.1;
      const adjMinLat = minLat - padLat;
      const adjMaxLat = maxLat + padLat;
      const adjMinLng = minLng - padLng;
      const adjMaxLng = maxLng + padLng;
      const adjLatRange = adjMaxLat - adjMinLat;
      const adjLngRange = adjMaxLng - adjMinLng;

      // Gray fills for different plots
      const fillColors: Array<[number, number, number]> = [
        [200, 200, 200], [170, 170, 170], [220, 220, 220],
        [185, 185, 185], [210, 210, 210],
      ];

      plotPolygons.forEach((polygon, idx) => {
        const color = fillColors[idx % fillColors.length];

        // Convert geo coords to page positions
        const points = polygon.coords.map(c => ({
          x: margin + ((c.lng - adjMinLng) / adjLngRange) * mapWidth,
          y: mapY + mapHeight - ((c.lat - adjMinLat) / adjLatRange) * mapHeight,
        }));

        // Draw filled polygon
        doc.setFillColor(...color);
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);

        // Build polygon path
        const firstPoint = points[0];
        let pathStr = `${firstPoint.x} ${firstPoint.y} m `;
        for (let i = 1; i < points.length; i++) {
          pathStr += `${points[i].x} ${points[i].y} l `;
        }

        // Use triangle/polygon drawing
        doc.triangle(
          points[0].x, points[0].y,
          points[1].x, points[1].y,
          points[2].x, points[2].y,
          "FD"
        );

        // Draw remaining triangles from first point to fill polygon
        for (let i = 2; i < points.length - 1; i++) {
          doc.triangle(
            points[0].x, points[0].y,
            points[i].x, points[i].y,
            points[i + 1].x, points[i + 1].y,
            "FD"
          );
        }

        // Draw outline
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.5);
        for (let i = 0; i < points.length; i++) {
          const next = points[(i + 1) % points.length];
          doc.line(points[i].x, points[i].y, next.x, next.y);
        }

        // Label at centroid
        const centX = points.reduce((s, p) => s + p.x, 0) / points.length;
        const centY = points.reduce((s, p) => s + p.y, 0) / points.length;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 30, 30);
        doc.text(polygon.name, centX, centY, { align: "center" });
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
