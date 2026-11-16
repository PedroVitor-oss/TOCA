# TOCA – Backend

API simples em **Node + Express**. Os dados ficam em um arquivo JSON (`data/db.json`), sem banco.
O mesmo servidor entrega o site (`../page`), então tudo roda em **http://localhost:3000**.

## Como rodar
```bash
cd backend
npm install
npm run seed     # (opcional) cria dados de exemplo
npm start
```
Logins do seed: `joao@mail.com` (responsável) e `john@mail.com` (filho), senha `123456`.
Sem o seed, crie a conta pela própria tela de cadastro.

Teste automático da API (com o servidor ligado): `node teste.js`

## Como o site conversa com a API
- `page/js/api.js` – função `TOCA.api(caminho, { metodo, corpo })` (fetch + token no cabeçalho).
- `page/js/paginas.js` – o que cada tela faz com a API (um bloco por arquivo `.html`).
- Se abrir o site por outro servidor (Live Server etc.), ele aponta para `http://localhost:3000`.
  Para outro endereço: `<script>window.TOCA_API_URL = 'https://meu-servidor.com'</script>` antes do `api.js`.

Autenticação: `POST /api/auth/login` devolve um `token`; as demais rotas exigem `Authorization: Bearer <token>`.

## Rotas
| Área | Rota | Quem | Telas |
|---|---|---|---|
| Auth | `POST /auth/cadastro` · `POST /auth/cadastro-filho` (com código) · `POST /auth/login` · `POST /auth/logout` | todos | T02, T07 |
| Perfil | `GET/PUT/DELETE /auth/me` | todos | T32, T54 |
| Família | `GET/PUT /familia` · `PUT /familia/mesada` · `/porcentagens` · `/permissoes` · `/privacidade` · `/plano` | resp. | T03–T06, T26–T30 |
| Membros | `GET /familia/membros` · `DELETE /familia/membros/:id` | resp. | T25 |
| Mesada | `POST /familia/mesada/pagar` (divide guardar/gastar/livre) | resp. | T04 |
| Metas | `GET /metas` · `GET /metas/:id` · `POST /metas` · `PUT /metas/:id` · `POST /metas/:id/bonus` · `POST /metas/:id/concluir` | ambos | T09, T18, T19, T34, T35, T51, T52 |
| Lançamentos | `GET /lancamentos?tipo&filhoId&mes` · `GET /lancamentos/impacto?valor` · `POST` · `PUT /:id` · `DELETE /:id` | ambos | T12–T14, T36, T37, T40, T41 |
| Aprovações | `GET /aprovacoes?status` · `GET /:id` · `POST /aprovacoes` (prazo) · `PUT /:id` (motivo) · `POST /:id/decidir` | ambos | T10, T15, T16, T42 |
| Home | `GET /dashboard` | ambos | T11, T33 |
| Notificações | `GET /notificacoes` · `POST /notificacoes/lidas` · `POST /notificacoes/:id/lida` · `GET/PUT /notificacoes-config` | ambos | T55, T56 |
| Engajamento | `POST /checkin` · `GET /missoes` · `GET /conquistas` · `GET /ranking` | filho (ranking: ambos) | T44–T48 |
| Relatórios | `GET /relatorio?mes` · `GET /dicas` · `GET /exportar?formato=csv\|json` | resp. | T20, T22, T31 |
| Conteúdo | `GET /biblioteca` · `GET /biblioteca/:id` · `GET /dica-do-dia` | ambos | T23, T24, T43 |

## Regras de negócio implementadas
- Gasto do filho **acima do limite** (padrão R$ 20) fica `pendente` e cria um pedido na Central de Aprovações.
- Meta criada pelo filho nasce `pendente` e só vira `ativa` quando o responsável aprova (pode ajustar o valor).
- Saldo do filho = entradas − gastos aprovados − dinheiro guardado em metas.
- "Isso atrasa sua meta em X dias" = valor do gasto ÷ (quanto ele guarda por dia segundo a mesada e a % de guardar).
- Porcentagens precisam somar 100%. Ranking é opt-in e mostra só dias de sequência, nunca valores.
- Senhas com `scrypt`; sessão por token aleatório.

> Projeto de estudo: o arquivo JSON e o token simples não substituem banco e segurança de produção
> (HTTPS, expiração de sessão, limite de tentativas, LGPD para dados de menores).
