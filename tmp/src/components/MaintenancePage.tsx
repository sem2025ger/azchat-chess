import { useEffect } from 'react';

export default function MaintenancePage() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
      <div className="max-w-md w-full p-10 rounded-2xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-md">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-[0.2em] uppercase mb-6 opacity-90">
          AZTRChess.De
        </h1>
        <div className="w-8 h-1 bg-emerald-500/50 mx-auto mb-8 rounded-full"></div>
        <p className="text-neutral-400 text-base sm:text-lg leading-relaxed font-medium">
          We are preparing for launch.
          <br />
          The platform will be available soon.
        </p>
      </div>
    </div>
  );
}
