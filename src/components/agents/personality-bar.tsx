import clsx from 'clsx';

interface PersonalityBarProps {
  trait: string;
  value: number;
  className?: string;
}

export function PersonalityBar({ trait, value, className }: PersonalityBarProps) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <span className="text-sm text-white/50 w-28 capitalize shrink-0">{trait}</span>
      <div className="score-meter flex-1">
        <div className="score-meter-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-medium text-white/70 w-8 text-right">{value}</span>
    </div>
  );
}
