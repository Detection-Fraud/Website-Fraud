interface MiniCartProps {
  title: string;
  value?: number;
  sub?: string;
  color: string;
}

export default function MiniCart({ title, value, sub, color }: MiniCartProps) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-1">
        {title}
      </p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}
