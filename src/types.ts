export type MediaCategory = "Movie" | "Web Series" | "Anime";
export type MediaStatus = "Watched" | "Watching" | "Plan to Watch";

export interface ProgressState {
  currentEpisode?: number;
  totalEpisodes?: number;
  currentSeason?: number;
  totalSeasons?: number;
}

export interface MediaItem {
  id: string;
  title: string;
  category: MediaCategory;
  status: MediaStatus;
  genres: string[];
  rating: number | string; // scale of 0 to 10 or 'N/A'
  year: string;
  duration: string; // string representing runtime or episode description
  language: string;
  synopsis: string;
  posterUrl: string;
  favorite: boolean;
  dateAdded: string; // ISO string
  progress?: ProgressState;
  notes?: string;
  releaseDate?: string;
  isUpcoming?: boolean;
}

export interface ChatMessage {
  sender: string;
  text: string;
}

export interface MovieSuggestion {
  title: string;
  category: MediaCategory;
  year: string;
  genres: string[];
  rating: number;
  duration: string;
  language: string;
  synopsis: string;
  posterUrl: string;
  recommendedBy: string;
}
