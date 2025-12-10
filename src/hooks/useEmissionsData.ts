import { useState, useEffect, useCallback } from 'react';
import { 
  loadAllData, 
  getSectorTotals, 
  getYearlyTrends, 
  getTopEmitters,
  getGlobalStats,
  getCountryTimeSeries,
  getContinentData,
  type ProcessedEmissionsData,
  type SectorDataRow 
} from '@/lib/data-loader';
import type { SectorEmission, YearlyTrend, CountryEmission } from '@/lib/emissions-types';

export function useEmissionsData() {
  const [data, setData] = useState<ProcessedEmissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await loadAllData();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getFilteredSectorTotals = useCallback((year?: number): SectorEmission[] => {
    if (!data) return [];
    return getSectorTotals(data.sectorData, year);
  }, [data]);

  const getFilteredYearlyTrends = useCallback((country?: string): YearlyTrend[] => {
    if (!data) return [];
    return getYearlyTrends(data.sectorData, country);
  }, [data]);

  const getFilteredTopEmitters = useCallback((year: number, limit?: number): CountryEmission[] => {
    if (!data) return [];
    return getTopEmitters(data.sectorData, year, limit);
  }, [data]);

  const getStats = useCallback((year: number) => {
    if (!data) return null;
    return getGlobalStats(data.sectorData, year);
  }, [data]);

  const getCountryData = useCallback((country: string) => {
    if (!data) return [];
    return getCountryTimeSeries(data.sectorData, country);
  }, [data]);

  const getContinentStats = useCallback((year: number) => {
    if (!data) return [];
    return getContinentData(data.sectorData, year);
  }, [data]);

  return {
    data,
    loading,
    error,
    getSectorTotals: getFilteredSectorTotals,
    getYearlyTrends: getFilteredYearlyTrends,
    getTopEmitters: getFilteredTopEmitters,
    getGlobalStats: getStats,
    getCountryTimeSeries: getCountryData,
    getContinentData: getContinentStats,
  };
}
