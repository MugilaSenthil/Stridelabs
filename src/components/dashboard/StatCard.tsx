import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  unit?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: 'primary' | 'accent' | 'warning' | 'destructive';
  delay?: number;
}

function AnimatedNumber({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number>();

  useEffect(() => {
    startTime.current = null;
    
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(value * easeOutQuart));
      
      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    animationFrame.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [value, duration]);

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  return <span className="font-mono">{formatNumber(displayValue)}</span>;
}

export function StatCard({ title, value, unit = 'MtCO₂e', icon, trend, color = 'primary', delay = 0 }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const colorStyles = {
    primary: 'from-primary/20 to-primary/5 border-primary/30',
    accent: 'from-accent/20 to-accent/5 border-accent/30',
    warning: 'from-warning/20 to-warning/5 border-warning/30',
    destructive: 'from-destructive/20 to-destructive/5 border-destructive/30',
  };

  const iconColors = {
    primary: 'text-primary',
    accent: 'text-accent',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  return (
    <Card
      variant="glass"
      className={cn(
        "relative overflow-hidden transition-all duration-500 hover:scale-[1.02]",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", colorStyles[color])} />
      
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight">
                <AnimatedNumber value={Math.round(value)} />
              </h3>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend > 0 ? (
                  <TrendingUp className="h-4 w-4 text-destructive" />
                ) : trend < 0 ? (
                  <TrendingDown className="h-4 w-4 text-primary" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  trend > 0 ? "text-destructive" : trend < 0 ? "text-primary" : "text-muted-foreground"
                )}>
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs last year</span>
              </div>
            )}
          </div>
          
          <div className={cn(
            "p-3 rounded-xl bg-background/50",
            iconColors[color]
          )}>
            {icon}
          </div>
        </div>
      </div>
    </Card>
  );
}
