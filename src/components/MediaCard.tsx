import React from "react";
import { MediaItem } from "../types";
import { 
  Heart, Star, Film, Tv, Sparkles, CheckCircle2, PlayCircle, Clock, 
  PlusCircle, Trash2, Share2, Edit, Globe, Check, Plus
} from "lucide-react";
import { motion } from "motion/react";

interface MediaCardProps {
  key?: string | number;
  index?: number;
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onIncrementProgress?: (id: string, e: React.MouseEvent) => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
  onEdit?: (item: MediaItem, e: React.MouseEvent) => void;
  onShare?: (item: MediaItem, e: React.MouseEvent) => void;
  onAddUpcoming?: (item: MediaItem, e: React.MouseEvent) => void;
  isUpcomingAdded?: boolean;
}

export function MediaCard({ 
  item, 
  index = 0,
  onSelect, 
  onToggleFavorite, 
  onIncrementProgress, 
  onDelete,
  onEdit,
  onShare,
  onAddUpcoming,
  isUpcomingAdded
}: MediaCardProps) {
  
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Watched":
        return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
      case "Watching":
        return "bg-sky-500/20 text-sky-300 border border-sky-500/30";
      case "Plan to Watch":
        return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border border-slate-500/30";
    }
  };

  const getProgressLabel = () => {
    if (!item.progress) return null;
    const { currentSeason, currentEpisode, totalEpisodes } = item.progress;
    if (currentSeason !== undefined) {
      return `S${currentSeason} E${currentEpisode || 1}${totalEpisodes ? `/${totalEpisodes}` : ""}`;
    }
    return `E${currentEpisode}${totalEpisodes ? `/${totalEpisodes}` : ""}`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        type: "spring",
        stiffness: 140,
        damping: 18,
        delay: Math.min(index * 0.045, 0.45) 
      }}
      id={`media-card-${item.id}`}
      onClick={() => onSelect(item)}
      className="movie-card glass rounded-2xl overflow-hidden relative group cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(96,165,250,0.3)] flex flex-col h-full select-none transform-gpu will-change-transform"
      style={{ transform: "translateZ(0)", willChange: "transform" }}
    >
      {/* Poster Image & Overlay Container */}
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-950">
        <img
          src={item.posterUrl}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
          }}
        />
        
        {/* Inside poster: Top-left Region tag */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start pointer-events-none">
          <span className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 text-blue-300 border border-white/10 shadow-lg tracking-wider uppercase">
            <Globe className="w-2.5 h-2.5 text-blue-400" />
            {item.language || "Global"}
          </span>
          <span className="bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-full text-[8px] font-bold text-slate-300 opacity-90 border border-white/5 uppercase tracking-widest">
            {item.category}
          </span>
        </div>

        {/* Inside poster: Top-right heart icon */}
        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id, e);
            }}
            className="bg-black/75 backdrop-blur-md p-2 rounded-full border border-white/10 text-gray-400 hover:text-red-400 active:scale-95 transition-all cursor-pointer shadow-lg"
            title="Toggle Favorite"
          >
            <Heart className={`w-3.5 h-3.5 ${item.favorite ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>

        {/* Inside poster: Bottom overlay (Status badge and Star Rating) */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/45 to-transparent p-3 pt-8 flex items-end justify-between z-10 select-none">
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold shadow-sm ${getStatusStyle(item.status)}`}>
            {item.status === "Watched" && <CheckCircle2 className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />}
            {item.status === "Watching" && <PlayCircle className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />}
            {item.status === "Plan to Watch" && <Clock className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />}
            {item.status}
          </span>
          <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5 flex items-center gap-1 text-yellow-400 shadow-md">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-black">{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Below poster: Title and 'Year • Region' text */}
      <div className="p-3.5 bg-gradient-to-b from-slate-950/60 to-slate-950 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-white group-hover:text-blue-400 transition-colors line-clamp-1 leading-tight tracking-tight" title={item.title}>
            {item.title}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1 font-semibold tracking-wide">
            {item.year} • {item.language || "Global"}
          </p>

          {/* Custom Progress Bar for Series/Anime */}
          {item.progress && item.status === "Watching" && (
            <div className="mt-3 pt-2.5 border-t border-white/5">
              <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-wider">
                <span>Progress: {getProgressLabel()}</span>
                {onIncrementProgress && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrementProgress(item.id, e);
                    }}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 p-0.5 px-1 rounded bg-white/5 border border-white/5 active:scale-90 transition-all cursor-pointer"
                    title="Next Episode"
                  >
                    <PlusCircle className="w-3 h-3 inline" />
                    <span>+1</span>
                  </button>
                )}
              </div>
              {/* Progress bar line */}
              {item.progress.currentEpisode && item.progress.totalEpisodes && (
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden shadow-inner mt-1">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (item.progress.currentEpisode / item.progress.totalEpisodes) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Releasing badge / Action Footer */}
        {item.isUpcoming ? (
          <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-1.5 select-none w-full">
            <span className="flex-grow text-[10px] sm:text-xs font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 uppercase bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/25 shadow-sm text-center">
              Releasing: {item.releaseDate || item.year || "June 2026"}
            </span>
            {onAddUpcoming && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isUpcomingAdded) {
                    onAddUpcoming(item, e);
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                  isUpcomingAdded
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95"
                }`}
                title={isUpcomingAdded ? "Added to Plan to Watch" : "Add to Plan to Watch"}
              >
                {isUpcomingAdded ? (
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                ) : (
                  <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between select-none">
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShare) onShare(item, e);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-blue-300 border border-white/5 active:scale-90 transition-all cursor-pointer"
                title="Share Title"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) onEdit(item, e);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-300 border border-white/5 active:scale-90 transition-all cursor-pointer"
                title="Edit Details"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            </div>

            {onDelete && (
              <button
                data-id={item.id}
                className="delete-btn p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/90 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Delete Title"
              >
                <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
