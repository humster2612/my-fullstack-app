// client/src/locationOptions.ts

export type CityOption = {
    id: string;          // уникальный ключ, например "prague"
    countryCode: string; // "CZ"
    countryName: string; // "Czech Republic"
    city: string;        // "Prague"
    lat: number;
    lng: number;
  };
  
  export const CITY_OPTIONS: CityOption[] = [
    {
      id: "prague",
      countryCode: "CZ",
      countryName: "Czech Republic",
      city: "Prague",
      lat: 50.0755,
      lng: 14.4378,
    },
    {
      id: "warsaw",
      countryCode: "PL",
      countryName: "Poland",
      city: "Warsaw",
      lat: 52.2297,
      lng: 21.0122,
    },
    {
      id: "krakow",
      countryCode: "PL",
      countryName: "Poland",
      city: "Kraków",
      lat: 50.0647,
      lng: 19.9450,
    },
    {
      id: "berlin",
      countryCode: "DE",
      countryName: "Germany",
      city: "Berlin",
      lat: 52.52,
      lng: 13.405,
    },
    {
      id: "amsterdam",
      countryCode: "NL",
      countryName: "Netherlands",
      city: "Amsterdam",
      lat: 52.3676,
      lng: 4.9041,
    },
    // потом можно добавить ещё сколько угодно городов
  ];
  