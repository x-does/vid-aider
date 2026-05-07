import { ModelStudio } from '@/components/model-studio';

const features = [
  'Import STL / OBJ / GLTF / GLB directly in the browser',
  'Spin-loop controls for clean product and 3D object showcases',
  'PNG frame capture and WebM loop recording using canvas capture',
  'Resolution + FPS presets for Shorts, HD, square posts, and 4K planning',
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 md:grid-cols-[1fr_22rem] md:items-end">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#b4a6cc]">xdoes interactive tool</p>
          <h1 className="font-display text-5xl font-black leading-[0.92] text-[#f3edff] sm:text-7xl md:text-8xl">
            Vid
            <span className="block text-[#c6a8ff]">Aider</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#cfc3e6]">
            Browser-based video creation helper for loading 3D objects, building simple spin loops,
            and recording clean model showcases without leaving the page.
          </p>
        </div>
        <div className="rounded-2xl border border-[#7f6b9d]/18 bg-[#0f0c17]/40 p-6 text-sm leading-7 text-[#cfc3e6]">
          {features.map((feature) => (
            <div key={feature} className="border-b border-[#7f6b9d]/10 py-2 last:border-0">{feature}</div>
          ))}
        </div>
      </section>

      <ModelStudio />
    </div>
  );
}
