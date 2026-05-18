// Avatar/Farb-Helper – konsistente Initialen-Avatare pro Username
// Wird aktuell genutzt von:
//   - /pages/termine/ModuleTerminePage.jsx
//   - /pages/aufgaben/ModuleAufgabenPage.jsx

export const AVATAR_PALETTE = [
  { bg: "bg-blue-500", border: "border-blue-500" },
  { bg: "bg-emerald-500", border: "border-emerald-500" },
  { bg: "bg-amber-500", border: "border-amber-500" },
  { bg: "bg-rose-500", border: "border-rose-500" },
  { bg: "bg-blue-700", border: "border-blue-700" },
  { bg: "bg-teal-500", border: "border-teal-500" },
  { bg: "bg-orange-500", border: "border-orange-500" },
  { bg: "bg-pink-500", border: "border-pink-500" },
  { bg: "bg-indigo-500", border: "border-indigo-500" },
  { bg: "bg-cyan-500", border: "border-cyan-500" },
  { bg: "bg-lime-600", border: "border-lime-600" },
  { bg: "bg-blue-900", border: "border-blue-900" },
];

export const colorForUser = (username) => {
  if (!username) return null;
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

export const initialsOf = (username) => {
  if (!username) return "?";
  const parts = username.split(/[._\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "?").toUpperCase();
};

export const MonteurAvatar = ({ username, size = "sm", title }) => {
  const c = colorForUser(username);
  if (!c) return null;
  const sizeCls = size === "lg" ? "w-9 h-9 text-sm" : "w-6 h-6 text-[10px]";
  return (
    <div
      className={`${sizeCls} rounded-full ${c.bg} text-white font-bold flex items-center justify-center flex-shrink-0 select-none`}
      title={title || username}
    >
      {initialsOf(username)}
    </div>
  );
};
