import Link from 'next/link';

const SOCIALS = [
  { label: 'x', href: 'https://x.com/xdoes' },
  { label: 'github', href: 'https://github.com/x-does' },
  { label: 'youtube', href: 'https://youtube.com/@x-does' },
];

export function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#07060b] text-[#efeafc]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(143,113,196,0.08),transparent_45%),radial-gradient(circle_at_78%_68%,rgba(143,113,196,0.06),transparent_42%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-[#7f6b9d]/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <Link href="/" className="group inline-flex items-baseline gap-3">
            <span className="font-display text-3xl font-black leading-none text-[#f3edff] transition-colors group-hover:text-white">X</span>
            <span className="text-sm uppercase tracking-[0.28em] text-[#b4a6cc]">Vid Aider</span>
          </Link>
          <nav className="flex flex-wrap gap-3 text-xs lowercase text-[#ac9cc4]">
            <a className="hover:text-white" href="#studio">studio</a>
            <a className="hover:text-white" href="#assets">assets</a>
            <a className="hover:text-white" href="#export">export</a>
            <a className="hover:text-white" href="https://node.xdoes.space/interactive-apps">xdoes apps</a>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 flex flex-col items-end space-y-4 border-t border-[#7f6b9d]/20 pt-4 text-right">
          <div className="flex flex-wrap justify-end gap-3 text-xs lowercase text-[#ac9cc4]">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="hover:text-white">
                {s.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
