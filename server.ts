import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

dotenv.config();

// Initialize Firebase Admin SDK
try {
  const configRaw = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
  const parsedConfig = JSON.parse(configRaw);
  admin.initializeApp({
    projectId: parsedConfig.projectId
  });
} catch (e) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.error("Firebase Admin initialization error or already runs:", error);
  }
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini Client to avoid crash if API key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is missing.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API to reset user password using security answer verification and Firebase Admin
app.post("/api/reset-password", async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }
  if (!securityAnswer) {
    return res.status(400).json({ error: "Security answer is required." });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters long." });
  }

  try {
    const configRaw = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
    const parsedConfig = JSON.parse(configRaw);
    const dbId = parsedConfig.firestoreDatabaseId || "(default)";
    const appInstance = getApp();
    const firestoreInstance = dbId && dbId !== "(default)" ? getFirestore(appInstance, dbId) : getFirestore();
    
    const usernameLower = username.toLowerCase().trim();
    const userDocRef = firestoreInstance.collection("users").doc(usernameLower);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: `Username "${username}" not found.` });
    }

    const dbAnswer = (userDoc.get("securityAnswer") || "").toString().trim().toLowerCase();
    const submittedAnswer = securityAnswer.toString().trim().toLowerCase();

    if (dbAnswer !== submittedAnswer) {
      return res.status(400).json({ error: "Verification failed. Incorrect security answer." });
    }

    const uid = userDoc.get("uid");
    if (!uid) {
      return res.status(500).json({ error: "User record does not contain an Auth UID. Please contact support." });
    }

    // Update the password in Firebase Authentication using Admin SDK
    const authInstance = getAuth();
    await authInstance.updateUser(uid, {
      password: newPassword
    });

    return res.json({ success: true, message: "Password updated successfully!" });
  } catch (error: any) {
    console.error("Password reset error in REST API:", error);
    return res.status(500).json({ error: "Failed to reset password. " + error.message });
  }
});

