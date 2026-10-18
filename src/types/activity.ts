
export interface RunActivity {
  id: string;
  date: string;
  name: string;
  distanceKm: number;
  pace: string;
  duration: string;
  averageHeartRate: number;
  type: "Easy" | "Tempo" | "Long" | "Intervals";
  elevationGainM: number;
}

export interface WeeklyStats {
  week: string;
  distanceKm: number;
  averagePaceMinutes: number;
}
