export interface BioSection {
  heading: string | null
  content: string
}

export function parseBioSections(bio: string): BioSection[] {
  if (!bio.trim()) return []

  const parts = bio.split(/^## /m)
  const sections: BioSection[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue

    if (i === 0 && !bio.trimStart().startsWith('## ')) {
      sections.push({ heading: null, content: part })
    } else {
      const newlineIndex = part.indexOf('\n')
      if (newlineIndex === -1) continue
      const heading = part.slice(0, newlineIndex).trim()
      const content = part.slice(newlineIndex + 1).trim()
      if (!content) continue
      sections.push({ heading, content })
    }
  }

  return sections
}
