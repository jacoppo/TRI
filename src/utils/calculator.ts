import { formatSeconds, formatSpeed, formatPace, formatSwimPace } from './formatters';

// ============================================================
// TYPES
// ============================================================

export interface AthleteData {
  weightKg: number;
  swim400Time?: number;   // seconds
  swim1500Time?: number;  // seconds
  swimWeeklyKm?: number;
  bikeWatts20: number;
  bikeWatts90?: number;
  bikeWatts180?: number;
  bikeWeeklyHours?: number;
  run10kTime?: number;    // seconds
  runHalfTime?: number;   // seconds
  runWeeklyKm?: number;
  dailyCalories: number;
}

export interface FractionResult {
  seconds: number;
  displayTime: string;
  speedKmh?: number;    // bike only
  paceSecPerKm?: number; // run only
  paceSecPer100m?: number; // swim only
}

export interface RaceResult {
  key: string;
  name: string;
  distances: string;
  swimM: number;
  bikeKm: number;
  runKm: number;
  swim: FractionResult | null;
  t1Sec: number;
  bike: FractionResult | null;
  t2Sec: number;
  run: FractionResult | null;
  totalSec: number | null;
  totalDisplay: string;
}

export interface NutritionDay {
  choGrams: number;
  choKcal: number;
  extraKcal: number;
}

export interface NutritionResult {
  distanceName: string;
  day48h: NutritionDay;
  day24h: NutritionDay;
  note: string;
}

// Protocollo carb loading per distanza
// Valori in g di CHO per kg di peso corporeo
const NUTRITION_PROTOCOLS: Record<string, { name: string; cho48h: number; cho24h: number; note: string }> = {
  sprint: {
    name: 'Sprint',
    cho48h: 5,
    cho24h: 6,
    note: 'Carico leggero: un buon pasto la sera prima è sufficiente. Privilegia pasta, riso o patate.',
  },
  olympic: {
    name: 'Olimpico',
    cho48h: 6,
    cho24h: 8,
    note: 'Carico moderato su 48h. Aumenta i carboidrati e riduci fibre e grassi il giorno prima.',
  },
  half: {
    name: 'Medio 70.3',
    cho48h: 8,
    cho24h: 10,
    note: 'Carico completo su 48h. Pasta, riso, pane bianco, banane. Riduci drasticamente fibre e grassi.',
  },
  full: {
    name: 'Full Ironman',
    cho48h: 10,
    cho24h: 12,
    note: 'Carico massimo su 48h. Carboidrati ad ogni pasto. Elimina fibre, grassi e alimenti nuovi.',
  },
};

export interface AthleteLevel {
  overall: string;
  bike: string;
  run: string;
  swim: string;
}

export interface RouteData {
  distanceM: number;
  elevationGainM: number;
  elevationLossM: number;
  source: 'gpx' | 'manual';
  name?: string;
}

// ============================================================
// TRIATHLON DISTANCES
// ============================================================

const DISTANCES = [
  { key: 'sprint',  name: 'Sprint',     distances: '750m · 20km · 5km',       swimM: 750,  bikeM: 20000,  runM: 5000,  t1: 120, t2: 60  },
  { key: 'olympic', name: 'Olimpico',   distances: '1.500m · 40km · 10km',    swimM: 1500, bikeM: 40000,  runM: 10000, t1: 120, t2: 60  },
  { key: 'half',    name: 'Medio 70.3', distances: '1.900m · 90km · 21,1km',  swimM: 1900, bikeM: 90000,  runM: 21097, t1: 180, t2: 120 },
  { key: 'full',    name: 'Full IM',    distances: '3.800m · 180km · 42,2km', swimM: 3800, bikeM: 180000, runM: 42195, t1: 300, t2: 180 },
];

// ============================================================
// RIEGEL FORMULA
// ============================================================

/**
 * Predicts race time at a new distance using the Riegel formula.
 * T2 = T1 * (D2/D1)^1.06
 */
function riegelTime(refTimeSec: number, refDistM: number, targetDistM: number): number {
  return refTimeSec * Math.pow(targetDistM / refDistM, 1.06);
}

// ============================================================
// SWIM CALCULATION
// ============================================================

/**
 * Calculates estimated swim time for a given distance and race format.
 * Uses the Riegel formula with an open-water correction factor.
 */
function calcSwimTime(data: AthleteData, swimM: number, format: string): FractionResult | null {
  let refTimeSec: number;
  let refDistM: number;

  // Prefer the longer reference for longer target distances (more accurate)
  const use1500 = data.swim1500Time != null && (swimM >= 1000 || data.swim400Time == null);

  if (use1500 && data.swim1500Time != null) {
    refTimeSec = data.swim1500Time;
    refDistM = 1500;
  } else if (data.swim400Time != null) {
    refTimeSec = data.swim400Time;
    refDistM = 400;
  } else {
    return null;
  }

  let estimatedSec = riegelTime(refTimeSec, refDistM, swimM);

  // Open water / wetsuit correction
  const openWaterFactor = (format === 'sprint' || format === 'olympic') ? 1.03 : 1.05;
  estimatedSec *= openWaterFactor;

  const paceSecPer100m = estimatedSec / (swimM / 100);

  return {
    seconds: estimatedSec,
    displayTime: formatSeconds(estimatedSec),
    paceSecPer100m,
  };
}

