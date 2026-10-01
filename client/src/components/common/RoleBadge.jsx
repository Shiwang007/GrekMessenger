const ROLE_STYLES = {
  OWNER: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  ADMIN: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  MEMBER: "bg-slate-700/50 text-slate-400 border border-slate-700",
};

export default function RoleBadge({ role, className = "" }) {
  if (!role) return null;
  const style = ROLE_STYLES[role] || ROLE_STYLES.MEMBER;

  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${style} ${className}`}
    >
      {role}
    </span>
  );
}
