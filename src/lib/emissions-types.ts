// Emission data types and utilities

export interface EmissionRecord {
  year: number;
  country: string;
  iso: string;
  continent: string;
  sector: string;
  gas: string;
  emission_value: number;
  source: string;
}

export interface CountryEmission {
  country: string;
  iso: string;
  continent: string;
  total: number;
  co2: number;
  ch4?: number;
  n2o?: number;
}

export interface SectorEmission {
  sector: string;
  value: number;
  percentage: number;
}

export interface YearlyTrend {
  year: number;
  total: number;
  co2?: number;
  ch4?: number;
  n2o?: number;
}

export interface ProcessedData {
  records: EmissionRecord[];
  countries: string[];
  years: number[];
  sectors: string[];
  continents: string[];
  totalEmissions: number;
  latestYear: number;
}

// Continent mapping based on ISO codes
export const continentMapping: Record<string, string> = {
  // Africa
  DZA: 'Africa', AGO: 'Africa', BEN: 'Africa', BWA: 'Africa', BFA: 'Africa',
  BDI: 'Africa', CMR: 'Africa', CPV: 'Africa', CAF: 'Africa', TCD: 'Africa',
  COM: 'Africa', COG: 'Africa', COD: 'Africa', CIV: 'Africa', DJI: 'Africa',
  EGY: 'Africa', GNQ: 'Africa', ERI: 'Africa', ETH: 'Africa', GAB: 'Africa',
  GMB: 'Africa', GHA: 'Africa', GIN: 'Africa', GNB: 'Africa', KEN: 'Africa',
  LSO: 'Africa', LBR: 'Africa', LBY: 'Africa', MDG: 'Africa', MWI: 'Africa',
  MLI: 'Africa', MRT: 'Africa', MUS: 'Africa', MAR: 'Africa', MOZ: 'Africa',
  NAM: 'Africa', NER: 'Africa', NGA: 'Africa', RWA: 'Africa', STP: 'Africa',
  SEN: 'Africa', SYC: 'Africa', SLE: 'Africa', SOM: 'Africa', ZAF: 'Africa',
  SSD: 'Africa', SDN: 'Africa', SWZ: 'Africa', TZA: 'Africa', TGO: 'Africa',
  TUN: 'Africa', UGA: 'Africa', ZMB: 'Africa', ZWE: 'Africa',
  
  // Asia
  AFG: 'Asia', ARM: 'Asia', AZE: 'Asia', BHR: 'Asia', BGD: 'Asia',
  BTN: 'Asia', BRN: 'Asia', KHM: 'Asia', CHN: 'Asia', CYP: 'Asia',
  GEO: 'Asia', IND: 'Asia', IDN: 'Asia', IRN: 'Asia', IRQ: 'Asia',
  ISR: 'Asia', JPN: 'Asia', JOR: 'Asia', KAZ: 'Asia', KWT: 'Asia',
  KGZ: 'Asia', LAO: 'Asia', LBN: 'Asia', MYS: 'Asia', MDV: 'Asia',
  MNG: 'Asia', MMR: 'Asia', NPL: 'Asia', PRK: 'Asia', OMN: 'Asia',
  PAK: 'Asia', PHL: 'Asia', QAT: 'Asia', SAU: 'Asia', SGP: 'Asia',
  KOR: 'Asia', LKA: 'Asia', SYR: 'Asia', TWN: 'Asia', TJK: 'Asia',
  THA: 'Asia', TLS: 'Asia', TUR: 'Asia', TKM: 'Asia', ARE: 'Asia',
  UZB: 'Asia', VNM: 'Asia', YEM: 'Asia',
  
  // Europe
  ALB: 'Europe', AND: 'Europe', AUT: 'Europe', BLR: 'Europe', BEL: 'Europe',
  BIH: 'Europe', BGR: 'Europe', HRV: 'Europe', CZE: 'Europe', DNK: 'Europe',
  EST: 'Europe', FIN: 'Europe', FRA: 'Europe', DEU: 'Europe', GRC: 'Europe',
  HUN: 'Europe', ISL: 'Europe', IRL: 'Europe', ITA: 'Europe', LVA: 'Europe',
  LIE: 'Europe', LTU: 'Europe', LUX: 'Europe', MLT: 'Europe', MDA: 'Europe',
  MCO: 'Europe', MNE: 'Europe', NLD: 'Europe', MKD: 'Europe', NOR: 'Europe',
  POL: 'Europe', PRT: 'Europe', ROU: 'Europe', RUS: 'Europe', SMR: 'Europe',
  SRB: 'Europe', SVK: 'Europe', SVN: 'Europe', ESP: 'Europe', SWE: 'Europe',
  CHE: 'Europe', UKR: 'Europe', GBR: 'Europe', VAT: 'Europe',
  
  // North America
  ATG: 'North America', BHS: 'North America', BRB: 'North America', BLZ: 'North America',
  CAN: 'North America', CRI: 'North America', CUB: 'North America', DMA: 'North America',
  DOM: 'North America', SLV: 'North America', GRD: 'North America', GTM: 'North America',
  HTI: 'North America', HND: 'North America', JAM: 'North America', MEX: 'North America',
  NIC: 'North America', PAN: 'North America', KNA: 'North America', LCA: 'North America',
  VCT: 'North America', TTO: 'North America', USA: 'North America',
  
  // South America
  ARG: 'South America', BOL: 'South America', BRA: 'South America', CHL: 'South America',
  COL: 'South America', ECU: 'South America', GUY: 'South America', PRY: 'South America',
  PER: 'South America', SUR: 'South America', URY: 'South America', VEN: 'South America',
  
  // Oceania
  AUS: 'Oceania', FJI: 'Oceania', KIR: 'Oceania', MHL: 'Oceania', FSM: 'Oceania',
  NRU: 'Oceania', NZL: 'Oceania', PLW: 'Oceania', PNG: 'Oceania', WSM: 'Oceania',
  SLB: 'Oceania', TON: 'Oceania', TUV: 'Oceania', VUT: 'Oceania',
};

export function getContinent(iso: string): string {
  return continentMapping[iso] || 'Unknown';
}

export function formatEmissionValue(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

export const sectorColors: Record<string, string> = {
  'Energy': 'hsl(var(--chart-1))',
  'Transport': 'hsl(var(--chart-2))',
  'Industry': 'hsl(var(--chart-3))',
  'Agriculture': 'hsl(var(--chart-4))',
  'Buildings': 'hsl(var(--chart-5))',
  'Waste': 'hsl(var(--chart-6))',
  'Land Use': 'hsl(280, 65%, 60%)',
  'Other': 'hsl(var(--muted-foreground))',
};

export const gasColors: Record<string, string> = {
  'CO2': 'hsl(var(--chart-1))',
  'CH4': 'hsl(var(--chart-2))',
  'N2O': 'hsl(var(--chart-3))',
  'Total GHG': 'hsl(var(--chart-4))',
};
