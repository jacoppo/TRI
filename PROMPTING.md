# TriCalculator — Prompting Dettagliato per Sviluppo AI-Assisted

Prompt pronti all'uso per costruire tricalculator.app con Astro, passo per passo.

---

## PROMPT 1 — Setup progetto Astro

```
Crea il setup iniziale di un progetto Astro per la web app "TriCalculator" (tricalculator.app).

Requisiti:
- Astro v4 con output: 'static'
- TypeScript abilitato (strict mode)
- Integrazione @astrojs/sitemap
- Integrazione @astrojs/partytown (per caricare Google AdSense in un web worker e non impattare Core Web Vitals)
- Nessun framework UI (nessun React/Vue/Svelte)

Crea i seguenti file di configurazione:

**astro.config.mjs:**
- site: 'https://tricalculator.app'
- output: 'static'
- integrazioni: sitemap, partytown
- partytown configurato per forwarding di 'dataLayer.push' e 'gtag'

**tsconfig.json:**
- extends: astro/tsconfigs/strict
- alias path: @components, @utils, @styles

**netlify.toml:**
- Build command: npm run build
- Publish dir: dist
- Security headers: X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
- Content-Security-Policy che permette Google AdSense (pagead2.googlesyndication.com, googleads.g.doubleclick.net)
- Redirect 301 da www.tricalculator.app a tricalculator.app

**package.json:**
- Script: dev, build, preview

**public/robots.txt:**
- Allow tutte le pagine
- Sitemap: https://tricalculator.app/sitemap-index.xml
```

---

## PROMPT 2 — Layout base e integrazione AdSense

```
Crea il file src/layouts/Layout.astro per la web app TriCalculator.

Il layout deve:

**Head:**
- Meta charset, viewport
- Title e description passati come props
- Open Graph tags (og:title, og:description, og:url, og:image)
- Canonical URL
- Google Fonts: Inter (weights 400, 500, 600, 700) — usa <link rel="preconnect"> + <link rel="stylesheet">
- Script Google AdSense tramite Partytown:
  <script type="text/partytown" async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX" crossorigin="anonymous"></script>
  (usa ca-pub-XXXXXXXXXX come placeholder)
- Link al file global.css

**Body:**
- Slot per il contenuto della pagina
- CookieBanner component (per GDPR)
- Footer con copyright "© 2025 TriCalculator. Tutti i diritti riservati." e link a Privacy Policy

**Props TypeScript:**
interface Props {
  title?: string;
  description?: string;
  canonicalUrl?: string;
}

Default title: "TriCalculator - Calcola il tuo tempo di triathlon"
Default description: "Calcola gratis il tuo tempo stimato per Sprint, Olimpico, 70.3 e Ironman."
```

---

## PROMPT 3 — CSS globale e tema

