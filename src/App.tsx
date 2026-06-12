import React, { useState, useEffect } from "react";
import { MediaItem, MediaCategory, MediaStatus } from "./types";
import { DEFAULT_MEDIA_ITEMS, GENRES_LIST } from "./data";
import { DashboardView } from "./components/DashboardView";
import { MediaCard } from "./components/MediaCard";
import { AddEditModal } from "./components/AddEditModal";
import { MediaDetailModal } from "./components/MediaDetailModal";
import { GroupChatView } from "./components/GroupChatView";
import { LoginOverlay } from "./components/LoginOverlay";
import { FindFriendsView } from "./components/FindFriendsView";
import { triggerConfetti } from "./utils/confetti";
import { 
  Search, Plus, Heart, HeartOff, Trash2, Edit, X, Star, Calendar, Languages, Clock, BookOpen, Film, Tv, Sparkles, Users, LogOut, Loader2, User, UserPlus, Palette, Check, ChevronDown, Mic
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, where, updateDoc, addDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";

export default function App() {
  // Custom confirmation modal states
  const [deleteConfirmationItem, setDeleteConfirmationItem] = useState<MediaItem | null>(null);
  const [isDeletingOngoing, setIsDeletingOngoing] = useState(false);

  // Main navigation & search/filtering states
  const [activeTab, setActiveTab] = useState<"Dashboard" | "Movies" | "Web Series" | "Anime" | "Upcoming" | "Dosto ka Adda" | "Profile" | "Find Friends">("Movies");
  const [isMoviesLoading, setIsMoviesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All Status");
  const [selectedGenre, setSelectedGenre] = useState<string>("All Genres");
  const [sortBy, setSortBy] = useState<string>("Sort: Date Added");
  const [isOfflineModeActive, setIsOfflineModeActive] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Mobile Pull to Refresh states
  const [startY, setStartY] = useState<number | null>(null);
  const [pullOffset, setPullOffset] = useState<number>(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const startVoiceSearch = (onResult: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech Recognition is not supported by your browser.", "danger");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      showToast("Listening... Speak now", "info");
    };
    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
      showToast("Voice identification failed: " + (e.error || "unknown"), "danger");
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        onResult(text);
        showToast(`Captured: "${text}"`, "success");
      }
    };
    recognition.start();
  };

  // Mobile Pull to Refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isPullRefreshing) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null || isPullRefreshing) return;
    const currentY = e.touches[0].clientY;
    const offset = currentY - startY;

    if (offset > 0) {
      const cappedOffset = Math.min(110, offset * 0.45);
      setPullOffset(cappedOffset);
      
      // If we are pulling down at the top of the viewport, prevent rubber-banding on iOS Chrome/Safari
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (startY === null || isPullRefreshing) return;
    
    if (pullOffset >= 50) {
      setIsPullRefreshing(true);
      showToast("Refreshing latest watchlists...", "info");
      try {
        await loadMovies();
      } catch (err) {
        console.error("Failed to refresh watchlist:", err);
      } finally {
        setTimeout(() => {
          setIsPullRefreshing(false);
          setPullOffset(0);
          setStartY(null);
        }, 750);
      }
    } else {
      setPullOffset(0);
      setStartY(null);
    }
  };

  // Upcoming TMDB State variables
  const [upcomingSubTab, setUpcomingSubTab] = useState<"All" | "Movies" | "Web Series" | "Anime">("All");
  const [upcomingItems, setUpcomingItems] = useState<MediaItem[]>([]);
  const [isUpcomingLoading, setIsUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(() => localStorage.getItem("cinetrack_guest_mode") === "true");

  // Watchlist items store, initialized from localStorage or defaults
  const [items, setItems] = useState<MediaItem[]>(() => {
    const saved = localStorage.getItem("cinetrack_items");
    return saved ? JSON.parse(saved) : DEFAULT_MEDIA_ITEMS;
  });

  const handleLoginSuccess = (user: any) => {
    setIsGuestMode(false);
    localStorage.removeItem("cinetrack_guest_mode");
    setShowSuccessAnimation(true);
    setTimeout(() => {
      setShowSuccessAnimation(false);
      setCurrentUser(user);
    }, 1500);
  };

  const handleContinueAsGuest = () => {
    setIsGuestMode(true);
    localStorage.setItem("cinetrack_guest_mode", "true");
    const guestUser = { uid: "guest", displayName: "Guest Explorer", isAnonymous: true, email: "guest@cinetrack.com" };
    setShowSuccessAnimation(true);
    setTimeout(() => {
      setShowSuccessAnimation(false);
      setCurrentUser(guestUser);
      const saved = localStorage.getItem("cinetrack_items");
      setItems(saved ? JSON.parse(saved) : DEFAULT_MEDIA_ITEMS);
    }, 1500);
  };

  // Write a loadMovies() function using Firebase Firestore
  const loadMovies = async () => {
    setIsMoviesLoading(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("Device is offline. Loading cached items from localStorage.");
      setIsOfflineModeActive(true);
      const saved = localStorage.getItem("cinetrack_items");
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (parseErr) {
          setItems(DEFAULT_MEDIA_ITEMS);
        }
      } else {
        setItems(DEFAULT_MEDIA_ITEMS);
      }
      setIsMoviesLoading(false);
      return;
    }

    try {
      let q;
      if (activeTab === "Dashboard" || activeTab === "Profile") {
        q = query(collection(db, "watched_movies"));
      } else {
        // Determine the query category
        let currentTab = "movie";
        if (activeTab === "Web Series") {
          currentTab = "web-series";
        } else if (activeTab === "Anime") {
          currentTab = "anime";
        }
        // Fetch from the 'watched_movies' collection filtered by category using queries
        q = query(collection(db, "watched_movies"), where("category", "==", currentTab));
      }

      const snapshot = await getDocs(q);
      const loadedItems: MediaItem[] = [];

      snapshot.forEach((docSnapshot: any) => {
        const data = docSnapshot.data();
        let appCategory: MediaCategory = "Movie";
        if (data.category === "web-series") {
          appCategory = "Web Series";
        } else if (data.category === "anime") {
          appCategory = "Anime";
        }

        const loadedItem: MediaItem = {
          id: docSnapshot.id,
          title: data.title || "Untitled",
          category: appCategory,
          status: data.status || "Watched",
          genres: data.genres || [appCategory === "Anime" ? "Anime" : "Action", "Drama"],
          rating: (data.rating === "N/A" || data.rating === "n/a") ? "N/A" : (data.rating !== undefined ? (isNaN(parseFloat(data.rating)) ? 8.0 : parseFloat(data.rating)) : 8.0),
          year: data.year || "2024",
          duration: data.duration || (appCategory === "Movie" ? "2h 5m" : "12 Episodes"),
          language: data.language || "Hindi",
          synopsis: data.synopsis || "Loaded dynamically from Firebase Firestore Database watch history.",
          posterUrl: data.posterUrl || "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
          favorite: data.favorite || false,
          dateAdded: data.createdAt || new Date().toISOString()
        };

        if (data.progress) {
          loadedItem.progress = data.progress;
        }

        loadedItems.push(loadedItem);
      });

      // Clear any dummy static cards currently in the poster grid by setting items with computed documents
      setItems(loadedItems);
      setIsOfflineModeActive(false);
    } catch (err) {
      console.warn("Firestore unreachable or network offline, fallback to local storage cache: ", err);
      setIsOfflineModeActive(true);
      
      // Load cached items from local storage
      const saved = localStorage.getItem("cinetrack_items");
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (parseErr) {
          setItems(DEFAULT_MEDIA_ITEMS);
        }
      } else {
        setItems(DEFAULT_MEDIA_ITEMS);
      }

      try {
        const errInfo = {
          error: err instanceof Error ? err.message : String(err),
          authInfo: {
            userId: auth?.currentUser?.uid,
            email: auth?.currentUser?.email,
            emailVerified: auth?.currentUser?.emailVerified,
          },
          operationType: "get",
          path: "watched_movies"
        };
        console.error("Firestore Error info: ", JSON.stringify(errInfo));
      } catch (logErr) {
        console.error("Failed to log structured Firestore error:", logErr);
      }
    } finally {
      setIsMoviesLoading(false);
    }
  };

  // Fetch upcoming releases from TMDB
  const loadUpcomingItems = async () => {
    setIsUpcomingLoading(true);
    setUpcomingError(null);
    try {
      const apiKey = localStorage.getItem("CINETRACK_TMDB_API_KEY") || "43e9bbd1f428333ca987121e8ba403ce";
      const baseUrl = "https://api.themoviedb.org/3";
      
      // 1. Movies URL
      const moviesUrl = `${baseUrl}/discover/movie?api_key=${apiKey}&region=IN&with_original_language=hi|ko|en&primary_release_date.gte=2026-06-01&primary_release_date.lte=2026-06-30`;
      
      // 2. TV URL
      const tvUrl = `${baseUrl}/discover/tv?api_key=${apiKey}&region=IN&with_original_language=hi|ko|en&first_air_date.gte=2026-06-01&first_air_date.lte=2026-06-30`;
      
      // 3. Anime Movie
      const animeMovieUrl = `${baseUrl}/discover/movie?api_key=${apiKey}&with_genres=16&with_original_language=ja|hi&primary_release_date.gte=2026-06-01&primary_release_date.lte=2026-06-30`;
      
      // 4. Anime TV
      const animeTvUrl = `${baseUrl}/discover/tv?api_key=${apiKey}&with_genres=16&with_original_language=ja|hi&first_air_date.gte=2026-06-01&first_air_date.lte=2026-06-30`;

      const [resMovies, resTv, resAnimeMovie, resAnimeTv] = await Promise.all([
        fetch(moviesUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(tvUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(animeMovieUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(animeTvUrl).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      const TMDB_GENRES: Record<number, string> = {
        16: "Animation", 28: "Action", 12: "Adventure", 35: "Comedy", 80: "Crime",
        99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy",
        36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery",
        10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller",
        10752: "War", 37: "Western", 10759: "Action & Adventure", 10762: "Kids",
        10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
        10767: "Talk", 10768: "War & Politics"
      };

      const mapGenres = (genreIds?: number[]) => {
        if (!genreIds) return ["Upcoming"];
        const names = genreIds.map(id => TMDB_GENRES[id]).filter(Boolean);
        return names.length > 0 ? names.slice(0, 3) : ["Upcoming"];
      };

      const itemsList: MediaItem[] = [];

      // Process Movies
      if (resMovies && resMovies.results) {
        resMovies.results.forEach((m: any) => {
          itemsList.push({
            id: `upcoming-movie-${m.id}`,
            title: m.title || m.name || "Untitled",
            category: "Movie",
            status: "Plan to Watch",
            genres: mapGenres(m.genre_ids),
            rating: m.vote_average || 7.0,
            year: (m.release_date || "2026").substring(0, 4),
            duration: "Bollywood Movie",
            language: "Hindi",
            synopsis: m.overview || "No synopsis available yet.",
            posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
            favorite: false,
            dateAdded: new Date().toISOString(),
            isUpcoming: true,
            releaseDate: m.release_date || "2026-06-15"
          });
        });
      }

      // Process TV Shows
      if (resTv && resTv.results) {
        resTv.results.forEach((m: any) => {
          itemsList.push({
            id: `upcoming-tv-${m.id}`,
            title: m.name || m.title || "Untitled",
            category: "Web Series",
            status: "Plan to Watch",
            genres: mapGenres(m.genre_ids),
            rating: m.vote_average || 7.0,
            year: (m.first_air_date || "2026").substring(0, 4),
            duration: "Hindi Web Series",
            language: "Hindi",
            synopsis: m.overview || "No synopsis available yet.",
            posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
            favorite: false,
            dateAdded: new Date().toISOString(),
            isUpcoming: true,
            releaseDate: m.first_air_date || "2026-06-15"
          });
        });
      }

      // Process Anime Movies
      if (resAnimeMovie && resAnimeMovie.results) {
        resAnimeMovie.results.forEach((m: any) => {
          if (!itemsList.find(i => i.id === `upcoming-movie-${m.id}`)) {
            itemsList.push({
              id: `upcoming-anime-movie-${m.id}`,
              title: m.title || m.name || "Untitled",
              category: "Anime",
              status: "Plan to Watch",
              genres: ["Anime", ...mapGenres(m.genre_ids).filter(g => g !== "Animation")].slice(0, 3),
              rating: m.vote_average || 7.0,
              year: (m.release_date || "2026").substring(0, 4),
              duration: "Anime Movie",
              language: m.original_language === "ja" ? "Japanese" : "Hindi",
              synopsis: m.overview || "No synopsis available yet.",
              posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
              favorite: false,
              dateAdded: new Date().toISOString(),
              isUpcoming: true,
              releaseDate: m.release_date || "2026-06-15"
            });
          }
        });
      }

      // Process Anime TV
      if (resAnimeTv && resAnimeTv.results) {
        resAnimeTv.results.forEach((m: any) => {
          if (!itemsList.find(i => i.id === `upcoming-tv-${m.id}`)) {
            itemsList.push({
              id: `upcoming-anime-tv-${m.id}`,
              title: m.name || m.title || "Untitled",
              category: "Anime",
              status: "Plan to Watch",
              genres: ["Anime", ...mapGenres(m.genre_ids).filter(g => g !== "Animation")].slice(0, 3),
              rating: m.vote_average || 7.0,
              year: (m.first_air_date || "2026").substring(0, 4),
              duration: "Anime Series",
              language: m.original_language === "ja" ? "Japanese" : "Hindi",
              synopsis: m.overview || "No synopsis available yet.",
              posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
              favorite: false,
              dateAdded: new Date().toISOString(),
              isUpcoming: true,
              releaseDate: m.first_air_date || "2026-06-15"
            });
          }
        });
      }

      // Sort chronological ascending
      itemsList.sort((a, b) => {
        const dateA = a.releaseDate || "";
        const dateB = b.releaseDate || "";
        return dateA.localeCompare(dateB);
      });

      setUpcomingItems(itemsList);
    } catch (err: any) {
      console.error("Failed to fetch upcoming titles from TMDB API:", err);
      setUpcomingError(err.message || "Failed to load upcoming movies/shows.");
    } finally {
      setIsUpcomingLoading(false);
    }
  };

  // Write a deleteMovie(event, docId) function that triggers our custom confirmation dialog
  const deleteMovie = async (event: any, docId: string) => {
    if (event) {
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      if (typeof event.preventDefault === "function") event.preventDefault();
    }
    
    let targetDocId = docId;
    if (typeof event === "string" && !docId) {
      targetDocId = event;
    }

    if (!targetDocId) return;

    const item = items.find((i) => i.id === targetDocId);
    if (item) {
      setDeleteConfirmationItem(item);
    }
  };

  // Perform the durable Firestore document deletion and remove it from local state
  const executeMovieDeletion = async () => {
    if (!deleteConfirmationItem) return;
    
    const targetDocId = deleteConfirmationItem.id;
    setIsDeletingOngoing(true);

    try {
      const docRef = doc(db, 'watched_movies', targetDocId);
      await deleteDoc(docRef);
      
      // Remove element from DOM using data-id check
      const element = document.querySelector(`[data-id="${targetDocId}"]`);
      if (element) {
        const closestCard = element.closest('.movie-card');
        if (closestCard) closestCard.remove();
      }
      
      console.log('Delete successful:', targetDocId);

      // Instantly remove from React UI state
      setItems((prev) => prev.filter((item) => item.id !== targetDocId));
      setSelectedItem(null);
      showToast("Firestore se item delete ho gaya! 🗑️", "danger");
      setDeleteConfirmationItem(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      showToast("Delete karne mein error aayi! Check console.", "danger");
      
      try {
        const errInfo = {
          error: err instanceof Error ? err.message : String(err),
          authInfo: {
            userId: auth?.currentUser?.uid,
            email: auth?.currentUser?.email,
            emailVerified: auth?.currentUser?.emailVerified,
          },
          operationType: "delete",
          path: `watched_movies/${targetDocId}`
        };
        console.error("Firestore Error: ", JSON.stringify(errInfo));
      } catch (logErr) {
        console.error("Failed to log structured Firestore error:", logErr);
      }
    } finally {
      setIsDeletingOngoing(false);
    }
  };

  // Bind to window.deleteMovie as requested for global integration
  useEffect(() => {
    (window as any).deleteMovie = deleteMovie;
  }, [items, currentUser]);

  // Setup Authentication State Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsGuestMode(false);
        localStorage.removeItem("cinetrack_guest_mode");
        setCurrentUser(user);
        setAuthLoading(false);
        loadMovies();

        // Ensure user has a profile document in Firestore mapping
        const userEmail = user.email || "";
        if (userEmail) {
          const usernamePart = userEmail.split("@")[0].toLowerCase();
          const userDocRef = doc(db, "users", usernamePart);
          getDoc(userDocRef).then((snap) => {
            if (!snap.exists()) {
              setDoc(userDocRef, {
                username: user.displayName || usernamePart,
                email: userEmail,
                uid: user.uid,
                createdAt: new Date().toISOString()
              }).catch(err => console.warn("Auto-creating user profile doc failed:", err));
            }
          });
        }
      } else {
        const guestModeActive = localStorage.getItem("cinetrack_guest_mode") === "true";
        if (guestModeActive) {
          setCurrentUser({ uid: "guest", displayName: "Guest Explorer", isAnonymous: true, email: "guest@cinetrack.com" });
          setAuthLoading(false);
          const saved = localStorage.getItem("cinetrack_items");
          setItems(saved ? JSON.parse(saved) : DEFAULT_MEDIA_ITEMS);
        } else {
          setCurrentUser(null);
          setAuthLoading(false);
          setItems([]);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Save changes to localStorage on any items modification
  useEffect(() => {
    localStorage.setItem("cinetrack_items", JSON.stringify(items));
  }, [items]);

  // Synchronously listen on network state changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineModeActive(false);
      loadMovies();
    };
    const handleOffline = () => {
      setIsOfflineModeActive(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOfflineModeActive(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // A simple render() function that clears the current grid and re-fetches data
  const render = () => {
    setItems([]);
    loadMovies();
  };

  // Sync UI and trigger render whenever switching tabs
  useEffect(() => {
    if (["Dashboard", "Movies", "Web Series", "Anime", "Profile"].includes(activeTab)) {
      render();
    } else if (activeTab === "Upcoming") {
      loadUpcomingItems();
    }
  }, [activeTab]);

  // Grid container delete event delegation
  useEffect(() => {
    const handleGridClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const deleteBtn = target.closest(".delete-btn") as HTMLElement | null;
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        console.log("Clicked ID:", id);
        if (!id) return;

        e.stopPropagation();
        e.preventDefault();

        // Call our state-synced delete function
        await deleteMovie(e, id);
      }
    };

    const container = document.getElementById("movieGrid") || document.querySelector(".movieGrid") || document.querySelector(".grid-container");
    if (container) {
      container.addEventListener("click", handleGridClick as any);
    }
    return () => {
      if (container) {
        container.removeEventListener("click", handleGridClick as any);
      }
    };
  }, [items, activeTab]);



  // Custom Selector Dropdown Toggles
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Dynamic Palette Settings
  const [theme, setTheme] = useState<"dark-purple" | "midnight-blue" | "crimson-red" | "light-glass">(() => {
    return (localStorage.getItem("cinetrack_theme") as any) || "dark-purple";
  });
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  // Dropdown click outside listener behavior
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isThemeDropdownOpen && !target.closest("#theme-palette-btn")) {
        setIsThemeDropdownOpen(false);
      }
      if (isStatusDropdownOpen && !target.closest("#status-dropdown-btn")) {
        setIsStatusDropdownOpen(false);
      }
      if (isGenreDropdownOpen && !target.closest("#genre-dropdown-btn")) {
        setIsGenreDropdownOpen(false);
      }
      if (isSortDropdownOpen && !target.closest("#sort-dropdown-btn")) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [isThemeDropdownOpen, isStatusDropdownOpen, isGenreDropdownOpen, isSortDropdownOpen]);

  // Helper theme colors mapping to keep design ultra polished
  const themeColors = {
    "dark-purple": {
      meshTopLeft: "bg-blue-600/20",
      meshBottomRight: "bg-purple-600/20",
      activeTab: "bg-blue-600/30 text-blue-300 border-blue-500/30 shadow-blue-500/10",
      textAccent: "text-blue-400",
      bgButton: "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20",
      loaderText: "text-blue-500"
    },
    "midnight-blue": {
      meshTopLeft: "bg-cyan-600/20",
      meshBottomRight: "bg-blue-700/20",
      activeTab: "bg-cyan-600/30 text-cyan-300 border-cyan-500/30 shadow-cyan-500/10",
      textAccent: "text-cyan-400",
      bgButton: "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20",
      loaderText: "text-cyan-500"
    },
    "crimson-red": {
      meshTopLeft: "bg-rose-600/20",
      meshBottomRight: "bg-orange-600/20",
      activeTab: "bg-rose-600/30 text-rose-300 border-rose-500/30 shadow-rose-500/10",
      textAccent: "text-rose-400",
      bgButton: "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20",
      loaderText: "text-rose-500"
    },
    "light-glass": {
      meshTopLeft: "bg-sky-400/20",
      meshBottomRight: "bg-blue-300/25",
      activeTab: "bg-blue-600 text-white border-blue-500/40 shadow-lg shadow-blue-500/20",
      textAccent: "text-blue-600",
      bgButton: "bg-blue-600 hover:bg-blue-550 shadow-blue-500/15",
      loaderText: "text-blue-600"
    }
  };

  const changeTheme = (newTheme: "dark-purple" | "midnight-blue" | "crimson-red" | "light-glass") => {
    setTheme(newTheme);
    localStorage.setItem("cinetrack_theme", newTheme);

    const gradients = {
      "dark-purple": "linear-gradient(135deg, #020617 0%, #0c0a09 100%)",
      "midnight-blue": "linear-gradient(135deg, #020412 0%, #030822 100%)",
      "crimson-red": "linear-gradient(135deg, #090204 0%, #1e0307 100%)",
      "light-glass": "linear-gradient(135deg, #f1f5f9 0%, #ffffff 50%, #eff6ff 100%)"
    };
    document.body.style.backgroundImage = gradients[newTheme];

    if (newTheme === "light-glass") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }

    const labels = {
      "dark-purple": "Dark Purple",
      "midnight-blue": "Midnight Blue",
      "crimson-red": "Crimson Red",
      "light-glass": "Light Glass (Origin OS)"
    };
    showToast(`Theme updated to ${labels[newTheme]}! 🎨`);
  };

  useEffect(() => {
    const gradients = {
      "dark-purple": "linear-gradient(135deg, #020617 0%, #0c0a09 100%)",
      "midnight-blue": "linear-gradient(135deg, #020412 0%, #030822 100%)",
      "crimson-red": "linear-gradient(135deg, #090204 0%, #1e0307 100%)",
      "light-glass": "linear-gradient(135deg, #f1f5f9 0%, #ffffff 50%, #eff6ff 100%)"
    };
    document.body.style.backgroundImage = gradients[theme];

    if (theme === "light-glass") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, [theme]);

  // Selection / Form modals
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  // Toast notifications for user actions feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "danger" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "danger" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Callback to add a new item
  const handleAddItem = (item: MediaItem) => {
    setItems((prev) => [item, ...prev]);
    showToast(`"${item.title}" successfully added!`);
    if (item.status === "Watched") {
      triggerConfetti();
    }
  };

  // Helper to save direct trending item
  const handleSaveTrendingItem = async (tmdbItem: any, category: MediaCategory) => {
    const isGuestModeActive = localStorage.getItem("cinetrack_guest_mode") === "true";
    const dbCategory = category === "Web Series" ? "web-series" : category === "Anime" ? "anime" : "movie";
    
    // Extract year
    const yearResolved = (tmdbItem.release_date || tmdbItem.first_air_date || "2024").substring(0, 4);

    const tmdbGenresMap: Record<number, string> = {
      28: "Action",
      12: "Adventure",
      16: "Animation",
      35: "Comedy",
      80: "Crime",
      99: "Documentary",
      18: "Drama",
      10751: "Family",
      14: "Fantasy",
      36: "History",
      27: "Horror",
      10402: "Music",
      9648: "Mystery",
      10749: "Romance",
      878: "Sci-Fi",
      10770: "TV Movie",
      53: "Thriller",
      10752: "War",
      37: "Western"
    };

    const genreIds: number[] = tmdbItem.genre_ids || [];
    const mappedGenres: string[] = genreIds
      .map(id => tmdbGenresMap[id])
      .filter(Boolean) as string[];
    
    const finalGenres = mappedGenres.length > 0 ? mappedGenres : [category === "Anime" ? "Anime" : "Action"];

    const movieDetails: any = {
      title: tmdbItem.title || tmdbItem.name || "Untitled",
      posterUrl: tmdbItem.poster_path 
        ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` 
        : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
      year: yearResolved,
      rating: parseFloat((tmdbItem.vote_average || 8.0).toFixed(1)),
      language: tmdbItem.original_language || "en",
      category: dbCategory,
      status: "Watched" as MediaStatus,
      genres: finalGenres,
      duration: category === "Movie" ? "2h 5m" : "10 Episodes",
      synopsis: tmdbItem.overview || "Dynamically synchronized with watch list.",
      favorite: false,
      notes: (auth.currentUser && !isGuestModeActive) ? "Real-time watched item synchronized from Trending list!" : "Saved locally from Trending list!",
    };

    if (category !== "Movie") {
      movieDetails.progress = {
        currentSeason: 1,
        totalSeasons: 1,
        currentEpisode: 1,
        totalEpisodes: 10
      };
    }

    let targetId = "media_" + Math.random().toString(36).substring(2, 9);

    if (auth.currentUser && !isGuestModeActive) {
      try {
        const docRef = await addDoc(collection(db, "watched_movies"), {
          ...movieDetails,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
        targetId = docRef.id;
      } catch (err: any) {
        console.error("Firebase Firestore save failed:", err);
        showToast("Firestore save failed: " + err.message, "danger");
        return;
      }
    }

    const newItem: MediaItem = {
      id: targetId,
      title: movieDetails.title,
      category,
      status: "Watched",
      genres: movieDetails.genres,
      rating: movieDetails.rating,
      year: movieDetails.year,
      duration: movieDetails.duration,
      language: movieDetails.language,
      synopsis: movieDetails.synopsis,
      posterUrl: movieDetails.posterUrl,
      favorite: movieDetails.favorite,
      notes: movieDetails.notes,
      dateAdded: new Date().toISOString()
    };

    if (category !== "Movie") {
      newItem.progress = movieDetails.progress;
    }

    // append to items
    setItems((prev) => {
      const updated = [newItem, ...prev];
      if (isGuestModeActive) {
        localStorage.setItem("cinetrack_items", JSON.stringify(updated));
      }
      return updated;
    });

    showToast(`"${movieDetails.title}" added to your Watched List!`, "success");
  };

  // Helper to save direct upcoming item
  const handleAddUpcomingItem = async (upcomingItem: MediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isGuestModeActive = localStorage.getItem("cinetrack_guest_mode") === "true";
    
    // Check if already exists in items
    const alreadyExists = items.some(
      (watchlistItem) => watchlistItem.title.toLowerCase().trim() === upcomingItem.title.toLowerCase().trim()
    );
    if (alreadyExists) {
      showToast(`"${upcomingItem.title}" is already in your watchlist!`, "info");
      return;
    }

    const dbCategory = upcomingItem.category === "Web Series" ? "web-series" : upcomingItem.category === "Anime" ? "anime" : "movie";

    const movieDetails: any = {
      title: upcomingItem.title,
      posterUrl: upcomingItem.posterUrl || "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80",
      year: upcomingItem.year,
      rating: typeof upcomingItem.rating === "number" ? upcomingItem.rating : 8.0,
      language: upcomingItem.language || "en",
      category: dbCategory,
      status: "Plan to Watch" as MediaStatus,
      genres: upcomingItem.genres || [],
      duration: upcomingItem.duration || (upcomingItem.category === "Movie" ? "2h" : "1 Episode"),
      synopsis: upcomingItem.synopsis || "Added from upcoming releases.",
      favorite: false,
      notes: (auth.currentUser && !isGuestModeActive) ? "Real-time upcoming item synchronized under Plan to Watch!" : "Saved locally from upcoming list!",
    };

    if (upcomingItem.category !== "Movie") {
      movieDetails.progress = {
        currentSeason: 1,
        totalSeasons: 1,
        currentEpisode: 1,
        totalEpisodes: 10
      };
    }

    let targetId = "media_" + Math.random().toString(36).substring(2, 9);

    if (auth.currentUser && !isGuestModeActive) {
      try {
        const docRef = await addDoc(collection(db, "watched_movies"), {
          ...movieDetails,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
        targetId = docRef.id;
      } catch (err: any) {
        console.error("Firebase Firestore save failed:", err);
        showToast("Firestore save failed: " + err.message, "danger");
        return;
      }
    }

    const newItem: MediaItem = {
      id: targetId,
      title: movieDetails.title,
      category: upcomingItem.category,
      status: "Plan to Watch",
      genres: movieDetails.genres,
      rating: movieDetails.rating,
      year: movieDetails.year,
      duration: movieDetails.duration,
      language: movieDetails.language,
      synopsis: movieDetails.synopsis,
      posterUrl: movieDetails.posterUrl,
      favorite: movieDetails.favorite,
      notes: movieDetails.notes,
      dateAdded: new Date().toISOString()
    };

    if (upcomingItem.category !== "Movie") {
      newItem.progress = movieDetails.progress;
    }

    setItems((prev) => {
      const updated = [newItem, ...prev];
      if (isGuestModeActive) {
        localStorage.setItem("cinetrack_items", JSON.stringify(updated));
      }
      return updated;
    });

    showToast(`"${movieDetails.title}" added to your Plan to Watch list!`, "success");
  };

  // Callback to update an existing item
  const handleUpdateItem = (updatedItem: MediaItem) => {
    const prevItem = items.find((itm) => itm.id === updatedItem.id);
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    showToast(`"${updatedItem.title}" updated successfully!`);
    if (selectedItem && selectedItem.id === updatedItem.id) {
      setSelectedItem(updatedItem);
    }
    if (updatedItem.status === "Watched" && (!prevItem || prevItem.status !== "Watched")) {
      triggerConfetti();
    }
  };

  // Callback to toggle favorite state
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    let newFavState = false;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          newFavState = !item.favorite;
          showToast(
            newFavState ? `"${item.title}" added to favorites! ✨` : `"${item.title}" removed from favorites`,
            "info"
          );
          return { ...item, favorite: newFavState };
        }
        return item;
      })
    );

    const isGuestModeActive = localStorage.getItem("cinetrack_guest_mode") === "true";
    if (auth.currentUser && !isGuestModeActive) {
      try {
        await updateDoc(doc(db, "watched_movies", id), { favorite: newFavState });
      } catch (err) {
        console.error("Firestore update favorite failed (could be local-only or missing permission):", err);
      }
    }
  };

  // Quick helper to increment episodes/seasons watching progress directly on the dashboard
  const handleIncrementProgress = async (id: string, e: React.MouseEvent) => {
    let updatedItem: MediaItem | null = null;
    
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.progress) {
          const currentE = item.progress.currentEpisode || 1;
          const totalE = item.progress.totalEpisodes || 12;
          const currentS = item.progress.currentSeason || 1;
          const totalS = item.progress.totalSeasons || 1;

          let nextItem = { ...item };
          if (currentE < totalE) {
            showToast(`Episode increased for "${item.title}" (+1 Progress)`, "success");
            nextItem.progress = {
              ...item.progress,
              currentEpisode: currentE + 1
            };
          } else if (currentS < totalS) {
            showToast(`Next Season started for "${item.title}"! 🌟`, "success");
            nextItem.progress = {
              ...item.progress,
              currentSeason: currentS + 1,
              currentEpisode: 1
            };
          } else {
            showToast(`"${item.title}" finished! Moving to Completed. 🎉`, "success");
            nextItem.status = "Watched" as MediaStatus;
            triggerConfetti();
          }
          updatedItem = nextItem;
          return nextItem;
        }
        return item;
      })
    );

    const isGuestModeActive = localStorage.getItem("cinetrack_guest_mode") === "true";
    if (auth.currentUser && !isGuestModeActive && updatedItem) {
      try {
        const updateParams: any = { status: (updatedItem as MediaItem).status };
        if ((updatedItem as MediaItem).progress) {
          updateParams.progress = (updatedItem as MediaItem).progress;
        }
        await updateDoc(doc(db, "watched_movies", id), updateParams);
      } catch (err) {
        console.error("Firestore update progress failed (could be local-only or missing permission):", err);
      }
    }
  };

  // Callback to delete an item
  const handleDeleteItem = (id: string) => {
    deleteMovie(null, id);
  };

  // Sync details selection with the latest state
  const currentSelectedItem = selectedItem 
    ? (selectedItem.isUpcoming 
        ? upcomingItems.find((i) => i.id === selectedItem.id) 
        : items.find((i) => i.id === selectedItem.id)) || null 
    : null;

  // Filter logic based on activeTab, search query, status, and genre
  const filteredItems = items.filter((item) => {
    // 1. Tab check matching category
    if (activeTab === "Movies" && item.category !== "Movie") return false;
    if (activeTab === "Web Series" && item.category !== "Web Series") return false;
    if (activeTab === "Anime" && item.category !== "Anime") return false;
    if (activeTab === "Dashboard" || activeTab === "Dosto ka Adda") return true;

    // 2. Text Search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchGenre = item.genres?.some((g) => g.toLowerCase().includes(q));
      const matchSynopsis = item.synopsis?.toLowerCase().includes(q);
      const matchYear = item.year?.toLowerCase().includes(q);
      if (!matchTitle && !matchGenre && !matchSynopsis && !matchYear) return false;
    }

    // 3. Status Filters
    if (selectedStatus !== "All Status" && item.status !== selectedStatus) return false;

    // 4. Genre Filters
    if (selectedGenre !== "All Genres" && !item.genres?.includes(selectedGenre)) return false;

    return true;
  });

  // Sorting logic on filtered Items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "Sort: Date Added") {
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
    if (sortBy === "Sort: A to Z") {
      return a.title.localeCompare(b.title);
    }
    const ratingA = typeof a.rating === "number" ? a.rating : -1;
    const ratingB = typeof b.rating === "number" ? b.rating : -1;
    return ratingB - ratingA; // default: Score Rating or high-to-low
  });

  // Filter display list depending on the active tab (Tracking Watched lists vs. Upcoming lists)
  const displayItems = activeTab === "Upcoming"
    ? upcomingItems.filter((item) => {
        // subTab filter
        if (upcomingSubTab === "Movies" && item.category !== "Movie") return false;
        if (upcomingSubTab === "Web Series" && item.category !== "Web Series") return false;
        if (upcomingSubTab === "Anime" && item.category !== "Anime") return false;

        // Search query filter
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchGenre = item.genres?.some((g) => g.toLowerCase().includes(q));
          const matchSynopsis = item.synopsis?.toLowerCase().includes(q);
          if (!matchTitle && !matchGenre && !matchSynopsis) return false;
        }
        return true;
      })
    : sortedItems;

  // Calculate default category when opening "Add Modal" from an active tab
  const getModalDefaultCategory = (): MediaCategory => {
    if (activeTab === "Movies") return "Movie";
    if (activeTab === "Web Series") return "Web Series";
    if (activeTab === "Anime") return "Anime";
    return "Movie";
  };

  if (authLoading) {
    return (
      <div className={`${theme === "light-glass" ? "bg-slate-100 text-slate-800" : "bg-slate-950 text-slate-100"} min-h-screen font-sans flex flex-col items-center justify-center relative overflow-hidden`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`w-8 h-8 animate-spin ${themeColors[theme].loaderText}`} />
          <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold">Loading CineTrack Pro...</span>
        </div>
      </div>
    );
  }

  if (!currentUser && !showSuccessAnimation) {
    return <LoginOverlay onSuccess={handleLoginSuccess} onContinueAsGuest={handleContinueAsGuest} />;
  }

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`${theme === "light-glass" ? "bg-transparent text-slate-850" : "bg-slate-950 text-slate-100"} min-h-screen font-sans flex flex-col selection:bg-blue-550/20 selection:text-blue-800 relative overflow-x-hidden transition-all duration-500`}
    >
      
      {/* Pull to Refresh Indicator */}
      <div 
        className="w-full shrink-0 overflow-hidden flex items-center justify-center transition-all duration-200"
        style={{ 
          height: isPullRefreshing ? '55px' : `${pullOffset}px`, 
          opacity: pullOffset > 8 || isPullRefreshing ? 1 : 0,
          background: "rgba(15, 23, 42, 0.45)",
          borderBottom: pullOffset > 8 || isPullRefreshing ? "1px solid rgba(255,255,255,0.06)" : "none"
        }}
      >
        <div className="flex items-center gap-2 py-2">
          <Loader2 
            className={`w-4 h-4 text-blue-400 ${isPullRefreshing ? "animate-spin" : ""}`}
            style={{ 
              transform: isPullRefreshing ? "none" : `rotate(${pullOffset * 4.5}deg)`
            }} 
          />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
            {isPullRefreshing ? "Syncing watchlist..." : pullOffset >= 50 ? "Release to sync" : "Pull down to refresh"}
          </span>
        </div>
      </div>
      
      {/* Navigation Header */}
      <nav className="h-20 w-full z-50 sticky top-0 flex items-center justify-between px-4 md:px-8 border-b border-white/10 bg-white/5 backdrop-blur-xl shrink-0">
        {/* Brand Logo and Title */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="relative flex items-center justify-center">
            <Film className="w-6 h-6 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.85)] filter" />
            <div className="absolute -inset-0.5 bg-blue-500/20 rounded-full blur-md -z-10 animate-pulse"></div>
          </div>
          <div className="flex items-baseline">
            <span className="font-extrabold text-2xl text-white tracking-tight">CineTrack</span>
            <span className="font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 ml-1">PRO</span>
            <span className="text-[10px] text-slate-500 ml-2 uppercase tracking-widest relative -top-3">v1.1</span>
          </div>
          {isOfflineModeActive && (
            <span className="text-[8px] md:text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm animate-pulse whitespace-nowrap ml-2">
              Offline Mode
            </span>
          )}
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-3">
          <div className="relative hidden md:block">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-white/15 border border-white/15 rounded-full pl-9 pr-14 py-1.5 text-xs w-48 lg:w-56 focus:outline-none focus:ring-1 ${theme === "midnight-blue" ? "focus:ring-cyan-500/50" : theme === "crimson-red" ? "focus:ring-rose-500/50" : "focus:ring-blue-500/50"} transition-all text-slate-150`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 text-slate-400">
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => startVoiceSearch((text) => setSearchQuery(text))}
                className={`hover:text-white transition-colors flex items-center ${isListening ? "text-red-500 animate-pulse scale-110" : "text-slate-400"}`}
                title="Voice Search"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 shadow-sm" title="Total Items Tracked">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">{items.length} Items</span>
          </div>

          {/* Palette (Theme) Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
              className="bg-white/5 border border-white/10 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all duration-200 flex items-center justify-center"
              title="Change Theme"
              id="theme-palette-btn"
            >
              <Palette className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {isThemeDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 mt-3 w-48 rounded-2xl border ${theme === "light-glass" ? "border-slate-200 bg-white/90 shadow-2xl" : "border-white/10 bg-slate-950/90"} backdrop-blur-xl p-2 z-50 overflow-hidden`}
                >
                  <div className="px-2.5 py-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-white/5 mb-1.5 select-none">
                    Choose Accent
                  </div>
                  {[
                    { id: "dark-purple", label: "Dark Purple", dot: "bg-purple-500", activeDot: "bg-blue-400" },
                    { id: "midnight-blue", label: "Midnight Blue", dot: "bg-cyan-500", activeDot: "bg-cyan-400" },
                    { id: "crimson-red", label: "Crimson Red", dot: "bg-rose-500", activeDot: "bg-rose-400" },
                    { id: "light-glass", label: "Light Glass", dot: "bg-gradient-to-tr from-sky-450 to-blue-350", activeDot: "text-blue-500" }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        changeTheme(option.id as any);
                        setIsThemeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer select-none ${
                        theme === option.id 
                          ? (theme === "light-glass" ? "bg-slate-200/60 text-slate-900 border border-slate-300/30" : "bg-white/10 text-white") 
                          : (theme === "light-glass" ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50" : "text-slate-400 hover:text-slate-100 hover:bg-white/5")
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${option.dot} ring-1 ring-white/10`} />
                        {option.label}
                      </span>
                      {theme === option.id && <div className={`w-1.5 h-1.5 rounded-full ${theme === "light-glass" ? "bg-blue-500" : option.activeDot}`} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 border-l border-white/10 pl-3.5" id="header-user-logout-wrapper">
              <div className="flex items-center gap-2 backdrop-blur-md bg-slate-800/50 px-3 py-1.5 rounded-full border border-white/10">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm uppercase">
                  {currentUser.email ? currentUser.email.substring(0,1) : "U"}
                </div>
                <span className="text-[11px] font-black tracking-tight text-slate-300 max-w-[90px] truncate" title={currentUser.email || ""}>
                  {currentUser.email ? currentUser.email.split("@")[0] : "User"}
                </span>
              </div>
              
              <button
                onClick={async () => {
                  try {
                    await signOut(auth);
                    setIsGuestMode(false);
                    localStorage.removeItem("cinetrack_guest_mode");
                    localStorage.removeItem("cinetrack_items");
                    setCurrentUser(null);
                    setItems([]);
                    showToast("Logged out successfully! See you soon. 👋", "info");
                  } catch (e) {
                    console.error("Logout failed:", e);
                  }
                }}
                className="backdrop-blur-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 p-2 rounded-full text-rose-450 hover:text-rose-400 cursor-pointer transition-all duration-200 active:scale-90 flex items-center justify-center"
                title="Log Out"
                id="header-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Sub-Navigation exactly below top header */}
      <div className="w-full z-40 bg-slate-950/20 backdrop-blur-md select-none border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4">
          <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-white/10 pb-3 items-center gap-2 scroll-smooth" style={{ WebkitOverflowScrolling: "touch" }}>
            {[
              { name: "Dashboard", icon: <Tv className="w-4 h-4" /> },
              { name: "Movies", icon: <Film className="w-4 h-4" /> },
              { name: "Web Series", icon: <Tv className="w-4 h-4" /> },
              { name: "Anime", icon: <Sparkles className="w-4 h-4" /> },
              { name: "Upcoming", icon: <Calendar className="w-4 h-4" /> },
              { name: "Dosto ka Adda", icon: <Users className="w-4 h-4" /> },
              { name: "Find Friends", icon: <UserPlus className="w-4 h-4" /> },
              { name: "Profile", icon: <User className="w-4 h-4" /> }
            ].map((tab) => {
              const isTabActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name as any)}
                  className={`px-4 py-2 rounded-full cursor-pointer transition-all duration-200 flex items-center gap-2 shrink-0 text-sm font-bold active:scale-90 transform-gpu ${
                    isTabActive
                      ? `${themeColors[theme].activeTab} backdrop-blur-md shadow-lg`
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container Area */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-grow flex flex-col justify-start">
        
        {/* Page Title Section & Description */}
        {activeTab !== "Dashboard" && activeTab !== "Dosto ka Adda" && activeTab !== "Profile" && activeTab !== "Find Friends" && (
          <div className="mb-6 animate-fade-in select-none">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
              {activeTab === "Movies" && <Film className="w-8 h-8 text-blue-500" />}
              {activeTab === "Web Series" && <Tv className="w-8 h-8 text-indigo-500" />}
              {activeTab === "Anime" && <Sparkles className="w-8 h-8 text-fuchsia-500" />}
              {activeTab === "Upcoming" && <Calendar className="w-8 h-8 text-cyan-400" />}
              {activeTab}
            </h1>

          </div>
        )}

        {/* Dynamic Filters bar (Only visible for Movies, Web Series, Anime tabs) */}
        {activeTab !== "Dashboard" && activeTab !== "Dosto ka Adda" && activeTab !== "Profile" && activeTab !== "Find Friends" && (
          <div className="flex flex-col gap-4 mb-8 select-none">
            {/* Local Search input directly below title */}
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()} by title, genres, storyline...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-white/5 border border-white/10 rounded-xl pl-9 pr-14 py-2 text-sm w-full focus:outline-none focus:ring-1 ${theme === "midnight-blue" ? "focus:ring-cyan-500/50" : theme === "crimson-red" ? "focus:ring-rose-500/50" : "focus:ring-blue-500/50"} transition-all text-slate-150`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 text-slate-400">
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="hover:text-white transition-colors animate-fade-in"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => startVoiceSearch((text) => setSearchQuery(text))}
                  className={`hover:text-white transition-colors flex items-center pb-0.5 ${isListening ? "text-red-500 animate-pulse scale-110" : "text-slate-400"}`}
                  title="Voice Search"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters selectors underneath search bar */}
            {activeTab === "Upcoming" ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2.5 z-40 items-center">
                  {(["All", "Movies", "Web Series", "Anime"] as const).map((subTab) => {
                    const isActive = upcomingSubTab === subTab;
                    return (
                      <button
                        key={subTab}
                        onClick={() => setUpcomingSubTab(subTab)}
                        className={`px-4.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-1.5 select-none hover:scale-[1.03] active:scale-[0.97] border ${
                          isActive
                            ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 font-bold shadow-lg shadow-cyan-550/15 animate-pulse"
                            : "bg-white/5 border-white/5 text-slate-450 hover:text-white"
                        }`}
                      >
                        {subTab}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2.5 z-40">
                {/* Status Dropdown */}
                <div className="relative" id="status-dropdown-btn">
                  <button
                    onClick={() => {
                      setIsStatusDropdownOpen(!isStatusDropdownOpen);
                      setIsGenreDropdownOpen(false);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`px-4 py-2 border transition-all duration-300 rounded-xl text-xs font-bold tracking-wide outline-none select-none cursor-pointer flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] ${
                      theme === "light-glass" 
                        ? "bg-white/40 border-slate-200 text-slate-800 hover:bg-white/60 shadow-sm" 
                        : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10 hover:border-white/20 shadow-md backdrop-blur-md shadow-slate-950/25"
                    }`}
                  >
                    <span>{selectedStatus}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 border-none bg-transparent transitions-transform duration-300" />
                  </button>
                  <AnimatePresence>
                    {isStatusDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`absolute left-0 z-50 mt-2.5 w-52 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl ${
                          theme === "light-glass" 
                            ? "bg-white/70 border-slate-200 text-slate-800" 
                            : "bg-slate-900/85 border-white/10 text-white shadow-slate-950/50"
                        }`}
                      >
                        {["All Status", "Watched", "Watching", "Plan to Watch"].map((status) => (
                          <div
                            key={status}
                            onClick={() => {
                              setSelectedStatus(status);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                              theme === "light-glass"
                                ? "hover:bg-slate-100/80 text-slate-700"
                                : "hover:bg-white/10 text-slate-200"
                            } ${selectedStatus === status ? (theme === "light-glass" ? "bg-blue-100/70 text-blue-600 font-bold" : "bg-white/10 text-cyan-400 font-bold") : ""}`}
                          >
                            <span>{status}</span>
                            {selectedStatus === status && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Genre Dropdown */}
                <div className="relative" id="genre-dropdown-btn">
                  <button
                    onClick={() => {
                      setIsGenreDropdownOpen(!isGenreDropdownOpen);
                      setIsStatusDropdownOpen(false);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`px-4 py-2 border transition-all duration-300 rounded-xl text-xs font-bold tracking-wide outline-none select-none cursor-pointer flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] ${
                      theme === "light-glass" 
                        ? "bg-white/40 border-slate-200 text-slate-800 hover:bg-white/60 shadow-sm" 
                        : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10 hover:border-white/20 shadow-md backdrop-blur-md shadow-slate-950/25"
                    }`}
                  >
                    <span>{selectedGenre}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 border-none bg-transparent transitions-transform duration-300" />
                  </button>
                  <AnimatePresence>
                    {isGenreDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`absolute left-0 z-50 mt-2.5 w-52 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl max-h-60 overflow-y-auto scrollbar-thin ${
                          theme === "light-glass" 
                            ? "bg-white/70 border-slate-200 text-slate-800 hover:scrollbar-slate-400" 
                            : "bg-slate-900/85 border-white/10 text-white shadow-slate-950/50 hover:scrollbar-white"
                        }`}
                      >
                        {GENRES_LIST.map((genre) => (
                          <div
                            key={genre}
                            onClick={() => {
                              setSelectedGenre(genre);
                              setIsGenreDropdownOpen(false);
                            }}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                              theme === "light-glass"
                                ? "hover:bg-slate-100/80 text-slate-700"
                                : "hover:bg-white/10 text-slate-200"
                            } ${selectedGenre === genre ? (theme === "light-glass" ? "bg-blue-100/70 text-blue-600 font-bold" : "bg-white/10 text-cyan-400 font-bold") : ""}`}
                          >
                            <span>{genre}</span>
                            {selectedGenre === genre && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sort Dropdown */}
                <div className="relative" id="sort-dropdown-btn">
                  <button
                    onClick={() => {
                      setIsSortDropdownOpen(!isSortDropdownOpen);
                      setIsStatusDropdownOpen(false);
                      setIsGenreDropdownOpen(false);
                    }}
                    className={`px-4 py-2 border transition-all duration-300 rounded-xl text-xs font-bold tracking-wide outline-none select-none cursor-pointer flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] ${
                      theme === "light-glass" 
                        ? "bg-white/40 border-slate-200 text-slate-800 hover:bg-white/60 shadow-sm" 
                        : "bg-white/10 border-white/15 text-slate-100 hover:bg-white/20 hover:border-white/20 shadow-md backdrop-blur-md shadow-slate-950/25"
                    }`}
                  >
                    <span>{sortBy}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 border-none bg-transparent transitions-transform duration-300" />
                  </button>
                  <AnimatePresence>
                    {isSortDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`absolute left-0 z-50 mt-2.5 w-52 rounded-2xl border p-2 shadow-2xl backdrop-blur-2xl ${
                          theme === "light-glass" 
                            ? "bg-white/70 border-slate-200 text-slate-800" 
                            : "bg-slate-900/85 border-white/10 text-white shadow-slate-950/50"
                        }`}
                      >
                        {[
                          { value: "Sort: Date Added", label: "Sort: Date Added" },
                          { value: "Sort: A to Z", label: "Sort: A to Z" },
                          { value: "Sort: Top Ratings", label: "Sort: Top Ratings" }
                        ].map((opt) => (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setSortBy(opt.value);
                              setIsSortDropdownOpen(false);
                            }}
                            className={`px-3.5 py-2 text-xs font-semibold rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                              theme === "light-glass"
                                ? "hover:bg-slate-100/80 text-slate-700"
                                : "hover:bg-white/10 text-slate-200"
                            } ${sortBy === opt.value ? (theme === "light-glass" ? "bg-blue-100/70 text-blue-600 font-bold" : "bg-white/10 text-cyan-400 font-bold") : ""}`}
                          >
                            <span>{opt.label}</span>
                            {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* View Layout Renderer */}
        <div className="flex-grow flex flex-col justify-start">
          <AnimatePresence mode="wait">
            {activeTab === "Dashboard" ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full animate-fade-in-up"
              >
                <DashboardView 
                  items={items} 
                  onSelect={setSelectedItem} 
                  onIncrementProgress={handleIncrementProgress} 
                  onAddTrendingItem={handleSaveTrendingItem}
                />
              </motion.div>
            ) : activeTab === "Dosto ka Adda" ? (
              <motion.div
                key="adda"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full animate-fade-in-up"
              >
                <GroupChatView 
                  watchlist={items} 
                  watchlistItemsCount={items.length} 
                  onAddItem={handleAddItem} 
                />
              </motion.div>
            ) : activeTab === "Find Friends" ? (
              <motion.div
                key="find-friends"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full animate-fade-in-up"
              >
                <FindFriendsView 
                  theme={theme}
                  showToast={showToast}
                />
              </motion.div>
            ) : activeTab === "Profile" ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-4xl mx-auto select-none animate-fade-in-up"
              >
                <div className="glass rounded-3xl border border-white/10 bg-slate-950/40 p-6 md:p-8 space-y-8 backdrop-blur-xl relative overflow-hidden">
                  {/* Decorative ambient lights inside */}
                  <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                  <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

                  {/* Header / Avatar block */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/10">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-0.5 shadow-xl relative flex items-center justify-center shrink-0">
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white text-3xl font-black">
                        {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : "G"}
                      </div>
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950" title="Sessions Status: Live" />
                    </div>
                    <div className="text-center sm:text-left space-y-1">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2 justify-center sm:justify-start">
                        {currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "Guest Explorer")}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start text-xs text-slate-400 font-medium font-mono">
                        <span className="bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-slate-400 font-sans">
                          {isGuestMode ? "Guest Mode" : "Firebase Auth"}
                        </span>
                        <span>•</span>
                        <span>{currentUser?.email || "guest@cinetrack.com"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Row Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 hover:border-blue-500/30 transition-all text-center sm:text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Completed</div>
                      <div className="text-3xl font-black text-white">{items.filter(i => i.status === "Watched").length}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 hover:border-indigo-500/30 transition-all text-center sm:text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Watching</div>
                      <div className="text-3xl font-black text-white">{items.filter(i => i.status === "Watching").length}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 hover:border-fuchsia-500/30 transition-all text-center sm:text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Plan to Watch</div>
                      <div className="text-3xl font-black text-white">{items.filter(i => i.status === "Plan to Watch").length}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 hover:border-red-500/30 transition-all text-center sm:text-left">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Favorites</div>
                      <div className="text-3xl font-black text-white">{items.filter(i => i.favorite).length}</div>
                    </div>
                  </div>

                  {/* System Credentials & Status Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-widest text-slate-400 font-extrabold flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                      CineTrack Core Status
                    </h3>
                    <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-xs text-slate-400 space-y-3 font-medium">
                      <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                        <span>TMDB API Cloud-Sync Sync Status</span>
                        <span className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03]">
                        <span>User Session ID Key</span>
                        <span className="text-white font-mono break-all max-w-[180px] md:max-w-none text-right text-[10px]">
                          {currentUser?.uid || "guest71d41f0d"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span>Database Stream Status</span>
                        <span className="text-blue-400 font-bold uppercase tracking-widest text-[10px] bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                          {isGuestMode ? "LOCAL STORAGE" : "FIRESTORE CLOUD ACTIVE"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Settings Control Options */}
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs text-slate-400">Need to refresh the app cache state?</span>
                    <button
                      onClick={() => {
                        window.location.reload();
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Hard Reload
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Grid Layout for Media Items (Movies, TV Series, Anime tabs) */
              <motion.div
                key={`grid-${activeTab}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full flex-grow flex flex-col justify-start animate-fade-in-up"
              >
                {activeTab === "Upcoming" && isUpcomingLoading ? (
                  <div className="py-24 text-center glass rounded-3xl border border-white/10 bg-slate-950/20 max-w-xl mx-auto w-full select-none animate-fade-in">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className={`w-8 h-8 animate-spin ${themeColors[theme].loaderText}`} />
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold animate-pulse">Syncing TMDB Indian Releases & Anime...</span>
                    </div>
                  </div>
                ) : (activeTab !== "Upcoming" && isMoviesLoading) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl aspect-[2/3] w-full" />
                    ))}
                  </div>
                ) : activeTab === "Upcoming" && upcomingError ? (
                  <div className="py-24 text-center glass rounded-3xl border border-red-500/20 bg-slate-950/20 max-w-xl mx-auto w-full select-none animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-4">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base text-white">TMDB API Sync Failed</h3>
                    <p className="text-xs text-red-400 mt-2 max-w-xs mx-auto">
                      {upcomingError}
                    </p>
                    <button
                      onClick={() => loadUpcomingItems()}
                      className="mt-6 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : displayItems.length === 0 ? (
                  ["Movies", "Web Series", "Anime"].includes(activeTab) ? (
                    <div className="text-center py-20 text-slate-400">
                      <div className="text-6xl mb-4 opacity-50">🍿</div>
                      <h3 className="text-xl font-semibold text-white mb-2">List Khali Hai!</h3>
                      <p>Jaldi se '+ Nayi Entry' pe click karke add karo.</p>
                    </div>
                  ) : (
                    <div className="py-24 text-center glass rounded-3xl border border-dashed border-white/5 bg-slate-950/20 max-w-xl mx-auto w-full select-none animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
                        {activeTab === "Upcoming" ? <Calendar className="w-6 h-6 text-cyan-400" /> : <Film className="w-6 h-6" />}
                      </div>
                      <h3 className="font-bold text-base text-white">No items found</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        {activeTab === "Upcoming"
                          ? `Could not find any upcoming ${upcomingSubTab !== "All" ? upcomingSubTab.toLowerCase() : "releases"} matching your search query: "${searchQuery}".`
                          : "Could not match any media cards with current filters or queries. Try adjusting your search!"
                        }
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          if (activeTab === "Upcoming") {
                            setUpcomingSubTab("All");
                          } else {
                            setSelectedStatus("All Status");
                            setSelectedGenre("All Genres");
                          }
                        }}
                        className="mt-6 text-xs font-bold text-blue-450 hover:text-blue-350 underline cursor-pointer"
                      >
                        Reset active filters
                      </button>
                    </div>
                  )
                ) : (
                  <motion.div 
                    layout
                    id="movieGrid"
                    className="movieGrid grid-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fade-in"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      const deleteBtn = target.closest(".delete-btn") as HTMLElement | null;
                      if (deleteBtn) {
                        e.stopPropagation();
                        e.preventDefault();
                        const id = deleteBtn.getAttribute("data-id");
                        if (id) {
                          deleteMovie(e, id);
                        }
                      }
                    }}
                  >
                    <AnimatePresence mode="popLayout">
                      {displayItems.map((item, index) => (
                        <MediaCard
                          key={item.id}
                          index={index}
                          item={item}
                          onSelect={setSelectedItem}
                          onToggleFavorite={handleToggleFavorite}
                          onIncrementProgress={handleIncrementProgress}
                          onDelete={(id, e) => deleteMovie(e, id)}
                          onEdit={(item, e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                            setSelectedItem(null);
                            setIsAddModalOpen(true);
                          }}
                          onShare={(item, e) => {
                            e.stopPropagation();
                            if (navigator.share) {
                              navigator.share({
                                title: item.title,
                                text: `Check out "${item.title}" (${item.year}) on CineTrack!`,
                                url: window.location.href
                              }).catch(err => console.error(err));
                            } else {
                              navigator.clipboard.writeText(`"${item.title}" (${item.year})`);
                              showToast(`Copied "${item.title}" info to clipboard! 📋`, "success");
                            }
                          }}
                          onAddUpcoming={handleAddUpcomingItem}
                          isUpcomingAdded={items.some((wt) => wt.title.toLowerCase().trim() === item.title.toLowerCase().trim())}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>



      {/* Floating Detailed Inspection Overlay Modal */}
      <AnimatePresence>
        {currentSelectedItem && (
          <MediaDetailModal
            item={currentSelectedItem}
            onClose={() => setSelectedItem(null)}
            onToggleFavorite={(id, e) => handleToggleFavorite(id, e)}
            onDelete={(id) => handleDeleteItem(id)}
            onEdit={() => {
              setEditingItem(currentSelectedItem);
              setSelectedItem(null);
              setIsAddModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal for Deletion */}
      <AnimatePresence>
        {deleteConfirmationItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
            onClick={() => {
              if (!isDeletingOngoing) setDeleteConfirmationItem(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Alert Indicator Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-400/10 border border-red-500/20 text-red-400 rounded-xl">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                    Confirm Deletion
                  </h3>
                  <p className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest">
                    Irreversible Action
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="text-slate-300 text-sm leading-relaxed mb-6 space-y-2">
                <p>
                  Kya aap sach mein <span className="font-semibold text-white">"{deleteConfirmationItem.title}"</span> ko watchlist se nikaalna chahte hain?
                </p>
                <p className="text-xs text-slate-400 italic bg-white/5 p-3 rounded-xl border border-white/5">
                  Ye item database se permanently delete ho jayega aur iski tracked history humesha ke liye khatam ho jayegi.
                </p>
              </div>

              {/* Lower Control Buttons Wrapper */}
              <div className="flex justify-end gap-3 font-semibold">
                <button
                  type="button"
                  disabled={isDeletingOngoing}
                  onClick={() => setDeleteConfirmationItem(null)}
                  className="px-4 py-2 text-sm text-slate-300 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingOngoing}
                  onClick={executeMovieDeletion}
                  className="px-5 py-2 text-sm text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:scale-95 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingOngoing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Yes, Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Add Entry / Editing Forms Overlay Modal */}
      <AddEditModal
        item={editingItem}
        isOpen={isAddModalOpen}
        watchlist={items}
        showToast={showToast}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={(data) => {
          if (editingItem) {
            handleUpdateItem(data);
          } else {
            handleAddItem(data);
          }
        }}
        defaultCategory={getModalDefaultCategory()}
      />

      {/* Floating Action Button (FAB) for adding new entries */}
      <AnimatePresence>
        {["Movies", "Web Series", "Anime"].includes(activeTab) && (
          <motion.button
            key="fab-button"
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 15px rgba(59,130,246,0.4)",
                "0 0 35px rgba(139,92,246,0.7)",
                "0 0 15px rgba(59,130,246,0.4)"
              ]
            }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            transition={{
              scale: {
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              },
              boxShadow: {
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
              },
              opacity: { duration: 0.2 },
              y: { duration: 0.2 }
            }}
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="fixed bottom-24 right-8 z-[90] w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center cursor-pointer shadow-[0_0_24px_rgba(59,130,246,0.6)] focus:outline-none select-none group border border-blue-500/20 active:scale-95 transition-all duration-300"
            aria-label="Add entry"
            id="fab-add-entry"
          >
            {/* Pulsing rings backings */}
            <span className="absolute inset-0 rounded-full bg-blue-550/20 animate-ping" />
            
            <Plus className="w-6 h-6 stroke-[3] transition-transform duration-300 group-hover:rotate-90 relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floated Success/Danger Alerts notification panel toaster */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-slate-800/90 text-white px-6 py-3 rounded-full backdrop-blur-md shadow-xl z-50 animate-fade-in-up flex items-center pointer-events-none select-none"
          >
            <div className="flex items-center gap-2 font-bold text-xs tracking-wide">
              <span className="text-sm">
                {toast.type === "success" ? "✓" : toast.type === "danger" ? "✕" : "✦"}
              </span>
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success 'Pop' Animation 😄 */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950"
          >
            <motion.div
              initial={{ y: 200, scale: 0.1, opacity: 0 }}
              animate={{ y: 0, scale: [0.1, 1.4, 0.95, 1.0], opacity: 1 }}
              exit={{ y: -100, scale: 0.5, opacity: 0 }}
              transition={{
                duration: 1.2,
                times: [0, 0.4, 0.75, 1.0],
                ease: "easeOut"
              }}
              className="text-[120px] md:text-[180px] select-none filter drop-shadow-[0_15px_30px_rgba(16,185,129,0.3)] flex flex-col items-center gap-6"
            >
              😄
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-base md:text-lg font-black tracking-widest text-emerald-400 uppercase select-none text-center"
              >
                SUCCESSFULLY LOGGED IN!
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
