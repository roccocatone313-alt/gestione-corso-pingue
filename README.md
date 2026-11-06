# GRIFO VI — Gestione economica corso

Sito per la gestione economica del corso Grifo VI e il rendiconto della Festa del Pingue 2026.

- **Online:** https://gestione-corso-pingue.vercel.app
- **Dati:** Supabase, progetto `wqruqjlhyegythnowuvc`
- **Pubblicazione:** Vercel, automatica a ogni commit su `main`

## Pagine

| Pagina | Chi la vede | A cosa serve |
|---|---|---|
| Rendiconto (`/`) | Tutti | Resoconto da presentare a corso e comando: sintesi, copertura delle spese, fonti di finanziamento, spese per sezione con le rate, sponsor, registro di cassa, stampa/PDF |
| Sponsor (`/sponsor`) | Tutti; modifica solo il comitato | Elenco degli sponsor per stato (Prospect, In trattativa, Confermato, Incassato, Perso) |
| Inserisci (`/inserisci`) | Solo il comitato | Nuovi movimenti, sponsor e acquisti (con l'eventuale anticipo già pagato) |
| Admin (`/admin`) | Solo il comitato | Modifica ed eliminazione di movimenti, sponsor e acquisti; rate degli acquisti; export Excel e PDF |
| Accedi (`/login`) | Tutti | Accesso del comitato |

Qualsiasi altro indirizzo (anche i vecchi `/rendiconto`, `/budget`, `/esigenze`) riporta al Rendiconto.

## Accesso e permessi

Tutti possono guardare il sito senza accedere. Modifica solo chi accede con un account la cui email
è nella tabella `editori` del database (con email confermata).

Il blocco vero è nelle regole del database (RLS): chi non è editore non può inserire, modificare o
cancellare nulla, nemmeno chiamando direttamente Supabase. Il sito in più nasconde i pulsanti di
modifica e mostra un messaggio se qualcuno prova a salvare.

**Aggiungere una persona del comitato**

1. Supabase → Authentication → Users → **Add user** → **Create new user**: email, password, spunta
   **Auto Confirm User**.
2. Supabase → SQL Editor:
   ```sql
   insert into public.editori (email) values ('nome@esempio.it');
   ```

**Togliere il permesso:** `delete from public.editori where email = 'nome@esempio.it';`

**Password dimenticata:** cancellare l'utente da Authentication → Users e ricrearlo. I dati del sito
non vengono toccati.

## Cose da cambiare durante l'anno

- **Quota e paganti:** Rendiconto → riquadro *Quote allievi* → **Modifica quota e paganti** (serve
  l'accesso). Con più rate si scrive la quota totale che ogni allievo deve versare. Sono salvati nella
  tabella `impostazioni_rendiconto`.
- **Spostare una spesa in un'altra sezione:** Rendiconto → **Sposta spese**, oppure Admin → Acquisti →
  Modifica → *Sezione del rendiconto*.
- **Aggiungere una sezione:** in `src/lib/macroSezioni.js` scrivere il nome nell'elenco, prima di
  `'ALTRO'`. Vale per tutto il sito.
- **Titolo e organizzatore** mostrati in cima al Rendiconto: `src/data/rendiconto.json`.

## Come funzionano i soldi

La tabella `movimenti` è la cassa: ogni riga è un'entrata o un'uscita. Alcune righe si inseriscono a
mano (Inserisci → Movimento), altre le crea da solo il database:

- **Sponsor** in stato *Incassato* → entrata pari all'importo incassato; se l'incassato è vuoto o zero,
  vale l'importo promesso. Se lo sponsor torna a un altro stato, l'entrata viene tolta.
- **Rate di un acquisto** (Admin → Acquisti → **Pagamenti**, oppure l'anticipo in Inserisci) → ogni
  rata è un'uscita, registrata subito.
- **Acquisto** in stato *Pagato* → uscita del **saldo**, cioè il totale meno le rate già pagate.
- **Acquisto annullato** (*Rifiutato*) → il saldo viene tolto, le rate già pagate restano come spesa.
- **Acquisto eliminato** → vengono tolti il saldo, le rate e i loro movimenti.

Se manca la data di pagamento o di incasso, modificare la riga non sposta la data già registrata in
cassa. I movimenti automatici non si modificano da Admin: si modifica l'acquisto o lo sponsor.

Le entrate fatte a mano usano le categorie **Quote allievi** e **F.I.Do**, che il Rendiconto conta
nelle fonti di finanziamento. In fondo alla pagina Rendiconto c'è la spiegazione di ogni calcolo.

I totali degli sponsor sono calcolati in un solo punto, `src/lib/sponsor.js`, e sono uguali in
Rendiconto, pagina Sponsor ed export: **attesi** = sponsor confermati e incassati, cioè incassati più
da incassare; **da incassare** = quanto manca dai confermati. Gli sponsor in trattativa sono mostrati a
parte e non entrano nei conti.

## Database (Supabase)

| Tabella | Contenuto |
|---|---|
| `movimenti` | Cassa: entrate e uscite, manuali o automatiche |
| `sponsor` | Sponsor, importi promessi e incassati |
| `acquisti` | Spese, con stato e sezione del rendiconto |
| `pagamenti_acquisti` | Rate e anticipi degli acquisti |
| `impostazioni_rendiconto` | Paganti e quota per allievo (una sola riga) |
| `editori` | Email di chi può modificare |

Funzioni principali: `puo_modificare()` dice se l'utente collegato è un editore;
`ricalcola_saldo_acquisto()` tiene aggiornato il movimento di saldo; i trigger di `acquisti`,
`pagamenti_acquisti` e `sponsor` creano e aggiornano i movimenti automatici.

I due archivi di file `documenti-budget` e `documenti-esigenze` non sono più usati dal sito.

## Pubblicazione

Ogni commit sul branch `main` di GitHub viene pubblicato da Vercel in circa un minuto. Vercel ha
bisogno di due variabili d'ambiente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`vercel.json` rimanda tutti gli indirizzi a `index.html`, così funzionano anche i link diretti come
`/sponsor`.

## Sviluppo in locale

```bash
npm install
# crea .env.local con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev     # sito in locale
npm run build   # controllo che il sito compili
```

## Piano gratuito di Supabase: pausa e backup

- Un progetto gratuito va in **pausa** se per una settimana riceve poca attività. Ogni visita al sito
  conta. Prima della pausa arriva un'email di avviso; per riattivarlo: dashboard Supabase → progetto →
  **Resume project**.
- Il piano gratuito **non fa backup**: scaricare regolarmente l'Excel da Admin, di sicuro dopo la festa.

## Struttura del codice

```
src/
  pages/        Rendiconto, Sponsor, Inserisci, Admin, Login
  components/   Layout (menu), AuthProvider (accesso), SoloComitato,
                PagamentiAcquisto (rate), Modal, InfoBox
  lib/          supabase.js (client e blocco delle modifiche), auth.js,
                macroSezioni.js, formato.js (importi e date), dateCassa.js,
                export.js (Excel e PDF)
  data/         rendiconto.json (titolo e organizzatore)
```
