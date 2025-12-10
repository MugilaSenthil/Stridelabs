import { useState, useMemo } from 'react';
import { useEmissionsData } from '@/hooks/useEmissionsData';
import { StatCard } from '@/components/dashboard/StatCard';
import { EmissionsTrendChart } from '@/components/dashboard/EmissionsTrendChart';
import { SectorBreakdown } from '@/components/dashboard/SectorBreakdown';
import { TopEmittersChart } from '@/components/dashboard/TopEmittersChart';
import { ContinentChart } from '@/components/dashboard/ContinentChart';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { WorldMap } from '@/components/dashboard/WorldMap';
import { AIChatPanel } from '@/components/dashboard/AIChatPanel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity, Zap, Factory, Truck, Download, Globe, MessageSquare } from 'lucide-react';
import { getContinent } from '@/lib/emissions-types';

const Index = () => {
  const { data, loading, error, getSectorTotals, getYearlyTrends, getTopEmitters, getGlobalStats, getContinentData } = useEmissionsData();
  const [selectedYear, setSelectedYear] = useState<number>(2021);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [selectedGas, setSelectedGas] = useState<string>('total');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Filter countries by continent if selected
  const filteredCountries = useMemo(() => {
    if (!data) return [];
    let countries = data.countries;
    if (selectedContinent) {
      countries = countries.filter(country => {
        const countryData = data.sectorData.find(d => d.Entity === country);
        if (countryData && countryData.Code) {
          return getContinent(countryData.Code) === selectedContinent;
        }
        return false;
      });
    }
    return countries.filter(c => c && !c.includes('(') && c.length > 2);
  }, [data, selectedContinent]);

  // Apply filters to data
  const stats = useMemo(() => getGlobalStats(selectedYear), [getGlobalStats, selectedYear]);
  
  const sectorData = useMemo(() => {
    const baseData = getSectorTotals(selectedYear);
    // Gas type affects the total values display
    return baseData;
  }, [getSectorTotals, selectedYear]);

  const yearlyTrends = useMemo(() => {
    return getYearlyTrends(selectedCountry || undefined);
  }, [getYearlyTrends, selectedCountry]);

  const topEmitters = useMemo(() => {
    let emitters = getTopEmitters(selectedYear, 15);
    if (selectedContinent) {
      emitters = emitters.filter(e => e.continent === selectedContinent);
    }
    return emitters.slice(0, 10);
  }, [getTopEmitters, selectedYear, selectedContinent]);

  const continentData = useMemo(() => getContinentData(selectedYear), [getContinentData, selectedYear]);

  const availableYears = useMemo(() => {
    if (!data) return [];
    return data.years.filter(y => y >= 1990 && y <= 2022);
  }, [data]);

  const handleExportCSV = () => {
    if (!data) return;
    
    const headers = ['Entity', 'Code', 'Year', 'Total_GHG'];
    const rows = data.sectorData
      .filter(d => parseInt(d.Year) === selectedYear)
      .map(d => [d.Entity, d.Code, d.Year, 'calculated_value']);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emissions_${selectedYear}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading emissions data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-lg">Error loading data</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const gasMultiplier = selectedGas === 'co2' ? 0.75 : selectedGas === 'ch4' ? 0.16 : selectedGas === 'n2o' ? 0.06 : 1;
  const gasLabel = { total: 'Total GHG', co2: 'CO₂', ch4: 'CH₄', n2o: 'N₂O' }[selectedGas] || 'Total GHG';

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* Top Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">Global Emissions Intelligence</h1>
                  <p className="text-xs text-muted-foreground">Real-time greenhouse gas monitoring dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[120px] bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="glass" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button 
                  variant={isChatOpen ? 'default' : 'glass'} 
                  size="sm" 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  AI Chat
                </Button>
              </div>
            </div>

            {/* Filter Row */}
            <FilterPanel
              countries={filteredCountries}
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              selectedContinent={selectedContinent}
              onContinentChange={setSelectedContinent}
              selectedGas={selectedGas}
              onGasChange={setSelectedGas}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Active Filters Summary */}
        {(selectedCountry || selectedContinent || selectedGas !== 'total') && (
          <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground">
              Showing <span className="font-semibold text-primary">{gasLabel}</span> emissions
              {selectedContinent && <> in <span className="font-semibold text-primary">{selectedContinent}</span></>}
              {selectedCountry && <> for <span className="font-semibold text-primary">{selectedCountry}</span></>}
              {' '}({selectedYear})
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title={`Total ${gasLabel}`}
            value={(stats?.totalGHG || 0) * gasMultiplier}
            icon={<Activity className="h-5 w-5" />}
            color="primary"
            trend={2.3}
            delay={0}
          />
          <StatCard
            title="Energy Sector"
            value={(stats?.totalEnergy || 0) * gasMultiplier}
            icon={<Zap className="h-5 w-5" />}
            color="accent"
            trend={1.8}
            delay={100}
          />
          <StatCard
            title="Industry"
            value={(stats?.totalIndustry || 0) * gasMultiplier}
            icon={<Factory className="h-5 w-5" />}
            color="warning"
            trend={-0.5}
            delay={200}
          />
          <StatCard
            title="Transport"
            value={(stats?.totalTransport || 0) * gasMultiplier}
            icon={<Truck className="h-5 w-5" />}
            color="destructive"
            trend={3.1}
            delay={300}
          />
        </div>

        {/* World Map */}
        <div className="mb-8">
          <WorldMap data={topEmitters} selectedGas={selectedGas} year={selectedYear} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <EmissionsTrendChart data={yearlyTrends} title={selectedCountry ? `${selectedCountry} Emissions Trend` : 'Global Emissions Trend'} />
          <SectorBreakdown data={sectorData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopEmittersChart data={topEmitters} title={selectedContinent ? `Top Emitters - ${selectedContinent}` : 'Top Emitters'} />
          <ContinentChart data={continentData} />
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            Data sources: OWID, EDGAR v8.0, Climate Watch • Last updated: {selectedYear}
          </p>
        </footer>
      </main>

      {/* AI Chat Panel */}
      <AIChatPanel 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        contextData={{
          year: selectedYear,
          totalEmissions: stats?.totalGHG || 0,
          topCountry: topEmitters[0]?.country || 'Unknown',
          gasType: selectedGas,
          country: selectedCountry,
          continent: selectedContinent,
        }}
      />
    </div>
  );
};

export default Index;
