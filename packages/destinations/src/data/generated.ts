// GENERATED FILE — do not edit by hand.
// Regenerate with: pnpm --filter @timeaway/destinations data:codegen
//
// Climate: Open-Meteo historical reanalysis (https://open-meteo.com)
// Licence: CC BY 4.0
// Period:  2020-01-01..2024-12-31

import type { Destination, MonthClimate } from "../types.js";

export const CLIMATE_ATTRIBUTION = "Open-Meteo historical reanalysis (https://open-meteo.com)";
export const CLIMATE_LICENCE = "CC BY 4.0";
export const CLIMATE_PERIOD = "2020-01-01..2024-12-31";

export const DESTINATIONS: Destination[] = [
  {
    "id": "bangkok",
    "name": "Bangkok",
    "country": "Thailand",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "flightHoursFromSin": 2.3,
    "visaFreeSg": true
  },
  {
    "id": "chiang-mai",
    "name": "Chiang Mai",
    "country": "Thailand",
    "latitude": 18.7883,
    "longitude": 98.9853,
    "flightHoursFromSin": 3,
    "visaFreeSg": true
  },
  {
    "id": "phuket",
    "name": "Phuket",
    "country": "Thailand",
    "latitude": 7.8804,
    "longitude": 98.3923,
    "flightHoursFromSin": 1.8,
    "visaFreeSg": true
  },
  {
    "id": "bali",
    "name": "Bali",
    "country": "Indonesia",
    "latitude": -8.65,
    "longitude": 115.2167,
    "flightHoursFromSin": 2.7,
    "visaFreeSg": true
  },
  {
    "id": "jakarta",
    "name": "Jakarta",
    "country": "Indonesia",
    "latitude": -6.2088,
    "longitude": 106.8456,
    "flightHoursFromSin": 1.8,
    "visaFreeSg": true
  },
  {
    "id": "kuala-lumpur",
    "name": "Kuala Lumpur",
    "country": "Malaysia",
    "latitude": 3.139,
    "longitude": 101.6869,
    "flightHoursFromSin": 1,
    "visaFreeSg": true
  },
  {
    "id": "penang",
    "name": "Penang",
    "country": "Malaysia",
    "latitude": 5.4141,
    "longitude": 100.3288,
    "flightHoursFromSin": 1.5,
    "visaFreeSg": true
  },
  {
    "id": "ho-chi-minh-city",
    "name": "Ho Chi Minh City",
    "country": "Vietnam",
    "latitude": 10.8231,
    "longitude": 106.6297,
    "flightHoursFromSin": 2,
    "visaFreeSg": true
  },
  {
    "id": "hanoi",
    "name": "Hanoi",
    "country": "Vietnam",
    "latitude": 21.0285,
    "longitude": 105.8542,
    "flightHoursFromSin": 3.3,
    "visaFreeSg": true
  },
  {
    "id": "da-nang",
    "name": "Da Nang",
    "country": "Vietnam",
    "latitude": 16.0544,
    "longitude": 108.2022,
    "flightHoursFromSin": 3,
    "visaFreeSg": true
  },
  {
    "id": "manila",
    "name": "Manila",
    "country": "Philippines",
    "latitude": 14.5995,
    "longitude": 120.9842,
    "flightHoursFromSin": 3.6,
    "visaFreeSg": true
  },
  {
    "id": "cebu",
    "name": "Cebu",
    "country": "Philippines",
    "latitude": 10.3157,
    "longitude": 123.8854,
    "flightHoursFromSin": 3.8,
    "visaFreeSg": true
  },
  {
    "id": "siem-reap",
    "name": "Siem Reap",
    "country": "Cambodia",
    "latitude": 13.3671,
    "longitude": 103.8448,
    "flightHoursFromSin": 2.2,
    "visaFreeSg": true
  },
  {
    "id": "tokyo",
    "name": "Tokyo",
    "country": "Japan",
    "latitude": 35.6762,
    "longitude": 139.6503,
    "flightHoursFromSin": 7,
    "visaFreeSg": true
  },
  {
    "id": "osaka",
    "name": "Osaka",
    "country": "Japan",
    "latitude": 34.6937,
    "longitude": 135.5023,
    "flightHoursFromSin": 6.5,
    "visaFreeSg": true
  },
  {
    "id": "sapporo",
    "name": "Sapporo",
    "country": "Japan",
    "latitude": 43.0621,
    "longitude": 141.3544,
    "flightHoursFromSin": 8,
    "visaFreeSg": true
  },
  {
    "id": "seoul",
    "name": "Seoul",
    "country": "South Korea",
    "latitude": 37.5665,
    "longitude": 126.978,
    "flightHoursFromSin": 6.5,
    "visaFreeSg": true
  },
  {
    "id": "busan",
    "name": "Busan",
    "country": "South Korea",
    "latitude": 35.1796,
    "longitude": 129.0756,
    "flightHoursFromSin": 6.2,
    "visaFreeSg": true
  },
  {
    "id": "taipei",
    "name": "Taipei",
    "country": "Taiwan",
    "latitude": 25.033,
    "longitude": 121.5654,
    "flightHoursFromSin": 4.7,
    "visaFreeSg": true
  },
  {
    "id": "hong-kong",
    "name": "Hong Kong",
    "country": "Hong Kong",
    "latitude": 22.3193,
    "longitude": 114.1694,
    "flightHoursFromSin": 4,
    "visaFreeSg": true
  }
];

