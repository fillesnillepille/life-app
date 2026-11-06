import type { PocketBaseClient } from '../pocketbase.ts'
import type { ActivityRecord, DayRecord, GarminStore } from './types.ts'

// Writes Garmin data to the `garmin_activities` and `garmin_days`
// collections, through the client the mail store also uses.
export function createPocketBaseGarminStore(pb: PocketBaseClient): GarminStore {
  return {
    activities: pb.collection<ActivityRecord>('garmin_activities'),
    days: pb.collection<DayRecord>('garmin_days'),
  }
}