```
Crea il file src/styles/global.css completo per TriCalculator.

**Variabili CSS:**
:root {
  --color-primary: #E53E3E;
  --color-primary-dark: #C53030;
  --color-primary-light: #FC8181;
  --color-bg: #0F0F0F;
  --color-surface: #1A1A1A;
  --color-surface-2: #242424;
  --color-text: #F5F5F5;
  --color-text-secondary: #A0A0A0;
  --color-border: #333333;
  --color-swim: #38A169;
  --color-bike: #D69E2E;
  --color-run: #3182CE;
  --radius-md: 12px;
  --radius-sm: 8px;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.3);
}

**Reset e base:**
- Box-sizing border-box globale
- Margin/padding reset
- Font-family: 'Inter', system-ui, sans-serif
- Background: var(--color-bg), color: var(--color-text)
- Smooth scroll

**Layout dashboard:**
- .container: max-width 1400px, margin auto, padding 0 1.5rem
- .dashboard-grid: CSS Grid 2 colonne (minmax(380px,40%) 1fr), gap 2rem
- Su < 900px: colonna singola

**Card:**
- .card: background surface, border 1px solid border, border-radius radius-md, padding 1.5rem, shadow-card
- .card-title: font-size 1rem, font-weight 600, padding-bottom 0.75rem, border-bottom 2px solid primary, margin-bottom 1.25rem
- .card-title svg: colore primary, vertical-align middle

**Form elements:**
- .form-group: margin-bottom 1rem
- label: display block, font-size 0.875rem, color text-secondary, margin-bottom 0.375rem
- input[type=number], input[type=text]: width 100%, background surface-2, border 1px solid border, border-radius radius-sm, padding 0.625rem 0.75rem, color text, font-size 1rem, min-height 44px
- input:focus: border-color primary, outline none, box-shadow 0 0 0 2px rgba(229,62,62,0.2)
- .unit: font-size 0.875rem, color text-secondary, margin-left 0.5rem

**Tabella risultati:**
- border-collapse collapse, width 100%
- th: background primary-dark, color white, padding 0.75rem 1rem, text-align left, font-size 0.875rem
- td: padding 0.75rem 1rem, border-bottom 1px solid border, font-size 0.9rem
- tr:nth-child(even) td: background surface-2
- tr:hover td: background rgba(229,62,62,0.05)
- .td-total: font-weight 700, color primary, font-family monospace
- .td-time: font-family monospace

**Progress bars:**
- .progress-container: display flex, gap 4px, height 8px, border-radius 4px, overflow hidden
- .progress-swim: background swim
- .progress-bike: background bike
- .progress-run: background run
- Transizione width: 0.4s ease

**Ad units:**
- .ad-unit: width 100%, min-height 90px, background surface-2, border 1px dashed border, border-radius radius-sm, display flex, align-items center, justify-content center
- .ad-unit::before: content "Pubblicità", font-size 0.75rem, color text-secondary

**Header:**
- background surface, border-bottom 2px solid primary, padding 1rem 0
- .logo: font-size 1.75rem, font-weight 800, letter-spacing -0.5px
- .logo span.tri: color primary
- .tagline: font-size 0.875rem, color text-secondary

**Responsive mobile (< 768px):**
- .dashboard-grid: 1 colonna
- Tabella: overflow-x auto, display block
- Cards: margin-bottom 1rem
```

---

## PROMPT 4 — Utilities TypeScript calcoli

