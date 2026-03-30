const BrandBadge = () => {
  return (
    <div className="flex items-center gap-2">
      <img src="/app-icon.png" alt="yoobro" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/15" />
      <span className="font-display text-sm font-semibold tracking-[0.18em] text-primary">
        yoobro
      </span>
    </div>
  );
};

export default BrandBadge;
