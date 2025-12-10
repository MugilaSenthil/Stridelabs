import Papa from 'papaparse';
import { getContinent, type CountryEmission, type SectorEmission, type YearlyTrend } from './emissions-types';

export interface SectorDataRow {
  Entity: string;
  Code: string;
  Year: string;
  'Greenhouse gas emissions from agriculture': string;
  'Greenhouse gas emissions from land-use change and forestry': string;
  'Greenhouse gas emissions from waste': string;
  'Greenhouse gas emissions from buildings': string;
  'Greenhouse gas emissions from industry': string;
  'Greenhouse gas emissions from manufacturing and construction': string;
  'Greenhouse gas emissions from transport': string;
  'Greenhouse gas emissions from electricity and heat': string;
  'Fugitive emissions of greenhouse gases from energy production': string;
  'Greenhouse gas emissions from other fuel combustion': string;
  'Greenhouse gas emissions from bunker fuels': string;
}

export interface HistoricalDataRow {
  ISO: string;
  Country: string;
  'Data source': string;
  Sector: string;
  Gas: string;
  Unit: string;
  [year: string]: string;
}

export interface GHGDataRow {
  iso: string;
  'Country/Region': string;
  unit: string;
  [year: string]: string;
}

export interface ProcessedEmissionsData {
  sectorData: SectorDataRow[];
  historicalData: HistoricalDataRow[];
  ghgData: GHGDataRow[];
  countries: string[];
  years: number[];
  sectors: string[];
}

async function parseCSV<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const text = await response.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

export async function loadAllData(): Promise<ProcessedEmissionsData> {
  const [sectorData, historicalData, ghgData] = await Promise.all([
    parseCSV<SectorDataRow>('/data/ghg-emissions-by-sector.csv'),
    parseCSV<HistoricalDataRow>('/data/historical_emissions.csv'),
    parseCSV<GHGDataRow>('/data/ghg-emissions.csv'),
  ]);

  const countries = [...new Set(sectorData.map(d => d.Entity).filter(Boolean))];
  const years = [...new Set(sectorData.map(d => parseInt(d.Year)).filter(y => !isNaN(y)))].sort();
  const sectors = [
    'Agriculture',
    'Land Use',
    'Waste',
    'Buildings',
    'Industry',
    'Manufacturing',
    'Transport',
    'Electricity & Heat',
    'Fugitive Emissions',
    'Other Fuel Combustion',
  ];

  return {
    sectorData,
    historicalData,
    ghgData,
    countries,
    years,
    sectors,
  };
}