```
Crea il file src/utils/calculator.ts con tutta la logica di calcolo di TriCalculator.

**Tipi TypeScript:**

interface AthleteData {
  weightKg: number;
  swim400Time?: number;    // secondi
  swim1500Time?: number;   // secondi
  swimWeeklyKm: number;
  bikeWatts20: number;
  bikeWatts90?: number;
  bikeWatts180?: number;
  bikeWeeklyKm: number;
  run10kTime?: number;     // secondi
  runHalfTime?: number;    // secondi
  runWeeklyKm: number;
  dailyCalories: number;
}

interface TriathlonDistance {
  name: string;
  swimM: number;
  bikeM: number;
  runM: number;
  t1Sec: number;   // transizione 1
  t2Sec: number;   // transizione 2
}

interface FractionResult {
  seconds: number;
  displayTime: string;
  speed?: number;    // km/h per bici
  pace?: number;     // sec/km per corsa
  swimPace?: number; // sec/100m per nuoto
}

interface RaceResult {
  distance: TriathlonDistance;
  swim: FractionResult | null;
  bike: FractionResult | null;
  run: FractionResult | null;
  t1: number;
  t2: number;
  total: number | null;
  totalDisplay: string;
}

interface NutritionResult {
  choMinPerDay: number;
  choOptPerDay: number;
  kcalMinPerDay: number;
  kcalOptPerDay: number;
  kcalExtraMin: number;
  kcalExtraOpt: number;
}

**Costanti:**
export const DISTANCES: Record<string, TriathlonDistance> = {
  sprint:  { name: 'Sprint',     swimM: 750,  bikeM: 20000,  runM: 5000,  t1Sec: 120, t2Sec: 60  },
  olympic: { name: 'Olimpico',   swimM: 1500, bikeM: 40000,  runM: 10000, t1Sec: 120, t2Sec: 60  },
  half:    { name: 'Medio 70.3', swimM: 1900, bikeM: 90000,  runM: 21097, t1Sec: 180, t2Sec: 120 },
  full:    { name: 'Full IM',    swimM: 3800, bikeM: 180000, runM: 42195, t1Sec: 300, t2Sec: 180 },
}

**Funzioni da implementare:**

1. riegelTime(refTimeSec: number, refDistM: number, targetDistM: number): number
   - Formula: T2 = T1 * (D2/D1)^1.06

2. calcSwimTime(data: AthleteData, distanceM: number, format: string): FractionResult | null
   - Usa swim1500Time se disponibile (più preciso per distanze >1000m), altrimenti swim400Time
   - Fattore acqua aperta: sprint/olympic *1.03, half/full *1.05
   - Ritorno: secondi + pace /100m

3. calcBikeTime(data: AthleteData, distanceM: number, format: string): FractionResult | null
   - Mappa watts: sprint/olympic → bikeWatts20, half → bikeWatts90, full → bikeWatts180 o bikeWatts90*0.88
   - Modello fisico: P = (0.5 * 1.225 * 0.32 * v³) + (0.004 * (weightKg+8) * 9.81 * v), v in m/s
   - Risoluzione iterativa (Newton-Raphson, 50 iterazioni, tolleranza 0.001)
   - Ritorno: secondi + velocità km/h

4. calcRunTime(data: AthleteData, distanceM: number, format: string): FractionResult | null
   - Usa run10kTime (10000m) se disponibile, altrimenti runHalfTime (21097m)
   - Fattori fatica: sprint *1.03, olympic *1.05, half *1.08, full *1.13
   - Ritorno: secondi + pace min/km

5. calcNutrition(data: AthleteData): NutritionResult

6. calcAllDistances(data: AthleteData): RaceResult[]
   - Ritorna array di 4 RaceResult (sprint, olympic, half, full)
   - total = null se una qualunque frazione è null

7. athleteLevel(data: AthleteData): { overall: string, swim: string, bike: string, run: string }
   - Livelli: 'Principiante' | 'Amatore' | 'Competitivo' | 'Elite'
   - Bici W/kg: <2.0 / 2.0-2.8 / 2.8-3.5 / >3.5
   - Corsa pace (sec/km): >360 / 300-360 / 240-300 / <240
```

---

## PROMPT 5 — Formatters e componente AdUnit

```
Crea i seguenti file:

**src/utils/formatters.ts:**

export function parseTimeToSeconds(input: string): number | null
- Accetta "mm:ss" o "hh:mm:ss" o "m:ss"
- Ritorna null se input invalido
- Gestisce input con separatore ":" o "."

export function formatSeconds(sec: number): string
- Input: numero di secondi
- Output: "h:mm:ss" se >= 3600, "mm:ss" se < 3600

export function formatPace(secPerKm: number): string
- Output: "m:ss /km"

export function formatSwimPace(secPer100m: number): string
- Output: "m:ss /100m"

export function formatSpeed(kmh: number): string
- Output: "XX.X km/h"

**src/components/AdUnit.astro:**

Props:
- slot: 'leaderboard' | 'rectangle' | 'skyscraper'
- label?: string (default: "Pubblicità")

Logica:
- In development (import.meta.env.DEV): mostra placeholder colorato con dimensioni e label
- In production: mostra il tag <ins class="adsbygoogle"> con formato corretto
  - leaderboard: data-ad-format="horizontal", style height 90px
  - rectangle: data-ad-format="rectangle", style height 250px
  - skyscraper: data-ad-format="vertical", style height 600px
- Script: (adsbygoogle = window.adsbygoogle || []).push({}) — tramite tag type="text/partytown"
- usa data-ad-client="ca-pub-XXXXXXXXXX" e data-ad-slot="YYYYYYYYYY" come placeholder

Il componente deve avere una prop `class` per permettere styling esterno.
```

