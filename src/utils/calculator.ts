import { formatSeconds, formatSpeed, formatPace, formatSwimPace } from './formatters';

// ============================================================
// TYPES
// ============================================================

export interface AthleteData {
  weightKg: number;
  swim400Time?: number;   // seconds
  swim1500Time?: number;  // seconds
  bikeWatts20: number;
  bikeWatts90?: number;
  bikeWatts180?: number;
  run10kTime?: number;    // seconds
  runHalfTime?: number;   // seconds
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
 * Model: P = 0.5 * rho * CdA * v³ + Crr * totalMass * g * v
 *   - rho = 1.225 kg/m³ (air density)
 *   - CdA = 0.32 m² (aero triathlon position)
 *   - Crr = 0.004 (road rolling resistance)
 *   - totalMass = athleteKg + 8 (bike ~8kg)
 */
function solveForSpeedMs(watts: number, weightKg: number): number {
  const rho = 1.225;
  const CdA = 0.32;
  const Crr = 0.004;
  const g = 9.81;
  const mass = weightKg + 8;

  const A = 0.5 * rho * CdA; // coefficient for v³
  const B = Crr * mass * g;  // coefficient for v

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
    v = Math.max(0.1, vNew); // prevent negative speed
  }

  return v;
}

/**
 * Calculates estimated bike time for a given distance and race format.
 */
function calcBikeTime(data: AthleteData, bikeM: number, format: string): FractionResult | null {
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

  const speedMs = solveForSpeedMs(watts, data.weightKg);
  const speedKmh = speedMs * 3.6;
  const bikeKm = bikeM / 1000;
  const estimatedSec = (bikeKm / speedKmh) * 3600;

  return {
    seconds: estimatedSec,
    displayTime: formatSeconds(estimatedSec),
    speedKmh,
  };
}

// ============================================================
// RUN CALCULATION
// ============================================================

const FATIGUE_FACTORS: Record<string, number> = {
  sprint: 1.03,
  olympic: 1.05,
  half: 1.08,
  full: 1.13,
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
export function calcAllDistances(data: AthleteData): RaceResult[] {
  return DISTANCES.map((d) => {
    const swim = calcSwimTime(data, d.swimM, d.key);
    const bike = calcBikeTime(data, d.bikeM, d.key);
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
