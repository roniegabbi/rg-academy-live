# RG Academy Live: onde paramos (26/11/2026)

## Pronto
- Protótipo visual (aprovado): https://claude.ai/artifact/4QNHk7JJ5px8rL7JH9aMM4
- Banco Neon: projeto `rg-academy-live` (id `silent-dust-36535150`, região aws-sa-east-1, Postgres 18).
  Tabelas: users, events, activities, participants, responses, images.
- Código completo do app (Next.js 15, JavaScript) nesta pasta.
  Sintaxe verificada; consultas do gráfico, quiz e ranking testadas no banco.

## Falta
1. Criar o repositório privado `roniegabbi/rg-academy-live` no GitHub (clique do usuário em "Create repository").
2. Enviar este código para o repositório (git push).
3. Importar o repositório na Vercel (equipe roniegabbi74-4301's projects, plano Hobby), região gru1, com as variáveis:
   - DATABASE_URL: string de conexão "pooler" do Neon (pegar com get_connection_string)
   - SESSION_SECRET: chave aleatória de 64 caracteres hex (gerada nesta sessão)
   - SIGNUP_CODE: código de convite (guardado com o responsável)
   Observação: o conector da Vercel recusa criar projetos (403), então a importação é pelo painel.
4. Testar o fluxo completo: cadastro, evento, controle, telão, celular, relatório, CSV.
5. Teste de carga simulando 500 participantes.
6. Antes do primeiro evento comercial: plano Vercel Pro (decisão do usuário).

## Arquitetura (resumo)
- Celulares: GET /api/live/[pin] com cache de 1s na CDN, sondagem a cada 1,5s.
- Telão: GET /api/live/[pin]/results (sem cache, 1 cliente), sondagem a cada 1s.
- Respostas: POST /api/live/[pin]/respond. O servidor valida a atividade atual, a pausa, o tempo do quiz (tolerância de 1,5s) e um voto por pessoa.
- Imagens e páginas de PDF: comprimidas no navegador, guardadas no Neon (tabela images) e servidas com cache imutável.
- PDF de slides: renderizado no navegador com pdf.js 4.10.38 via CDN jsdelivr.
- Relatório: /painel/[id]/relatorio (impressão do navegador → Salvar como PDF) e /api/events/[id]/export (CSV).
