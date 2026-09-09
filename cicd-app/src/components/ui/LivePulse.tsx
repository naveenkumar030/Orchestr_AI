interface LivePulseProps {
  size?: 'sm' | 'md';
  color?: string;
}

export default function LivePulse({ size = 'sm', color = '#D97757' }: LivePulseProps) {
  const dim = size === 'md' ? 'h-3 w-3' : 'h-2 w-2';
  return (
    <span className={`relative flex ${dim}`}>
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75`}
        style={{ backgroundColor: color }}
      />
      <span
        className={`relative inline-flex rounded-full ${dim}`}
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
