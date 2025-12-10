import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';

interface FilterPanelProps {
  countries: string[];
  selectedCountry: string | null;
  onCountryChange: (country: string | null) => void;
  selectedContinent: string | null;
  onContinentChange: (continent: string | null) => void;
  selectedGas: string;
  onGasChange: (gas: string) => void;
}

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const GAS_TYPES = [
  { value: 'total', label: 'Total GHG' },
  { value: 'co2', label: 'CO₂' },
  { value: 'ch4', label: 'CH₄' },
  { value: 'n2o', label: 'N₂O' },
];

export function FilterPanel({
  countries,
  selectedCountry,
  onCountryChange,
  selectedContinent,
  onContinentChange,
  selectedGas,
  onGasChange,
}: FilterPanelProps) {
  const hasFilters = selectedCountry || selectedContinent || selectedGas !== 'total';

  const clearFilters = () => {
    onCountryChange(null);
    onContinentChange(null);
    onGasChange('total');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      {/* Continent Filter */}
      <Select 
        value={selectedContinent || 'all'} 
        onValueChange={(v) => onContinentChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[150px] bg-secondary/50 border-border/50">
          <SelectValue placeholder="Continent" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          <SelectItem value="all">All Continents</SelectItem>
          {CONTINENTS.map(continent => (
            <SelectItem key={continent} value={continent}>{continent}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Country Filter */}
      <Select 
        value={selectedCountry || 'all'} 
        onValueChange={(v) => onCountryChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[180px] bg-secondary/50 border-border/50">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border max-h-[300px]">
          <SelectItem value="all">All Countries</SelectItem>
          {countries.slice(0, 100).map(country => (
            <SelectItem key={country} value={country}>{country}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Gas Type Filter */}
      <div className="flex gap-1">
        {GAS_TYPES.map(gas => (
          <Badge
            key={gas.value}
            variant={selectedGas === gas.value ? 'default' : 'outline'}
            className={`cursor-pointer transition-all ${
              selectedGas === gas.value 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary/50 hover:bg-secondary text-foreground border-border/50'
            }`}
            onClick={() => onGasChange(gas.value)}
          >
            {gas.label}
          </Badge>
        ))}
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
