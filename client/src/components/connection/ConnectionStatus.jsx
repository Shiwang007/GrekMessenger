import { useSocket } from "../../socket/SocketProvider";

export default function ConnectionStatus({ showText = false, className = "" }) {
  const { status, isConnected } = useSocket();

  const isConnecting = status === "connecting" || status === "reconnecting";
  const isSyncing = status === "syncing";
  const isError = status === "error";
  const isLive = status === "ready" || status === "connected";

  const config = isLive
    ? {
        color: "bg-emerald-500",
        pulse: "bg-emerald-400",
        label: "Live",
        tooltip: "Connected to real-time gateway",
      }
    : isSyncing
    ? {
        color: "bg-sky-500",
        pulse: "bg-sky-400",
        label: "Syncing...",
        tooltip: "Synchronizing missed messages...",
      }
    : isConnecting
    ? {
        color: "bg-amber-500",
        pulse: "bg-amber-400",
        label: status === "reconnecting" ? "Reconnecting..." : "Connecting...",
        tooltip: "Reconnecting to real-time gateway...",
      }
    : {
        color: "bg-rose-500",
        pulse: "bg-rose-400",
        label: isError ? "Connection Error" : "Disconnected",
        tooltip: "Real-time gateway disconnected",
      };

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium transition-all ${className}`}
      title={config.tooltip}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulse}`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`}
        ></span>
      </span>
      {showText && <span className="text-slate-300 font-mono">{config.label}</span>}
    </div>
  );
}