// ============================================================
// BIKE CALCULATION (aerodynamic model)
// ============================================================

/**
 * Solves for cycling speed (m/s) given power output using Newton-Raphson iteration.
 * Model: P = 0.5 * rho * CdA * v³ + (Crr + gradient) * totalMass * g * v
 *   - rho = 1.225 kg/m³ (air density)
 *   - CdA = 0.32 m² (aero triathlon position)
 *   - Crr = 0.004 (road rolling resistance)
 *   - totalMass = athleteKg + 8 (bike ~8kg)
 *   - gradient = elevationGain / distance (dimensionless, accounts for climbing)
 */
function solveForSpeedMs(watts: number, weightKg: number, gradient: number = 0): number {
  const rho = 1.225;
  const CdA = 0.32;
  const Crr = 0.004;
  const g = 9.81;
  const mass = weightKg + 8;

  const A = 0.5 * rho * CdA;
  const B = (Crr + gradient) * mass * g; // gradient adds to rolling resistance

  let v = 9.0; // initial guess ~32 km/h in m/s

  for (let i = 0; i < 50; i++) {
    const fv = A * v * v * v + B * v - watts;
    const dfv = 3 * A * v * v + B;
    if (Math.abs(dfv) < 1e-10) break;
    const vNew = v - fv / dfv;
    if (Math.abs(vNew - v) < 0.001) {
      v = vNew;
      break;
    }
    v = Math.max(0.1, vNew);
  }

  return v;
}

/**
 * Calculates estimated speed and time for a specific GPX/manual route using
 * a 3-segment model (uphill / flat / downhill) that correctly accounts for
 * both elevation gain AND loss.
 *
 * Previous single-gradient model was wrong because it treated the whole route
 * as a constant uphill grade, ignoring that descents give free speed back.
 *
 * Model assumptions:
 *   - Average climb/descent grade: 5% (typical triathlon hilly course)
 *   - Uphill distance  = elevationGain / 0.05
 *   - Downhill distance = elevationLoss / 0.05
 *   - Flat distance = total - uphill - downhill (≥ 0)
 *   - Downhill speed capped at 54 km/h (15 m/s) for safety/realism
 *   - For manual input (loss = 0), assumes a symmetric course: loss ≈ gain
 *
 * @param data  - Athlete data (weight, watts)
 * @param route - Route data from GPX or manual input
 */
export function calcRouteResult(data: AthleteData, route: RouteData): FractionResult | null {
  if (!route || route.distanceM <= 0) return null;

  // Select watts appropriate for the route distance
  let watts: number;
  if (route.distanceM <= 30000) {
    watts = data.bikeWatts20;
  } else if (route.distanceM <= 120000) {
    watts = data.bikeWatts90 ?? data.bikeWatts20 * 0.875;
  } else {
    watts = data.bikeWatts180 ?? (data.bikeWatts90 ?? data.bikeWatts20 * 0.875) * 0.88;
  }

  if (!watts || watts <= 0) return null;

  const D = route.distanceM;
  const gainM = route.elevationGainM;
  // For manual input (loss = 0) assume a symmetric/loop course: loss ≈ gain
  const lossM = route.elevationLossM > 0 ? route.elevationLossM : gainM;

  // Flat route — simple single-speed calculation
  if (gainM === 0 && lossM === 0) {
    const speedMs = solveForSpeedMs(watts, data.weightKg, 0);
    const speedKmh = speedMs * 3.6;
    const estimatedSec = (D / 1000 / speedKmh) * 3600;
    return { seconds: estimatedSec, displayTime: formatSeconds(estimatedSec), speedKmh };
  }

  // 3-segment model
  const AVG_GRADE = 0.05; // 5% assumed average slope for climb/descent sections
  const MAX_DOWN_MS = 15; // 54 km/h downhill speed cap

  let distUp   = gainM / AVG_GRADE;  // distance spent climbing
  let distDown = lossM / AVG_GRADE;  // distance spent descending

  // If uphill + downhill > total distance, scale proportionally
  if (distUp + distDown > D) {
    const scale = D / (distUp + distDown);
    distUp   *= scale;
    distDown *= scale;
  }
  const distFlat = Math.max(0, D - distUp - distDown);

  const vUp   = solveForSpeedMs(watts, data.weightKg, AVG_GRADE);
  const vFlat = solveForSpeedMs(watts, data.weightKg, 0);
  const vDown = Math.min(solveForSpeedMs(watts, data.weightKg, -AVG_GRADE), MAX_DOWN_MS);

  // Total time = sum of time for each segment (harmonic, NOT arithmetic mean)
  const totalTimeSec = (distUp / vUp) + (distFlat / vFlat) + (distDown / vDown);
  const avgSpeedKmh  = (D / 1000) / (totalTimeSec / 3600);

  return {
    seconds: totalTimeSec,
    displayTime: formatSeconds(totalTimeSec),
    speedKmh: avgSpeedKmh,
  };
}

/**
 * Calculates estimated bike time for a given distance and race format.
 * If gainPerM / lossPerM are provided (from a loaded GPX/manual route),
 * the same elevation density is applied proportionally to this distance
 * using the same 3-segment model as calcRouteResult.
 */
