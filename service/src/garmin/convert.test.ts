import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyDay, toActivity, toDays } from './convert.ts'

const run = {
  activityId: 21000000001,
  activityName: 'Morgonlöpning',
  startTimeLocal: '2026-11-05 07:30:12',
  startTimeGMT: '2026-11-05 06:30:12',
  activityType: { typeId: 1, typeKey: 'running', parentTypeId: 17 },
  distance: 5012.37,
  duration: 1712.4,
  elapsedDuration: 1800.9,
  movingDuration: 1700.2,
  elevationGain: 32.6,
  averageHR: 151.2,
  maxHR: 178,
  calories: 402.7,
  averageSpeed: 2.9271,
  ownerFullName: 'Kept out of the store',
  startLatitude: 59.3,
}

describe('Garmin activities', () => {
  it('keeps the summary and leaves out personal extras', () => {
    assert.deepEqual(toActivity(run), {
      garminId: 21000000001,
      name: 'Morgonlöpning',
      type: 'running',
      date: '2026-11-05',
      startTime: '07:30',
      startedAt: '2026-11-05T06:30:12.000Z',
      duration: 1712,
      elapsed: 1801,
      moving: 1700,
      distance: 5012.4,
      elevationGain: 33,
      averageHr: 151,
      maxHr: 178,
      calories: 403,
      averageSpeed: 2.927,
    })
  })

  it('turns missing numbers into 0', () => {
    const activity = toActivity({
      activityId: 5,
      startTimeLocal: '2026-11-05 18:00:00',
      activityType: { typeKey: 'strength_training' },
      duration: 2400,
    })
    assert.equal(activity?.distance, 0)
    assert.equal(activity?.averageHr, 0)
    assert.equal(activity?.startedAt, '')
    assert.equal(activity?.name, '')
  })

  it('skips activities without an id or a start time', () => {
    assert.equal(toActivity({ activityName: 'x', startTimeLocal: '2026-11-05 07:00:00' }), null)
    assert.equal(toActivity({ activityId: 1 }), null)
    assert.equal(toActivity(null), null)
  })
})

describe('Garmin days', () => {
  it('joins summaries, sleep, and HRV by date', () => {
    const [day] = toDays({
      summaries: [
        {
          calendarDate: '2026-11-05',
          movement: { steps: { value: 8123, goal: 7500 } },
          heartRate: { restingValue: 52 },
          stress: { avgLevel: 31 },
          bodyBattery: { maxValue: 88, minValue: 21 },
          calories: { burnedActive: 612 },
          intensityMinutes: { moderate: 20, vigorous: 15 },
        },
      ],
      sleep: [
        {
          calendarDate: '2026-11-05',
          sleepTimeSeconds: 26100,
          deepSleepSeconds: 5400,
          lightSleepSeconds: 14400,
          remSleepSeconds: 6300,
          awakeSleepSeconds: 900,
          sleepScores: { overall: { value: 81, qualifierKey: 'GOOD' } },
          // Milliseconds that already include the offset.
          sleepStartTimestampLocal: Date.UTC(2026, 10, 4, 23, 12),
          sleepEndTimestampLocal: '2026-11-05T06:40:00.0',
        },
      ],
      hrv: [
        { calendarDate: '2026-11-05', lastNightAvg: 48, weeklyAvg: 45, status: 'BALANCED' },
      ],
    })
    assert.deepEqual(day, {
      ...emptyDay('2026-11-05'),
      steps: 8123,
      stepsGoal: 7500,
      restingHr: 52,
      stress: 31,
      bodyBatteryHigh: 88,
      bodyBatteryLow: 21,
      activeCalories: 612,
      moderateMinutes: 20,
      vigorousMinutes: 15,
      sleep: 26100,
      deepSleep: 5400,
      lightSleep: 14400,
      remSleep: 6300,
      awake: 900,
      sleepScore: 81,
      sleepStart: '23:12',
      sleepEnd: '06:40',
      hrvLastNight: 48,
      hrvWeekly: 45,
      hrvStatus: 'BALANCED',
    })
  })

  it('leaves out days with only a goal, and sorts by date', () => {
    const days = toDays({
      summaries: [
        { calendarDate: '2026-11-03', movement: { steps: { value: 0, goal: 7500 } } },
        { calendarDate: '2026-11-05', movement: { steps: { value: 10 } } },
        { calendarDate: 'not a date', movement: { steps: { value: 10 } } },
      ],
      sleep: [{ calendarDate: '2026-11-04', sleepTimeSeconds: 3600 }],
      hrv: [],
    })
    assert.deepEqual(
      days.map((day) => day.date),
      ['2026-11-04', '2026-11-05'],
    )
  })

  it("doesn't let an empty source blank out another's value", () => {
    const [day] = toDays({
      summaries: [{ calendarDate: '2026-11-05', heartRate: { restingValue: 50 } }],
      sleep: [{ calendarDate: '2026-11-05', sleepTimeSeconds: 0 }],
      hrv: [{ calendarDate: '2026-11-05' }],
    })
    assert.equal(day.restingHr, 50)
  })
})
