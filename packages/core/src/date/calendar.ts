/*
 * Implementation ported from from from https://github.com/melt-ui/melt-ui/blob/develop/src/lib/builders/calendar/create.ts
*/

import type { Grid } from './types'
import type { DateRange } from '@/shared'
import type { DayOfWeek } from '@/shared/date'
import type { TemporalDate } from '@/temporal/types'
import { Temporal } from 'temporal-polyfill'
import { endOfMonth, endOfYear, getDayOfWeek, getDaysInMonth, getLastFirstDayOfWeek, getNextLastDayOfWeek, startOfMonth, startOfYear, toPlainDate } from '@/temporal/comparators'
import { chunk } from './utils'

export type WeekDayFormat = 'narrow' | 'short' | 'long'

export type CreateSelectProps = {
  /**
   * The date object representing the date (usually the first day of the month/year).
   */
  dateObj: TemporalDate
}

export type CreateMonthProps = {
  /**
   * The date object representing the month's date (usually the first day of the month).
   */
  dateObj: TemporalDate

  /**
   * The day of the week to start the calendar on (0 for Sunday, 1 for Monday, etc.).
   */
  weekStartsOn: number

  /**
   * Whether to always render 6 weeks in the calendar, even if the month doesn't
   * span 6 weeks.
   */
  fixedWeeks: boolean

  /**
   * The locale to use when creating the calendar month.
   */
  locale: string
}

/**
 * Retrieves an array of date values representing the days between
 * the provided start and end dates.
 */
export function getDaysBetween(start: TemporalDate, end: TemporalDate) {
  const days: TemporalDate[] = []
  const startDate = toPlainDate(start)
  const endDate = toPlainDate(end)
  let dCurrent = startDate.add({ days: 1 })
  while (Temporal.PlainDate.compare(dCurrent, endDate) < 0) {
    days.push(dCurrent)
    dCurrent = dCurrent.add({ days: 1 })
  }
  return days
}

export function createMonth(props: CreateMonthProps): Grid<TemporalDate> {
  const { dateObj, weekStartsOn, fixedWeeks, locale } = props
  const daysInMonth = getDaysInMonth(dateObj)

  const datesArray = Array.from({ length: daysInMonth }, (_, i) => dateObj.with({ day: i + 1 }))

  const firstDayOfMonth = startOfMonth(dateObj)
  const lastDayOfMonth = endOfMonth(dateObj)

  const lastSunday = getLastFirstDayOfWeek(firstDayOfMonth, weekStartsOn, locale)
  const nextSaturday = getNextLastDayOfWeek(lastDayOfMonth, weekStartsOn, locale)

  const lastMonthDays = getDaysBetween(lastSunday.subtract({ days: 1 }), firstDayOfMonth)
  const nextMonthDays = getDaysBetween(lastDayOfMonth, nextSaturday.add({ days: 1 }))

  const totalDays = lastMonthDays.length + datesArray.length + nextMonthDays.length

  if (fixedWeeks && totalDays < 42) {
    const extraDays = 42 - totalDays

    let startFrom = nextMonthDays[nextMonthDays.length - 1]

    if (!startFrom)
      startFrom = endOfMonth(dateObj)

    const extraDaysArray = Array.from({ length: extraDays }, (_, i) => {
      const incr = i + 1
      return startFrom.add({ days: incr })
    })
    nextMonthDays.push(...extraDaysArray)
  }

  const allDays = lastMonthDays.concat(datesArray, nextMonthDays)

  const weeks = chunk(allDays, 7)

  return {
    value: dateObj,
    cells: allDays,
    rows: weeks,
  }
}

type SetMonthProps = CreateMonthProps & {
  numberOfMonths: number | undefined
  currentMonths?: Grid<TemporalDate>[]
}

type SetYearProps = CreateSelectProps & {
  numberOfMonths?: number
  pagedNavigation?: boolean
}

type SetDecadeProps = CreateSelectProps & {
  startIndex?: number
  endIndex: number
}

export function startOfDecade(dateObj: TemporalDate) {
  // round to the lowest nearest 10 when building the decade
  return startOfYear(dateObj.subtract({ years: dateObj.year - Math.floor(dateObj.year / 10) * 10 }).with({ day: 1, month: 1 }))
}