function calcBikeTime(
  data: AthleteData,
  bikeM: number,
  format: string,
  gainPerM: number = 0,
  lossPerM: number = 0,
): FractionResult | null {
  let watts: number;

  if (format === 'sprint' || format === 'olympic') {
    watts = data.bikeWatts20;
  } else if (format === 'half') {
    watts = data.bikeWatts90 ?? data.bikeWatts20 * 0.875;
  } else {
    // full
    watts = data.bikeWatts180 ?? (data.bikeWatts90 ?? data.bikeWatts20 * 0.875) * 0.88;
  }

  if (!watts || watts <= 0) return null;

  // If no elevation data, use flat model
  if (gainPerM === 0 && lossPerM === 0) {
    const speedMs = solveForSpeedMs(watts, data.weightKg);
    const speedKmh = speedMs * 3.6;
    const estimatedSec = (bikeM / 1000 / speedKmh) * 3600;
    return { seconds: estimatedSec, displayTime: formatSeconds(estimatedSec), speedKmh };
  }

  // Apply same elevation density proportionally to this race distance (3-segment model)
  const AVG_GRADE = 0.05;
  const MAX_DOWN_MS = 15;
  const gainM = gainPerM * bikeM;
  const lossM = lossPerM * bikeM;

  let distUp   = gainM / AVG_GRADE;
  let distDown = lossM / AVG_GRADE;
  if (distUp + distDown > bikeM) {
    const scale = bikeM / (distUp + distDown);
    distUp   *= scale;
    distDown *= scale;
  }
  const distFlat = Math.max(0, bikeM - distUp - distDown);

  const vUp   = solveForSpeedMs(watts, data.weightKg, AVG_GRADE);
  const vFlat = solveForSpeedMs(watts, data.weightKg, 0);
  const vDown = Math.min(solveForSpeedMs(watts, data.weightKg, -AVG_GRADE), MAX_DOWN_MS);

  const estimatedSec = (distUp / vUp) + (distFlat / vFlat) + (distDown / vDown);
  const speedKmh = (bikeM / 1000) / (estimatedSec / 3600);

  return {
    seconds: estimatedSec,
    displayTime: formatSeconds(estimatedSec),
    speedKmh,
  };
}

// ============================================================
// RUN CALCULATION
// ============================================================

// Fatigue factors: how much slower the triathlon run split is vs standalone running.
// Based on published race data for amateur triathletes (Lepers et al., Friel):
//   Sprint:  5–8% slower  → 1.07 (mid-range)
//   Olympic: 8–12% slower → 1.11
//   Half:    12–15% slower → 1.14
//   Full:    20–25% slower → 1.22
const FATIGUE_FACTORS: Record<string, number> = {
  sprint: 1.07,
  olympic: 1.11,
  half: 1.14,
  full: 1.22,
};

/**
 * Calculates estimated run time for a given distance and race format.
 * Applies Riegel formula plus a triathlon-specific fatigue factor.
 */
function calcRunTime(data: AthleteData, runM: number, format: string): FractionResult | null {
  let refTimeSec: number;
  let refDistM: number;

  // Prefer half marathon reference for longer distances
  const useHalf = data.runHalfTime != null && (runM >= 15000 || data.run10kTime == null);

  if (useHalf && data.runHalfTime != null) {
    refTimeSec = data.runHalfTime;
    refDistM = 21097;
  } else if (data.run10kTime != null) {
    refTimeSec = data.run10kTime;
    refDistM = 10000;
  } else {
    return null;
  }

  const fatigue = FATIGUE_FACTORS[format] ?? 1.05;
  let estimatedSec = riegelTime(refTimeSec, refDistM, runM) * fatigue;

  const paceSecPerKm = estimatedSec / (runM / 1000);

  return {
    seconds: estimatedSec,
    displayTime: formatSeconds(estimatedSec),
    paceSecPerKm,
  };
}

// ============================================================
// NUTRITION
// ============================================================

/**
 * Calculates pre-race carb loading recommendations split by 48h and 24h before the race.
 * Protocols vary by triathlon distance: sprint uses lighter loading, full IM uses maximum loading.
 *
 * @param data - Athlete input data (weight, daily calories)
 * @param distanceKey - Race distance ('sprint' | 'olympic' | 'half' | 'full')
 */
export function calcNutrition(data: AthleteData, distanceKey: string = 'olympic'): NutritionResult {
  const protocol = NUTRITION_PROTOCOLS[distanceKey] ?? NUTRITION_PROTOCOLS['olympic']!;

  const cho48h = Math.round(data.weightKg * protocol.cho48h);
  const cho24h = Math.round(data.weightKg * protocol.cho24h);

  const kcal48h = cho48h * 4;
  const kcal24h = cho24h * 4;

  return {
    distanceName: protocol.name,
    day48h: {
      choGrams: cho48h,
      choKcal: kcal48h,
      extraKcal: Math.max(0, kcal48h - data.dailyCalories),
    },
    day24h: {
      choGrams: cho24h,
      choKcal: kcal24h,
      extraKcal: Math.max(0, kcal24h - data.dailyCalories),
    },
    note: protocol.note,
  };
}

// ============================================================
// ATHLETE LEVEL
// ============================================================

