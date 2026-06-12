import React, { useState } from "react";
import { ChatMessage, MovieSuggestion, MediaItem } from "../types";
import { MessageSquare, Users, Sparkles, Send, Plus, Loader2, Star, Film, Tv, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GroupChatViewProps {
  watchlist: MediaItem[];
  watchlistItemsCount: number;
  onAddItem: (item: MediaItem) => void;
}

export function GroupChatView({ watchlist, watchlistItemsCount, onAddItem }: GroupChatViewProps) {
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Default dialogue in the Group Chat representing a natural startup conversation
  const [discussion, setDiscussion] = useState<ChatMessage[]>([
    {
      sender: "Rahul (Action Buff)",
      text: "Yo guys! What is the plan for this weekend? I'm in the mood for some absolute blockbuster action with crazy stunts. Please don't suggest slow drama again!"
    },
    {
      sender: "Sneha (Cinephile)",
      text: "Rahul, blockbusters are fine, but we should watch something with actual depth. Cinema Dost (AI), what classic gems do we have on our radar that bridge thrilling action with pristine writing?"
    },
    {
      sender: "Amit (Anime Otaku)",
      text: "Guys, if we talk about epic action AND deep storytelling, look no further than anime! We can binge Attack on Titan or maybe a modern anime film. Let's ask our expert!"
    },
    {
      sender: "Cinema Dost (AI)",
      text: "Namaste team! Welcome to the Adda. Looking at our watchlist, we have tracked epic thrillers like Pathaan and sci-fi masterpiece Interstellar. Based on your preferences, I highly suggest 'Kantara' or custom anime recommendations below!"
    }
  ]);

  // Default initial recommendations loaded beautifully
  const [suggestions, setSuggestions] = useState<MovieSuggestion[]>([
    {
      title: "Kantara",
      category: "Movie",
      year: "2022",
      genres: ["Action", "Thriller", "Drama"],
      rating: 8.3,
      duration: "2h 30m",
      language: "Kannada, Hindi",
      synopsis: "A fiery champion clashes with a no-nonsense forest officer in a battle that leads to a legendary conflict between local folklore and humanity.",
      posterUrl: "https://image.tmdb.org/t/p/w500/8G0XfW6D366MhS0f2162N3I64r7.jpg",
      recommendedBy: "Rahul (Action Buff)"
    },
    {
      title: "Stein's Gate",
      category: "Anime",
      year: "2011",
      genres: ["Sci-Fi", "Thriller"],
      rating: 9.1,
      duration: "24 Episodes",
      language: "Japanese, English",
      synopsis: "A self-proclaimed mad scientist discovers time travel via a modified microwave, triggering dangerous paradoxes and a battle for reality.",
      posterUrl: "https://image.tmdb.org/t/p/w500/m99F6C8T8T7NPhLpIdvSeSe6yL0.jpg",
      recommendedBy: "Amit (Anime Otaku)"
    }
  ]);

  const getSenderColor = (sender: string) => {
    if (sender.startsWith("Rahul")) return "from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/20";
    if (sender.startsWith("Sneha")) return "from-teal-500/20 to-emerald-500/10 text-teal-300 border-teal-500/20";
    if (sender.startsWith("Amit")) return "from-purple-500/20 to-indigo-500/10 text-purple-300 border-purple-500/20";
    return "from-blue-600/30 to-purple-600/10 text-blue-300 border-blue-500/30 font-bold glow-gold shadow-[0_0_15px_rgba(59,130,246,0.2)]";
  };

  const getSenderAvatar = (sender: string) => {
    if (sender.startsWith("Rahul")) return "🕺";
    if (sender.startsWith("Sneha")) return "👩‍🎨";
    if (sender.startsWith("Amit")) return "⚡";
    return "🧠";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim()) return;

    setLoading(true);
    setError("");

    // Read current user message and clear input immediately for snappy experience
    const currentMsg = userMessage;
    setUserMessage("");

    // Optimistically add user command as a simulated message immediately 
    const updatedChat = [...discussion, { sender: "You (Host)", text: currentMsg }];
    setDiscussion(updatedChat);

    try {
      const res = await fetch("/api/dosto-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlist,
          userMessage: currentMsg
        })
      });

      if (!res.ok) {
        throw new Error("Unable to reach Gemini API");
      }

      const data = await res.json();
      if (data.discussion && data.aiSuggestions) {
        setDiscussion([...updatedChat, ...data.discussion]);
        setSuggestions(data.aiSuggestions);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      setError("AI Cinema dost was temporarily offline, but suggested manual choices instead.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestion = (sug: MovieSuggestion) => {
    // Check if item already exists
    const alreadyExists = watchlist.some((item) => item.title.toLowerCase() === sug.title.toLowerCase());
    if (alreadyExists) return;

    const newItem: MediaItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: sug.title,
      category: sug.category,
      status: "Plan to Watch",
      genres: sug.genres,
      rating: sug.rating,
      year: sug.year,
      duration: sug.duration,
      language: sug.language,
      synopsis: sug.synopsis,
      posterUrl: sug.posterUrl,
      favorite: false,
      dateAdded: new Date().toISOString()
    };

    onAddItem(newItem);
  };

  const cinematicLoadingQuotes = [
    "Cinema Dost is reviewing IMDb databases...",
    "Rahul is demanding popcorn...",
    "Sneha is looking up classic film archives...",
    "Amit is loading sub vs dub tracks...",
    "Crafting custom Bollywood & Hollywood recommendations..."
  ];

  const [loadingQuoteIdx, setLoadingQuoteIdx] = useState(0);

  React.useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingQuoteIdx((prev) => (prev + 1) % cinematicLoadingQuotes.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left Area (Dialogue Feed): Span 7 */}
      <div className="lg:col-span-7 flex flex-col justify-between glass rounded-3xl p-5 border border-white/5 bg-slate-950/40">
        
        {/* Welcome Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white font-display">Dosto ka Adda</h3>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Group Chat Simulator</p>
            </div>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-3 py-1 rounded-full font-bold">
            Cinema Dost AI Active
          </span>
        </div>

        {/* Dialogue Scroll area */}
        <div className="flex-grow space-y-4 max-h-[460px] overflow-y-auto pr-2 min-h-[350px]">
          <AnimatePresence initial={false}>
            {discussion.map((msg, i) => {
              const isUser = msg.sender.startsWith("You");
              const isAI = msg.sender.startsWith("Cinema Dost");
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isUser ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border bg-slate-900 border-white/10 shadow-sm shrink-0`}>
                    {getSenderAvatar(msg.sender)}
                  </div>
                  <div className="max-w-[85%] space-y-1">
                    <div className="flex items-center gap-1.5 px-1">
                      <span className={`text-[10px] font-extrabold ${isUser ? "text-blue-400" : isAI ? "text-yellow-400" : "text-gray-300"}`}>
                        {msg.sender}
                      </span>
                    </div>
                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow border ${
                      isUser
                        ? "bg-blue-600/10 border-blue-500/30 text-white" 
                        : isAI
                          ? "bg-slate-900 border-yellow-500/20 text-yellow-50/95"
                          : `bg-white/[0.02] ${msg.sender.includes("Rahul") ? "border-amber-500/10 text-orange-50/90" : msg.sender.includes("Sneha") ? "border-teal-500/10 text-emerald-50/90" : "border-purple-500/10 text-indigo-50/90"}`
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Loading Quote block */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-sm">
                ⏱️
              </div>
              <div className="space-y-1 bg-white/[0.01] border border-white/5 rounded-2xl p-4 max-w-[80%] shadow">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{cinematicLoadingQuotes[loadingQuoteIdx]}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Message Form submission box */}
        <form onSubmit={handleSendMessage} className="mt-4 flex gap-2 pt-3 border-t border-white/5 select-none">
          <input
            type="text"
            required
            placeholder="Type: e.g. We want an indie Korean thriller movie..."
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            className="flex-grow bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-blue-500/80 focus:bg-white/[0.05] transition-all font-medium"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-2xl w-10 h-10 flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 shadow-md cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Right Area (Simulated AI Custom Suggestions Deck): Span 5 */}
      <div className="lg:col-span-5 flex flex-col justify-between glass rounded-3xl p-5 border border-white/5 bg-slate-950/40">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-blue-400" />
              <h3 className="font-extrabold text-sm text-white font-display">Adda Recommendations</h3>
            </div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
              {suggestions.length} Suggested Choice
            </span>
          </div>

          {/* Suggestions List */}
          <div className="space-y-4">
            {suggestions.map((sug, idx) => {
              const alreadyAdded = watchlist.some((item) => item.title.toLowerCase() === sug.title.toLowerCase());
              return (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex gap-3 relative group"
                >
                  <img
                    src={sug.posterUrl}
                    alt={sug.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-20 object-cover rounded-md bg-slate-900 border border-white/5 shadow-inner"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1542204172-e70528091852?w=400&q=80";
                    }}
                  />
                  
                  <div className="min-w-0 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[9px] uppercase font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          {sug.category}
                        </span>
                        <div className="flex items-center text-xs text-yellow-400 gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400" />
                          <span className="font-extrabold">{typeof sug.rating === "number" ? sug.rating.toFixed(1) : sug.rating || "N/A"}</span>
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-white truncate min-w-0 mt-1" title={sug.title}>
                        {sug.title}
                      </h4>
                      <p className="text-[9px] text-gray-500 font-semibold">
                        {sug.year} • {sug.language}
                      </p>
                      <p className="text-[10px] text-slate-300 line-clamp-2 mt-1 leading-snug">
                        {sug.synopsis}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 gap-2">
                      <span className="text-[9px] text-gray-400 select-none">
                        By <span className="text-gray-300 font-semibold">{sug.recommendedBy}</span>
                      </span>

                      {alreadyAdded ? (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5 select-none bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 rounded-lg">
                          Added 🗸
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddSuggestion(sug)}
                          className="bg-blue-500/25 hover:bg-blue-500 text-blue-300 hover:text-white transition-colors text-[10px] font-bold px-2.5 py-1 rounded-lg border border-blue-500/30 flex items-center gap-0.5 select-none cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Watchlist</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick hint instructions */}
        <div className="text-[11px] text-gray-500 border-t border-white/5 pt-4 mt-4 select-none leading-relaxed">
          💡 Send custom prompts in the left chat box, e.g. <span className="text-gray-400 italic">"Recommend a suspense drama like Mirzapur"</span> to prompt the Friends' Hub to chat about it!
        </div>
      </div>
    </div>
  );
}
