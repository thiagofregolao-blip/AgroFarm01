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
}

export function generateReceituarioPDF(data: ReceituarioData): Blob {
  const doc = new jsPDF();

  // Cores
  const primaryColor: [number, number, number] = [34, 139, 34]; // Verde esmeralda
  const secondaryColor: [number, number, number] = [107, 114, 128]; // Cinza

  // Cabeçalho
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RECEITUÁRIO AGRONÔMICO", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Recomendação de Aplicação", 105, 30, { align: "center" });

  // Informações gerais
  let yPos = 50;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Propriedade:", 20, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.propertyName, 60, yPos);

  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Data/Hora:", 20, yPos);
  doc.setFont("helvetica", "normal");
  const dateStr = data.appliedAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(dateStr, 60, yPos);

  if (data.instructions) {
    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Instruções:", 20, yPos);
    doc.setFont("helvetica", "normal");
    const instructionsLines = doc.splitTextToSize(data.instructions, 170);
    doc.text(instructionsLines, 20, yPos + 5);
    yPos += instructionsLines.length * 5 + 5;
  }

  // Organizar dados por talhão
  const plotsMap = new Map<string, Array<{ productName: string; dosePerHa?: number; unit: string; quantity: number }>>();

  data.products.forEach(product => {
    product.plots.forEach(plot => {
      if (!plotsMap.has(plot.plotName)) {
        plotsMap.set(plot.plotName, []);
      }
      plotsMap.get(plot.plotName)!.push({
        productName: product.productName,
        dosePerHa: product.dosePerHa,
        unit: product.unit,
        quantity: plot.quantity,
      });
    });
  });

  // Gerar tabela por talhão
  yPos += 10;

  plotsMap.forEach((products, plotName) => {
    // Verificar se precisa de nova página
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Título do talhão
    doc.setFillColor(240, 253, 244); // Verde claro
    doc.rect(20, yPos - 5, 170, 8, "F");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text(`TALHÃO: ${plotName}`, 25, yPos + 2);

    yPos += 12;

    // Tabela de produtos para este talhão
    const tableData = products.map(p => [
      p.productName,
      p.dosePerHa ? `${p.dosePerHa.toFixed(2)} ${p.unit}/ha` : "—",
      `${p.quantity.toFixed(2)} ${p.unit}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Produto", "Dose Recomendada", "Quantidade"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: "center" },
        2: { cellWidth: 40, halign: "center" },
      },
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text(
      `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString("pt-BR")}`,
      105,
      285,
      { align: "center" }
    );
  }

  // Converter para Blob
  const pdfBlob = doc.output("blob");
  return pdfBlob;
}

export function shareViaWhatsApp(pdfBlob: Blob, message: string): void {
  // Primeiro, fazer download do PDF
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = pdfUrl;
  const filename = `receituario-${new Date().toISOString().split("T")[0]}.pdf`;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Mensagem formatada para WhatsApp (sem anexo, pois WhatsApp Web não suporta)
  const whatsappMessage = encodeURIComponent(
    `${message}\n\n📄 Receituário: O arquivo PDF foi baixado. Por favor, anexe-o manualmente ao enviar esta mensagem.`
  );

  // Abrir WhatsApp Web/App
  const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
  window.open(whatsappUrl, "_blank");

  // Limpar URL após um tempo
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