/**
 * Estimates athlete level based on W/kg and run pace.
 */
export function calcAthleteLevel(data: AthleteData): AthleteLevel {
  const wkg = data.bikeWatts20 / data.weightKg;

  let bike: string;
  if (wkg >= 3.5) bike = 'Elite';
  else if (wkg >= 2.8) bike = 'Competitivo';
  else if (wkg >= 2.0) bike = 'Amatore';
  else bike = 'Principiante';

  let run = 'Principiante';
  if (data.run10kTime != null) {
    const paceSecPerKm = data.run10kTime / 10;
    if (paceSecPerKm < 240) run = 'Elite';
    else if (paceSecPerKm < 300) run = 'Competitivo';
    else if (paceSecPerKm < 360) run = 'Amatore';
    else run = 'Principiante';
  }

  let swim = 'Principiante';
  const swimRefSec = data.swim400Time;
  if (swimRefSec != null) {
    const pace = swimRefSec / 4; // sec/100m
    if (pace < 75) swim = 'Elite';
    else if (pace < 95) swim = 'Competitivo';
    else if (pace < 120) swim = 'Amatore';
    else swim = 'Principiante';
  }

  const levels = ['Principiante', 'Amatore', 'Competitivo', 'Elite'];
  const overallIdx = Math.round(
    (levels.indexOf(bike) + levels.indexOf(run) + levels.indexOf(swim)) / 3
  );
  const overall = levels[Math.min(overallIdx, 3)] ?? 'Amatore';

  return { overall, bike, run, swim };
}

// ============================================================
// MAIN: CALCULATE ALL DISTANCES
// ============================================================

/**
 * Calculates estimated times for all four triathlon distances.
 */
export function calcAllDistances(data: AthleteData, route: RouteData | null = null): RaceResult[] {
  // If a route is loaded, extract elevation density (m of gain per m of distance)
  // and apply it proportionally to each race distance.
  let gainPerM = 0;
  let lossPerM = 0;
  if (route && route.distanceM > 0) {
    gainPerM = route.elevationGainM / route.distanceM;
    // For manual input (loss = 0), assume symmetric loop: loss = gain
    const effectiveLoss = route.elevationLossM > 0 ? route.elevationLossM : route.elevationGainM;
    lossPerM = effectiveLoss / route.distanceM;
  }

  return DISTANCES.map((d) => {
    const swim = calcSwimTime(data, d.swimM, d.key);
    const bike = calcBikeTime(data, d.bikeM, d.key, gainPerM, lossPerM);
    const run = calcRunTime(data, d.runM, d.key);

    let totalSec: number | null = null;
    if (swim !== null && bike !== null && run !== null) {
      totalSec = swim.seconds + d.t1 + bike.seconds + d.t2 + run.seconds;
    }

    return {
      key: d.key,
      name: d.name,
      distances: d.distances,
      swimM: d.swimM,
      bikeKm: d.bikeM / 1000,
      runKm: d.runM / 1000,
      swim,
      t1Sec: d.t1,
      bike,
      t2Sec: d.t2,
      run,
      totalSec,
      totalDisplay: totalSec !== null ? formatSeconds(totalSec) : '—',
    };
  });
}

// ============================================================
// COACHING ADVICE
// ============================================================

export interface DisciplineAdvice {
  label: string;
  level: string;
  volumeDisplay: string;
  priority: 'Alta' | 'Media' | 'Bassa';
  weakness: string;
  tips: string[];
  exampleSession: string;
  isLimitingFactor: boolean;
}

export interface CoachingReport {
  hasEnoughData: boolean;
  swim: DisciplineAdvice | null;
  bike: DisciplineAdvice | null;
  run: DisciplineAdvice | null;
  limitingFactor: 'Nuoto' | 'Bici' | 'Corsa' | null;
  totalWeeklyHours: number;
  generalTips: string[];
}

