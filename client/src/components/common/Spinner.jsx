const SIZES = {
  xs: "w-3 h-3 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
};

const COLORS = {
  indigo: "border-indigo-500 border-t-transparent",
  white: "border-white border-t-transparent",
};

export default function Spinner({
  size = "md",
  color = "indigo",
  className = "",
}) {
  const sizeClass = SIZES[size] || SIZES.md;
  const colorClass = COLORS[color] || COLORS.indigo;

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full animate-spin flex-shrink-0 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