// REST API for autofilling movie progress
app.post("/api/autofill", async (req, res) => {
  const { title, category } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Return sample high-quality mockup if API key is not present
    return res.json({
      title: title,
      year: "2024",
      genres: ["Action", "Sci-Fi"],
      rating: 8.0,
      duration: category === "Movie" ? "2h 05m" : "10 Episodes",
      language: "Hindi, English",
      synopsis: `An impressive tracking entry for the ${category || "item"} '${title}'. (Set up GEMINI_API_KEY to unlock real high-fidelity descriptions)`,
      posterUrl: `https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80`
    });
  }

  try {
    const prompt = `Search for the ${category || "Movie/Series"} named "${title}". Return a JSON object with details about it. Always try to match the closest matching actual release.
The response must match this schema:
{
  "title": "Normalized correct title",
  "year": "Release year (string)",
  "genres": ["Genre1", "Genre2"], // Max 3 genres. Use standard simple genres like Action, Comedy, Drama, Sci-Fi, Thriller, Romance, Fantasy, Horror, Mystery, Sport, Documentary
  "rating": 8.5, // Numeric score between 0 and 10 based on TMDB/IMDb
  "duration": "Length, e.g. '2h 10m' for movie, or '10 Episodes' or '2 Seasons' for series/anime",
  "language": "Major languages spoken, e.g. 'English, Hindi'",
  "synopsis": "A compelling 1-2 sentence description of the plot.",
  "posterUrl": "A beautiful valid poster image URL or high-quality background. For movies/series, use either a real TMDB poster path if you know it (prefix with 'https://image.tmdb.org/t/p/w500/'), or a highly relevant query code on Unsplash (e.g., 'https://images.unsplash.com/photo-...' featuring cinema/popcorn or specific mood matching the genre)."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            genres: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            rating: { type: Type.NUMBER },
            duration: { type: Type.STRING },
            language: { type: Type.STRING },
            synopsis: { type: Type.STRING },
            posterUrl: { type: Type.STRING }
          },
          required: ["title", "year", "genres", "rating", "duration", "language", "synopsis", "posterUrl"]
        }
      }
    });

    const text = response.text?.trim() || "{}";
    const result = JSON.parse(text);
    return res.json(result);
  } catch (error: any) {
    console.error("Autofill API error:", error);
    return res.status(500).json({ error: "Failed to fetch movie metadata", details: error.message });
  }
});

// REST API for Dosto ka Adda chat and group recommendations
app.post("/api/dosto-chat", async (req, res) => {
  const { watchlist, userMessage } = req.body;
  const ai = getGeminiClient();

  // Create description of current watchlist
  const watchlistDesc = watchlist && watchlist.length > 0 
    ? watchlist.map((item: any) => `- ${item.title} (${item.category}, Status: ${item.status}, Rating: ${item.rating}/10, Genres: ${item.genres?.join(", ")})`).join("\n")
    : "No media saved yet. Looking for starting recommendations!";

  if (!ai) {
    // Return mock conversation if key is missing
    return res.json({
      discussion: [
        { sender: "Rahul (Action Buff)", text: `Bhai! Anyone watched something epic lately? I see we have some classic movies in mind!` },
        { sender: "Sneha (Cinephile)", text: `Yeah! I think we should check out Oppenheimer, it is simply masterfully crafted, or maybe some classic Hindi thriller.` },
        { sender: "Amit (Anime Otaku)", text: `Did someone say thriller? Attack on Titan has the absolute best build-up and payoff. We should plan a virtual watch party tonight!` },
        { sender: "Cinema Dost (AI)", text: `Welcome to the Adda! Here are 2 stellar recommendations for your group: 1. 'Super Deluxe' (Tamil, 2019) is a marvelous black comedy-thriller, and 2. 'Your Name' (Anime, 2016) is a beautiful fantasy-romance.` }
      ],
      aiSuggestions: [
        {
          title: "Super Deluxe",
          category: "Movie",
          year: "2019",
          genres: ["Thriller", "Comedy"],
          rating: 8.4,
          duration: "2h 56m",
          language: "Tamil",
          synopsis: "An angst-ridden teenager, an unfaithful wife, and an angry mob find themselves stuck in unexpected situations on a fateful day.",
          posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80",
          recommendedBy: "Cinema Dost"
        },
        {
          title: "Your Name",
          category: "Anime",
          year: "2016",
          genres: ["Fantasy", "Romance"],
          rating: 8.4,
          duration: "1h 46m",
          language: "Japanese, Hindi",
          synopsis: "Two strangers find themselves linked in a bizarre way. When a connection is formed, will distance be the only thing to keep them apart?",
          posterUrl: "https://images.unsplash.com/photo-1541562232579-512a21360020?w=400&q=80",
          recommendedBy: "Amit (Anime Otaku)"
        }
      ]
    });
  }

  try {
    const systemPrompt = `You are hosting 'Dosto ka Adda' (Friends' Hangout Corner), a fun chat room for a group of Indian friends tracking movies, web series, and anime.
The characters in the chat are:
1. Rahul (Action Buff & Bollywood Masaala Fan) - loves popcorn thrillers, South Indian high-octane action, commercial entertainers. Uses casual Indian slang (bhai, solid, mast, ghazab).
2. Sneha (Cinephile & Deep Thinker) - loves indie cinema, world movies, intense dramas, gorgeous visuals. Speaks gracefully and professionally.
3. Amit (Anime Otaku & Tech Geek) - crazy about anime like Jujutsu Kaisen, Stein's Gate, complex plots, sci-fi series. Energetic, otaku language.
4. Cinema Dost (Guru AI) - friendly, highly knowledgeable AI film expert who links everything together nicely and suggests pristine hidden gems.

The user's current tracklist is:
${watchlistDesc}

User's new message is: "${userMessage || "Suggest something awesome we can watch as a group tonight!"}"

Generate:
1. A lively chat transcript of 4 messages (one from each of Rahul, Sneha, Amit, and Cinema Dost) discussing/responding to the user's input/watchlist. They must sound realistic, funny, and warm, exchanging brief arguments.
2. An array of 2-3 specific real movies/series/anime recommended by the group. Each recommendation must be populated with beautiful metadata.

Return ONLY a JSON response matching this schema:
{
  "discussion": [
    { "sender": "Rahul (Action Buff)", "text": "brief friendly message" },
    { "sender": "Sneha (Cinephile)", "text": "brief insightful comment" },
    { "sender": "Amit (Anime Otaku)", "text": "brief anime hype message" },
    { "sender": "Cinema Dost (AI)", "text": "expert movie host feedback" }
  ],
  "aiSuggestions": [
    {
      "title": "Recommended Title name",
      "category": "Movie" or "Web Series" or "Anime",
      "year": "Release year",
      "genres": ["Genre1", "Genre2"],
      "rating": 8.1,
      "duration": "Length",
      "language": "English/Hindi/etc",
      "synopsis": "A short engaging review/synopsis explaining why it is a must-watch.",
      "posterUrl": "A valid TMDb poster image link prefix ('https://image.tmdb.org/t/p/w500/...') if you know the exact path, otherwise a nice Unsplash query link.",
      "recommendedBy": "Rahul (Action Buff)" or "Sneha (Cinephile)" or "Amit (Anime Otaku)" or "Cinema Dost"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            discussion: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sender: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["sender", "text"]
              }
            },
            aiSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  year: { type: Type.STRING },
                  genres: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  rating: { type: Type.NUMBER },
                  duration: { type: Type.STRING },
                  language: { type: Type.STRING },
                  synopsis: { type: Type.STRING },
                  posterUrl: { type: Type.STRING },
                  recommendedBy: { type: Type.STRING }
                },
                required: ["title", "category", "year", "genres", "rating", "duration", "language", "synopsis", "posterUrl", "recommendedBy"]
              }
            }
          },
          required: ["discussion", "aiSuggestions"]
        }
      }
    });

    const text = response.text?.trim() || "{}";
    const result = JSON.parse(text);
    return res.json(result);
  } catch (error: any) {
    console.error("Dosto Chat API error:", error);
    return res.status(500).json({ error: "Failed to generate group chat", details: error.message });
  }
});


// Serve static static assets & connect Vite in Dev mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
