/**
 * Icon mapping from emojis and shorthand names to Heroicons
 * This allows backward compatibility during migration from emojis to proper icons
 */
export const iconMap: Record<string, string> = {
  // Plain name aliases (for developer convenience)
  'calendar': 'heroicons:calendar',
  'file': 'heroicons:document-text',
  'folder': 'heroicons:folder',
  'document': 'heroicons:document-text',
  'user': 'heroicons:user',
  'phone': 'heroicons:phone',
  'email': 'heroicons:envelope',
  'mail': 'heroicons:envelope',
  'search': 'heroicons:magnifying-glass',
  'home': 'heroicons:home',
  'settings': 'heroicons:cog-6-tooth',
  'check': 'heroicons:check',
  'close': 'heroicons:x-mark',
  'warning': 'heroicons:exclamation-triangle',
  'info': 'heroicons:information-circle',
  'error': 'heroicons:exclamation-circle',

  // Contact & Communication
  '📞': 'heroicons:phone',
  '✉️': 'heroicons:envelope',
  '📧': 'heroicons:envelope',
  '📍': 'heroicons:map-pin',
  '🌐': 'heroicons:globe-alt',
  '📢': 'heroicons:megaphone',
  '📬': 'heroicons:envelope-open',

  // Navigation & UI
  '🔍': 'heroicons:magnifying-glass',
  '🔎': 'heroicons:magnifying-glass',
  '🏛️': 'heroicons:building-library',
  '🏠': 'heroicons:home',
  '📊': 'heroicons:chart-bar',
  '📈': 'heroicons:chart-bar',
  '📄': 'heroicons:document-text',
  '📰': 'heroicons:newspaper',
  '📑': 'heroicons:document-duplicate',
  '🔗': 'heroicons:link',
  '⬇️': 'heroicons:arrow-down',
  '⬆️': 'heroicons:arrow-up',
  '➡️': 'heroicons:arrow-right',
  '⬅️': 'heroicons:arrow-left',

  // Actions & Status
  '✓': 'heroicons:check',
  '✔️': 'heroicons:check',
  '✅': 'heroicons:check-circle',
  '❌': 'heroicons:x-circle',
  '⚠️': 'heroicons:exclamation-triangle',
  '❗': 'heroicons:exclamation-circle',
  'ℹ️': 'heroicons:information-circle',
  '🔔': 'heroicons:bell',
  '🎯': 'heroicons:flag',
  '👁️': 'heroicons:eye',

  // Categories & Types
  '💼': 'heroicons:briefcase',
  '🎓': 'heroicons:academic-cap',
  '📋': 'heroicons:clipboard-document-list',
  '🕒': 'heroicons:clock',
  '📅': 'heroicons:calendar',
  '🗓️': 'heroicons:calendar-days',
  '👥': 'heroicons:user-group',
  '👤': 'heroicons:user',
  '🏢': 'heroicons:building-office',
  '💰': 'heroicons:currency-dollar',
  '🔒': 'heroicons:lock-closed',
  '🔓': 'heroicons:lock-open',
  '⚖️': 'heroicons:scale',
  '📝': 'heroicons:pencil-square',
  '🌍': 'heroicons:globe-americas',
  '💻': 'heroicons:computer-desktop',
  '🛡️': 'heroicons:shield-check',
  '📜': 'heroicons:document',

  // Files & Documents
  '📥': 'heroicons:arrow-down-tray',
  '📤': 'heroicons:arrow-up-tray',
  '📁': 'heroicons:folder',
  '📂': 'heroicons:folder-open',
  '🗂️': 'heroicons:archive-box',
  '📎': 'heroicons:paper-clip',

  // Media
  '🖼️': 'heroicons:photo',
  '📸': 'heroicons:camera',
  '🎥': 'heroicons:video-camera',
  '🎤': 'heroicons:microphone',

  // Misc
  '⚙️': 'heroicons:cog-6-tooth',
  '🔧': 'heroicons:wrench-screwdriver',
  '💡': 'heroicons:light-bulb',
  '🌟': 'heroicons:star',
  '⭐': 'heroicons:star',
  '❤️': 'heroicons:heart',
  '🏆': 'heroicons:trophy',
  '🚀': 'heroicons:rocket-launch',
  '⚡': 'heroicons:bolt',
  '🎉': 'heroicons:sparkles'
}

/**
 * Resolve an icon string to a Heroicon name
 * Returns the original string if not an emoji (assumes it's already an icon name)
 */
export function resolveIcon(icon: string): string {
  return iconMap[icon] || icon
}

/**
 * Check if a string is an emoji
 */
export function isEmoji(str: string): boolean {
  return str in iconMap
}
