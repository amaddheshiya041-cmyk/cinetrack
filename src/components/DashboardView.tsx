import React from "react";
import { MediaItem, MediaCategory } from "../types";
import { Film, Tv, Sparkles, CheckCircle2, PlayCircle, Clock, Heart, Star, Flame, Trophy, TrendingUp, Shuffle, X, Loader2, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardViewProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onIncrementProgress: (id: string, e: React.MouseEvent) => void;
  onAddTrendingItem: (tmdbItem: any, category: MediaCategory) => void;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const end = value;
    if (end <= 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 1000; // milliseconds
    const startTime = performance.now();
    let animationFrameId: number;

    function updateNumber(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
      const current = Math.floor(easeProgress * end);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(end);
      }
    }

    animationFrameId = requestAnimationFrame(updateNumber);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value]);

  return <>{displayValue}</>;
}

function TrendingItemCard({ 
  item, 
  isAdded, 
  onAdd, 
  onPosterClick 
}: { 
  item: any; 
  isAdded: boolean; 
  onAdd: (e: any) => void | Promise<void>; 
  onPosterClick: () => void | Promise<void>; 
  key?: any;
}) {
  const title = item.title || item.name || "Untitled";
  const posterPath = item.poster_path
    ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
    : "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
  const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

  return (
    <div 
      className="w-28 sm:w-32 shrink-0 snap-start group relative transition-all duration-300 hover:scale-[1.03] will-change-transform"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
    >
      <div 
        onClick={onPosterClick}
        className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-white/5 group-hover:border-white/10 group-hover:shadow-[0_0_15px_rgba(96,165,250,0.25)] transition-all duration-300 cursor-pointer"
      >
        <img
          src={posterPath}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {/* Rating bubble at top right */}
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-slate-950/80 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-0.5 text-[9px] font-bold text-amber-400 select-none">
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          <span>{rating}</span>
        </div>

        {/* Add/Added Button in top left corner of poster */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isAdded) onAdd(e);
          }}
          className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-lg backdrop-blur-md flex items-center justify-center border transition-all ${
            isAdded
              ? "bg-emerald-500/80 border-emerald-400 text-white cursor-default"
              : "bg-slate-950/80 border-white/10 text-white hover:bg-slate-950 hover:scale-105 active:scale-95 cursor-pointer"
          }`}
          title={isAdded ? "In Watchlist" : "Add to Watchlist"}
        >
          {isAdded ? (
            <Check className="w-3.5 h-3.5 stroke-[3px]" />
          ) : (
            <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
          )}
        </button>
      </div>
      <div className="mt-2 text-center">
        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate px-1" title={title}>
          {title}
        </h4>
      </div>
    </div>
  );
}

function TrendingRowSkeleton() {
  return (
    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="w-28 sm:w-32 shrink-0 space-y-2 animate-pulse">
          <div className="aspect-[2/3] rounded-xl bg-slate-800/20 border border-white/5" />
          <div className="h-3 bg-slate-800/20 rounded w-4/5 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ items, onSelect, onIncrementProgress, onAddTrendingItem }: DashboardViewProps) {
  const [trendingMovies, setTrendingMovies] = React.useState<any[]>([]);
  const [trendingSeries, setTrendingSeries] = React.useState<any[]>([]);
  const [trendingAnime, setTrendingAnime] = React.useState<any[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = React.useState(true);

  // States for Trailer Modal
  const [selectedTrendingItem, setSelectedTrendingItem] = React.useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<MediaCategory>("Movie");
  const [showTrailerModal, setShowTrailerModal] = React.useState(false);
  const [isModalLoading, setIsModalLoading] = React.useState(false);
  const [modalDetails, setModalDetails] = React.useState<any | null>(null);
  const [trailerVideoKey, setTrailerVideoKey] = React.useState<string | null>(null);

  const isAlreadyAdded = (item: any) => {
    return items.some((watchlistItem) => {
      const wTitle = watchlistItem.title.toLowerCase().trim();
      const tTitle = (item.title || item.name || "").toLowerCase().trim();
      return wTitle === tTitle;
    });
  };

  const handlePosterClick = async (item: any, category: MediaCategory) => {
    setSelectedTrendingItem(item);
    setSelectedCategory(category);
    setShowTrailerModal(true);
    setIsModalLoading(true);
    setModalDetails(null);
    setTrailerVideoKey(null);

    const mediaType = category === "Movie" ? "movie" : "tv";

    try {
      const apiKey = localStorage.getItem("CINETRACK_TMDB_API_KEY") || "43e9bbd1f428333ca987121e8ba403ce";
      const baseUrl = "https://api.themoviedb.org/3";
      
      const detailsUrl = `${baseUrl}/${mediaType}/${item.id}?api_key=${apiKey}&language=hi-IN&append_to_response=videos&include_video_language=hi,en`;
      const res = await fetch(detailsUrl);
      if (res.ok) {
        const detailsData = await res.json();
        setModalDetails(detailsData);
        
        const videoResults = detailsData.videos?.results || [];
        
        // Find Hindi video first
        let chosenVideo = videoResults.find(
          (v: any) => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "hi"
        );

        if (!chosenVideo) {
          chosenVideo = videoResults.find(
            (v: any) => v.site === "YouTube" && v.type === "Trailer"
          );
        }

        if (!chosenVideo) {
          chosenVideo = videoResults.find(
            (v: any) => v.site === "YouTube" && (v.type === "Teaser" || v.type === "Clip")
          );
        }

        if (!chosenVideo) {
          chosenVideo = videoResults.find((v: any) => v.site === "YouTube");
        }

        if (chosenVideo) {
          setTrailerVideoKey(chosenVideo.key);
        }
      }
    } catch (err) {
      console.error("Error fetching TMDB details/videos:", err);
    } finally {
      setIsModalLoading(false);
    }
  };

  React.useEffect(() => {
    let isMounted = true;
    const fetchTrendingData = async () => {
      try {
        const apiKey = localStorage.getItem("CINETRACK_TMDB_API_KEY") || "43e9bbd1f428333ca987121e8ba403ce";
        const baseUrl = "https://api.themoviedb.org/3";

        const moviesUrl = `${baseUrl}/trending/movie/week?api_key=${apiKey}`;
        const seriesUrl = `${baseUrl}/trending/tv/week?api_key=${apiKey}`;
        const animeUrl = `${baseUrl}/discover/tv?api_key=${apiKey}&with_genres=16&with_original_language=ja&sort_by=popularity.desc`;

        const [moviesRes, seriesRes, animeRes] = await Promise.all([
          fetch(moviesUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(seriesUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(animeUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);

        if (isMounted) {
          if (moviesRes?.results) {
            setTrendingMovies(moviesRes.results.slice(0, 10));
          }
          if (seriesRes?.results) {
            setTrendingSeries(seriesRes.results.slice(0, 10));
          }
          if (animeRes?.results) {
            setTrendingAnime(animeRes.results.slice(0, 10));
          }
        }
      } catch (err) {
        console.error("Error fetching trending data:", err);
      } finally {
        if (isMounted) {
          setIsTrendingLoading(false);
        }
      }
    };

    fetchTrendingData();

    return () => {
      isMounted = false;
    };
  }, []);

  const total = items.length;
  const watched = items.filter((i) => i.status === "Watched").length;
  const watching = items.filter((i) => i.status === "Watching").length;
  const planToWatch = items.filter((i) => i.status === "Plan to Watch").length;
  const favorites = items.filter((i) => i.favorite);

  const moviesCount = items.filter((i) => i.category === "Movie").length;
  const seriesCount = items.filter((i) => i.category === "Web Series").length;
  const animeCount = items.filter((i) => i.category === "Anime").length;

  // Calculate generic percent completion
  const completionPercent = total > 0 ? Math.round((watched / total) * 100) : 0;

  // Calculate genre distributions
  const genreMap: { [key: string]: number } = {};
  items.forEach((item) => {
    item.genres.forEach((g) => {
      genreMap[g] = (genreMap[g] || 0) + 1;
    });
  });

  const sortedGenres = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // top 5 genres

  const maxGenreCount = Math.max(...Object.values(genreMap), 1);

  // Dynamic Top Genre
  const topGenre = sortedGenres.length > 0 ? sortedGenres[0][0] : "Drama";
  const topGenreCount = sortedGenres.length > 0 ? sortedGenres[0][1] : 0;

  // Pick a random plan-to-watch recommendation
  const planToWatchItems = items.filter((i) => i.status === "Plan to Watch");
  const randomRecommendation = React.useMemo(() => {
    if (planToWatchItems.length === 0) return null;
    const idx = Math.floor(Math.random() * planToWatchItems.length);
    return planToWatchItems[idx];
  }, [items]); // Re-evaluate when items list changes

  const currentlyWatching = items.filter((i) => i.status === "Watching");

  return (
    <div className="space-y-6">
      {/* Immersive Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-r from-blue-900/40 via-purple-900/20 to-slate-900 border border-blue-500/10 shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-purple-500/5 rounded-full blur-2xl -z-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/25">
                CineTrack Engine Active
              </span>
              {sortedGenres.length > 0 && (
                <span className="text-xs font-bold tracking-wider uppercase text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/25 flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-purple-400/20" />
                  <span>Top Genre: {topGenre}</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3.5xl font-extrabold font-display tracking-tight text-white mt-3 leading-tight">
              Review, track, and share your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Cinematic Journey
              </span>
            </h1>
            <p className="text-sm text-gray-400 mt-2 max-w-xl">
              Keep tabs on film releases, binge series episodes, and discuss anime gems in your friend group corner.
            </p>
          </div>

          {/* Quick completion ring */}
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="url(#blue-grad)"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - completionPercent / 100)}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute text-xs font-extrabold text-blue-300">
                <AnimatedNumber value={completionPercent} />%
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Completion Rate</div>
              <div className="text-xl font-extrabold text-white mt-0.5">
                <AnimatedNumber value={watched} /> <span className="text-xs text-gray-500 font-normal">/ {total} watched</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Movies", val: moviesCount, info: "Cinema releases", color: "border-blue-500/20 text-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]", icon: <Film className="w-5 h-5 text-blue-400" /> },
          { title: "Total Web Series", val: seriesCount, info: "Binge sessions & shows", color: "border-purple-500/20 text-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]", icon: <Tv className="w-5 h-5 text-purple-400" /> },
          { title: "Total Anime", val: animeCount, info: "Otaku mode selections", color: "border-pink-500/20 text-pink-400 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]", icon: <Sparkles className="w-5 h-5 text-pink-400" /> },
          { title: "Total Completed", val: watched, info: "Full entries marked watched", color: "border-emerald-500/20 text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]", icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> }
        ].map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`glass rounded-2xl p-4 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all duration-300 relative overflow-hidden group ${c.color}`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.02] rounded-full blur-xl -z-10 group-hover:scale-125 transition-transform duration-500" />
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{c.title}</span>
              {c.icon}
            </div>
            <div className="mt-4">
              <span className="text-3.5xl font-black tracking-tight text-white block">
                <AnimatedNumber value={c.val} />
              </span>
              <p className="text-[11px] text-gray-500 font-semibold mt-1">{c.info}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trending Now Section */}
      <div className="glass rounded-3xl p-6 border border-white/5 space-y-6">
        <div className="flex items-center gap-2 pb-1 border-b border-white/5">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold tracking-tight text-white font-display">Trending Now</h2>
          <span className="bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border border-blue-500/15">
            Realtime TMDB
          </span>
        </div>

        {/* Trending Movies Row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              <span>Trending Movies This Week</span>
            </h3>
          </div>
          {isTrendingLoading ? (
            <TrendingRowSkeleton />
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-1 snap-x scroll-smooth scrollbar-hide">
              {trendingMovies.map((item) => (
                <TrendingItemCard 
                  key={item.id} 
                  item={item} 
                  isAdded={isAlreadyAdded(item)}
                  onAdd={() => onAddTrendingItem(item, "Movie")}
                  onPosterClick={() => handlePosterClick(item, "Movie")}
                />
              ))}
              {trendingMovies.length === 0 && (
                <p className="text-xs text-slate-500 italic pb-1">No trending movies found.</p>
              )}
            </div>
          )}
        </div>

        {/* Trending Web Series Row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>Trending Web Series This Week</span>
            </h3>
          </div>
          {isTrendingLoading ? (
            <TrendingRowSkeleton />
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-1 snap-x scroll-smooth scrollbar-hide">
              {trendingSeries.map((item) => (
                <TrendingItemCard 
                  key={item.id} 
                  item={item} 
                  isAdded={isAlreadyAdded(item)}
                  onAdd={() => onAddTrendingItem(item, "Web Series")}
                  onPosterClick={() => handlePosterClick(item, "Web Series")}
                />
              ))}
              {trendingSeries.length === 0 && (
                <p className="text-xs text-slate-500 italic pb-1">No trending series found.</p>
              )}
            </div>
          )}
        </div>

        {/* Trending Anime Row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Hot Anime Discoveries</span>
            </h3>
          </div>
          {isTrendingLoading ? (
            <TrendingRowSkeleton />
          ) : (
            <div className="flex overflow-x-auto gap-4 pb-1 snap-x scroll-smooth scrollbar-hide">
              {trendingAnime.map((item) => (
                <TrendingItemCard 
                  key={item.id} 
                  item={item} 
                  isAdded={isAlreadyAdded(item)}
                  onAdd={() => onAddTrendingItem(item, "Anime")}
                  onPosterClick={() => handlePosterClick(item, "Anime")}
                />
              ))}
              {trendingAnime.length === 0 && (
                <p className="text-xs text-slate-500 italic pb-1">No trending anime found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailerModal && selectedTrendingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
            onClick={() => setShowTrailerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl glass text-white rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowTrailerModal(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-slate-950/60 hover:bg-slate-950/90 rounded-full border border-white/10 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
                  <p className="text-xs text-slate-400 animate-pulse font-extrabold uppercase tracking-widest">
                    Fetching Cinematic Trailer...
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto">
                  {/* YouTube Embed Container */}
                  {trailerVideoKey ? (
                    <div className="relative aspect-video w-full bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${trailerVideoKey}?autoplay=1&rel=0`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video w-full bg-slate-950 flex flex-col items-center justify-center border-b border-white/10 p-12">
                      <Film className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-sm text-slate-400 font-medium">Trailer not found on YouTube</p>
                    </div>
                  )}

                  {/* Title / Details area */}
                  <div className="p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black font-display tracking-tight text-white leading-tight">
                          {modalDetails?.title || modalDetails?.name || selectedTrendingItem.title || selectedTrendingItem.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          {(modalDetails?.release_date || modalDetails?.first_air_date || "").substring(0, 4) || "N/A"}
                          {" • "}{(modalDetails?.original_language || selectedTrendingItem.original_language || "EN").toUpperCase()}
                          {modalDetails?.genres && ` • ${modalDetails.genres.map((g: any) => g.name).join(", ")}`}
                        </p>
                      </div>

                      <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black text-sm rounded-xl flex items-center gap-1">
                        <Star className="w-4 h-4 fill-amber-400" />
                        <span>{(modalDetails?.vote_average || selectedTrendingItem.vote_average || 8.0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Overview</h4>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">
                        {modalDetails?.overview || selectedTrendingItem.overview || "Overview not available."}
                      </p>
                    </div>

                    {/* Action Button: Quick Add from within Modal */}
                    <div className="pt-2 flex justify-end">
                      {isAlreadyAdded(selectedTrendingItem) ? (
                        <button className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-500/20 border border-emerald-400 text-emerald-400 rounded-xl text-xs font-bold leading-none cursor-default select-none">
                          <Check className="w-4 h-4" />
                          <span>In Watched List</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onAddTrendingItem(selectedTrendingItem, selectedCategory);
                          }}
                          className="flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:opacity-95 active:scale-95 transition-all rounded-xl text-xs font-bold leading-none cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add to Watched List</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout Divided into 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Columns (Span 2): Active Track + Spotlight */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active watching progress dashboard section */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h2 className="text-md font-bold tracking-tight text-white mb-4 flex items-center gap-2">
              <PlayCircle className="w-4.5 h-4.5 text-blue-400" />
              <span>Current Progress Tracking</span>
              {currentlyWatching.length > 0 && (
                <span className="ml-1.5 bg-blue-500/15 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {currentlyWatching.length} Active
                </span>
              )}
            </h2>

            {currentlyWatching.length === 0 ? (
              <div className="py-8 text-center text-gray-500 rounded-xl border border-dashed border-white/5 bg-black/10">
                <p className="text-xs font-medium">No series or anime marked as "Watching" currently.</p>
                <p className="text-[11px] text-gray-600 mt-1">Move items from Plan to Watch, or add new shows to see them here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentlyWatching.map((item) => (
                  <div
                    key={item.id}
                    id={`dash-watching-${item.id}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all gap-4"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto" onClick={() => onSelect(item)}>
                      <img
                        src={item.posterUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-14 rounded-lg object-cover bg-slate-900 border border-white/5 shadow-inner cursor-pointer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                          {item.category}
                        </span>
                        <h4 className="font-extrabold text-sm text-white hover:text-blue-400 cursor-pointer truncate max-w-xs transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-gray-400 select-none">
                          {item.progress?.currentSeason ? `Season ${item.progress.currentSeason} • ` : ""}
                          Episode {item.progress?.currentEpisode || 1}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                      {/* Simple Progress Mini Bar */}
                      {item.progress?.currentEpisode && item.progress?.totalEpisodes && (
                        <div className="hidden md:block w-32">
                          <div className="flex justify-between text-[9px] text-gray-500 font-bold mb-1">
                            <span>
                              {Math.round((item.progress.currentEpisode / item.progress.totalEpisodes) * 100)}% Done
                            </span>
                            <span>{item.progress.currentEpisode}/{item.progress.totalEpisodes} Eps</span>
                          </div>
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${(item.progress.currentEpisode / item.progress.totalEpisodes) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={(e) => onIncrementProgress(item.id, e)}
                        className="bg-blue-500/20 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ml-auto sm:ml-0"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Episode Up</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plan-to-watch suggestion engine spotlight */}
          {randomRecommendation && (
            <div className="glass rounded-2xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 bg-blue-500/10 rounded-bl-2xl border-l border-b border-blue-500/10">
                <Shuffle className="w-4 h-4 text-blue-400" />
              </div>

              <h2 className="text-md font-bold tracking-tight text-white mb-3">Cinema Choice: What to Watch Next?</h2>
              <div className="flex gap-4 items-start bg-black/10 p-3 rounded-xl border border-white/5">
                <img
                  src={randomRecommendation.posterUrl}
                  alt={randomRecommendation.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-24 object-cover rounded-lg bg-slate-900 border border-white/5 cursor-pointer"
                  onClick={() => onSelect(randomRecommendation)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase">
                      Plan to Watch
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold">{randomRecommendation.year}</span>
                  </div>
                  <h3
                    className="font-extrabold text-base text-white hover:text-blue-400 cursor-pointer mt-1 select-none"
                    onClick={() => onSelect(randomRecommendation)}
                  >
                    {randomRecommendation.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-1">
                    {randomRecommendation.synopsis}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2 font-medium">
                    Genres: {randomRecommendation.genres.join(", ")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Genre Stats + Spotlight Favorite Carousel */}
        <div className="space-y-6">
          {/* Genre Preferences */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <h2 className="text-md font-bold tracking-tight text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-purple-400" />
              <span>Genre Breakdown</span>
            </h2>

            {sortedGenres.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p className="text-xs font-medium">Start adding items to populate genre stats.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dynamically Styled Top Genre Spotlight Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-purple-500/15 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-bl-2xl border-l border-b border-purple-500/10">
                    <Trophy className="w-4.5 h-4.5 text-purple-400 fill-purple-400/10" />
                  </div>
                  <span className="text-[10px] text-purple-400 font-bold tracking-wider uppercase">Top Genre</span>
                  <h3 className="text-xl font-[900] text-white mt-1 uppercase tracking-wide font-display">{topGenre}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    You have <span className="font-extrabold text-purple-300">{topGenreCount} items</span> logged under this style.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Detailed Theme Distributions</div>
                  {sortedGenres.map(([genre, count]) => {
                    const percentOfMax = (count / maxGenreCount) * 100;
                    return (
                      <div key={genre} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-300 font-semibold">{genre}</span>
                          <span className="text-slate-500 font-bold">{count} items</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full"
                            style={{ width: `${percentOfMax}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Favorites spotlight carousel */}
          <div className="glass rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
            <div>
              <h2 className="text-md font-bold tracking-tight text-white mb-3 flex items-center gap-2">
                <Heart className="w-4.5 h-4.5 text-rose-400 fill-rose-500/20" />
                <span>Star Spotlight</span>
              </h2>
              {favorites.length === 0 ? (
                <div className="py-6 text-center text-gray-500">
                  <p className="text-xs font-medium">Heart your top items; they will shine here in the spotlights.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 overflow-hidden py-1">
                  {favorites.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelect(item)}
                      className="group cursor-pointer aspect-[2/3] rounded-lg overflow-hidden relative border border-white/5 hover:border-blue-400/50 shadow transition-colors"
                      title={item.title}
                    >
                      <img
                        src={item.posterUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-1 left-1.5 right-1.5 truncate text-[9px] font-bold text-white">
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {favorites.length > 3 && (
              <p className="text-[10px] text-gray-500 text-right mt-3 font-semibold uppercase tracking-wider">
                + {favorites.length - 3} more favorites
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline PlusCircle SVG implementation to avoid double imports
function PlusCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}
