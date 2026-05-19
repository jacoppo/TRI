# TriCalculator — CLAUDE.md

Web app statica per il calcolo dei tempi di gara nel triathlon.
Dominio: **tricalculator.app** | Deploy: **Netlify** via **GitHub**

---

## Stack Tecnico

- **Astro v4** — static site generation (`output: 'static'`)
- **TypeScript** — strict mode, per tutta la logica di calcolo
- **CSS puro** — nessun framework CSS, variabili CSS custom
- **Vanilla JS** — interattività client-side via Astro Islands (`client:load`)
- **@astrojs/partytown** — carica Google AdSense in web worker (no impatto su Core Web Vitals)
- **@astrojs/sitemap** — sitemap XML automatica per SEO
- **Deploy:** `npm run build` → `dist/` → Netlify

---

## Struttura File

```
tricalculator/
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── Calculator.astro       — island principale (client:load), form + output
│   │   ├── AdUnit.astro           — wrapper Google AdSense (dev: placeholder)
│   │   └── CookieBanner.astro     — consenso cookie GDPR
│   ├── layouts/
│   │   └── Layout.astro           — head, meta, AdSense script partytown, footer
│   ├── pages/
│   │   ├── index.astro            — homepage dashboard
│   │   └── privacy-policy.astro  — pagina privacy (obbligatoria per AdSense)
│   ├── utils/
│   │   ├── calculator.ts          — logica calcoli (Riegel, modello aerodinamico, nutrizione)
│   │   └── formatters.ts          — utility tempi (parseTimeToSeconds, formatSeconds, ecc.)
│   └── styles/
│       └── global.css             — variabili CSS, reset, tutti gli stili
├── astro.config.mjs
├── tsconfig.json
├── netlify.toml
└── package.json
```

---

## Distanze Triathlon

| Formato    | Nuoto   | Bici    | Corsa   | T1   | T2   |
|------------|---------|---------|---------|------|------|
| Sprint     | 750 m   | 20 km   | 5 km    | 2min | 1min |
| Olimpico   | 1.500 m | 40 km   | 10 km   | 2min | 1min |
| Medio 70.3 | 1.900 m | 90 km   | 21,1 km | 3min | 2min |
| Full IM    | 3.800 m | 180 km  | 42,2 km | 5min | 3min |

---

## Formule di Calcolo

### Nuoto — Formula Riegel
```
T2 = T1 * (D2 / D1) ^ 1.06
```
- Fattore acqua aperta: Sprint/Olimpico `*1.03`, Medio/Full `*1.05`
- Preferisce swim1500Time come riferimento se disponibile

### Bici — Modello Aerodinamico
```
P = (0.5 * 1.225 * 0.32 * v³) + (0.004 * (peso_kg + 8) * 9.81 * v)
```
- `v` in m/s, risolta con Newton-Raphson (50 iter, tolleranza 0.001)
- Mapping watt: Sprint/Olimpico → `bikeWatts20`, Medio → `bikeWatts90`, Full → `bikeWatts180` (o `bikeWatts90 * 0.88`)

### Corsa — Formula Riegel + Fattore Fatica Triathlon
```
T2 = T1 * (D2 / D1) ^ 1.06 * fatigueFactor
```
- Fattori: Sprint `1.03`, Olimpico `1.05`, Medio `1.08`, Full `1.13`

### Nutrizione Pre-Gara
```
CHO_min = peso_kg * 8  g/giorno
CHO_opt = peso_kg * 12 g/giorno
kcal_extra = (CHO * 4) - calorie_medie_utente
```

---

## Monetizzazione Google AdSense

- Script caricato via `@astrojs/partytown` (web worker, non blocca rendering)
- Cookie consent GDPR obbligatorio — AdSense non si carica senza consenso
- Se consenso rifiutato: annunci non personalizzati (`data-npa="1"`)
- Placeholder ID: `ca-pub-XXXXXXXXXX` / slot: `YYYYYYYYYY`
- Privacy Policy disponibile a `/privacy-policy`
- Posizioni annunci: sotto header, tra input/output, footer

---

## Palette Colori

| Variabile CSS           | Valore    | Uso                     |
|-------------------------|-----------|-------------------------|
| `--color-primary`       | `#E53E3E` | Rosso principale, CTA   |
| `--color-primary-dark`  | `#C53030` | Hover, header border    |
| `--color-bg`            | `#0F0F0F` | Sfondo pagina           |
| `--color-surface`       | `#1A1A1A` | Card, componenti        |
| `--color-surface-2`     | `#242424` | Input, righe alternate  |
| `--color-text`          | `#F5F5F5` | Testo principale        |
| `--color-text-secondary`| `#A0A0A0` | Label, testo secondario |
| `--color-border`        | `#333333` | Bordi                   |
| `--color-swim`          | `#38A169` | Fraction nuoto          |
| `--color-bike`          | `#D69E2E` | Fraction bici           |
| `--color-run`           | `#3182CE` | Fraction corsa          |

---

## Convenzioni di Codice

- Lingua UI: **italiano** per tutti i testi visibili all'utente
- Lingua codice: **inglese** per variabili, funzioni, commenti tecnici
- TypeScript: nessun `any`, tipi espliciti per tutti i parametri delle funzioni di calcolo
- Astro: componenti `.astro` per struttura/stile, logica pesante in `utils/*.ts`
- CSS: solo variabili definite in `:root`, nessun valore hardcoded ripetuto
- Nessuna dipendenza NPM oltre a quelle già dichiarate (nessun React, Vue, ecc.)
- Tutti i calcoli avvengono **client-side**, nessun dato viene inviato a server esterni

---

## Agenti Disponibili

Gli agenti sono definiti in `.claude/agents/`. Invocali con il comando `/agent <nome>` o specificando il loro ruolo in una richiesta.

| Agente          | File                            | Responsabilità                                      |
|-----------------|---------------------------------|-----------------------------------------------------|
| `coder`         | `.claude/agents/coder.md`         | Scrive e modifica codice Astro/TS/CSS                        |
| `reviewer`      | `.claude/agents/reviewer.md`      | Revisiona codice per qualità, performance, pattern           |
| `cybersecurity` | `.claude/agents/cybersecurity.md` | CSP, XSS, GDPR, sicurezza AdSense                           |
| `documentation` | `.claude/agents/documentation.md` | Documenta componenti, API utils, README                     |
| `seo`           | `.claude/agents/seo.md`           | Core Web Vitals, meta tag, sitemap, ottimizzazione AdSense  |

---

## Comandi Utili

```bash
npm run dev      # sviluppo locale su localhost:4321
npm run build    # build statica in dist/
npm run preview  # preview del build statico
npx tsc --noEmit # check TypeScript senza build
```

---

## Target Qualità

- Lighthouse Performance: **> 95**
- Lighthouse SEO: **> 95**
- Core Web Vitals: tutti **"Good"** (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- TypeScript: zero errori
- Nessun dato personale salvato o trasmesso
