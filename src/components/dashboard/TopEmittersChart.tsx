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
import type { CountryEmission } from '@/lib/emissions-types';

interface TopEmittersChartProps {
  data: CountryEmission[];
  title?: string;
}

export function TopEmittersChart({ data, title = "Top Emitters" }: TopEmittersChartProps) {
  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      totalFormatted: (d.total / 1e9).toFixed(2),
      rank: index + 1,
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-foreground">{data.country}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.continent}</p>
          <p className="text-sm text-primary">
            Total: {(data.total / 1e9).toFixed(2)}B tonnes
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground">Top 10 Countries</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.3}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `${(value / 1e9).toFixed(0)}B`}
              />
              <YAxis
                type="category"
                dataKey="country"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="total" 
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 
                      ? 'hsl(var(--primary))' 
                      : index === 1 
                        ? 'hsl(var(--accent))' 
                        : 'hsl(var(--muted-foreground))'
                    }
                    fillOpacity={1 - (index * 0.08)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
