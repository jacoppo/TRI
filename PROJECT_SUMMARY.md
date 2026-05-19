# TriCalculator — Project Summary

**Dominio:** tricalculator.app
**Deploy:** Netlify (free tier) + GitHub
**Tipo:** Static site generato con Astro — zero JS runtime di default, massima performance
**Monetizzazione:** Google AdSense (annunci display)

---

## Obiettivo

Una single-page dashboard per triatleti che, inserendo i propri dati fisici e di performance, riceve in output:
- Il tempo stimato per ogni frazione (nuoto, bici, corsa) su tutte le distanze di triathlon
- Il tempo totale stimato a gara
- Le calorie da assumere nei giorni pre-gara (carb loading)

---

## Distanze Triathlon Supportate

| Formato    | Nuoto   | Bici    | Corsa   |
|------------|---------|---------|---------|
| Sprint     | 750 m   | 20 km   | 5 km    |
| Olimpico   | 1.500 m | 40 km   | 10 km   |
| Medio 70.3 | 1.900 m | 90 km   | 21,1 km |
| Full/IM    | 3.800 m | 180 km  | 42,2 km |

---

## Input Utente

### Dati fisici
- Peso corporeo (kg)

### Nuoto
- Tempo su 400m (mm:ss)
- Tempo su 1.500m (mm:ss) — opzionale
- Volume settimanale allenamento (km/settimana)

### Bici
- Watt medi sostenuti su 20 km (Sprint/Olimpico)
- Watt medi sostenuti su 90 km (Medio)
- Watt medi sostenuti su 180 km (Full) — opzionale
- Volume settimanale (km/settimana)

### Corsa
- Miglior tempo sui 10 km in gara (mm:ss)
- Miglior tempo sulla mezza maratona in gara (hh:mm:ss) — opzionale
- Volume settimanale (km/settimana)

### Nutrizione
- Calorie medie giornaliere (kcal)
- Output: range CHO e kcal consigliati nelle 48h pre-gara (8-12g CHO/kg)

---

## Logica di Calcolo

### Nuoto
- Formula di Riegel: `T2 = T1 * (D2/D1)^1.06`
- Fattore acqua aperta/muta: +3% Sprint/Olimpico, +5% Medio/Full

### Bici
- Modello aerodinamico: `P = 0.5 * 1.225 * 0.32 * v³ + 0.004 * (peso+8) * 9.81 * v`
- Risoluzione iterativa per v dato P (Newton-Raphson, max 50 iter)
- Watt per distanza: sprint/olimpico → watt20km, medio → watt90km, full → watt180km (o watt90km*0.88)

### Corsa
- Formula di Riegel: `T2 = T1 * (D2/D1)^1.06`
- Fattore fatica triathlon: Sprint +3%, Olimpico +5%, Medio +8%, Full +13%

### Nutrizione Pre-Gara
- CHO_min = peso_kg * 8 g/giorno
- CHO_opt = peso_kg * 12 g/giorno
- Kcal aggiuntive = CHO * 4 kcal/g delta rispetto alla media utente

---

## Stack Tecnico

- **Astro** — framework static site generation, output: `static`
- **TypeScript** — logica calcoli type-safe
- **CSS puro** — nessun framework CSS, variabili CSS per tema
- **Vanilla JS** — interattività client-side (Astro Islands con `client:load`)
- **Google Fonts** — Inter (self-hosted via Astro per performance)
- **Icone** — SVG inline

### Dipendenze
```json
{
  "astro": "^4.x",
  "@astrojs/sitemap": "per SEO",
  "@astrojs/partytown": "per Google Ads/Analytics senza bloccare il thread principale"
}
```

---

## Google AdSense — Strategia Monetizzazione

### Setup
1. Account Google AdSense approvato (richiede sito live con contenuto)
2. Script AdSense inserito via `@astrojs/partytown` (non blocca il rendering)
3. Auto Ads abilitati (Google posiziona automaticamente)
4. Unità manuali in posizioni strategiche:

### Posizionamento Annunci
| Posizione                        | Formato       | Priorità |
|----------------------------------|---------------|----------|
| Sotto l'header                   | Leaderboard   | Alta     |
| Tra sezione input e output       | Rectangle     | Alta     |
| Sidebar destra (desktop only)    | Skyscraper    | Media    |
| Sotto la tabella risultati       | Rectangle     | Alta     |
| Footer (sopra copyright)         | Leaderboard   | Media    |

### Note importanti
- `@astrojs/partytown` carica AdSense in un web worker → Core Web Vitals non impattati
- Rispettare le policy AdSense: nessun clic incentivato, contenuto di qualità
- Aggiungere `Privacy Policy` page (obbligatoria per AdSense)
- Cookie consent banner per GDPR (obbligatorio per traffico EU)

---

## Struttura File Astro

```
tricalculator/
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── InputCard.astro        — card input generica
│   │   ├── Calculator.astro       — componente interattivo principale (island)
│   │   ├── ResultsTable.astro     — tabella risultati
│   │   ├── DistanceCard.astro     — card dettaglio per distanza
│   │   ├── NutritionCard.astro    — card nutrizione
│   │   ├── AdUnit.astro           — wrapper unità pubblicitaria
│   │   └── CookieBanner.astro     — cookie consent GDPR
│   ├── layouts/
│   │   └── Layout.astro           — layout base con head, AdSense, partytown
│   ├── pages/
│   │   ├── index.astro            — homepage dashboard
│   │   └── privacy-policy.astro   — pagina privacy (richiesta da AdSense)
│   ├── utils/
│   │   ├── calculator.ts          — logica calcoli triathlon
│   │   └── formatters.ts          — utility formattazione tempi
│   └── styles/
│       └── global.css             — variabili CSS, reset, stili base
├── astro.config.mjs
├── tsconfig.json
├── netlify.toml
├── package.json
└── CLAUDE.md
```

---

## Deploy & CI/CD

1. Repository GitHub (`tricalculator-app`, pubblico o privato)
2. Netlify: `Build command: npm run build`, `Publish dir: dist`
3. Dominio custom `tricalculator.app` su Netlify DNS
4. HTTPS automatico (Let's Encrypt)
5. `netlify.toml` con security headers

---

## Palette Colori

| Ruolo           | Colore          |
|-----------------|-----------------|
| Primary/Accent  | #E53E3E (rosso) |
| Primary Dark    | #C53030         |
| Background      | #0F0F0F         |
| Surface         | #1A1A1A         |
| Surface 2       | #242424         |
| Text Primary    | #F5F5F5         |
| Text Secondary  | #A0A0A0         |
| Border          | #333333         |
| Nuoto           | #38A169         |
| Bici            | #D69E2E         |
| Corsa           | #3182CE         |

---

## SEO & Performance Target

- Lighthouse Performance: > 95
- Lighthouse SEO: > 95
- Core Web Vitals: tutti "Good" (LCP < 2.5s, CLS < 0.1, FID < 100ms)
- Title: "TriCalculator - Calcola il tuo tempo di triathlon"
- Description: "Calcola gratis il tuo tempo stimato per Sprint, Olimpico, 70.3 e Ironman in base a watt, tempi di corsa e nuoto."
- Sitemap XML generata automaticamente da `@astrojs/sitemap`
- robots.txt configurato
