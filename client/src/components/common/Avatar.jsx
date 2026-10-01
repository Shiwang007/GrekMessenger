import { useState, useEffect } from "react";

export default function Avatar({
  src,
  alt = "",
  type = "DIRECT", // "DIRECT" | "GROUP"
  size = "md", // "sm" | "md" | "lg" | "xl"
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset state if src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const isDirect = type === "DIRECT";

  const sizeClasses = {
    sm: "w-7 h-7 text-xs rounded-full",
    md: "w-10 h-10 text-sm rounded-xl",
    lg: "w-11 h-11 text-sm rounded-xl",
    xl: "w-20 h-20 text-2xl rounded-2xl",
  }[size] || "w-10 h-10 text-sm rounded-xl";

  const isReady = Boolean(src && !error && loaded);

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses} ${className}`}>
      {/* Placeholder: Active by default while image is loading or if it fails */}
      {!isReady && (
        <div
          className={`w-full h-full flex items-center justify-center font-bold shadow-inner ${sizeClasses} ${
            isDirect
              ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
              : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
          }`}
        >
          {isDirect ? (
            alt?.[0]?.toUpperCase() || "U"
          ) : (
            <svg
              className={
                size === "xl"
                  ? "w-10 h-10 text-emerald-400"
                  : size === "sm"
                  ? "w-3.5 h-3.5 text-emerald-400"
                  : "w-5 h-5 text-emerald-400"
              }
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          )}
        </div>
      )}

      {/* Actual image: Only visible once successfully loaded without error */}
      {src && !error && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover bg-slate-800 border border-white/10 ${sizeClasses} ${
            isReady ? "block" : "hidden"
          }`}
        />
      )}
    </div>
  );
}
