# RG Academy Live: onde paramos (26/11/2026, 19h30)

## No ar
- App: https://rg-academy-live.vercel.app (login do palestrante em /login)
- Código: github.com/roniegabbi/rg-academy-live (público, sem segredos) → publicação automática na Vercel
- Banco: Neon, projeto `rg-academy-live` (silent-dust-36535150, São Paulo)
- Protótipo e telas aprovadas: https://claude.ai/artifact/4QNHk7JJ5px8rL7JH9aMM4 (página "Telão — novo visual")

## Pronto e testado
- Eventos em sequência: Capa (tipográfica, aprovada) + QR code + slides (texto, imagem, PDF importado, YouTube), mapa de palavras (com emojis e moderação), múltipla escolha (gráfico), quiz competitivo (tempo de 5 a 60 s, 15 s por padrão, tempo para todas as perguntas, revelação antecipada, pódio com troféu e medalhas)
- Telão protegido (só o palestrante logado), novo visual aprovado em 8 telas, transições, controles discretos e passador de slides
- Painel do palestrante com botão único "Avançar", "A seguir", moderação de palavras e menu Mais opções
- Relatório em PDF e planilha CSV
- Ensaio de carga com 300 participantes: 0 falhas, respostas típicas em ~0,1 s

## Em andamento: "Criar com IA" (Claude Haiku 5.5 via API da Anthropic)
- Código já publicado: botão "✨ Criar quiz com IA" no quiz, sugestão de enquete e de pergunta do mapa
- Claude Console: créditos do plano Max ativados (US$ 100/mês); espaço de trabalho "RG Academy Live" criado com limite de US$ 20/mês
- FALTA:
  1. Usuário cria a chave "RG Academy Live" no espaço "RG Academy Live" (Console → Chaves de API)
  2. Usuário cola em Vercel → Environment Variables → `ANTHROPIC_API_KEY`
  3. Republicar (as variáveis novas só valem numa publicação nova) e testar a geração de um quiz de 10 perguntas

## Pendências e lembretes
- Vercel está no plano Hobby: uso comercial com clientes exige o plano Pro (decisão do usuário)
- Eventos de teste para excluir quando quiser: "Ensaio de carga (300)", "Teste de emojis", "Liderança que inspira" (vitrines)
- Próximas melhorias sugeridas: limitar entradas falsas em massa, teste com 500 participantes antes de eventos grandes
