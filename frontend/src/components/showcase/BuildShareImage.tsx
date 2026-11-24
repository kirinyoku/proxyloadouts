import { BuildEquipmentCard } from '@/components/showcase/BuildEquipmentCard'
import type { ImageExportSubject } from '@/lib/render-share-image'

export function BuildShareImage({ subject }: { subject: ImageExportSubject }) {
  const builds = subject.kind === 'build'
    ? [subject.build]
    : [...subject.members].sort((a, b) => a.slot_number - b.slot_number).map((member) => member.build)
  return (
    <div
      data-export-root
      className={subject.kind === 'team' ? 'space-y-4 bg-background font-sans text-foreground' : 'bg-card font-sans text-foreground'}
    >
      {subject.kind === 'team' && (
        <header className="border border-white/[0.08] bg-card px-5 py-3">
          <h1 className="font-heading text-xl text-foreground">{subject.team.name}</h1>
        </header>
      )}
      {builds.map((build) => (
        <section key={build.id} className="border border-white/[0.08] bg-card p-5">
          <BuildEquipmentCard variant="image" build={build} />
        </section>
      ))}
    </div>
  )
}