export function endOfDecade(dateObj: TemporalDate) {
  // round to the lowest nearest 10 when building the decade
  return endOfYear(dateObj.add({ years: Math.ceil((dateObj.year + 1) / 10) * 10 - dateObj.year - 1 }).with({ day: 35, month: 12 }))
}

export function createDecade(props: SetDecadeProps): TemporalDate[] {
  const { dateObj, startIndex, endIndex } = props

  const decadeArray = Array.from({ length: Math.abs(startIndex ?? 0) + endIndex }, (_, i) =>
    i <= Math.abs((startIndex ?? 0))
      ? dateObj.subtract({ years: i }).with({ day: 1, month: 1 })
      : dateObj.add({ years: i - endIndex }).with({ day: 1, month: 1 }))

  decadeArray.sort((a: TemporalDate, b: TemporalDate) => a.year - b.year)

  return decadeArray
}

export function createYear(props: SetYearProps): TemporalDate[] {
  const { dateObj, numberOfMonths = 1, pagedNavigation = false } = props

  if (numberOfMonths && pagedNavigation) {
    const monthsArray = Array.from({ length: Math.floor(12 / numberOfMonths) }, (_, i) => startOfMonth(dateObj.with({ month: i * numberOfMonths + 1 })))

    return monthsArray
  }

  const monthsArray = Array.from({ length: 12 }, (_, i) => startOfMonth(dateObj.with({ month: i + 1 })))
  return monthsArray
}

export function createMonths(props: SetMonthProps) {
  const { numberOfMonths, dateObj, ...monthProps } = props

  const months: Grid<TemporalDate>[] = []

  if (!numberOfMonths || numberOfMonths === 1) {
    months.push(
      createMonth({
        ...monthProps,
        dateObj,
      }),
    )
    return months
  }

  months.push(
    createMonth({
      ...monthProps,
      dateObj,
    }),
  )

  // Create all the months, starting with the current month
  for (let i = 1; i < numberOfMonths; i++) {
    const nextMonth = dateObj.add({ months: i })
    months.push(
      createMonth({
        ...monthProps,
        dateObj: nextMonth,
      }),
    )
  }

  return months
}

export function createYearRange({ start, end }: DateRange): TemporalDate[] {
  const years: TemporalDate[] = []

  if (!start || !end)
    return years

  const startDate = toPlainDate(start)
  const endDate = toPlainDate(end)
  let current = startOfYear(startDate)

  while (Temporal.PlainDate.compare(toPlainDate(current), endDate) <= 0) {
    years.push(current)
    // Move to the first day of the next year
    current = startOfYear(current.add({ years: 1 }))
  }

  return years
}

export function createDateRange({ start, end }: DateRange): TemporalDate[] {
  const dates: TemporalDate[] = []

  if (!start || !end)
    return dates

  let current = toPlainDate(start)
  const endDate = toPlainDate(end)

  while (Temporal.PlainDate.compare(toPlainDate(current), endDate) <= 0) {
    dates.push(current)
    current = current.add({ days: 1 })
  }

  return dates
}

/**
 * Returns the locale-specific week number
 */
export function getWeekNumber(date: TemporalDate, locale: string = 'en-US', firstDayOfWeek?: DayOfWeek): number {
  const firstDayOfYear = Temporal.PlainDate.from({ year: date.year, month: 1, day: 1 })

  const firstDayOfYearWeekday = getDayOfWeek(firstDayOfYear, locale, firstDayOfWeek)

  const firstWeekStart = firstDayOfYear.subtract({ days: firstDayOfYearWeekday })

  // If date is before the first week start It belongs to the last week of the previous year
  if (Temporal.PlainDate.compare(toPlainDate(date), toPlainDate(firstWeekStart)) < 0) {
    const prevYearDate = Temporal.PlainDate.from({ year: date.year - 1, month: 12, day: 31 })
    return getWeekNumber(prevYearDate, locale, firstDayOfWeek)
  }

  const days = getDaysBetween(firstWeekStart, date)

  // Week number is days divided by 7 plus 1
  return Math.floor(days.length / 7) + 1
}
