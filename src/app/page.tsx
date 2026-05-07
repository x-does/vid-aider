import { ModelStudio } from '@/components/model-studio';

export default function Home() {
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#b4a6cc]">xdoes tool</p>
          <h1 className="font-display text-4xl font-black leading-none text-[#f3edff] sm:text-6xl">
            Vid <span className="text-[#c6a8ff]">Aider</span>
          </h1>
        </div>
        <details className="max-w-md rounded-2xl border border-[#7f6b9d]/18 bg-[#0f0c17]/40 p-3 text-sm text-[#b9accf]">
          <summary className="cursor-pointer text-[#f3edff]">What is this?</summary>
          <p className="mt-2 leading-6">Load many 3D assets, control one/all/groups, spin loops, snapshot PNG, record WebM. Hover controls for help.</p>
        </details>
      </section>

      <ModelStudio />
    </div>
  );
}