function swimAdvice(data: AthleteData): DisciplineAdvice | null {
  if (!data.swim400Time) return null;

  const pace = data.swim400Time / 4; // sec/100m
  const km = data.swimWeeklyKm ?? 0;
  const volDisplay = km > 0 ? `${km} km/sett` : 'non inserito';

  let level: string;
  let levelIdx: number;
  if (pace < 75)       { level = 'Elite';        levelIdx = 3; }
  else if (pace < 95)  { level = 'Competitivo';  levelIdx = 2; }
  else if (pace < 120) { level = 'Amatore';       levelIdx = 1; }
  else                 { level = 'Principiante';  levelIdx = 0; }

  let weakness: string;
  let tips: string[];
  let exampleSession: string;
  let priority: 'Alta' | 'Media' | 'Bassa';

  if (levelIdx === 0) {
    priority = 'Alta';
    if (km < 4) {
      weakness = 'Volume e tecnica insufficienti';
      tips = [
        'Porta la frequenza a 3 sessioni/sett anche se brevi (1.500-2.000m): la ripetizione è più importante del volume totale.',
        'Dedica il 40% di ogni sessione a lavoro tecnico: catch-up drill, nuoto con il galleggiante tra le gambe (pull buoy), kicking con tavoletta.',
        'Impara la respirazione bilaterale (ogni 3 bracciate): migliora il bilanciamento e riduce le deviazioni di rotta in acqua aperta.',
        'Non trascurare il nuoto: spesso è la disciplina con il margine di miglioramento più alto per i triatleti amatori.',
      ];
      exampleSession = '400m riscaldamento → 8×50m drill (catch-up) rec 20s → 6×100m al ritmo di gara rec 30s → 200m defaticamento';
    } else {
      weakness = 'Hai il volume ma la tecnica è il limitatore principale';
      tips = [
        'Riduci il volume del 20% e investi quel tempo in analisi tecnica: anche 2 sessioni con un coach valgono mesi di nuoto da solo.',
        'CSS Training (Critical Swim Speed): testa i tuoi tempi su 400m e 200m, calcola il tuo CSS e usa 8×100m al ritmo CSS con 15s rec come workout settimanale principale.',
        'Usa videate sott\'acqua o specchi in vasca per correggere i difetti di postura e di presa sull\'acqua.',
        'Lavora sull\'ingresso della mano: un buon "catch" vale 5-10s/100m senza sforzo aggiuntivo.',
      ];
      exampleSession = '400m riscaldamento → 4×200m CSS pace rec 30s → 8×50m drill alternati rec 15s → 300m defaticamento';
    }
  } else if (levelIdx === 1) {
    priority = 'Media';
    if (km < 6) {
      weakness = 'Volume insufficiente per la distanza di gara';
      tips = [
        'Porta il volume a 5-8 km/sett con almeno 3 sessioni. Per il mezzo e il full, devi arrivare a nuotare distanze gara in allenamento.',
        'Aggiungi 1 sessione di soglia a settimana: 4×200m al ritmo 10km nuoto con 30s di recupero.',
        'Nuoto in acque aperte: pratica almeno 1 volta al mese la navigazione, la partenza in massa e il nuoto in scia (drafting riduce il consumo energetico del 15-25%).',
      ];
      exampleSession = '300m riscaldamento → 3×400m al ritmo gara rec 45s → 6×50m sprint rec 20s → 200m defaticamento';
    } else {
      weakness = 'Buon volume, lavora sulla specificità e l\'acqua aperta';
      tips = [
        'Inserisci 1 sessione/sett in acque aperte per abituarti alla visibilità ridotta e al contatto fisico.',
        'Pratica il nuoto in scia: nuota dietro qualcuno di leggermente più veloce, risparmi fino al 20% di energia.',
        'Lavora sulla partenza: i primi 200-400m in gara sono caotici — allenati a partire forte e poi trovare il ritmo.',
      ];
      exampleSession = '500m riscaldamento → 5×300m progressivi (ogni 100m più veloce) rec 40s → 200m kick → 200m defaticamento';
    }
  } else {
    priority = 'Bassa';
    weakness = 'Il nuoto non è il tuo limitatore principale';
    tips = [
      'Il guadagno reale ora viene dal risparmio energetico, non dalla velocità: nuota sempre in scia quando possibile.',
      'Lavora sulla transizione nuoto-bici (T1): pratica ad uscire dall\'acqua, toglierti la muta e montare in sella il più veloce possibile.',
      'Inserisci 1 sessione/mese di nuoto in acqua aperta per mantenere la confidenza con le condizioni di gara.',
    ];
    exampleSession = 'Sessione race-pace: 1.500m riscaldamento → 2×(750m ritmo gara + 200m forte) → 500m defaticamento';
  }

  return { label: 'Nuoto', level, volumeDisplay: volDisplay, priority, weakness, tips, exampleSession, isLimitingFactor: false };
}

