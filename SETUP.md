# Instruções de Instalação e Configuração

## ✅ Instalação Concluída

As dependências do projeto já foram instaladas com sucesso!

## 🔧 Configuração Necessária

O arquivo `.env` já foi criado automaticamente! Você só precisa configurar o `DATABASE_URL`.

### Configurando o Banco de Dados (Escolha uma opção):

#### Opção 1: Serviço Online Gratuito (Mais Fácil - Recomendado)

1. **Neon** (https://neon.tech):
   - Crie uma conta gratuita
   - Crie um novo projeto
   - Copie a connection string
   - Cole no arquivo `.env` na variável `DATABASE_URL`

2. **Supabase** (https://supabase.com):
   - Crie uma conta gratuita
   - Crie um novo projeto
   - Vá em Settings > Database
   - Copie a connection string
   - Cole no arquivo `.env` na variável `DATABASE_URL`

#### Opção 2: Docker (Se tiver Docker instalado)

```bash
docker compose up -d
```

O `.env` já está configurado para usar o Docker.

#### Opção 3: PostgreSQL Local

Se você tem PostgreSQL instalado localmente, configure:
```env
DATABASE_URL=postgresql://postgres:sua-senha@localhost:5432/agrofarm
```

### Variáveis Já Configuradas:

✅ `SESSION_SECRET` - Já gerada automaticamente  
✅ `PORT` - Configurado para 5000  
✅ `NODE_ENV` - Configurado para development

### Variáveis Opcionais:

```env
# Porta do servidor (padrão: 5000)
PORT=5000

# Configuração de Email (para recuperação de senha)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app

# API Externa
TWELVE_DATA_API_KEY=sua-api-key-aqui

# Ambiente
NODE_ENV=development
```

## 🚀 Como Executar

1. **Configure o `DATABASE_URL` no arquivo `.env`** (veja opções acima)

2. **Configure o schema do banco de dados:**
   ```bash
   npm run db:push
   ```
   Isso criará todas as tabelas necessárias no banco.

3. **Execute o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **O aplicativo estará disponível em `http://localhost:5000`**

## 📝 Comandos Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Compila o projeto para produção
- `npm start` - Inicia o servidor em modo produção
- `npm run check` - Verifica erros de TypeScript
- `npm run db:push` - Atualiza o banco de dados com o schema

## ⚠️ Importante

- Certifique-se de ter um banco de dados PostgreSQL configurado (pode usar Neon, Supabase, ou outro provedor)
- A variável `SESSION_SECRET` deve ser uma string aleatória e segura
- Para gerar uma SESSION_SECRET, você pode usar: `openssl rand -base64 32`

