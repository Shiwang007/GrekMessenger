export function getReceiptStatus(message) {
  if (message.readAt) return "read";
  if (message.deliveredAt) return "delivered";
  return "sent";
}

export default function ReceiptIcon({ status }) {
  if (status === "read") {
    return (
      <span className="text-blue-400 flex items-center" title="Read">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12l5 5L17 6" />
          <path d="M7 12l5 5L23 6" />
        </svg>
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className="text-indigo-300/70 flex items-center" title="Delivered">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12l5 5L17 6" />
          <path d="M7 12l5 5L23 6" />
        </svg>
      </span>
    );
  }

  return (
    <span className="text-indigo-300/50 flex items-center" title="Sent">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12l5 5L20 6" />
      </svg>
    </span>
  );
}
