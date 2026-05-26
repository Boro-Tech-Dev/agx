export function HazardStripe({
  color = '#FFD23E',
  height = '4px',
}: {
  color?: string;
  height?: string;
}) {
  return (
    <div
      className="pointer-events-none w-full opacity-40"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${color} 10px, ${color} 20px)`,
      }}
    />
  );
}