export function getSectorTotals(data: SectorDataRow[], year?: number): SectorEmission[] {
  const filtered = year 
    ? data.filter(d => parseInt(d.Year) === year)
    : data;

  const sectorMap: Record<string, number> = {
    'Agriculture': 0,
    'Land Use': 0,
    'Waste': 0,
    'Buildings': 0,
    'Industry': 0,
    'Transport': 0,
    'Electricity & Heat': 0,
    'Other': 0,
  };

  filtered.forEach(row => {
    const getValue = (val: string) => parseFloat(val) || 0;
    
    sectorMap['Agriculture'] += getValue(row['Greenhouse gas emissions from agriculture']);
    sectorMap['Land Use'] += getValue(row['Greenhouse gas emissions from land-use change and forestry']);
    sectorMap['Waste'] += getValue(row['Greenhouse gas emissions from waste']);
    sectorMap['Buildings'] += getValue(row['Greenhouse gas emissions from buildings']);
    sectorMap['Industry'] += getValue(row['Greenhouse gas emissions from industry']);
    sectorMap['Transport'] += getValue(row['Greenhouse gas emissions from transport']);
    sectorMap['Electricity & Heat'] += getValue(row['Greenhouse gas emissions from electricity and heat']);
    sectorMap['Other'] += getValue(row['Fugitive emissions of greenhouse gases from energy production']) +
                          getValue(row['Greenhouse gas emissions from other fuel combustion']);
  });

  const total = Object.values(sectorMap).reduce((a, b) => a + b, 0);
  
  return Object.entries(sectorMap)
    .map(([sector, value]) => ({
      sector,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function getYearlyTrends(data: SectorDataRow[], country?: string): YearlyTrend[] {
  const filtered = country 
    ? data.filter(d => d.Entity === country)
    : data;

  const yearMap = new Map<number, number>();

  filtered.forEach(row => {
    const year = parseInt(row.Year);
    if (isNaN(year)) return;

    const getValue = (val: string) => parseFloat(val) || 0;
    const total = 
      getValue(row['Greenhouse gas emissions from agriculture']) +
      getValue(row['Greenhouse gas emissions from waste']) +
      getValue(row['Greenhouse gas emissions from buildings']) +
      getValue(row['Greenhouse gas emissions from industry']) +
      getValue(row['Greenhouse gas emissions from transport']) +
      getValue(row['Greenhouse gas emissions from electricity and heat']);

    yearMap.set(year, (yearMap.get(year) || 0) + total);
  });

  return Array.from(yearMap.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);
}

export function getTopEmitters(data: SectorDataRow[], year: number, limit: number = 10): CountryEmission[] {
  const countryMap = new Map<string, { total: number; iso: string }>();

  data
    .filter(d => parseInt(d.Year) === year && d.Code && d.Entity)
    .forEach(row => {
      const getValue = (val: string) => parseFloat(val) || 0;
      const total = 
        getValue(row['Greenhouse gas emissions from agriculture']) +
        getValue(row['Greenhouse gas emissions from waste']) +
        getValue(row['Greenhouse gas emissions from buildings']) +
        getValue(row['Greenhouse gas emissions from industry']) +
        getValue(row['Greenhouse gas emissions from transport']) +
        getValue(row['Greenhouse gas emissions from electricity and heat']);

      if (total > 0) {
        const existing = countryMap.get(row.Entity);
        countryMap.set(row.Entity, {
          total: (existing?.total || 0) + total,
          iso: row.Code,
        });
      }
    });

  return Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      iso: data.iso,
      continent: getContinent(data.iso),
      total: data.total,
      co2: data.total * 0.75, // Approximate CO2 proportion
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getGlobalStats(data: SectorDataRow[], year: number) {
  const yearData = data.filter(d => parseInt(d.Year) === year);
  
  let totalGHG = 0;
  let totalEnergy = 0;
  let totalTransport = 0;
  let totalIndustry = 0;
  let totalAgriculture = 0;

  yearData.forEach(row => {
    const getValue = (val: string) => parseFloat(val) || 0;
    
    totalGHG += 
      getValue(row['Greenhouse gas emissions from agriculture']) +
      getValue(row['Greenhouse gas emissions from waste']) +
      getValue(row['Greenhouse gas emissions from buildings']) +
      getValue(row['Greenhouse gas emissions from industry']) +
      getValue(row['Greenhouse gas emissions from transport']) +
      getValue(row['Greenhouse gas emissions from electricity and heat']);
    
    totalEnergy += getValue(row['Greenhouse gas emissions from electricity and heat']);
    totalTransport += getValue(row['Greenhouse gas emissions from transport']);
    totalIndustry += getValue(row['Greenhouse gas emissions from industry']);
    totalAgriculture += getValue(row['Greenhouse gas emissions from agriculture']);
  });

  return {
    totalGHG,
    totalEnergy,
    totalTransport,
    totalIndustry,
    totalAgriculture,
    year,
  };
}

export function getCountryTimeSeries(
  data: SectorDataRow[], 
  country: string
): { year: number; energy: number; transport: number; industry: number; agriculture: number; other: number }[] {
  return data
    .filter(d => d.Entity === country)
    .map(row => {
      const getValue = (val: string) => parseFloat(val) || 0;
      return {
        year: parseInt(row.Year),
        energy: getValue(row['Greenhouse gas emissions from electricity and heat']),
        transport: getValue(row['Greenhouse gas emissions from transport']),
        industry: getValue(row['Greenhouse gas emissions from industry']),
        agriculture: getValue(row['Greenhouse gas emissions from agriculture']),
        other: getValue(row['Greenhouse gas emissions from waste']) + 
               getValue(row['Greenhouse gas emissions from buildings']),
      };
    })
    .filter(d => !isNaN(d.year))
    .sort((a, b) => a.year - b.year);
}

export function getContinentData(data: SectorDataRow[], year: number) {
  const continentMap = new Map<string, number>();

  data
    .filter(d => parseInt(d.Year) === year && d.Code)
    .forEach(row => {
      const continent = getContinent(row.Code);
      const getValue = (val: string) => parseFloat(val) || 0;
      const total = 
        getValue(row['Greenhouse gas emissions from agriculture']) +
        getValue(row['Greenhouse gas emissions from waste']) +
        getValue(row['Greenhouse gas emissions from buildings']) +
        getValue(row['Greenhouse gas emissions from industry']) +
        getValue(row['Greenhouse gas emissions from transport']) +
        getValue(row['Greenhouse gas emissions from electricity and heat']);

      if (total > 0 && continent !== 'Unknown') {
        continentMap.set(continent, (continentMap.get(continent) || 0) + total);
      }
    });

  return Array.from(continentMap.entries())
    .map(([continent, total]) => ({ continent, total }))
    .sort((a, b) => b.total - a.total);
}
