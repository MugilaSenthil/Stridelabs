import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { SectorEmission } from '@/lib/emissions-types';

interface SectorBreakdownProps {
  data: SectorEmission[];
  title?: string;
}

const COLORS = [
  'hsl(160, 84%, 39%)',  // primary - Energy
  'hsl(199, 89%, 48%)',  // accent - Transport
  'hsl(38, 92%, 50%)',   // warning - Industry
  'hsl(280, 65%, 60%)',  // purple - Agriculture
  'hsl(0, 72%, 51%)',    // destructive - Buildings
  'hsl(262, 83%, 58%)',  // violet - Waste
  'hsl(180, 60%, 45%)',  // teal - Other
  'hsl(220, 40%, 50%)',  // slate
];

export function SectorBreakdown({ data, title = "Emissions by Sector" }: SectorBreakdownProps) {
  const chartData = useMemo(() => {
    return data.slice(0, 8).map((d, i) => ({
      ...d,
      color: COLORS[i % COLORS.length],
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-foreground">{data.sector}</p>
          <p className="text-sm text-muted-foreground">
            {(data.value / 1e9).toFixed(2)}B tonnes
          </p>
          <p className="text-sm text-primary font-medium">
            {data.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="sector"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
