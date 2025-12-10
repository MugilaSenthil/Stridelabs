import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe2 } from 'lucide-react';
import type { CountryEmission } from '@/lib/emissions-types';

interface WorldMapProps {
  data: CountryEmission[];
  selectedGas: string;
  year: number;
}

// ISO country codes to approximate positions for visualization
const COUNTRY_POSITIONS: Record<string, { x: number; y: number }> = {
  'USA': { x: 20, y: 40 },
  'CHN': { x: 75, y: 38 },
  'IND': { x: 68, y: 50 },
  'RUS': { x: 65, y: 25 },
  'JPN': { x: 85, y: 38 },
  'DEU': { x: 50, y: 32 },
  'GBR': { x: 47, y: 30 },
  'FRA': { x: 48, y: 35 },
  'BRA': { x: 30, y: 65 },
  'IDN': { x: 78, y: 60 },
  'IRN': { x: 60, y: 42 },
  'KOR': { x: 82, y: 40 },
  'CAN': { x: 22, y: 28 },
  'MEX': { x: 18, y: 52 },
  'SAU': { x: 58, y: 48 },
  'AUS': { x: 82, y: 72 },
  'ZAF': { x: 55, y: 75 },
  'TUR': { x: 55, y: 38 },
  'POL': { x: 52, y: 32 },
  'ITA': { x: 51, y: 38 },
  'ESP': { x: 46, y: 40 },
  'THA': { x: 76, y: 55 },
  'EGY': { x: 54, y: 48 },
  'PAK': { x: 66, y: 48 },
  'ARG': { x: 28, y: 78 },
  'NGA': { x: 50, y: 55 },
  'VNM': { x: 77, y: 52 },
  'MYS': { x: 76, y: 58 },
  'PHL': { x: 80, y: 55 },
  'BGD': { x: 70, y: 50 },
};

export function WorldMap({ data, selectedGas, year }: WorldMapProps) {
  const mapData = useMemo(() => {
    const maxEmission = Math.max(...data.map(d => d.total));
    return data
      .filter(d => COUNTRY_POSITIONS[d.iso])
      .map(d => ({
        ...d,
        position: COUNTRY_POSITIONS[d.iso],
        size: Math.max(8, Math.min(40, (d.total / maxEmission) * 40)),
        opacity: 0.3 + (d.total / maxEmission) * 0.7,
      }));
  }, [data]);

  const gasLabel = {
    'total': 'Total GHG',
    'co2': 'CO₂',
    'ch4': 'CH₄',
    'n2o': 'N₂O',
  }[selectedGas] || 'Total GHG';

  return (
    <Card variant="glass" className="col-span-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-5 w-5 text-primary" />
          Global Emissions Map - {gasLabel} ({year})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[400px] bg-gradient-to-b from-secondary/30 to-secondary/10 rounded-lg overflow-hidden">
          {/* World Map SVG Background */}
          <svg 
            viewBox="0 0 100 100" 
            className="absolute inset-0 w-full h-full opacity-20"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Simplified continent shapes */}
            <ellipse cx="25" cy="45" rx="18" ry="25" fill="currentColor" className="text-muted-foreground" />
            <ellipse cx="50" cy="40" rx="12" ry="20" fill="currentColor" className="text-muted-foreground" />
            <ellipse cx="70" cy="45" rx="20" ry="22" fill="currentColor" className="text-muted-foreground" />
            <ellipse cx="82" cy="72" rx="8" ry="6" fill="currentColor" className="text-muted-foreground" />
          </svg>

          {/* Emission Bubbles */}
          <svg 
            viewBox="0 0 100 100" 
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {mapData.map((country, index) => (
              <g key={country.iso}>
                {/* Glow effect */}
                <circle
                  cx={country.position.x}
                  cy={country.position.y}
                  r={country.size / 2 + 2}
                  fill="hsl(var(--primary))"
                  opacity={country.opacity * 0.3}
                  className="animate-pulse"
                  style={{ animationDelay: `${index * 100}ms` }}
                />
                {/* Main bubble */}
                <circle
                  cx={country.position.x}
                  cy={country.position.y}
                  r={country.size / 2}
                  fill="hsl(var(--primary))"
                  opacity={country.opacity}
                  className="cursor-pointer transition-all hover:opacity-100"
                />
                {/* Country label for large bubbles */}
                {country.size > 15 && (
                  <text
                    x={country.position.x}
                    y={country.position.y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize="2"
                    fontWeight="bold"
                  >
                    {country.iso}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Emission Intensity</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-primary opacity-30" />
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-primary opacity-60" />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-primary opacity-90" />
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </div>
          </div>

          {/* Top Emitters List */}
          <div className="absolute top-4 right-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border/50 max-w-[200px]">
            <p className="text-xs text-muted-foreground mb-2">Top Emitters</p>
            <div className="space-y-1">
              {data.slice(0, 5).map((country, i) => (
                <div key={country.country} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate">{i + 1}. {country.country}</span>
                  <span className="text-primary font-mono">{(country.total / 1e9).toFixed(1)}B</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