export const CLIMATE: Record<string, MonthClimate[]> = {
  "bangkok": [
    {
      "month": 1,
      "avgHighC": 31.9,
      "avgLowC": 22.3,
      "rainfallMm": 14,
      "rainDays": 3
    },
    {
      "month": 2,
      "avgHighC": 32.5,
      "avgLowC": 23.7,
      "rainfallMm": 44,
      "rainDays": 6
    },
    {
      "month": 3,
      "avgHighC": 33.3,
      "avgLowC": 25.9,
      "rainfallMm": 50,
      "rainDays": 9
    },
    {
      "month": 4,
      "avgHighC": 34.1,
      "avgLowC": 26.9,
      "rainfallMm": 84,
      "rainDays": 12
    },
    {
      "month": 5,
      "avgHighC": 33.6,
      "avgLowC": 26.7,
      "rainfallMm": 158,
      "rainDays": 20
    },
    {
      "month": 6,
      "avgHighC": 32.9,
      "avgLowC": 26.2,
      "rainfallMm": 156,
      "rainDays": 24
    },
    {
      "month": 7,
      "avgHighC": 31.7,
      "avgLowC": 25.7,
      "rainfallMm": 241,
      "rainDays": 27
    },
    {
      "month": 8,
      "avgHighC": 31.7,
      "avgLowC": 25.5,
      "rainfallMm": 217,
      "rainDays": 27
    },
    {
      "month": 9,
      "avgHighC": 30.9,
      "avgLowC": 25.1,
      "rainfallMm": 336,
      "rainDays": 28
    },
    {
      "month": 10,
      "avgHighC": 30.6,
      "avgLowC": 24.2,
      "rainfallMm": 290,
      "rainDays": 22
    },
    {
      "month": 11,
      "avgHighC": 31.4,
      "avgLowC": 23.8,
      "rainfallMm": 86,
      "rainDays": 11
    },
    {
      "month": 12,
      "avgHighC": 31.3,
      "avgLowC": 22.3,
      "rainfallMm": 15,
      "rainDays": 4
    }
  ],
  "chiang-mai": [
    {
      "month": 1,
      "avgHighC": 27.6,
      "avgLowC": 16.7,
      "rainfallMm": 14,
      "rainDays": 6
    },
    {
      "month": 2,
      "avgHighC": 30.2,
      "avgLowC": 17.8,
      "rainfallMm": 38,
      "rainDays": 3
    },
    {
      "month": 3,
      "avgHighC": 34.8,
      "avgLowC": 21.3,
      "rainfallMm": 14,
      "rainDays": 3
    },
    {
      "month": 4,
      "avgHighC": 35.7,
      "avgLowC": 23.5,
      "rainfallMm": 77,
      "rainDays": 8
    },
    {
      "month": 5,
      "avgHighC": 33.8,
      "avgLowC": 24.5,
      "rainfallMm": 232,
      "rainDays": 21
    },
    {
      "month": 6,
      "avgHighC": 31.8,
      "avgLowC": 24.1,
      "rainfallMm": 236,
      "rainDays": 27
    },
    {
      "month": 7,
      "avgHighC": 30.5,
      "avgLowC": 23.9,
      "rainfallMm": 375,
      "rainDays": 28
    },
    {
      "month": 8,
      "avgHighC": 29.6,
      "avgLowC": 23.6,
      "rainfallMm": 424,
      "rainDays": 30
    },
    {
      "month": 9,
      "avgHighC": 29.5,
      "avgLowC": 23.3,
      "rainfallMm": 416,
      "rainDays": 26
    },
    {
      "month": 10,
      "avgHighC": 29.1,
      "avgLowC": 22.1,
      "rainfallMm": 219,
      "rainDays": 19
    },
    {
      "month": 11,
      "avgHighC": 28.9,
      "avgLowC": 20.3,
      "rainfallMm": 60,
      "rainDays": 9
    },
    {
      "month": 12,
      "avgHighC": 27.5,
      "avgLowC": 17.7,
      "rainfallMm": 21,
      "rainDays": 3
    }
  ],
  "phuket": [
    {
      "month": 1,
      "avgHighC": 30.3,
      "avgLowC": 24.4,
      "rainfallMm": 36,
      "rainDays": 11
    },
    {
      "month": 2,
      "avgHighC": 31.6,
      "avgLowC": 24.7,
      "rainfallMm": 45,
      "rainDays": 9
    },
    {
      "month": 3,
      "avgHighC": 32.6,
      "avgLowC": 25.2,
      "rainfallMm": 72,
      "rainDays": 11
    },
    {
      "month": 4,
      "avgHighC": 31.9,
      "avgLowC": 25.5,
      "rainfallMm": 112,
      "rainDays": 18
    },
    {
      "month": 5,
      "avgHighC": 30.7,
      "avgLowC": 25.7,
      "rainfallMm": 211,
      "rainDays": 26
    },
    {
      "month": 6,
      "avgHighC": 29.9,
      "avgLowC": 25.3,
      "rainfallMm": 192,
      "rainDays": 23
    },
    {
      "month": 7,
      "avgHighC": 29.6,
      "avgLowC": 25.1,
      "rainfallMm": 205,
      "rainDays": 24
    },
    {
      "month": 8,
      "avgHighC": 29.6,
      "avgLowC": 24.9,
      "rainfallMm": 205,
      "rainDays": 23
    },
    {
      "month": 9,
      "avgHighC": 29,
      "avgLowC": 24.6,
      "rainfallMm": 272,
      "rainDays": 25
    },
    {
      "month": 10,
      "avgHighC": 28.9,
      "avgLowC": 24.2,
      "rainfallMm": 306,
      "rainDays": 28
    },
    {
      "month": 11,
      "avgHighC": 28.9,
      "avgLowC": 24.3,
      "rainfallMm": 295,
      "rainDays": 28
    },
    {
      "month": 12,
      "avgHighC": 29.1,
      "avgLowC": 24.3,
      "rainfallMm": 142,
      "rainDays": 18
    }
  ],
  "bali": [
    {
      "month": 1,
      "avgHighC": 29.3,
      "avgLowC": 24.3,
      "rainfallMm": 264,
      "rainDays": 26
    },
    {
      "month": 2,
      "avgHighC": 29.3,
      "avgLowC": 24.1,
      "rainfallMm": 270,
      "rainDays": 26
    },
    {
      "month": 3,
      "avgHighC": 29.5,
      "avgLowC": 24.1,
      "rainfallMm": 223,
      "rainDays": 26
    },
    {
      "month": 4,
      "avgHighC": 29.2,
      "avgLowC": 24,
      "rainfallMm": 156,
      "rainDays": 22
    },
    {
      "month": 5,
      "avgHighC": 29.2,
      "avgLowC": 24.3,
      "rainfallMm": 116,
      "rainDays": 19
    },
    {
      "month": 6,
      "avgHighC": 28.4,
      "avgLowC": 23.7,
      "rainfallMm": 104,
      "rainDays": 20
    },
    {
      "month": 7,
      "avgHighC": 27.3,
      "avgLowC": 23.3,
      "rainfallMm": 87,
      "rainDays": 18
    },
    {
      "month": 8,
      "avgHighC": 27.5,
      "avgLowC": 22.6,
      "rainfallMm": 64,
      "rainDays": 21
    },
    {
      "month": 9,
      "avgHighC": 28.3,
      "avgLowC": 22.9,
      "rainfallMm": 78,
      "rainDays": 21
    },
    {
      "month": 10,
      "avgHighC": 29.2,
      "avgLowC": 23.3,
      "rainfallMm": 110,
      "rainDays": 20
    },
    {
      "month": 11,
      "avgHighC": 29.7,
      "avgLowC": 24,
      "rainfallMm": 196,
      "rainDays": 25
    },
    {
      "month": 12,
      "avgHighC": 29.2,
      "avgLowC": 24,
      "rainfallMm": 284,
      "rainDays": 27
    }
  ],
  "jakarta": [
    {
      "month": 1,
      "avgHighC": 30,
      "avgLowC": 23.7,
      "rainfallMm": 343,
      "rainDays": 28
    },
    {
      "month": 2,
      "avgHighC": 29.9,
      "avgLowC": 23.7,
      "rainfallMm": 321,
      "rainDays": 26
    },
    {
      "month": 3,
      "avgHighC": 30.8,
      "avgLowC": 23.8,
      "rainfallMm": 278,
      "rainDays": 29
    },
    {
      "month": 4,
      "avgHighC": 31.5,
      "avgLowC": 23.9,
      "rainfallMm": 214,
      "rainDays": 27
    },
    {
      "month": 5,
      "avgHighC": 31.7,
      "avgLowC": 24.1,
      "rainfallMm": 181,
      "rainDays": 26
    },
    {
      "month": 6,
      "avgHighC": 31.4,
      "avgLowC": 23.4,
      "rainfallMm": 152,
      "rainDays": 24
    },
    {
      "month": 7,
      "avgHighC": 31.9,
      "avgLowC": 23.2,
      "rainfallMm": 84,
      "rainDays": 14
    },
    {
      "month": 8,
      "avgHighC": 32.9,
      "avgLowC": 23.4,
      "rainfallMm": 79,
      "rainDays": 14
    },
    {
      "month": 9,
      "avgHighC": 32.9,
      "avgLowC": 23.5,
      "rainfallMm": 119,
      "rainDays": 17
    },
    {
      "month": 10,
      "avgHighC": 32.9,
      "avgLowC": 23.9,
      "rainfallMm": 175,
      "rainDays": 24
    },
    {
      "month": 11,
      "avgHighC": 31.8,
      "avgLowC": 24,
      "rainfallMm": 251,
      "rainDays": 27
    },
    {
      "month": 12,
      "avgHighC": 30.8,
      "avgLowC": 24,
      "rainfallMm": 271,
      "rainDays": 28
    }
  ],
  "kuala-lumpur": [
    {
      "month": 1,
      "avgHighC": 30.5,
      "avgLowC": 23.5,
      "rainfallMm": 222,
      "rainDays": 23
    },
    {
      "month": 2,
      "avgHighC": 31.7,
      "avgLowC": 23.9,
      "rainfallMm": 138,
      "rainDays": 18
    },
    {
      "month": 3,
      "avgHighC": 31.8,
      "avgLowC": 24.1,
      "rainfallMm": 229,
      "rainDays": 25
    },
    {
      "month": 4,
      "avgHighC": 31.4,
      "avgLowC": 24.3,
      "rainfallMm": 262,
      "rainDays": 28
    },
    {
      "month": 5,
      "avgHighC": 31.4,
      "avgLowC": 24.8,
      "rainfallMm": 271,
      "rainDays": 26
    },
    {
      "month": 6,
      "avgHighC": 31,
      "avgLowC": 24.2,
      "rainfallMm": 208,
      "rainDays": 24
    },
    {
      "month": 7,
      "avgHighC": 31.2,
      "avgLowC": 24.1,
      "rainfallMm": 191,
      "rainDays": 20
    },
    {
      "month": 8,
      "avgHighC": 30.7,
      "avgLowC": 23.8,
      "rainfallMm": 288,
      "rainDays": 27
    },
    {
      "month": 9,
      "avgHighC": 30.6,
      "avgLowC": 23.9,
      "rainfallMm": 283,
      "rainDays": 25
    },
    {
      "month": 10,
      "avgHighC": 30.7,
      "avgLowC": 24,
      "rainfallMm": 243,
      "rainDays": 23
    },
    {
      "month": 11,
      "avgHighC": 30.1,
      "avgLowC": 23.8,
      "rainfallMm": 352,
      "rainDays": 29
    },
    {
      "month": 12,
      "avgHighC": 29.9,
      "avgLowC": 23.7,
      "rainfallMm": 377,
      "rainDays": 28
    }
  ],
  "penang": [
    {
      "month": 1,
      "avgHighC": 30,
      "avgLowC": 24.4,
      "rainfallMm": 106,
      "rainDays": 17
    },
    {
      "month": 2,
      "avgHighC": 30.9,
      "avgLowC": 24.5,
      "rainfallMm": 135,
      "rainDays": 16
    },
    {
      "month": 3,
      "avgHighC": 31.1,
      "avgLowC": 25,
      "rainfallMm": 207,
      "rainDays": 24
    },
    {
      "month": 4,
      "avgHighC": 30.5,
      "avgLowC": 25.3,
      "rainfallMm": 356,
      "rainDays": 28
    },
    {
      "month": 5,
      "avgHighC": 30.4,
      "avgLowC": 25.7,
      "rainfallMm": 434,
      "rainDays": 26
    },
    {
      "month": 6,
      "avgHighC": 29.9,
      "avgLowC": 25.4,
      "rainfallMm": 258,
      "rainDays": 25
    },
    {
      "month": 7,
      "avgHighC": 30.1,
      "avgLowC": 25.5,
      "rainfallMm": 203,
      "rainDays": 20
    },
    {
      "month": 8,
      "avgHighC": 29.9,
      "avgLowC": 25,
      "rainfallMm": 368,
      "rainDays": 26
    },
    {
      "month": 9,
      "avgHighC": 29.5,
      "avgLowC": 24.9,
      "rainfallMm": 361,
      "rainDays": 25
    },
    {
      "month": 10,
      "avgHighC": 29.2,
      "avgLowC": 24.7,
      "rainfallMm": 445,
      "rainDays": 28
    },
    {
      "month": 11,
      "avgHighC": 29.1,
      "avgLowC": 24.6,
      "rainfallMm": 413,
      "rainDays": 29
    },
    {
      "month": 12,
      "avgHighC": 29.3,
      "avgLowC": 24.4,
      "rainfallMm": 251,
      "rainDays": 23
    }
  ],
  "ho-chi-minh-city": [
    {
      "month": 1,
      "avgHighC": 32.6,
      "avgLowC": 22.8,
      "rainfallMm": 27,
      "rainDays": 6
    },
    {
      "month": 2,
      "avgHighC": 34.1,
      "avgLowC": 23.4,
      "rainfallMm": 14,
      "rainDays": 4
    },
    {
      "month": 3,
      "avgHighC": 35.2,
      "avgLowC": 24.6,
      "rainfallMm": 20,
      "rainDays": 5
    },
    {
      "month": 4,
      "avgHighC": 34.3,
      "avgLowC": 25.6,
      "rainfallMm": 121,
      "rainDays": 17
    },
    {
      "month": 5,
      "avgHighC": 33.2,
      "avgLowC": 26,
      "rainfallMm": 257,
      "rainDays": 24
    },
    {
      "month": 6,
      "avgHighC": 31.9,
      "avgLowC": 25,
      "rainfallMm": 282,
      "rainDays": 27
    },
    {
      "month": 7,
      "avgHighC": 30.8,
      "avgLowC": 24.8,
      "rainfallMm": 338,
      "rainDays": 30
    },
    {
      "month": 8,
      "avgHighC": 31.3,
      "avgLowC": 24.7,
      "rainfallMm": 309,
      "rainDays": 29
    },
    {
      "month": 9,
      "avgHighC": 30.7,
      "avgLowC": 24.4,
      "rainfallMm": 393,
      "rainDays": 30
    },
    {
      "month": 10,
      "avgHighC": 30.3,
      "avgLowC": 24,
      "rainfallMm": 367,
      "rainDays": 28
    },
    {
      "month": 11,
      "avgHighC": 31,
      "avgLowC": 23.7,
      "rainfallMm": 150,
      "rainDays": 20
    },
    {
      "month": 12,
      "avgHighC": 31.3,
      "avgLowC": 22.8,
      "rainfallMm": 56,
      "rainDays": 9
    }
  ],
  "hanoi": [
    {
      "month": 1,
      "avgHighC": 21.3,
      "avgLowC": 14.2,
      "rainfallMm": 61,
      "rainDays": 12
    },
    {
      "month": 2,
      "avgHighC": 22.5,
      "avgLowC": 15.6,
      "rainfallMm": 70,
      "rainDays": 11
    },
    {
      "month": 3,
      "avgHighC": 26.1,
      "avgLowC": 19.2,
      "rainfallMm": 86,
      "rainDays": 13
    },
    {
      "month": 4,
      "avgHighC": 28.5,
      "avgLowC": 21.5,
      "rainfallMm": 85,
      "rainDays": 14
    },
    {
      "month": 5,
      "avgHighC": 31.6,
      "avgLowC": 24.7,
      "rainfallMm": 206,
      "rainDays": 17
    },
    {
      "month": 6,
      "avgHighC": 33.4,
      "avgLowC": 26.7,
      "rainfallMm": 293,
      "rainDays": 18
    },
    {
      "month": 7,
      "avgHighC": 33.2,
      "avgLowC": 26.5,
      "rainfallMm": 288,
      "rainDays": 21
    },
    {
      "month": 8,
      "avgHighC": 31.8,
      "avgLowC": 25.8,
      "rainfallMm": 406,
      "rainDays": 25
    },
    {
      "month": 9,
      "avgHighC": 30.7,
      "avgLowC": 24.8,
      "rainfallMm": 441,
      "rainDays": 22
    },
    {
      "month": 10,
      "avgHighC": 28.1,
      "avgLowC": 21.6,
      "rainfallMm": 197,
      "rainDays": 13
    },
    {
      "month": 11,
      "avgHighC": 27,
      "avgLowC": 19.4,
      "rainfallMm": 54,
      "rainDays": 7
    },
    {
      "month": 12,
      "avgHighC": 21.5,
      "avgLowC": 14.1,
      "rainfallMm": 16,
      "rainDays": 4
    }
  ],
  "da-nang": [
    {
      "month": 1,
      "avgHighC": 23.7,
      "avgLowC": 19.9,
      "rainfallMm": 154,
      "rainDays": 20
    },
    {
      "month": 2,
      "avgHighC": 24.7,
      "avgLowC": 20.4,
      "rainfallMm": 71,
      "rainDays": 13
    },
    {
      "month": 3,
      "avgHighC": 27.2,
      "avgLowC": 22.7,
      "rainfallMm": 53,
      "rainDays": 11
    },
    {
      "month": 4,
      "avgHighC": 29.5,
      "avgLowC": 24.6,
      "rainfallMm": 104,
      "rainDays": 9
    },
    {
      "month": 5,
      "avgHighC": 31.5,
      "avgLowC": 26.2,
      "rainfallMm": 59,
      "rainDays": 12
    },
    {
      "month": 6,
      "avgHighC": 34.1,
      "avgLowC": 27.3,
      "rainfallMm": 60,
      "rainDays": 10
    },
    {
      "month": 7,
      "avgHighC": 32.9,
      "avgLowC": 26.7,
      "rainfallMm": 86,
      "rainDays": 14
    },
    {
      "month": 8,
      "avgHighC": 33.6,
      "avgLowC": 26.8,
      "rainfallMm": 87,
      "rainDays": 16
    },
    {
      "month": 9,
      "avgHighC": 30.9,
      "avgLowC": 25.6,
      "rainfallMm": 280,
      "rainDays": 23
    },
    {
      "month": 10,
      "avgHighC": 28,
      "avgLowC": 24.3,
      "rainfallMm": 628,
      "rainDays": 28
    },
    {
      "month": 11,
      "avgHighC": 26.7,
      "avgLowC": 23.2,
      "rainfallMm": 374,
      "rainDays": 24
    },
    {
      "month": 12,
      "avgHighC": 24,
      "avgLowC": 21.1,
      "rainfallMm": 352,
      "rainDays": 26
    }
  ],
  "manila": [
    {
      "month": 1,
      "avgHighC": 29.6,
      "avgLowC": 23.1,
      "rainfallMm": 69,
      "rainDays": 12
    },
    {
      "month": 2,
      "avgHighC": 30.9,
      "avgLowC": 23.1,
      "rainfallMm": 45,
      "rainDays": 9
    },
    {
      "month": 3,
      "avgHighC": 32.4,
      "avgLowC": 24.1,
      "rainfallMm": 36,
      "rainDays": 10
    },
    {
      "month": 4,
      "avgHighC": 33.5,
      "avgLowC": 25.4,
      "rainfallMm": 59,
      "rainDays": 14
    },
    {
      "month": 5,
      "avgHighC": 33.8,
      "avgLowC": 26.5,
      "rainfallMm": 171,
      "rainDays": 21
    },
    {
      "month": 6,
      "avgHighC": 31.5,
      "avgLowC": 25.8,
      "rainfallMm": 269,
      "rainDays": 26
    },
    {
      "month": 7,
      "avgHighC": 30.7,
      "avgLowC": 25.5,
      "rainfallMm": 409,
      "rainDays": 28
    },
    {
      "month": 8,
      "avgHighC": 30,
      "avgLowC": 25.5,
      "rainfallMm": 282,
      "rainDays": 26
    },
    {
      "month": 9,
      "avgHighC": 30,
      "avgLowC": 25.2,
      "rainfallMm": 352,
      "rainDays": 28
    },
    {
      "month": 10,
      "avgHighC": 29.9,
      "avgLowC": 25,
      "rainfallMm": 307,
      "rainDays": 28
    },
    {
      "month": 11,
      "avgHighC": 30.8,
      "avgLowC": 24.8,
      "rainfallMm": 141,
      "rainDays": 19
    },
    {
      "month": 12,
      "avgHighC": 29.9,
      "avgLowC": 24.2,
      "rainfallMm": 136,
      "rainDays": 17
    }
  ],
  "cebu": [
    {
      "month": 1,
      "avgHighC": 28.5,
      "avgLowC": 24.3,
      "rainfallMm": 223,
      "rainDays": 23
    },
    {
      "month": 2,
      "avgHighC": 28.8,
      "avgLowC": 24.2,
      "rainfallMm": 147,
      "rainDays": 19
    },
    {
      "month": 3,
      "avgHighC": 29.9,
      "avgLowC": 24.6,
      "rainfallMm": 119,
      "rainDays": 15
    },
    {
      "month": 4,
      "avgHighC": 30.9,
      "avgLowC": 25.2,
      "rainfallMm": 155,
      "rainDays": 18
    },
    {
      "month": 5,
      "avgHighC": 30.9,
      "avgLowC": 25.8,
      "rainfallMm": 221,
      "rainDays": 25
    },
    {
      "month": 6,
      "avgHighC": 30,
      "avgLowC": 25.3,
      "rainfallMm": 288,
      "rainDays": 27
    },
    {
      "month": 7,
      "avgHighC": 29.7,
      "avgLowC": 25.3,
      "rainfallMm": 311,
      "rainDays": 29
    },
    {
      "month": 8,
      "avgHighC": 30,
      "avgLowC": 25.3,
      "rainfallMm": 250,
      "rainDays": 26
    },
    {
      "month": 9,
      "avgHighC": 30,
      "avgLowC": 25.3,
      "rainfallMm": 256,
      "rainDays": 27
    },
    {
      "month": 10,
      "avgHighC": 29.7,
      "avgLowC": 25.1,
      "rainfallMm": 347,
      "rainDays": 30
    },
    {
      "month": 11,
      "avgHighC": 29.8,
      "avgLowC": 24.9,
      "rainfallMm": 212,
      "rainDays": 27
    },
    {
      "month": 12,
      "avgHighC": 29.1,
      "avgLowC": 24.7,
      "rainfallMm": 246,
      "rainDays": 26
    }
  ],
  "siem-reap": [
    {
      "month": 1,
      "avgHighC": 31.1,
      "avgLowC": 21.2,
      "rainfallMm": 25,
      "rainDays": 2
    },
    {
      "month": 2,
      "avgHighC": 32.7,
      "avgLowC": 22.5,
      "rainfallMm": 34,
      "rainDays": 6
    },
    {
      "month": 3,
      "avgHighC": 34.5,
      "avgLowC": 24.9,
      "rainfallMm": 49,
      "rainDays": 10
    },
    {
      "month": 4,
      "avgHighC": 34.3,
      "avgLowC": 25.6,
      "rainfallMm": 130,
      "rainDays": 16
    },
    {
      "month": 5,
      "avgHighC": 33.3,
      "avgLowC": 25.9,
      "rainfallMm": 227,
      "rainDays": 23
    },
    {
      "month": 6,
      "avgHighC": 33,
      "avgLowC": 25.6,
      "rainfallMm": 162,
      "rainDays": 22
    },
    {
      "month": 7,
      "avgHighC": 31.5,
      "avgLowC": 25.1,
      "rainfallMm": 280,
      "rainDays": 28
    },
    {
      "month": 8,
      "avgHighC": 31.9,
      "avgLowC": 25.1,
      "rainfallMm": 230,
      "rainDays": 27
    },
    {
      "month": 9,
      "avgHighC": 30.5,
      "avgLowC": 24.4,
      "rainfallMm": 380,
      "rainDays": 29
    },
    {
      "month": 10,
      "avgHighC": 30.1,
      "avgLowC": 23.5,
      "rainfallMm": 306,
      "rainDays": 24
    },
    {
      "month": 11,
      "avgHighC": 30.5,
      "avgLowC": 22.9,
      "rainfallMm": 125,
      "rainDays": 13
    },
    {
      "month": 12,
      "avgHighC": 29.8,
      "avgLowC": 21.2,
      "rainfallMm": 29,
      "rainDays": 4
    }
  ],
  "tokyo": [
    {
      "month": 1,
      "avgHighC": 9.4,
      "avgLowC": 0.2,
      "rainfallMm": 55,
      "rainDays": 6
    },
    {
      "month": 2,
      "avgHighC": 11.1,
      "avgLowC": 1.1,
      "rainfallMm": 59,
      "rainDays": 7
    },
    {
      "month": 3,
      "avgHighC": 15.3,
      "avgLowC": 5.3,
      "rainfallMm": 151,
      "rainDays": 12
    },
    {
      "month": 4,
      "avgHighC": 18.9,
      "avgLowC": 9.7,
      "rainfallMm": 162,
      "rainDays": 12
    },
    {
      "month": 5,
      "avgHighC": 22.9,
      "avgLowC": 14.4,
      "rainfallMm": 168,
      "rainDays": 13
    },
    {
      "month": 6,
      "avgHighC": 26.6,
      "avgLowC": 18.9,
      "rainfallMm": 203,
      "rainDays": 15
    },
    {
      "month": 7,
      "avgHighC": 30.8,
      "avgLowC": 23.4,
      "rainfallMm": 219,
      "rainDays": 18
    },
    {
      "month": 8,
      "avgHighC": 32.3,
      "avgLowC": 24.7,
      "rainfallMm": 145,
      "rainDays": 14
    },
    {
      "month": 9,
      "avgHighC": 28.2,
      "avgLowC": 21.3,
      "rainfallMm": 188,
      "rainDays": 15
    },
    {
      "month": 10,
      "avgHighC": 21.8,
      "avgLowC": 14.1,
      "rainfallMm": 158,
      "rainDays": 12
    },
    {
      "month": 11,
      "avgHighC": 17.5,
      "avgLowC": 8.5,
      "rainfallMm": 81,
      "rainDays": 8
    },
    {
      "month": 12,
      "avgHighC": 11.6,
      "avgLowC": 2.2,
      "rainfallMm": 50,
      "rainDays": 6
    }
  ],
  "osaka": [
    {
      "month": 1,
      "avgHighC": 9.4,
      "avgLowC": 1.2,
      "rainfallMm": 53,
      "rainDays": 7
    },
    {
      "month": 2,
      "avgHighC": 10.5,
      "avgLowC": 1.8,
      "rainfallMm": 72,
      "rainDays": 7
    },
    {
      "month": 3,
      "avgHighC": 14.5,
      "avgLowC": 5,
      "rainfallMm": 127,
      "rainDays": 11
    },
    {
      "month": 4,
      "avgHighC": 19,
      "avgLowC": 9.7,
      "rainfallMm": 166,
      "rainDays": 9
    },
    {
      "month": 5,
      "avgHighC": 22.8,
      "avgLowC": 14.2,
      "rainfallMm": 218,
      "rainDays": 13
    },
    {
      "month": 6,
      "avgHighC": 26.8,
      "avgLowC": 19.3,
      "rainfallMm": 248,
      "rainDays": 14
    },
    {
      "month": 7,
      "avgHighC": 30.7,
      "avgLowC": 24.2,
      "rainfallMm": 274,
      "rainDays": 17
    },
    {
      "month": 8,
      "avgHighC": 33,
      "avgLowC": 25.7,
      "rainfallMm": 188,
      "rainDays": 15
    },
    {
      "month": 9,
      "avgHighC": 30.1,
      "avgLowC": 22.5,
      "rainfallMm": 190,
      "rainDays": 14
    },
    {
      "month": 10,
      "avgHighC": 23.1,
      "avgLowC": 14.4,
      "rainfallMm": 163,
      "rainDays": 9
    },
    {
      "month": 11,
      "avgHighC": 17.7,
      "avgLowC": 8.8,
      "rainfallMm": 98,
      "rainDays": 7
    },
    {
      "month": 12,
      "avgHighC": 11.5,
      "avgLowC": 3.1,
      "rainfallMm": 39,
      "rainDays": 6
    }
  ],
  "sapporo": [
    {
      "month": 1,
      "avgHighC": -2.6,
      "avgLowC": -10.3,
      "rainfallMm": 76,
      "rainDays": 15
    },
    {
      "month": 2,
      "avgHighC": -1.7,
      "avgLowC": -8.9,
      "rainfallMm": 78,
      "rainDays": 16
    },
    {
      "month": 3,
      "avgHighC": 4.5,
      "avgLowC": -4.5,
      "rainfallMm": 80,
      "rainDays": 12
    },
    {
      "month": 4,
      "avgHighC": 12,
      "avgLowC": 1.9,
      "rainfallMm": 91,
      "rainDays": 11
    },
    {
      "month": 5,
      "avgHighC": 16.9,
      "avgLowC": 7.4,
      "rainfallMm": 107,
      "rainDays": 14
    },
    {
      "month": 6,
      "avgHighC": 21.3,
      "avgLowC": 12.6,
      "rainfallMm": 119,
      "rainDays": 13
    },
    {
      "month": 7,
      "avgHighC": 25.8,
      "avgLowC": 17.8,
      "rainfallMm": 113,
      "rainDays": 11
    },
    {
      "month": 8,
      "avgHighC": 26.5,
      "avgLowC": 19,
      "rainfallMm": 170,
      "rainDays": 16
    },
    {
      "month": 9,
      "avgHighC": 22.6,
      "avgLowC": 14.1,
      "rainfallMm": 124,
      "rainDays": 12
    },
    {
      "month": 10,
      "avgHighC": 16.1,
      "avgLowC": 6.6,
      "rainfallMm": 120,
      "rainDays": 13
    },
    {
      "month": 11,
      "avgHighC": 9.2,
      "avgLowC": 0.6,
      "rainfallMm": 118,
      "rainDays": 15
    },
    {
      "month": 12,
      "avgHighC": 0.2,
      "avgLowC": -7.6,
      "rainfallMm": 58,
      "rainDays": 14
    }
  ],
  "seoul": [
    {
      "month": 1,
      "avgHighC": 2.5,
      "avgLowC": -6.6,
      "rainfallMm": 28,
      "rainDays": 4
    },
    {
      "month": 2,
      "avgHighC": 5.6,
      "avgLowC": -4.3,
      "rainfallMm": 28,
      "rainDays": 5
    },
    {
      "month": 3,
      "avgHighC": 12.1,
      "avgLowC": 0.5,
      "rainfallMm": 53,
      "rainDays": 7
    },
    {
      "month": 4,
      "avgHighC": 17.9,
      "avgLowC": 6.6,
      "rainfallMm": 58,
      "rainDays": 6
    },
    {
      "month": 5,
      "avgHighC": 22.2,
      "avgLowC": 11.6,
      "rainfallMm": 128,
      "rainDays": 9
    },
    {
      "month": 6,
      "avgHighC": 26.9,
      "avgLowC": 17.8,
      "rainfallMm": 176,
      "rainDays": 12
    },
    {
      "month": 7,
      "avgHighC": 28.8,
      "avgLowC": 22,
      "rainfallMm": 324,
      "rainDays": 20
    },
    {
      "month": 8,
      "avgHighC": 28.9,
      "avgLowC": 22.5,
      "rainfallMm": 358,
      "rainDays": 19
    },
    {
      "month": 9,
      "avgHighC": 25.5,
      "avgLowC": 17.7,
      "rainfallMm": 199,
      "rainDays": 11
    },
    {
      "month": 10,
      "avgHighC": 18.5,
      "avgLowC": 9.1,
      "rainfallMm": 75,
      "rainDays": 7
    },
    {
      "month": 11,
      "avgHighC": 11.7,
      "avgLowC": 2.1,
      "rainfallMm": 66,
      "rainDays": 7
    },
    {
      "month": 12,
      "avgHighC": 2.7,
      "avgLowC": -5.7,
      "rainfallMm": 22,
      "rainDays": 4
    }
  ],
  "busan": [
    {
      "month": 1,
      "avgHighC": 7,
      "avgLowC": -2.7,
      "rainfallMm": 56,
      "rainDays": 5
    },
    {
      "month": 2,
      "avgHighC": 9.3,
      "avgLowC": -0.5,
      "rainfallMm": 64,
      "rainDays": 7
    },
    {
      "month": 3,
      "avgHighC": 14.1,
      "avgLowC": 3.8,
      "rainfallMm": 102,
      "rainDays": 8
    },
    {
      "month": 4,
      "avgHighC": 18.1,
      "avgLowC": 8.3,
      "rainfallMm": 113,
      "rainDays": 7
    },
    {
      "month": 5,
      "avgHighC": 22.2,
      "avgLowC": 13,
      "rainfallMm": 130,
      "rainDays": 9
    },
    {
      "month": 6,
      "avgHighC": 25.8,
      "avgLowC": 18.4,
      "rainfallMm": 232,
      "rainDays": 12
    },
    {
      "month": 7,
      "avgHighC": 28.1,
      "avgLowC": 22.5,
      "rainfallMm": 335,
      "rainDays": 20
    },
    {
      "month": 8,
      "avgHighC": 29.8,
      "avgLowC": 23.7,
      "rainfallMm": 246,
      "rainDays": 20
    },
    {
      "month": 9,
      "avgHighC": 26,
      "avgLowC": 19.6,
      "rainfallMm": 228,
      "rainDays": 13
    },
    {
      "month": 10,
      "avgHighC": 21.1,
      "avgLowC": 12,
      "rainfallMm": 68,
      "rainDays": 6
    },
    {
      "month": 11,
      "avgHighC": 15.5,
      "avgLowC": 5.3,
      "rainfallMm": 52,
      "rainDays": 4
    },
    {
      "month": 12,
      "avgHighC": 7.4,
      "avgLowC": -2.3,
      "rainfallMm": 27,
      "rainDays": 3
    }
  ],
  "taipei": [
    {
      "month": 1,
      "avgHighC": 19.3,
      "avgLowC": 13.5,
      "rainfallMm": 53,
      "rainDays": 11
    },
    {
      "month": 2,
      "avgHighC": 20.8,
      "avgLowC": 14.3,
      "rainfallMm": 76,
      "rainDays": 11
    },
    {
      "month": 3,
      "avgHighC": 23.5,
      "avgLowC": 15.8,
      "rainfallMm": 91,
      "rainDays": 12
    },
    {
      "month": 4,
      "avgHighC": 25.7,
      "avgLowC": 18.6,
      "rainfallMm": 99,
      "rainDays": 13
    },
    {
      "month": 5,
      "avgHighC": 28.9,
      "avgLowC": 21.9,
      "rainfallMm": 259,
      "rainDays": 19
    },
    {
      "month": 6,
      "avgHighC": 31.7,
      "avgLowC": 24.6,
      "rainfallMm": 206,
      "rainDays": 20
    },
    {
      "month": 7,
      "avgHighC": 33.8,
      "avgLowC": 25.9,
      "rainfallMm": 144,
      "rainDays": 18
    },
    {
      "month": 8,
      "avgHighC": 32.9,
      "avgLowC": 25.6,
      "rainfallMm": 196,
      "rainDays": 20
    },
    {
      "month": 9,
      "avgHighC": 31.1,
      "avgLowC": 24.4,
      "rainfallMm": 225,
      "rainDays": 15
    },
    {
      "month": 10,
      "avgHighC": 27.2,
      "avgLowC": 22.4,
      "rainfallMm": 201,
      "rainDays": 16
    },
    {
      "month": 11,
      "avgHighC": 24.9,
      "avgLowC": 19.5,
      "rainfallMm": 65,
      "rainDays": 12
    },
    {
      "month": 12,
      "avgHighC": 19.8,
      "avgLowC": 15.2,
      "rainfallMm": 78,
      "rainDays": 16
    }
  ],
  "hong-kong": [
    {
      "month": 1,
      "avgHighC": 18.8,
      "avgLowC": 13,
      "rainfallMm": 16,
      "rainDays": 4
    },
    {
      "month": 2,
      "avgHighC": 19.8,
      "avgLowC": 14.1,
      "rainfallMm": 61,
      "rainDays": 8
    },
    {
      "month": 3,
      "avgHighC": 22.4,
      "avgLowC": 17.8,
      "rainfallMm": 85,
      "rainDays": 14
    },
    {
      "month": 4,
      "avgHighC": 24.5,
      "avgLowC": 20.2,
      "rainfallMm": 180,
      "rainDays": 17
    },
    {
      "month": 5,
      "avgHighC": 26.9,
      "avgLowC": 23.4,
      "rainfallMm": 313,
      "rainDays": 23
    },
    {
      "month": 6,
      "avgHighC": 28.6,
      "avgLowC": 25.5,
      "rainfallMm": 344,
      "rainDays": 29
    },
    {
      "month": 7,
      "avgHighC": 29.9,
      "avgLowC": 26.4,
      "rainfallMm": 269,
      "rainDays": 26
    },
    {
      "month": 8,
      "avgHighC": 29.3,
      "avgLowC": 25.6,
      "rainfallMm": 379,
      "rainDays": 27
    },
    {
      "month": 9,
      "avgHighC": 29.3,
      "avgLowC": 25,
      "rainfallMm": 338,
      "rainDays": 24
    },
    {
      "month": 10,
      "avgHighC": 26.9,
      "avgLowC": 21.8,
      "rainfallMm": 212,
      "rainDays": 11
    },
    {
      "month": 11,
      "avgHighC": 24.3,
      "avgLowC": 18.8,
      "rainfallMm": 127,
      "rainDays": 8
    },
    {
      "month": 12,
      "avgHighC": 19.7,
      "avgLowC": 12.9,
      "rainfallMm": 23,
      "rainDays": 4
    }
  ]
};
