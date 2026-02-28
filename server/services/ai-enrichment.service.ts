import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function enrichProductData(
    productName: string,
    stockContext?: { quantity: string; unit: string; date: string }[]
): Promise<{
    activeIngredient: string;
    category: string;
    dosage: string;
    unit: string;
    provider: string;
    toxicologicalClass: string;
}> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    const stockInfo = stockContext && stockContext.length > 0
        ? `Histórico de uso/estoque deste agricultor (pode dar dicas sobre a unidade de medida comum):\n${stockContext.map(s => `- ${s.quantity} ${s.unit} em ${s.date}`).join('\n')}`
        : "Nenhum histórico de estoque anterior encontrado.";

    const prompt = `
Você é um Engenheiro Agrônomo especialista em defensivos agrícolas, fertilizantes e sementes no Brasil.
Seu objetivo é extrair ou enriquecer os dados técnicos de um produto agrícola a partir de seu nome.

Nome Original Recebido (pode estar com erros de digitação de notas fiscais):
"${productName}"

${stockInfo}

Você DEVE retornar APENAS um JSON estrito com as informações corrigidas e enriquecidas. Não inclua texto fora do JSON. Não inclua Markdown como \`\`\`json no início ou no fim.

As chaves do JSON (todas minúsculas em inglês, se não souber preencha com string vazia ""):
{
  "activeIngredient": "Nome do princípio ativo principal (ex: Glifosato, Azoxistrobina, N, P2O5, K2O...)",
  "category": "Escolha UMA destas e retorne EXATAMENTE como escrito: herbicida, fungicida, inseticida, fertilizante, semente, adjuvante, biologico",
  "dosage": "Dose média comercial recomendada (apenas números ou intervalos se possível, ex: 1.5, 2.0-3.0) ou 'vide bula'",
  "unit": "Unidade de medida padrão para comercialização e dosagem (retorne EXATAMENTE uma destas: L, kg, sc, dose)",
  "provider": "Nome da empresa fabricante provável (Ex: Syngenta, Bayer, UPL...)",
  "toxicologicalClass": "Classe toxicológica aproximada se aplicável (I, II, III, IV, Não Classificada, etc.)"
}
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "{}";
        const data = JSON.parse(text);

        return {
            activeIngredient: data.activeIngredient || "",
            category: data.category || "adjuvante",
            dosage: data.dosage || "",
            unit: data.unit || "L",
            provider: data.provider || "",
            toxicologicalClass: data.toxicologicalClass || "",
        };
    } catch (err) {
        console.error("AI Enrichment Error:", err);
        throw new Error("Falha ao comunicar com o modelo de inteligência artificial de enriquecimento agronegócio.");
    }
}
