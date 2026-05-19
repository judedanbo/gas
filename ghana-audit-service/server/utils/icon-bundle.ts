import { createRequire } from 'node:module'

// Use process.cwd() as the base for module resolution instead of
// import.meta.url, which Nitro transforms into a virtual path
// (/_entry.js) during prerendering — breaking createRequire.
const _require = createRequire(process.cwd() + '/package.json')

let _heroicons: unknown
let _simpleIcons: unknown

export const collections: Record<string, () => unknown> = {
  heroicons: () => {
    _heroicons ??= _require('@iconify-json/heroicons/icons.json')
    return _heroicons
  },
  'simple-icons': () => {
    _simpleIcons ??= _require('@iconify-json/simple-icons/icons.json')
    return _simpleIcons
  },
}
