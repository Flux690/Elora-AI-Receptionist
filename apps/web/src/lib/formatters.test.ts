import { describe, it, expect } from 'vitest'
import { digitsToNumber, formatCaller } from './formatters'

/** The two pure pieces behind the number field and the caller column. */
describe('digitsToNumber', () => {
  it('keeps a plain number', () => {
    expect(digitsToNumber('45')).toBe(45)
  })

  it('drops everything that is not a digit', () => {
    // The unit is painted into the box, so a stray keystroke lands next to it.
    expect(digitsToNumber('45min')).toBe(45)
    expect(digitsToNumber('1h30')).toBe(130)
  })

  it('never returns NaN, whatever is pasted in', () => {
    // This value becomes an appointment length. NaN minutes is a booking nobody
    // can keep, and it would propagate silently through the slot arithmetic.
    for (const junk of ['', 'abc', '-', '.', '   ', '+']) {
      expect(Number.isNaN(digitsToNumber(junk))).toBe(false)
      expect(digitsToNumber(junk)).toBe(0)
    }
  })

  it('reads a minus sign as an absence, not a negative', () => {
    // A negative buffer would widen the block backwards past the appointment.
    expect(digitsToNumber('-15')).toBe(15)
  })
})

describe('formatCaller', () => {
  it('leads with the name and keeps the number beside it', () => {
    expect(formatCaller('Dana Whitfield', '+15035550188')).toBe(
      'Dana Whitfield · +1 (503) 555-0188',
    )
  })

  it('falls back to the number when no name was given', () => {
    expect(formatCaller(null, '+15035550188')).toBe('+1 (503) 555-0188')
  })

  it('shows a name for a caller whose number was withheld', () => {
    expect(formatCaller('Dana Whitfield', null)).toBe('Dana Whitfield')
  })

  it('says "Unknown caller" only when there is genuinely neither', () => {
    // Distinct from "No caller ID", which means the number alone is missing.
    expect(formatCaller(null, null)).toBe('Unknown caller')
    expect(formatCaller('   ', null)).toBe('Unknown caller')
  })
})
