export type CityOption = {
  id: string;
  countryCode: string;
  countryName: string;
  city: string;
  lat: number;
  lng: number;
};

export const CITY_OPTIONS: CityOption[] = [
  // --- Czechia / Slovakia / Poland / neighbors ---
  { id: "prague", countryCode: "CZ", countryName: "Czech Republic", city: "Prague", lat: 50.0755, lng: 14.4378 },
  { id: "brno", countryCode: "CZ", countryName: "Czech Republic", city: "Brno", lat: 49.1951, lng: 16.6068 },
  { id: "ostrava", countryCode: "CZ", countryName: "Czech Republic", city: "Ostrava", lat: 49.8209, lng: 18.2625 },

  { id: "bratislava", countryCode: "SK", countryName: "Slovakia", city: "Bratislava", lat: 48.1486, lng: 17.1077 },
  { id: "kosice", countryCode: "SK", countryName: "Slovakia", city: "Košice", lat: 48.7164, lng: 21.2611 },

  { id: "warsaw", countryCode: "PL", countryName: "Poland", city: "Warsaw", lat: 52.2297, lng: 21.0122 },
  { id: "krakow", countryCode: "PL", countryName: "Poland", city: "Kraków", lat: 50.0647, lng: 19.9450 },
  { id: "wroclaw", countryCode: "PL", countryName: "Poland", city: "Wrocław", lat: 51.1079, lng: 17.0385 },
  { id: "poznan", countryCode: "PL", countryName: "Poland", city: "Poznań", lat: 52.4064, lng: 16.9252 },
  { id: "gdansk", countryCode: "PL", countryName: "Poland", city: "Gdańsk", lat: 54.3520, lng: 18.6466 },
  { id: "rzeszow", countryCode: "PL", countryName: "Poland", city: "Rzeszów", lat: 50.0412, lng: 21.9991 },

  { id: "vienna", countryCode: "AT", countryName: "Austria", city: "Vienna", lat: 48.2082, lng: 16.3738 },
  { id: "salzburg", countryCode: "AT", countryName: "Austria", city: "Salzburg", lat: 47.8095, lng: 13.0550 },
  { id: "budapest", countryCode: "HU", countryName: "Hungary", city: "Budapest", lat: 47.4979, lng: 19.0402 },

  // --- Germany ---
  { id: "berlin", countryCode: "DE", countryName: "Germany", city: "Berlin", lat: 52.5200, lng: 13.4050 },
  { id: "munich", countryCode: "DE", countryName: "Germany", city: "Munich", lat: 48.1351, lng: 11.5820 },
  { id: "hamburg", countryCode: "DE", countryName: "Germany", city: "Hamburg", lat: 53.5511, lng: 9.9937 },
  { id: "frankfurt", countryCode: "DE", countryName: "Germany", city: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { id: "cologne", countryCode: "DE", countryName: "Germany", city: "Cologne", lat: 50.9375, lng: 6.9603 },

  // --- Benelux / Nordics ---
  { id: "amsterdam", countryCode: "NL", countryName: "Netherlands", city: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { id: "rotterdam", countryCode: "NL", countryName: "Netherlands", city: "Rotterdam", lat: 51.9244, lng: 4.4777 },
  { id: "brussels", countryCode: "BE", countryName: "Belgium", city: "Brussels", lat: 50.8503, lng: 4.3517 },
  { id: "antwerp", countryCode: "BE", countryName: "Belgium", city: "Antwerp", lat: 51.2194, lng: 4.4025 },

  { id: "copenhagen", countryCode: "DK", countryName: "Denmark", city: "Copenhagen", lat: 55.6761, lng: 12.5683 },
  { id: "stockholm", countryCode: "SE", countryName: "Sweden", city: "Stockholm", lat: 59.3293, lng: 18.0686 },
  { id: "oslo", countryCode: "NO", countryName: "Norway", city: "Oslo", lat: 59.9139, lng: 10.7522 },
  { id: "helsinki", countryCode: "FI", countryName: "Finland", city: "Helsinki", lat: 60.1699, lng: 24.9384 },

  // --- France / Switzerland ---
  { id: "paris", countryCode: "FR", countryName: "France", city: "Paris", lat: 48.8566, lng: 2.3522 },
  { id: "lyon", countryCode: "FR", countryName: "France", city: "Lyon", lat: 45.7640, lng: 4.8357 },
  { id: "marseille", countryCode: "FR", countryName: "France", city: "Marseille", lat: 43.2965, lng: 5.3698 },

  { id: "zurich", countryCode: "CH", countryName: "Switzerland", city: "Zurich", lat: 47.3769, lng: 8.5417 },
  { id: "geneva", countryCode: "CH", countryName: "Switzerland", city: "Geneva", lat: 46.2044, lng: 6.1432 },

  // --- UK / Ireland ---
  { id: "london", countryCode: "GB", countryName: "United Kingdom", city: "London", lat: 51.5074, lng: -0.1278 },
  { id: "manchester", countryCode: "GB", countryName: "United Kingdom", city: "Manchester", lat: 53.4808, lng: -2.2426 },
  { id: "edinburgh", countryCode: "GB", countryName: "United Kingdom", city: "Edinburgh", lat: 55.9533, lng: -3.1883 },
  { id: "dublin", countryCode: "IE", countryName: "Ireland", city: "Dublin", lat: 53.3498, lng: -6.2603 },

  // --- Spain / Portugal / Italy / Greece ---
  { id: "madrid", countryCode: "ES", countryName: "Spain", city: "Madrid", lat: 40.4168, lng: -3.7038 },
  { id: "barcelona", countryCode: "ES", countryName: "Spain", city: "Barcelona", lat: 41.3851, lng: 2.1734 },
  { id: "valencia", countryCode: "ES", countryName: "Spain", city: "Valencia", lat: 39.4699, lng: -0.3763 },

  { id: "lisbon", countryCode: "PT", countryName: "Portugal", city: "Lisbon", lat: 38.7223, lng: -9.1393 },
  { id: "porto", countryCode: "PT", countryName: "Portugal", city: "Porto", lat: 41.1579, lng: -8.6291 },

  { id: "rome", countryCode: "IT", countryName: "Italy", city: "Rome", lat: 41.9028, lng: 12.4964 },
  { id: "milan", countryCode: "IT", countryName: "Italy", city: "Milan", lat: 45.4642, lng: 9.1900 },
  { id: "venice", countryCode: "IT", countryName: "Italy", city: "Venice", lat: 45.4408, lng: 12.3155 },
  { id: "naples", countryCode: "IT", countryName: "Italy", city: "Naples", lat: 40.8518, lng: 14.2681 },

  { id: "athens", countryCode: "GR", countryName: "Greece", city: "Athens", lat: 37.9838, lng: 23.7275 },

  // --- Balkans / Baltics ---
  { id: "zagreb", countryCode: "HR", countryName: "Croatia", city: "Zagreb", lat: 45.8150, lng: 15.9819 },
  { id: "ljubljana", countryCode: "SI", countryName: "Slovenia", city: "Ljubljana", lat: 46.0569, lng: 14.5058 },
  { id: "belgrade", countryCode: "RS", countryName: "Serbia", city: "Belgrade", lat: 44.7866, lng: 20.4489 },
  { id: "sofia", countryCode: "BG", countryName: "Bulgaria", city: "Sofia", lat: 42.6977, lng: 23.3219 },
  { id: "bucharest", countryCode: "RO", countryName: "Romania", city: "Bucharest", lat: 44.4268, lng: 26.1025 },

  { id: "vilnius", countryCode: "LT", countryName: "Lithuania", city: "Vilnius", lat: 54.6872, lng: 25.2797 },
  { id: "riga", countryCode: "LV", countryName: "Latvia", city: "Riga", lat: 56.9496, lng: 24.1052 },
  { id: "tallinn", countryCode: "EE", countryName: "Estonia", city: "Tallinn", lat: 59.4370, lng: 24.7536 },

  // --- USA / Canada ---
  { id: "new_york", countryCode: "US", countryName: "United States", city: "New York", lat: 40.7128, lng: -74.0060 },
  { id: "los_angeles", countryCode: "US", countryName: "United States", city: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { id: "chicago", countryCode: "US", countryName: "United States", city: "Chicago", lat: 41.8781, lng: -87.6298 },
  { id: "miami", countryCode: "US", countryName: "United States", city: "Miami", lat: 25.7617, lng: -80.1918 },
  { id: "san_francisco", countryCode: "US", countryName: "United States", city: "San Francisco", lat: 37.7749, lng: -122.4194 },
  { id: "seattle", countryCode: "US", countryName: "United States", city: "Seattle", lat: 47.6062, lng: -122.3321 },

  { id: "toronto", countryCode: "CA", countryName: "Canada", city: "Toronto", lat: 43.6532, lng: -79.3832 },
  { id: "vancouver", countryCode: "CA", countryName: "Canada", city: "Vancouver", lat: 49.2827, lng: -123.1207 },
  { id: "montreal", countryCode: "CA", countryName: "Canada", city: "Montreal", lat: 45.5017, lng: -73.5673 },

  // --- Asia ---
  { id: "tokyo", countryCode: "JP", countryName: "Japan", city: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { id: "osaka", countryCode: "JP", countryName: "Japan", city: "Osaka", lat: 34.6937, lng: 135.5023 },

  { id: "seoul", countryCode: "KR", countryName: "South Korea", city: "Seoul", lat: 37.5665, lng: 126.9780 },

  { id: "singapore", countryCode: "SG", countryName: "Singapore", city: "Singapore", lat: 1.3521, lng: 103.8198 },
  { id: "bangkok", countryCode: "TH", countryName: "Thailand", city: "Bangkok", lat: 13.7563, lng: 100.5018 },
  { id: "hanoi", countryCode: "VN", countryName: "Vietnam", city: "Hanoi", lat: 21.0278, lng: 105.8342 },
  { id: "ho_chi_minh", countryCode: "VN", countryName: "Vietnam", city: "Ho Chi Minh City", lat: 10.8231, lng: 106.6297 },

  { id: "dubai", countryCode: "AE", countryName: "United Arab Emirates", city: "Dubai", lat: 25.2048, lng: 55.2708 },
  { id: "istanbul", countryCode: "TR", countryName: "Turkey", city: "Istanbul", lat: 41.0082, lng: 28.9784 },

  // --- Australia / NZ ---
  { id: "sydney", countryCode: "AU", countryName: "Australia", city: "Sydney", lat: -33.8688, lng: 151.2093 },
  { id: "melbourne", countryCode: "AU", countryName: "Australia", city: "Melbourne", lat: -37.8136, lng: 144.9631 },
  { id: "auckland", countryCode: "NZ", countryName: "New Zealand", city: "Auckland", lat: -36.8485, lng: 174.7633 },

  // --- LatAm (минимум, но чтобы было) ---
  { id: "mexico_city", countryCode: "MX", countryName: "Mexico", city: "Mexico City", lat: 19.4326, lng: -99.1332 },
  { id: "sao_paulo", countryCode: "BR", countryName: "Brazil", city: "São Paulo", lat: -23.5558, lng: -46.6396 },
  { id: "buenos_aires", countryCode: "AR", countryName: "Argentina", city: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
];
