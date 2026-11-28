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

## Rodada 26/11 — integração com o público
- Reações ao vivo (👏 ❤️ 🔥 😂 💡 🙌): barra no celular (slides, espera, após votar); sobem pela borda direita do telão. Limite de 1 reação a cada 1,5s por pessoa (servidor), só emojis da lista.
- Celular: tela sempre acesa (Wake Lock), vibração quando chega pergunta nova, pedido de nome antes do quiz para quem entrou sem nome, "Você votou em: …" após o voto.
- Filtro de nomes ofensivos na entrada.
- Testado em produção com evento temporário (já apagado): reações, limite, emoji inválido, filtro de nome, nome no ranking e confirmação do voto.

## Rodada 27/11 — as 7 melhorias
- Perguntas ao palestrante (atividade `qa`): até 3 perguntas por pessoa, opção sem nome, curtidas (1 por pessoa), aprovação opcional; no painel: Aprovar, Destacar (tela cheia no telão), Respondida, Ocultar. Tabelas `questions` e `question_likes`.
- Sorteio (atividade `raffle`): nomes giram ~3,6s no telão, troféu e confete; celular do ganhador fica verde e vibra (marca = sha256(token) 12 caracteres). Ganhadores gravados como respostas da atividade; ninguém ganha duas vezes; opção "só quem tem nome". Botão principal vira "Sortear agora".
- Gráfico no celular após votar (opção por pergunta, ligada por padrão).
- Quiz: acertos seguidos e pontos que faltam para o próximo lugar.
- Reações: liga/desliga por evento (`events.reactions_on`).
- Entradas: até 400 novas entradas por minuto da mesma rede e teto de 2.000 por evento (`participants.ip_hash`, IP com hash).
- Nuvem: agrupa plural/singular, acento e maiúsculas; mostra a forma mais usada (empate: singular acentuado).
- Relatório PDF e planilha incluem perguntas e sorteados.
- Tudo testado em produção com evento temporário (apagado).

### Ideias futuras
1. Ensaio de carga das reações e das curtidas com 500 pessoas.
2. Resultado do quiz por equipes.
3. Pergunta aberta (texto livre) com respostas em mural.

## Rodada 28/11 — zerar e auditoria geral
- Editor: "Zerar respostas" por atividade (rota DELETE /api/activities/[id]/responses) e "Zerar evento" no topo (ação clearEvent; também desliga o QR por cima).
- Corrigido: voltar para um quiz em andamento recomeçava da pergunta 1 (todos já tinham respondido). Agora retoma da última pergunta respondida, no ranking.
- Corrigido: dava para "revelar resposta"/"ranking" antes de iniciar a pergunta.
- Celular: posição no quiz consultada 1x por pergunta, com atraso aleatório até 1s (antes 2x, todos no mesmo instante).
- Carga testada: 300 entradas em 2s; 300 reações simultâneas (p95 0,7s, 0 falhas); 299 curtidas na mesma pergunta (p95 1,1s, todas contadas).
- Conferido: um voto por pessoa na enquete é garantido pelo banco (q_index NOT NULL + índice único).

### Oportunidades de interação (propostas, não feitas)
Botão/link no celular junto do slide; escala 0–10; mural de respostas abertas; pontos de participação no evento todo; avaliação final; antes × depois; cronômetro de dinâmica; quiz por equipes.

## Rodada 28/11 (tarde) — 8 interações novas + IA
- Novos tipos: scale (0–10), wall (mural; reaproveita a tabela questions), rating (estrelas + comentário só no relatório), timer (run: state/endsAt/left; ações timerStart/Pause/Add/Reset), leaderboard (pontos de participação: 10/resposta, 15/pergunta ou frase, + quiz).
- Slide: linkUrl/linkLabel viram botão no celular e aviso no telão.
- Enquete: compareWith (antes × depois, mesmas opções).
- Quiz: teams (2–8); participants.team; rota /api/live/[pin]/team; ranking por média de pontos por integrante.
- Sorteio: weighted (chance proporcional à participação).
- Rotas novas: /api/live/[pin]/team, /api/live/[pin]/score.
- IA no editor também para escala, mural, perguntas, avaliação e cronômetro.
- Celular: se a entrada não vale mais (evento zerado), entra de novo sozinho e reenvia (liveApi/adoptToken).
- Capa da Aula 4 corrigida ("referência").
- Testado ponta a ponta em evento temporário (apagado).
