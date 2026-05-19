export default function EnvelopesPage() {
  return (
    <div className="p-4">
      <header className="flex items-center justify-between py-2 mb-6">
        <h1 className="text-xl font-semibold text-brand-text">Envelopes</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-surface border border-brand-border text-brand-accent active:opacity-70">
          <PlusIcon />
        </button>
      </header>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center mb-4">
          <EnvelopeIcon />
        </div>
        <p className="text-brand-text font-medium mb-1">No envelopes yet</p>
        <p className="text-brand-text-muted text-sm">
          Tap + to create your first envelope
        </p>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-8 h-8 text-brand-muted"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}
