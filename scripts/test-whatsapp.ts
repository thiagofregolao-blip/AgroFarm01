
import fetch from "node-fetch";

const PORT = 5001; // Alterar se o servidor estiver em outra porta

async function testWhatsapp(phone: string, message: string) {
    const url = `http://localhost:${PORT}/api/whatsapp/webhook`;

    console.log(`📡 Enviando mensagem simulada para ${url}`);
    console.log(`📱 Telefone: ${phone}`);
    console.log(`💬 Mensagem: "${message}"`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                phone: phone,
                message: message,
                messageId: "test-msg-" + Date.now(),
                timestamp: Math.floor(Date.now() / 1000),
                instanceId: "test-instance",
            }),
        });

        const data = await response.json();
        console.log("✅ Resposta do servidor:", data);
    } catch (error) {
        console.error("❌ Erro ao enviar:", error);
    }
}

// Pega argumentos da linha de comando
const phone = process.argv[2] || "5511999999999";
const message = process.argv[3] || "Qual meu estoque?";

if (process.argv.length < 3) {
    console.log("\n⚠️  Uso: tsx scripts/test-whatsapp.ts <TELEFONE> \"<MENSAGEM>\"");
    console.log(`   Exemplo: tsx scripts/test-whatsapp.ts 5543999999999 "quanto gastei com diesel?"\n`);
    console.log(`   Executando com valores padrão...\n`);
}

testWhatsapp(phone, message);