---

## PROMPT 6 — Componente Calculator (Astro Island)

```
Crea il componente principale src/components/Calculator.astro per TriCalculator.

Questo è un Astro Island con client:load — contiene tutto il form input e la visualizzazione output, con aggiornamento real-time.

**Struttura HTML:**

Sezione Input (colonna sinistra):
  - Card "Dati Fisici": campo peso (kg), range 40-150, step 0.5, default 72
  - Card "Nuoto" (icona onde):
    - Tempo 400m (mm:ss), opzionale se c'è 1500m
    - Tempo 1.500m (mm:ss), opzionale se c'è 400m
    - Volume settimanale (km/sett), default 6
  - Card "Bicicletta" (icona bici):
    - Watt medi 20 km (Sprint/Olimpico), default 200
    - Watt medi 90 km (Medio 70.3), default 175
    - Watt medi 180 km (Full - opzionale), default ""
    - Volume settimanale (km/sett), default 120
  - Card "Corsa" (icona persona che corre):
    - Miglior tempo 10 km gara (mm:ss), default 45:00
    - Miglior tempo mezza (hh:mm:ss), opzionale
    - Volume settimanale (km/sett), default 40
  - Card "Nutrizione" (icona forchetta):
    - Calorie medie giornaliere, default 2500
  - Pulsante "Reset ai valori esempio" (secondario)

Sezione Output (colonna destra):
  - Badge livello atleta (overall)
  - Tabella risultati (4 righe distanza × 7 colonne: Formato | Nuoto | T1 | Bici | T2 | Corsa | TOTALE)
  - 4 card distanza (Sprint, Olimpico, Medio, Full):
    - Titolo + distanze
    - Barre progress (nuoto/bici/corsa proporzionali al totale)
    - Statistiche: velocità bici, ritmo corsa, ritmo nuoto
  - Card nutrizione

**Script client-side (tag <script>):**
- Importa calcAllDistances, calcNutrition, athleteLevel da utils/calculator.ts
- Importa formatters da utils/formatters.ts
- parseFormData(): legge tutti gli input, costruisce AthleteData
- updateUI(results, nutrition, level): aggiorna tutti gli elementi del DOM
- Attacca event listener 'input' su tutti i campi → chiama parseFormData → calcAllDistances → updateUI
- Chiama calculateAll() al DOMContentLoaded con valori di default
- Gestisce valori null: mostra "—" nelle celle

Ogni card input deve avere un tooltip (attributo title) che spiega il dato e come misurarlo.
```

---

## PROMPT 7 — Pagina index e privacy policy

```
Crea le due pagine Astro:

**src/pages/index.astro:**
- Usa Layout.astro
- Header con logo "TRI|CALCULATOR" (TRI in rosso) + tagline "Calcola il tuo tempo di gara"
- AdUnit slot="leaderboard" sotto l'header
- Componente Calculator (client:load)
- AdUnit slot="rectangle" tra input e output (visibile solo su mobile, su desktop è in sidebar)
- Sezione FAQ (3 domande, accordion CSS puro):
  - "Come misuro i miei watt medi?" → Rispondi con FTP test, ciclocomputer con misuratore di potenza
  - "Cosa sono le transizioni T1 e T2?" → T1 da nuoto a bici, T2 da bici a corsa, tempo incluso nel totale
  - "Come effettuare il carb loading?" → 48h prima aumentare carboidrati a 8-12g/kg, ridurre fibre e grassi
  - "I tempi sono accurati?" → Stime basate su formule scientifiche (Riegel, modello aerodinamico), variabili esterne non incluse (pendenza, vento, caldo)
- AdUnit slot="leaderboard" nel footer

**src/pages/privacy-policy.astro:**
- Usa Layout.astro, title: "Privacy Policy - TriCalculator"
- Contenuto completo privacy policy in italiano per:
  - Nessun dato personale raccolto o salvato (tutti i calcoli sono locali nel browser)
  - Uso di Google AdSense (cookie di terze parti per annunci personalizzati)
  - Cookie tecnici
  - Diritti GDPR dell'utente
  - Email di contatto: privacy@tricalculator.app
  - Data ultimo aggiornamento: corrente
```

