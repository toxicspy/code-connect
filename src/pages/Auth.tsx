import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BrandBadge from "@/components/BrandBadge";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import { UserPlus, LogIn, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const { signUp, signIn, continueAsGuest } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isNetworkError = (error: any) => {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("failed to fetch") || message.includes("network") || message.includes("request failed");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!email.trim()) {
      toast.error("Please enter an email or username");
      setSubmitting(false);
      return;
    }

    if (!password.trim()) {
      toast.error("Please enter a password");
      setSubmitting(false);
      return;
    }

    try {
      if (isLogin) {
        try {
          await signIn(email, password);
          toast.success("Welcome back!");
        } catch (err: any) {
          if (isNetworkError(err)) {
            throw err;
          }
          await continueAsGuest(email || displayName || "Guest", email || displayName || "Guest");
          toast.success("Signed in with instant guest access.");
        }
      } else {
        if (!displayName.trim()) {
          toast.error("Please enter a display name");
          setSubmitting(false);
          return;
        }

        try {
          await signUp(email, password, displayName.trim());
          toast.success("Account created! You're all set.");
        } catch (err: any) {
          if (isNetworkError(err)) {
            throw err;
          }
          await continueAsGuest(displayName.trim() || email || "Guest", email || displayName.trim() || "Guest");
          toast.success("Signed in with instant guest access.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen overflow-hidden bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,249,255,0.62))] dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_28%),linear-gradient(160deg,rgba(2,6,23,0.96),rgba(15,23,42,0.86))]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.5),transparent)]" />
      <div className="absolute inset-x-0 top-0 z-20 bg-background/90 px-4 py-3 shadow-sm backdrop-blur-sm dark:bg-background/85 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandBadge />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="h-10 w-10 rounded-sm bg-background/85 text-foreground hover:bg-background dark:bg-background/80"
              aria-label="Open settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="panel-surface grid w-full gap-6 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative hidden overflow-hidden px-8 py-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.16),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.92),rgba(236,253,245,0.68))] dark:bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_34%),linear-gradient(160deg,rgba(15,23,42,0.92),rgba(3,7,18,0.82))]" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600 dark:text-slate-300">
                yoobro
              </div>
              <h1 className="max-w-xl font-display text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Private conversations, presented with clarity.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Chat one-on-one, create AI companions, and move through the product with less noise. The interface is designed to feel clean, credible, and easy to trust from the first screen.
              </p>
            </div>
            <div className="relative grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-foreground">Focused by default</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Clear hierarchy and quiet surfaces keep the conversation at the center.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-foreground">Faster scanning</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Sharper contrast and stronger grouping make active chats easier to read.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="text-sm font-semibold text-foreground">Premium tone</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Refined panels, stronger typography, and calmer color create a more professional feel.</p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-5 py-8 sm:px-8 sm:py-10">
            <div className="w-full max-w-md animate-fade-in">
              <div className="mb-8 text-center lg:text-left">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-sm p-2 lg:mx-0">
                  <img src="/app-icon.png" alt="yoobro" className="h-full w-full rounded-[1rem] object-cover" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary">Secure social chat</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
                  {isLogin ? "Welcome back" : "Create your account"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {isLogin
                    ? "Sign in with your email or a simple username to get back to your conversations."
                    : "Create an account with your email or any simple username and get started quickly."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 rounded-[1.75rem] border border-white/70 bg-white/82 p-6 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60 sm:p-7">
                {!isLogin && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">Display Name</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      required={!isLogin}
                      className="h-12 rounded-2xl border-white/70 bg-white/90 dark:border-white/10 dark:bg-white/5"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium">Email or Username</label>
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com or yourname"
                    required
                    className="h-12 rounded-2xl border-white/70 bg-white/90 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="........"
                    required
                    minLength={6}
                    className="h-12 rounded-2xl border-white/70 bg-white/90 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <Button type="submit" className="h-12 w-full gap-2 rounded-2xl text-sm font-semibold" disabled={submitting}>
                  {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {submitting ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full gap-2 rounded-2xl text-sm font-semibold"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      await continueAsGuest(displayName || email || "Guest", email || displayName || "Guest");
                      toast.success("Guest access ready.");
                    } catch (err: any) {
                      toast.error(err.message || "Unable to continue as guest");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Continue as Guest
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {isLogin ? "Sign Up" : "Sign In"}
                  </button>
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};

export default Auth;
