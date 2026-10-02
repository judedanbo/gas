import { describe, it, expect } from 'vitest'
import {
  createTransferRateMeter,
  estimateSecondsRemaining,
  progressPercent,
  splitDuration
} from '../../../utils/transferProgress'

describe('createTransferRateMeter', () => {
  it('has no rate until two samples span the minimum window', () => {
    const meter = createTransferRateMeter(5000, 750)
    expect(meter.rate()).toBeNull()

    meter.push(0, 0)
    expect(meter.rate()).toBeNull()

    // One fast early chunk must not produce a wild estimate
    meter.push(500_000, 100)
    expect(meter.rate()).toBeNull()

    meter.push(1_000_000, 1000)
    expect(meter.rate()).toBe(1_000_000)
  })

  it('averages over the sliding window so it follows a change in speed', () => {
    const meter = createTransferRateMeter(2000, 500)
    // 100 KB/s for 4 s…
    for (let t = 0; t <= 4000; t += 500) meter.push(t * 100, t)
    expect(meter.rate()).toBeCloseTo(100_000)

    // …then 10 KB/s for 3 s — the old fast samples fall out of the window
    let bytes = 400_000
    for (let t = 4500; t <= 7000; t += 500) {
      bytes += 5_000
      meter.push(bytes, t)
    }
    expect(meter.rate()).toBeCloseTo(10_000)
  })

  it('decays to zero when the transfer stalls', () => {
    const meter = createTransferRateMeter(2000, 500)
    meter.push(0, 0)
    meter.push(200_000, 1000)
    // No new bytes, but the caller keeps sampling on a timer
    for (let t = 1500; t <= 4000; t += 500) meter.push(200_000, t)
    expect(meter.rate()).toBe(0)
  })

  it('reset clears the samples', () => {
    const meter = createTransferRateMeter(5000, 0)
    meter.push(0, 0)
    meter.push(1000, 1000)
    meter.reset()
    expect(meter.rate()).toBeNull()
  })
})

describe('estimateSecondsRemaining', () => {
  it('divides the remaining bytes by the rate, rounding up', () => {
    expect(estimateSecondsRemaining(250, 1000, 100)).toBe(8)
    expect(estimateSecondsRemaining(0, 1000, 300)).toBe(4)
  })

  it('is zero once everything has arrived', () => {
    expect(estimateSecondsRemaining(1000, 1000, 100)).toBe(0)
    expect(estimateSecondsRemaining(1200, 1000, 100)).toBe(0)
  })

  it('is unknown without a size or a positive rate', () => {
    expect(estimateSecondsRemaining(10, null, 100)).toBeNull()
    expect(estimateSecondsRemaining(10, 1000, null)).toBeNull()
    expect(estimateSecondsRemaining(10, 1000, 0)).toBeNull()
  })
})

describe('progressPercent', () => {
  it('returns a whole, clamped percentage', () => {
    expect(progressPercent(0, 1000)).toBe(0)
    expect(progressPercent(333, 1000)).toBe(33)
    expect(progressPercent(999, 1000)).toBe(99)
    expect(progressPercent(1000, 1000)).toBe(100)
    expect(progressPercent(5000, 1000)).toBe(100)
  })

  it('is null when the total is unknown', () => {
    expect(progressPercent(500, null)).toBeNull()
    expect(progressPercent(500, 0)).toBeNull()
  })
})

describe('splitDuration', () => {
  it('keeps exact seconds for short waits', () => {
    expect(splitDuration(7)).toEqual({ hours: 0, minutes: 0, seconds: 7 })
  })

  it('rounds to 5-second steps under a minute so the countdown does not flicker', () => {
    expect(splitDuration(42)).toEqual({ hours: 0, minutes: 0, seconds: 45 })
    expect(splitDuration(58)).toEqual({ hours: 0, minutes: 1, seconds: 0 })
  })

  it('splits minutes and seconds', () => {
    expect(splitDuration(125)).toEqual({ hours: 0, minutes: 2, seconds: 5 })
  })

  it('rounds to whole minutes from ten minutes up', () => {
    expect(splitDuration(754)).toEqual({ hours: 0, minutes: 13, seconds: 0 })
    expect(splitDuration(3725)).toEqual({ hours: 1, minutes: 2, seconds: 0 })
  })
})