function bikeAdvice(data: AthleteData): DisciplineAdvice | null {
  if (!data.bikeWatts20 || !data.weightKg) return null;

  const wkg = data.bikeWatts20 / data.weightKg;
  const hours = data.bikeWeeklyHours ?? 0;
  const volDisplay = hours > 0 ? `${hours} ore/sett` : 'non inserito';

  let level: string;
  let levelIdx: number;
  if (wkg >= 3.5)      { level = 'Elite';        levelIdx = 3; }
  else if (wkg >= 2.8) { level = 'Competitivo';  levelIdx = 2; }
  else if (wkg >= 2.0) { level = 'Amatore';       levelIdx = 1; }
  else                 { level = 'Principiante';  levelIdx = 0; }

  let weakness: string;
  let tips: string[];
  let exampleSession: string;
  let priority: 'Alta' | 'Media' | 'Bassa';

  if (levelIdx === 0) {
    priority = 'Alta';
    if (hours < 5) {
      weakness = 'Volume e potenza entrambi insufficienti';
      tips = [
        'Porta le ore a 6-8/sett: la base aerobica è il fondamento su cui costruire tutto il resto. Il 75-80% delle uscite deve essere in Zona 2 (conversazionale, 65-75% FCmax).',
        'Aggiungi 1 sessione Sweet Spot a settimana: 2×15min all\'88-93% del tuo FTP. Questo è il miglior rapporto sforzo/adattamento per aumentare la potenza.',
        'Testa il tuo FTP ogni 6-8 settimane con il Ramp Test (più preciso del classico 20min test): sapere la tua soglia è essenziale per allenarti con intensità corretta.',
        'Lavora sulla cadenza: punta a 85-95 giri/minuto per essere più efficiente e preservare le gambe per la corsa.',
      ];
      exampleSession = 'Long ride Z2: 90min in Zona 2 (puoi parlare comodamente) → ultimi 20min: 2×8min a Sweet Spot (88-93% FTP) rec 3min';
    } else {
      weakness = 'Tante ore ma bassa potenza: stai facendo troppa Zona 2 ("junk miles")';
      tips = [
        'Sostituisci 2 ore di Z2 a settimana con sessioni di qualità: 1× Sweet Spot (3×15min @90% FTP) + 1× VO2max (6×4min massimali con 4min rec).',
        'Aggiungi salite: pedalare in salita forza l\'aumento di potenza naturalmente e migliora il W/kg.',
        'Polarizza l\'allenamento: 80% Z2 + 20% intensità. Smetti di pedalare a intensità "media" — quella zona non porta adattamenti ottimali.',
        'Verifica il tuo FTP con un Ramp Test. Se è sottostimato stai allenandoti sotto-soglia credendo di farlo a soglia.',
      ];
      exampleSession = 'Intervalli FTP: 10min riscaldamento → 3×12min @95-105% FTP rec 6min → 10min defaticamento';
    }
  } else if (levelIdx === 1) {
    priority = 'Media';
    if (hours < 6) {
      weakness = 'Buona potenza ma volume insufficiente per le gare lunghe';
      tips = [
        'Aggiungi una long ride settimanale di 2,5-3h in Z2: costruisce la resistenza metabolica necessaria per IM e 70.3.',
        'Inserisci 1 sessione Sweet Spot/sett (2×20min @90% FTP) per continuare ad aumentare l\'FTP.',
        'Brick training: almeno 1 volta a settimana finisci la bici con 20-30min di corsa immediata — è la skill più specifica del triathlon.',
      ];
      exampleSession = '2h Z2 → ultimi 30min: 3×8min Sweet Spot rec 3min → subito dopo: 20min corsa a ritmo olimpico';
    } else {
      weakness = 'Buon equilibrio. Concentrati sulla specificità di gara';
      tips = [
        'Race-simulation: 1 volta/mese simula la frazione bici della tua gara target (distanza, ritmo, nutrizione).',
        'Lavora sul pacing: in gara l\'errore più comune è partire troppo forte. Per l\'IM mantieni IF (Intensity Factor) tra 0.69-0.76.',
        'Brick run settimanale: corri 40-60min subito dopo la long ride — la corsa da "gambe stanche" è diversa dalla corsa normale.',
      ];
      exampleSession = 'Simulazione gara: 40km al ritmo IM/70.3 con nutrizione da gara → transizione immediata → 30min corsa a ritmo gara';
    }
  } else {
    priority = 'Bassa';
    weakness = 'Ottime basi di potenza. Focus su efficienza e gara-specificità';
    tips = [
      'Per il Full IM: mantieni l\'Intensity Factor (IF) tra 0.69-0.76 — partire troppo forte sulla bici distrugge la maratona.',
      'Taper pre-gara: 2 settimane prima riduci il volume del 40-50% mantenendo 2-3 sessioni brevi ad alta intensità per mantenere la sharpness.',
      'Lavora sulla posizione aero: anche 5W risparmiati in resistenza aerodinamica valgono più di 5W di potenza aggiuntiva.',
    ];
    exampleSession = 'Sharpening pre-gara: 45min Z2 → 3×8min @FTP rec 4min → 10min cool-down → 15min corsa facile';
  }

  return { label: 'Bici', level, volumeDisplay: volDisplay, priority, weakness, tips, exampleSession, isLimitingFactor: false };
}

