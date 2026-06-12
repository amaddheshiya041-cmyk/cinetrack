import { MediaItem } from "./types";

export const DEFAULT_MEDIA_ITEMS: MediaItem[] = [
  {
    id: "1",
    title: "Pathaan",
    category: "Movie",
    status: "Watched",
    genres: ["Action", "Thriller"],
    rating: 8.5,
    year: "2023",
    duration: "2h 26m",
    language: "Hindi, Tamil",
    synopsis: "An Indian agency secret agent is on a mission to stop a rogue private terrorist organization from launching a deadly virus threat.",
    posterUrl: "https://image.tmdb.org/t/p/w500/1LRLLWGvs5sZdTzuMqLEahb88Pc.jpg",
    favorite: true,
    dateAdded: "2026-01-10T12:00:00Z"
  },
  {
    id: "2",
    title: "Interstellar",
    category: "Movie",
    status: "Watched",
    genres: ["Sci-Fi", "Drama"],
    rating: 9.5,
    year: "2014",
    duration: "2h 49m",
    language: "English, Hindi",
    synopsis: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival on a dying Earth.",
    posterUrl: "https://image.tmdb.org/t/p/w500/gEU2Qv6HXZvDbgS6vNG3e0vsu0C.jpg",
    favorite: true,
    dateAdded: "2026-02-15T15:30:00Z"
  },
  {
    id: "3",
    title: "Mirzapur",
    category: "Web Series",
    status: "Watching",
    genres: ["Action", "Thriller"],
    rating: 9.0,
    year: "2018",
    duration: "3 Seasons",
    language: "Hindi",
    synopsis: "A shocking incident at a wedding procession ignites a series of events of greed, power and ambition in the lawless land of Mirzapur.",
    posterUrl: "https://image.tmdb.org/t/p/w500/7Wv9M0dC3qS94jQ7D8z67XwW09y.jpg",
    favorite: true,
    dateAdded: "2026-03-20T09:45:00Z",
    progress: {
      currentEpisode: 4,
      totalEpisodes: 10,
      currentSeason: 3,
      totalSeasons: 3
    }
  },
  {
    id: "4",
    title: "Demon Slayer",
    category: "Anime",
    status: "Watching",
    genres: ["Action", "Fantasy"],
    rating: 8.9,
    year: "2019",
    duration: "4 Seasons",
    language: "Japanese, Hindi",
    synopsis: "A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon.",
    posterUrl: "https://image.tmdb.org/t/p/w500/xOM07Z566P8m69U9EvgSsc79uX6.jpg",
    favorite: false,
    dateAdded: "2026-04-05T18:15:00Z",
    progress: {
      currentEpisode: 6,
      totalEpisodes: 8,
      currentSeason: 4,
      totalSeasons: 4
    }
  },
  {
    id: "5",
    title: "Inception",
    category: "Movie",
    status: "Watched",
    genres: ["Sci-Fi", "Action"],
    rating: 9.0,
    year: "2010",
    duration: "2h 28m",
    language: "English",
    synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    posterUrl: "https://image.tmdb.org/t/p/w500/l946fF7g6m2Yr7ihS6E0O7R4gNq.jpg",
    favorite: false,
    dateAdded: "2026-01-22T14:10:00Z"
  },
  {
    id: "6",
    title: "Stranger Things",
    category: "Web Series",
    status: "Plan to Watch",
    genres: ["Sci-Fi", "Thriller"],
    rating: 8.8,
    year: "2016",
    duration: "4 Seasons",
    language: "English",
    synopsis: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
    posterUrl: "https://image.tmdb.org/t/p/w500/49W66qvl6gS677IE3RfU6R6g365.jpg",
    favorite: false,
    dateAdded: "2026-05-12T10:00:00Z",
    progress: {
      currentEpisode: 1,
      totalEpisodes: 8,
      currentSeason: 1,
      totalSeasons: 4
    }
  },
  {
    id: "7",
    title: "Attack on Titan",
    category: "Anime",
    status: "Watched",
    genres: ["Action", "Fantasy"],
    rating: 9.6,
    year: "2013",
    duration: "4 Seasons",
    language: "Japanese, English",
    synopsis: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.",
    posterUrl: "https://image.tmdb.org/t/p/w500/h9B7wA99K86v6S6u9Evg6S6Evy5.jpg",
    favorite: true,
    dateAdded: "2026-01-05T08:00:00Z"
  },
  {
    id: "8",
    title: "La La Land",
    category: "Movie",
    status: "Plan to Watch",
    genres: ["Comedy", "Romance"],
    rating: 8.4,
    year: "2016",
    duration: "2h 08m",
    language: "English",
    synopsis: "While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future.",
    posterUrl: "https://image.tmdb.org/t/p/w500/uDo6v8go6b96QvSsc796T6g96O4.jpg",
    favorite: false,
    dateAdded: "2026-05-30T16:20:00Z"
  }
];

export const GENRES_LIST = [
  "All Genres",
  "Action",
  "Comedy",
  "Drama",
  "Sci-Fi",
  "Thriller",
  "Romance",
  "Fantasy",
  "Horror",
  "Mystery"
];
