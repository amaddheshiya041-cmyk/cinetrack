import React, { useState, useEffect } from "react";
import { MediaItem } from "../types";
import { 
  X, Star, Heart, Edit, Trash2, BookOpen, Film, Tv, Sparkles, PlayCircle, Loader2, User, Languages 
} from "lucide-react";
import { motion } from "motion/react";

interface MediaDetailModalProps {
  item: MediaItem;
  onClose: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export function MediaDetailModal({ item, onClose, onToggleFavorite, onDelete, onEdit }: MediaDetailModalProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<string>("rgba(59, 130, 246, 0.3)");

  useEffect(() => {
    if (!item.posterUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = item.posterUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 10;
        canvas.height = 10;

        ctx.drawImage(img, 0, 0, 10, 10);
        const imgData = ctx.getImageData(0, 0, 10, 10).data;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 15 && brightness < 240 && a > 200) {
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
          }
        }

        if (count > 0) {
          const rAvg = Math.round(rSum / count);
          const gAvg = Math.round(gSum / count);
          const bAvg = Math.round(bSum / count);
          setDominantColor(`rgba(${rAvg}, ${gAvg}, ${bAvg}, 0.35)`);
        } else {
          let rTotal = 0, gTotal = 0, bTotal = 0;
          const pixelCount = imgData.length / 4;
          for (let i = 0; i < imgData.length; i += 4) {
            rTotal += imgData[i];
            gTotal += imgData[i + 1];
            bTotal += imgData[i + 2];
          }
          const rAvg = Math.round(rTotal / pixelCount);
          const gAvg = Math.round(gTotal / pixelCount);
          const bAvg = Math.round(bTotal / pixelCount);
          setDominantColor(`rgba(${rAvg}, ${gAvg}, ${bAvg}, 0.35)`);
        }
      } catch (err) {
        console.warn("CORS or canvas error when extracting dominant color, using fallback hash:", err);
        let hash = 0;
        for (let i = 0; i < item.title.length; i++) {
          hash = item.title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const rNorm = Math.abs((hash & 0xFF0000) >> 16) % 150 + 50;
        const gNorm = Math.abs((hash & 0x00FF00) >> 8) % 150 + 50;
        const bNorm = Math.abs(hash & 0x0000FF) % 150 + 50;
        setDominantColor(`rgba(${rNorm}, ${gNorm}, ${bNorm}, 0.35)`);
      }
    };

    img.onerror = () => {
      let hash = 0;
      for (let i = 0; i < item.title.length; i++) {
        hash = item.title.charCodeAt(i) + ((hash << 5) - hash);
      }
      const r = Math.abs((hash & 0xFF0000) >> 16) % 150 + 50;
      const g = Math.abs((hash & 0x00FF00) >> 8) % 150 + 50;
      const b = Math.abs(hash & 0x0000FF) % 150 + 50;
      setDominantColor(`rgba(${r}, ${g}, ${b}, 0.35)`);
    };
  }, [item.posterUrl, item.title]);

  useEffect(() => {
    let active = true;
    const fetchTmdbDetails = async () => {
      setLoading(true);
      setError(null);
      setTrailerKey(null);
      setCast([]);
      setTranslations([]);

      try {
        const apiKey = localStorage.getItem("CINETRACK_TMDB_API_KEY") || "43e9bbd1f428333ca987121e8ba403ce";
        const cleanTitle = item.title.replace(/\((.*?)\)/g, "").trim();
        const searchType = item.category === "Movie" ? "movie" : "tv";
        
        // 1. Search for items to get the TMDB ID
        const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&year=${item.year || ""}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error("TMDB search failed");
        
        const searchData = await searchRes.json();
        
        // Fallback search without year if exact year search has no results
        let tmdbId = null;
        if (searchData.results && searchData.results.length > 0) {
          tmdbId = searchData.results[0].id;
        } else {
          const fallbackUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}`;
          const fallbackRes = await fetch(fallbackUrl);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData.results && fallbackData.results.length > 0) {
              tmdbId = fallbackData.results[0].id;
            }
          }
        }

        if (!tmdbId) {
          throw new Error("No TMDB match found");
        }

        if (!active) return;

        // 2. Fetch Videos, Credits, and Translations in Parallel
        const videosUrl = `https://api.themoviedb.org/3/${searchType}/${tmdbId}/videos?api_key=${apiKey}`;
        const creditsUrl = `https://api.themoviedb.org/3/${searchType}/${tmdbId}/credits?api_key=${apiKey}`;
        const translationsUrl = `https://api.themoviedb.org/3/${searchType}/${tmdbId}/translations?api_key=${apiKey}`;

        const [videosRes, creditsRes, translationsRes] = await Promise.all([
          fetch(videosUrl),
          fetch(creditsUrl),
          fetch(translationsUrl)
        ]);

        if (videosRes.ok && active) {
          const videosData = await videosRes.json();
          const trailer = videosData.results?.find(
            (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
          ) || videosData.results?.find((v: any) => v.site === "YouTube");
          
          if (trailer) {
            setTrailerKey(trailer.key);
          }
        }

        if (creditsRes.ok && active) {
          const creditsData = await creditsRes.json();
          const topCast = (creditsData.cast || [])
            .slice(0, 5)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            }));
          setCast(topCast);
        }

        if (translationsRes.ok && active) {
          const translationsData = await translationsRes.json();
          const languagesList = (translationsData.translations || [])
            .map((t: any) => t.english_name || t.name)
            .filter((name: string) => name && name.trim() !== "");
          const uniqueLanguages = Array.from(new Set(languagesList)) as string[];
          setTranslations(uniqueLanguages);
        }

      } catch (err: any) {
        console.warn("Could not load TMDB detailed metadata:", err.message);
        setError("Trailer/Cast/Translations loaded from simulated mode");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchTmdbDetails();

    return () => {
      active = false;
    };
  }, [item.id, item.title, item.category, item.year]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", damping: 15, stiffness: 180, mass: 0.8 }}
        className="glass rounded-3xl w-full max-w-4xl overflow-hidden relative border shadow-2xl bg-slate-950 flex flex-col my-8 transform-gpu transition-all duration-500"
        id={`detail-modal-${item.id}`}
        style={{
          boxShadow: `0 0 50px 4px ${dominantColor}`,
          borderColor: dominantColor.replace("0.35", "0.25").replace("0.3", "0.2"),
        }}
      >
        {/* Header toolbar banner */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <button
            onClick={(e) => onToggleFavorite(item.id, e)}
            className="p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 text-gray-400 hover:text-red-400 transition-colors shadow-lg cursor-pointer"
            title="Toggle Favorite"
          >
            <Heart className={`w-4 h-4 ${item.favorite ? 'text-red-500 fill-red-500' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 border border-white/10 text-gray-400 hover:text-white transition-colors shadow-lg cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5 focus:outline-none" />
          </button>
        </div>

        {/* Dynamic Trailer Panel */}
        <div className="w-full aspect-video bg-slate-900 relative border-b border-white/5 flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3.5">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <span className="text-xs uppercase tracking-widest text-slate-400 font-extrabold animate-pulse">
                Fetching HD Official Trailer...
              </span>
            </div>
          ) : trailerKey ? (
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
              title={`${item.title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0 shadow-inner"
            ></iframe>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <img 
                src={item.posterUrl} 
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-20"
              />
              <div className="relative text-center p-6 max-w-sm flex flex-col items-center gap-3">
                <PlayCircle className="w-16 h-16 text-slate-500 stroke-[1.5]" />
                <h4 className="text-sm font-semibold text-white">Trailer not found</h4>
                <p className="text-xs text-slate-400">
                  No trailer link was available on TMDB for this title. Review the metadata or poster parameters below.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Details & Cast Section */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 overflow-y-auto max-h-[60vh]">
          {/* Poster thumb & fast metadata */}
          <div className="w-full md:w-1/3 shrink-0 flex flex-col gap-4">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-lg relative max-w-[240px] mx-auto md:max-w-none">
              <img
                src={item.posterUrl}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
                }}
              />
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/5 flex items-center gap-1.5 text-xs font-bold text-white shadow-xl">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span>{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating || "N/A"}/10</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-slate-400 font-semibold bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-inner">
              <div className="flex justify-between border-b border-white/[0.03] pb-2">
                <span>Category:</span>
                <span className="text-blue-400 font-bold uppercase tracking-wider">{item.category}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.03] py-2">
                <span>Release Year:</span>
                <span className="text-white">{item.year}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.03] py-2">
                <span>Duration:</span>
                <span className="text-white">{item.duration}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span>Language:</span>
                <span className="text-white">{item.language}</span>
              </div>
            </div>
          </div>

          {/* Title, synopsis, and Cast */}
          <div className="flex-grow flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">
                  {item.title}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {item.genres?.map((g) => (
                    <span 
                      key={g} 
                      className="px-2.5 py-1 bg-white/5 text-gray-300 font-bold text-[10px] rounded-lg border border-white/5 uppercase tracking-wider"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Episode Progress for TV & Anime */}
              {item.category !== "Movie" && item.progress && (
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl shadow-inner">
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-2.5">
                    <span>Watching Progress</span>
                    <span className="text-blue-400 font-mono">
                      Season {item.progress.currentSeason || 1} • Episode {item.progress.currentEpisode || 1} / {item.progress.totalEpisodes || 12}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ((item.progress.currentEpisode || 1) / (item.progress.totalEpisodes || 12)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Plot Synopsis */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" /> Storyline Synopsis
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed font-medium">
                  {item.synopsis || "No story summary is currently logged in the tracker database."}
                </p>
              </div>

              {/* Personal Notes */}
              {item.notes && (
                <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 space-y-1">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-blue-400">Personal Tracker Notes</div>
                  <p className="text-xs italic text-gray-300 font-medium">
                    "{item.notes}"
                  </p>
                </div>
              )}

              {/* CAST DETAILS SECTION */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  <UsersAndCastIcon /> Stars &amp; Top Cast
                </h4>
                
                {loading ? (
                  <div className="flex gap-4 py-2 overflow-x-auto">
                    {[1, 2, 3, 4, 5].map((skeletonIdx) => (
                      <div key={skeletonIdx} className="flex flex-col items-center gap-2 animate-pulse w-14 shrink-0">
                        <div className="w-11 h-11 rounded-full bg-slate-800" />
                        <div className="h-2 w-10 bg-slate-800 rounded" />
                        <div className="h-1.5 w-6 bg-slate-800/60 rounded" />
                      </div>
                    ))}
                  </div>
                ) : cast.length > 0 ? (
                  <div className="flex gap-4 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                    {cast.map((member) => (
                      <div key={member.id} className="flex flex-col items-center text-center w-16 shrink-0 group/cast">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shadow-lg relative bg-slate-900 shrink-0 transform-gpu group-hover/cast:scale-110 transition-transform duration-300">
                          {member.profilePath ? (
                            <img
                              src={member.profilePath}
                              alt={member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-white font-bold tracking-tight truncate w-full mt-1.5" title={member.name}>
                          {member.name.split(" ")[0]}
                        </span>
                        <span className="text-[8px] text-slate-400 font-medium truncate w-full" title={member.character}>
                          {member.character}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 font-medium italic">
                    Cast information unavailable on simulated database mode.
                  </p>
                )}
              </div>

              {/* TRANSLATED / DUBBED LANGUAGES */}
              <div className="pt-4 border-t border-white/5 space-y-2.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-blue-400" /> Dubbed / Translated Languages
                </h4>
                {loading ? (
                  <div className="flex gap-2 py-1 overflow-x-auto scrollbar-hide">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-6 w-16 bg-slate-800/50 rounded-full animate-pulse shrink-0" />
                    ))}
                  </div>
                ) : translations.length > 0 ? (
                  <div className="flex flex-wrap gap-2 py-1 max-h-24 overflow-y-auto pr-1">
                    {translations.map((lang) => (
                      <span
                        key={lang}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-[9px] sm:text-[10px] rounded-lg border border-white/5 hover:border-white/10 transition-colors uppercase tracking-wider select-none shadow-sm"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 font-medium italic">
                    Translations unavailable or limited to primary native language ({item.language || "English"}).
                  </p>
                )}
              </div>
            </div>

            {/* Action Bar Footer */}
            {!item.isUpcoming ? (
              <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-5 mt-4">
                <button
                  onClick={onEdit}
                  className="px-4 py-2 bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/10 rounded-xl text-xs font-bold text-gray-300 hover:text-blue-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Adjust Details</span>
                </button>
                
                <button
                  onClick={() => {
                    onClose();
                    onDelete(item.id);
                  }}
                  className="px-4 py-2 border border-red-500/10 hover:border-red-500/50 hover:bg-red-500/15 rounded-xl text-xs font-bold text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Movie</span>
                </button>
              </div>
            ) : (
              <div className="border-t border-white/5 pt-5 mt-4 text-center">
                <span className="text-xs font-semibold text-slate-400 bg-blue-500/10 border border-blue-500/20 px-3.5 py-2 rounded-xl inline-block">
                  📢 Releasing soon on {item.releaseDate || "June 2026"} (TMDB API Live Sync)
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Visual icons helper
function UsersAndCastIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