function runAdvice(data: AthleteData): DisciplineAdvice | null {
  if (!data.run10kTime) return null;

  const paceSecPerKm = data.run10kTime / 10;
  const km = data.runWeeklyKm ?? 0;
  const volDisplay = km > 0 ? `${km} km/sett` : 'non inserito';

  let level: string;
  let levelIdx: number;
  if (paceSecPerKm < 240)      { level = 'Elite';        levelIdx = 3; }
  else if (paceSecPerKm < 300) { level = 'Competitivo';  levelIdx = 2; }
  else if (paceSecPerKm < 360) { level = 'Amatore';       levelIdx = 1; }
  else                         { level = 'Principiante';  levelIdx = 0; }

  let weakness: string;
  let tips: string[];
  let exampleSession: string;
  let priority: 'Alta' | 'Media' | 'Bassa';

  if (levelIdx === 0) {
    priority = 'Alta';
    if (km < 30) {
      weakness = 'Base aerobica aerobica insufficiente — priorità al volume';
      tips = [
        'Porta la frequenza a 4-5 uscite/sett tutte in Zona 2 (puoi portare avanti una conversazione). La base aerobica è il fondamento: non bruciare le tappe.',
        'Regola del 10%: non aumentare il kilometraggio di più del 10% a settimana per evitare infortuni.',
        'Lavora sulla cadenza: punta a 170-180 passi/minuto. Questo riduce l\'impatto sulle articolazioni e migliora l\'efficienza.',
        'Non iniziare con intensità: anche 1 sessione di qualità a questa fase può portare ad infortuni. Solo volume facile.',
      ];
      exampleSession = '3× settimana: 35-45min Z2 + 1× long run domenica: 55-65min Z2 (cammina se necessario per rimanere in Z2)';
    } else {
      weakness = 'Volume presente ma manca la qualità — tutto facile non porta miglioramenti';
      tips = [
        'Aggiungi 1 sessione fartlek/sett: 6×3min al ritmo 5km con 2min di jogging rec — alternare intensità e recupero è più efficace del ritmo costante.',
        'Strides: a fine di 3 uscite facili, esegui 6×100m accelerazioni progressive (non sprint) — migliorano la meccanica e l\'economia di corsa.',
        'Mantieni il volume ma polarizza: 80% Z2 + 1 sessione di qualità a settimana.',
      ];
      exampleSession = 'Fartlek: 15min riscaldamento Z2 → 8×2min ritmo 5km con 90s jogging → 10min defaticamento';
    }
  } else if (levelIdx === 1) {
    priority = 'Media';
    if (km < 40) {
      weakness = 'Volume insufficiente — aumenta la frequenza settimanale';
      tips = [
        'Punta a 4 uscite/sett: 3 uscite facili (Z2) + 1 long run domenica di 70-90min.',
        'Aggiungi 1 sessione di soglia a settimana: 5-6km al ritmo gara 10km. Questo è il workout più efficace per abbassare i tempi.',
        'Brick run settimanale: corri 20-30min subito dopo la bici — la corsa post-bici è più impegnativa e richiede adattamento specifico.',
      ];
      exampleSession = 'Soglia: 15min riscaldamento → 3×1mile (1,6km) a ritmo 10km gara rec 90s → 10min defaticamento';
    } else {
      weakness = 'Buon volume. Aggiungi qualità e specificità per il triathlon';
      tips = [
        'Brick run obbligatorio: almeno 1 volta a settimana esci a correre subito dopo la bici (anche 3-4km). Le gambe si "sbloccano" solo con la pratica.',
        'Intervalli: 10×400m al ritmo 5km con 90s rec — migliorano la capacità lattacida e abbassano il ritmo di soglia.',
        'Off-brick pacing: in gara accetta che il primo km di corsa sia 5-10s/km più lento del ritmo target — è normale.',
      ];
      exampleSession = 'Brick: 60min bici Z2+Sweet Spot → immediata transizione → 30min corsa (primo km facile, poi ritmo olimpico)';
    }
  } else {
    priority = 'Bassa';
    weakness = 'Ottima corsa. Focalizzati sulla specificità triathlon';
    tips = [
      'Il brick run settimanale è ancora più importante per te: l\'affaticamento da bici cambia la meccanica di corsa anche per i runner veloci.',
      'Lavora sul pacing dei brick: i runner tendono a partire troppo forte dopo la bici — parti sempre a -10s/km rispetto al target.',
      'Taper run: 10 giorni prima della gara riduci il volume del 30-40%, mantieni 2 sessioni di qualità brevi per la reattività neuromuscolare.',
    ];
    exampleSession = 'Brick race-specific: 40min bici a ritmo gara → transizione T2 → 20min corsa progressiva (ultimi 5min a ritmo gara)';
  }

  return { label: 'Corsa', level, volumeDisplay: volDisplay, priority, weakness, tips, exampleSession, isLimitingFactor: false };
}

/**
 * Generates a personalized coaching report based on athlete performance and training volume.
 * Advice is based on triathlon-specific training science (polarized training, FTP-based zones,
 * Swim Smooth CSS methodology, and brick-specific guidelines).
 */
export function calcCoachingAdvice(data: AthleteData): CoachingReport {
  const swim = swimAdvice(data);
  const bike = bikeAdvice(data);
  const run  = runAdvice(data);

  const hasEnoughData = swim !== null || bike !== null || run !== null;

  // Identify the limiting factor (lowest level discipline)
  const levels = ['Principiante', 'Amatore', 'Competitivo', 'Elite'];
  const disciplines: Array<{ name: 'Nuoto' | 'Bici' | 'Corsa'; advice: DisciplineAdvice | null }> = [
    { name: 'Nuoto', advice: swim },
    { name: 'Bici',  advice: bike },
    { name: 'Corsa', advice: run  },
  ];

  let limitingFactor: 'Nuoto' | 'Bici' | 'Corsa' | null = null;
  let minLevelIdx = 4;

  for (const d of disciplines) {
    if (!d.advice) continue;
    const idx = levels.indexOf(d.advice.level);
    if (idx < minLevelIdx) { minLevelIdx = idx; limitingFactor = d.name; }
  }

  // Mark the limiting factor
  if (swim && limitingFactor === 'Nuoto') swim.isLimitingFactor = true;
  if (bike && limitingFactor === 'Bici')  bike.isLimitingFactor = true;
  if (run  && limitingFactor === 'Corsa') run.isLimitingFactor  = true;

  // Total weekly hours
  const swimH  = (data.swimWeeklyKm ?? 0) / 2.5;  // ~2.5 km/h average swim speed
  const bikeH  = data.bikeWeeklyHours ?? 0;
  const runH   = (data.runWeeklyKm ?? 0) / 10;     // ~10 km/h easy run
  const totalWeeklyHours = Math.round((swimH + bikeH + runH) * 10) / 10;

  // General tips based on total load
  const generalTips: string[] = [];
  if (totalWeeklyHours > 0) {
    if (totalWeeklyHours < 5) {
      generalTips.push('Con meno di 5 ore/sett, concentra tutto su 1-2 discipline: allenare 3 discipline con poco volume porta a progressi minimi in tutte.');
      generalTips.push('Priorità al limitatore: dedica il 50% delle ore alla disciplina più debole.');
    } else if (totalWeeklyHours < 10) {
      generalTips.push('Un buon piano triathlon base: 2h nuoto + 4h bici + 3h corsa a settimana. Distribuisci in base ai tuoi punti deboli.');
      generalTips.push('Includi almeno 1 brick a settimana (bici + corsa immediata): è il workout più specifico del triathlon.');
    } else {
      generalTips.push('Con 10+ ore/sett hai il volume per performare bene. L\'errore principale a questo livello è fare tutto a intensità media — polarizza.');
      generalTips.push('Recovery: il miglioramento avviene nel recupero, non durante l\'allenamento. Dormi 7-9h, gestisci lo stress, e inserisci 1 settimana di scarico ogni 3-4.');
    }
  }
  generalTips.push('Brick training obbligatorio: ogni settimana almeno 1 sessione bici→corsa senza pausa. La corsa da gambe "stanche" si allena solo con la pratica.');
  generalTips.push('Nutrizione in gara: pratica la strategia nutrizionale in allenamento (stessi gel, stesse bevande). Non introdurre nulla di nuovo il giorno della gara.');

  return { hasEnoughData, swim, bike, run, limitingFactor, totalWeeklyHours, generalTips };
}

