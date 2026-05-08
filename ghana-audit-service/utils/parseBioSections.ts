export interface BioSection {
  heading: string | null
  content: string
}

export function parseBioSections(bio: string): BioSection[] {
  if (!bio.trim()) return []

  const [preamble, ...rest] = bio.split(/^## /m)
  const sections: BioSection[] = []

  if (preamble.trim()) {
    sections.push({ heading: null, content: preamble.trim() })
  }

  for (const part of rest) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const newlineIndex = trimmed.indexOf('\n')
    if (newlineIndex === -1) continue
    const heading = trimmed.slice(0, newlineIndex).trim()
    const content = trimmed.slice(newlineIndex + 1).trim()
    if (!content) continue
    sections.push({ heading, content })
  }

  return sections
}
