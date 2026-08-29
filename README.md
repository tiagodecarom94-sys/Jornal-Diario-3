# Diário de Trading

App pessoal para registrar operações de forex e acompanhar saldo em dólar, win rate e % de ganho por dia, mês e ano.

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicar no Vercel

1. Suba esta pasta para um repositório no GitHub (pode usar "Add file → Upload files" direto pelo site do GitHub).
2. No [vercel.com](https://vercel.com), clique em **Add New → Project** e selecione o repositório.
3. O Vercel detecta automaticamente que é um projeto Vite — não precisa mudar nada, é só clicar em **Deploy**.

## Sobre os dados

Os dados (operações, banca inicial, câmbio) ficam salvos no navegador (`localStorage`), separados por dispositivo/navegador. Não há backend nem banco de dados.
