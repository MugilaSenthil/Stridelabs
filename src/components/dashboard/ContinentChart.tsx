import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ContinentData {
  continent: string;
  total: number;
}

interface ContinentChartProps {
  data: ContinentData[];
  title?: string;
}

const CONTINENT_COLORS: Record<string, string> = {
  'Asia': 'hsl(160, 84%, 39%)',
  'North America': 'hsl(199, 89%, 48%)',
  'Europe': 'hsl(38, 92%, 50%)',
  'Africa': 'hsl(280, 65%, 60%)',
  'South America': 'hsl(0, 72%, 51%)',
  'Oceania': 'hsl(262, 83%, 58%)',
};

export function ContinentChart({ data, title = "Emissions by Continent" }: ContinentChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      color: CONTINENT_COLORS[d.continent] || 'hsl(var(--muted-foreground))',
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-foreground">{data.continent}</p>
          <p className="text-sm text-primary">
            {(data.total / 1e9).toFixed(2)}B tonnes
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="continent"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `${(value / 1e9).toFixed(0)}B`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="total" 
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
