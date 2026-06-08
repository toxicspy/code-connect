const BrandBadge = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center">
        <img src="/app-icon.png" alt="yoobro" className="h-full w-full rounded-sm object-cover" />
      </div>
      <div className="leading-none">
        <span className="block font-display text-[15px] font-semibold tracking-[0.18em] text-foreground">
          yoobro
        </span>
        <span className="block pt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
          secure social chat
        </span>
      </div>
    </div>
  );
};

export default BrandBadge;