// ============================================================
// TRAINING ZONES
// ============================================================

export interface BikeZone {
  z: number;
  name: string;
  description: string;
  pctMin: number;
  pctMax: number | null;
  wattsMin: number;
  wattsMax: number | null;
}

export interface RunZone {
  z: number;
  name: string;
  description: string;
  /** Fastest allowed pace in sec/km (lower bound). null = no fast limit (Z5). */
  paceFastEnd: number | null;
  /** Slowest allowed pace in sec/km (upper bound). null = no slow limit (Z1). */
  paceSlowEnd: number | null;
}

export interface TrainingZones {
  ftp: number;
  bikeZones: BikeZone[];
  runThresholdPace: number | null; // sec/km
  runZones: RunZone[];
  hasBike: boolean;
  hasRun: boolean;
}

/**
 * Calculates triathlon training zones for bike (Z1-Z5 based on FTP) and run (Z1-Z5 based on threshold pace).
 * FTP is estimated as bikeWatts20 × 0.95.
 * Threshold pace is estimated as 10km pace + 20s/km.
 */
export function calcTrainingZones(data: AthleteData): TrainingZones {
  const hasBike = data.bikeWatts20 > 0;
  const hasRun  = data.run10kTime != null;

  const ftp = hasBike ? Math.round(data.bikeWatts20 * 0.95) : 0;
  const w = (pct: number) => Math.round(ftp * pct / 100);

  const bikeZones: BikeZone[] = hasBike ? [
    { z: 1, name: 'Recovery',  description: 'Recupero attivo',         pctMin: 0,   pctMax: 55,  wattsMin: 0,      wattsMax: w(55)  },
    { z: 2, name: 'Aerobica',  description: 'Base aerobica (Z2)',       pctMin: 56,  pctMax: 75,  wattsMin: w(56),  wattsMax: w(75)  },
    { z: 3, name: 'Tempo',     description: 'Ritmo sostenuto',          pctMin: 76,  pctMax: 90,  wattsMin: w(76),  wattsMax: w(90)  },
    { z: 4, name: 'Soglia',    description: 'Sweet Spot / FTP',        pctMin: 91,  pctMax: 105, wattsMin: w(91),  wattsMax: w(105) },
    { z: 5, name: 'VO2max',    description: 'Intervalli massimali',    pctMin: 106, pctMax: null, wattsMin: w(106), wattsMax: null   },
  ] : [];

  let runThresholdPace: number | null = null;
  let runZones: RunZone[] = [];

  if (hasRun && data.run10kTime != null) {
    const pace10k = data.run10kTime / 10; // sec/km
    // Threshold pace ≈ 10km pace + 20s/km (roughly 60-min race pace)
    runThresholdPace = Math.round(pace10k + 20);
    const T = runThresholdPace;

    runZones = [
      { z: 1, name: 'Recovery', description: 'Jogging / recupero',           paceFastEnd: T + 75, paceSlowEnd: null    },
      { z: 2, name: 'Aerobica', description: 'Fondo lento / base aerobica',  paceFastEnd: T + 30, paceSlowEnd: T + 75  },
      { z: 3, name: 'Tempo',    description: 'Ritmo maratona / fartlek',     paceFastEnd: T,      paceSlowEnd: T + 30  },
      { z: 4, name: 'Soglia',   description: 'Threshold / ritmo 10km',       paceFastEnd: T - 15, paceSlowEnd: T       },
      { z: 5, name: 'VO2max',   description: 'Intervalli / ritmo 5km',       paceFastEnd: null,   paceSlowEnd: T - 15  },
    ];
  }

  return { ftp, bikeZones, runThresholdPace, runZones, hasBike, hasRun };
}