---

## PROMPT 8 — Cookie Banner GDPR

```
Crea il componente src/components/CookieBanner.astro per la gestione del consenso cookie GDPR.

Requisiti:
- Si mostra solo se l'utente non ha ancora espresso consenso (controlla localStorage 'cookie-consent')
- Design: banner fisso in basso, full-width, background surface, border-top rosso
- Testo: "Questo sito usa cookie di terze parti per mostrare annunci personalizzati tramite Google AdSense. [Leggi la Privacy Policy]"
- Due pulsanti: "Accetta" (rosso, primary) e "Rifiuta" (secondario, outline)
- Al click su "Accetta": salva 'cookie-consent'='accepted' in localStorage, nascondi banner, carica AdSense
- Al click su "Rifiuta": salva 'cookie-consent'='rejected' in localStorage, nascondi banner, NON caricare AdSense
- Se rifiutato: mostra annunci non personalizzati (data-npa="1" su adsbygoogle)
- Tutto in vanilla JS nel tag <script> del componente (nessun framework)
- Accessibile: focus trap sul banner, role="dialog", aria-label="Consenso cookie"
```

---

## PROMPT 9 — Test e ottimizzazione

```
Esegui una review completa del progetto TriCalculator (Astro) e verifica:

**1. Correttezza calcoli (testa questi casi):**
- Atleta A: 75kg, 220W/20km, 10km in 42:00, nuoto 400m in 7:00
  - Sprint atteso: nuoto ~13:30, bici ~32:00, corsa ~22:00, totale ~1:10:00
- Atleta B: 80kg, 280W/20km, 10km in 38:00, nuoto 1500m in 23:00
  - Olimpico atteso: nuoto ~26:00, bici ~63:00, corsa ~42:00, totale ~2:15:00

**2. Build Astro:**
- `npm run build` deve completare senza errori
- Output in `dist/` deve contenere solo file statici
- Nessun riferimento a node_modules nel bundle finale

**3. Performance:**
- Lighthouse sul build (usa `npm run preview`): Performance > 95
- Verifica che AdSense sia caricato via Partytown (non blocca main thread)
- Verifica che Inter sia self-hosted o caricato con `rel="preconnect"`

**4. TypeScript:**
- `npx tsc --noEmit` senza errori
- Tutti i tipi corretti, nessun `any` non giustificato

**5. SEO:**
- Sitemap generata in dist/sitemap-index.xml
- robots.txt presente
- OG tags corretti
- Canonical URL presente

**6. GDPR/AdSense:**
- Cookie banner funziona correttamente
- Privacy Policy accessibile dal footer
- AdSense non caricato se consenso rifiutato

Correggi tutti i problemi trovati.
```

---

## Note per l'uso

- Esegui i prompt nell'ordine 1→9
- Dopo i prompt 1-2: verifica `npm run dev` funziona
- Dopo i prompt 4-5: testa i calcoli nella console browser
- Dopo il prompt 9: fai il push su GitHub e collega Netlify
- Per l'approvazione AdSense: il sito deve essere live da qualche giorno con contenuto di qualità
- Usa `ca-pub-XXXXXXXXXX` come placeholder finché non ottieni l'ID AdSense reale

---

## Checklist Deploy Finale

- [ ] `npm run build` senza errori
- [ ] Lighthouse Performance > 95, SEO > 95
- [ ] Calcoli verificati su almeno 3 profili atleta
- [ ] Cookie banner funzionante (test accetta/rifiuta)
- [ ] Privacy Policy accessibile
- [ ] AdSense placeholder rimpiazzato con ID reale dopo approvazione
- [ ] Dominio tricalculator.app live con HTTPS
- [ ] Sitemap sottomessa a Google Search Console
