import { describe, it, expect } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  canFramePdf,
  clampPage,
  nextScale,
  zoomPercent
} from '~/utils/pdfViewer'

describe('nextScale', () => {
  it('steps the scale by a quarter in either direction', () => {
    expect(nextScale(1, 1)).toBe(1.25)
    expect(nextScale(1, -1)).toBe(0.8)
    expect(nextScale(0.8, 1)).toBe(1)
  })

  it('stays within the offered range', () => {
    expect(nextScale(MAX_SCALE, 1)).toBe(MAX_SCALE)
    expect(nextScale(3.9, 1)).toBe(MAX_SCALE)
    expect(nextScale(MIN_SCALE, -1)).toBe(MIN_SCALE)
    expect(nextScale(0.26, -1)).toBe(MIN_SCALE)
  })
})

describe('zoomPercent', () => {
  it('rounds the scale to whole percent', () => {
    expect(zoomPercent(1)).toBe(100)
    expect(zoomPercent(1.004)).toBe(100)
    expect(zoomPercent(0.333)).toBe(33)
  })
})

describe('clampPage', () => {
  it('keeps the page within the document', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(1, 10)).toBe(1)
    expect(clampPage(10, 10)).toBe(10)
    expect(clampPage(11, 10)).toBe(10)
  })

  it('rounds fractional input and falls back to the first page', () => {
    expect(clampPage(3.6, 10)).toBe(4)
    expect(clampPage(Number.NaN, 10)).toBe(1)
    expect(clampPage(5, 0)).toBe(1)
  })
})

describe('canFramePdf', () => {
  it('frames only on a mouse-driven browser with a built-in PDF viewer', () => {
    expect(canFramePdf({ pdfViewerEnabled: true }, true)).toBe(true)
  })

  it('does not frame on touch devices, even ones that report a viewer (iOS Safari)', () => {
    expect(canFramePdf({ pdfViewerEnabled: true }, false)).toBe(false)
  })

  it('does not frame without a built-in viewer (Chrome for Android, old browsers)', () => {
    expect(canFramePdf({ pdfViewerEnabled: false }, true)).toBe(false)
    expect(canFramePdf({}, true)).toBe(false)
  })
})
