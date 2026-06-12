import React, { useState } from "react";
import { LogIn, UserPlus, ShieldAlert, Loader2, User, Lock, Sparkles, HelpCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface LoginOverlayProps {
  onSuccess: (user: any) => void;
  onContinueAsGuest: () => void;
}

export function LoginOverlay({ onSuccess, onContinueAsGuest }: LoginOverlayProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot_verify" | "forgot_reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verifiedUsername, setVerifiedUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to make switching accounts easy
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const userCredential = await signInWithPopup(auth, provider);
      if (userCredential && userCredential.user) {
        onSuccess(userCredential.user);
      }
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      setErrorMsg(err.message || "Google Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedSecurityAnswer = securityAnswer.trim().toLowerCase();
    const trimmedNewPassword = newPassword.trim();

    if (mode === "login") {
      if (!trimmedUsername) {
        setErrorMsg("Please enter a username.");
        return;
      }
      if (!trimmedPassword || trimmedPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters long.");
        return;
      }

      // Silently append '@cinetrack.com' behind the scenes
      const email = `${trimmedUsername.toLowerCase()}@cinetrack.com`;

      setLoading(true);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, trimmedPassword);
        if (userCredential && userCredential.user) {
          onSuccess(userCredential.user);
        }
      } catch (err: any) {
        console.error("Login failed:", err);
        let friendlyMessage = err.message || "Failed to log in. Please check inputs.";
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
          friendlyMessage = `Invalid username or password. Try toggling to 'Create Account' mode if you are new!`;
        } else if (err.code === "auth/operation-not-allowed") {
          friendlyMessage = "Email/Password sign-in is currently disabled in your Firebase console settings. (auth/operation-not-allowed)";
        }
        setErrorMsg(friendlyMessage);
      } finally {
        setLoading(false);
      }
    } else if (mode === "signup") {
      if (!trimmedUsername) {
        setErrorMsg("Please enter a username.");
        return;
      }
      if (!trimmedPassword || trimmedPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters long.");
        return;
      }
      if (!trimmedSecurityAnswer) {
        setErrorMsg("Please provide an answer to the security question.");
        return;
      }

      const email = `${trimmedUsername.toLowerCase()}@cinetrack.com`;
      setLoading(true);

      try {
        // Match user checking in Firestore
        const userDocRef = doc(db, "users", trimmedUsername.toLowerCase());
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          setErrorMsg(`Username "${trimmedUsername}" is already taken. Please try a different username!`);
          setLoading(false);
          return;
        }

        // Create Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, trimmedPassword);
        
        // Save in Firestore collection "users"
        await setDoc(doc(db, "users", trimmedUsername.toLowerCase()), {
          username: trimmedUsername,
          email: email,
          uid: userCredential.user.uid,
          securityAnswer: trimmedSecurityAnswer,
          createdAt: new Date().toISOString()
        });

        if (userCredential && userCredential.user) {
          onSuccess(userCredential.user);
        }
      } catch (err: any) {
        console.error("Signup actions failed:", err);
        let friendlyMessage = err.message || "Sign up failed. Please check inputs.";
        if (err.code === "auth/email-already-in-use") {
          friendlyMessage = `Username "${trimmedUsername}" is already taken in our system.`;
        } else if (err.code === "auth/weak-password") {
          friendlyMessage = "Password is too weak. Must be at least 6 characters.";
        } else if (err.code === "auth/operation-not-allowed") {
          friendlyMessage = "Email/Password authentication provider is disabled in Firebase. (auth/operation-not-allowed)";
        }
        setErrorMsg(friendlyMessage);
      } finally {
        setLoading(false);
      }
    } else if (mode === "forgot_verify") {
      if (!trimmedUsername) {
        setErrorMsg("Please enter your username.");
        return;
      }
      if (!trimmedSecurityAnswer) {
        setErrorMsg("Please enter your security answer.");
        return;
      }

      setLoading(true);
      try {
        const usernameLower = trimmedUsername.toLowerCase();
        const userDocRef = doc(db, "users", usernameLower);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          setErrorMsg(`Username "${trimmedUsername}" not found.`);
          setLoading(false);
          return;
        }

        const dbAnswer = (userSnap.data()?.securityAnswer || "").toString().trim().toLowerCase();
        if (dbAnswer !== trimmedSecurityAnswer) {
          setErrorMsg("Incorrect security answer. Keep guessing or try again!");
          setLoading(false);
          return;
        }

        setVerifiedUsername(trimmedUsername);
        setMode("forgot_reset");
        setNewPassword("");
      } catch (err: any) {
        console.error("Verification failed:", err);
        setErrorMsg(err.message || "Failed to verify security answer.");
      } finally {
        setLoading(false);
      }
    } else if (mode === "forgot_reset") {
      if (!trimmedNewPassword || trimmedNewPassword.length < 6) {
        setErrorMsg("New password must be at least 6 characters long.");
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: verifiedUsername,
            securityAnswer: securityAnswer.trim().toLowerCase(),
            newPassword: trimmedNewPassword
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Reset password request failed on endpoint.");
        }

        // Success Update
        setSuccessMsg("Password updated successfully! Feel free to log in now.");
        setMode("login");
        setUsername(verifiedUsername);
        setPassword("");
        setSecurityAnswer("");
      } catch (err: any) {
        console.error("Pass update error:", err);
        setErrorMsg(err.message || "Failed to update your password.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 overflow-y-auto">


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl overflow-hidden"
      >
        {/* Glow border effect */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-inner">
            <Sparkles className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2 uppercase">
            CINETRACK <span className="text-blue-400">PRO</span>
          </h1>
          <p className="text-slate-400 text-xs">
            {mode === "login" && "Sign in to access your media journal history"}
            {mode === "signup" && "Join CineTrack to save your custom watched lists"}
            {mode === "forgot_verify" && "Verify your security answer to reset your password"}
            {mode === "forgot_reset" && "Secure your account with a brand new password"}
          </p>
        </div>

        {mode === "login" && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-sm tracking-wide"
            >
              <svg className="w-4 h-4 mr-1 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.57-5.17 3.57-8.77l-.1-.4z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.24A7.16 7.16 0 0 1 5 12c0-.79.13-1.57.32-2.34V6.51H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.39l4.11-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.62l4.11 3.15c.94-2.85 3.57-4.96 6.68-4.96z"
                />
              </svg>
              <span>CONTINUE WITH GOOGLE</span>
            </button>

            <button
              type="button"
              onClick={onContinueAsGuest}
              className="w-full h-11 mt-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 active:scale-95 text-sm tracking-wide"
            >
              <User className="w-4 h-4 text-blue-400" />
              <span>CONTINUE AS GUEST (OFFLINE MODE)</span>
            </button>

            <div className="flex items-center my-5">
              <div className="flex-1 border-t border-white/5"></div>
              <span className="px-3 text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">OR</span>
              <div className="flex-1 border-t border-white/5"></div>
            </div>
          </div>
        )}

        {(mode === "signup" || mode === "forgot_verify") && (
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-4 text-xs space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-widest text-[10px]">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Security Question</span>
            </div>
            <p className="text-white text-sm font-semibold">
              What is your favorite movie?
            </p>
          </div>
        )}

        {mode === "forgot_reset" && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4 text-xs flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300">
              Reset password for: <strong className="text-white">{verifiedUsername}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                key="error-msg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-2 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="font-semibold leading-relaxed">{errorMsg}</p>
                    {errorMsg.includes("operation-not-allowed") && (
                      <div className="mt-3 p-3.5 bg-red-950/40 rounded-xl border border-red-500/10 text-slate-300 leading-relaxed space-y-2.5 text-[11px] font-medium shadow-inner">
                        <p className="text-white font-black uppercase tracking-wider text-[10px] text-red-400 flex items-center gap-1.5">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          🛠️ ACTION REQUIRED: ENABLE EMAIL AUTH
                        </p>
                        <p>
                          CineTrack's custom registration requires enabling the <strong>Email/Password</strong> sign-in method in your Firebase console.
                        </p>
                        <div className="space-y-1.5 pt-1">
                          <a
                            href="https://console.firebase.google.com/project/gen-lang-client-0846510574/authentication/providers"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors no-underline cursor-pointer shadow-md"
                          >
                            Open Firebase Console ↗
                          </a>
                        </div>
                        <ol className="list-decimal pl-4 pt-1 space-y-1 text-slate-400">
                          <li>Click the button above to open the layout.</li>
                          <li>Click on <strong>"Add new provider"</strong> or select <strong>"Email/Password"</strong>.</li>
                          <li>Toggle **Enable** to active, then click <strong>"Save"</strong>.</li>
                        </ol>
                        <p className="text-slate-400 italic">
                          Once saved, please close the console and register! Custom signup and password recovery will work instantly.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                key="success-msg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-200 text-xs"
              >
                <CheckCircle className="w-4 h-4 shrink-0 text-green-400" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-4"
            >
              {mode !== "forgot_reset" && (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4 text-slate-500" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter username (e.g. viewer)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setMode("forgot_verify");
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                      Create Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type="password"
                        required
                        placeholder="Choose password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                      Your Security Answer
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <HelpCircle className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Your favorite movie (e.g. Inception)"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                        disabled={loading}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block leading-relaxed pl-1">
                      We'll map your username silently to <strong>{username ? username.toLowerCase() : "username"}@cinetrack.com</strong>!
                    </span>
                  </div>
                </>
              )}

              {mode === "forgot_verify" && (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                    Security Answer Answer
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter security answer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {mode === "forgot_reset" && (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-widest text-slate-400 font-extrabold block">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Enter new strong password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all focus:bg-white/[0.08]"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-sm tracking-wide"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : mode === "login" ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>LOG IN</span>
                  </>
                ) : mode === "signup" ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>CREATE ACCOUNT</span>
                  </>
                ) : mode === "forgot_verify" ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>VERIFY SECURITY ANSWER</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>UPDATE PASSWORD</span>
                  </>
                )}
              </button>
            </motion.div>
          </AnimatePresence>
        </form>

        <div className="mt-5 border-t border-white/5 pt-4 text-center">
          <p className="text-xs text-slate-400">
            {mode === "login" && (
              <>
                New to CineTrack Pro?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode("signup");
                  }}
                  className="text-blue-400 hover:text-blue-300 font-extrabold underline cursor-pointer transition-colors"
                >
                  Create Account & Get Started
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode("login");
                  }}
                  className="text-blue-400 hover:text-blue-300 font-extrabold underline cursor-pointer transition-colors"
                >
                  Log In directly
                </button>
              </>
            )}
            {(mode === "forgot_verify" || mode === "forgot_reset") && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode("login");
                }}
                className="text-slate-400 hover:text-white font-bold flex items-center justify-center gap-2 mx-auto transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Log In</span>
              </button>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
