import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import { UserPlus, LogIn, Settings } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const { signUp, signIn } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Welcome back!");
      } else {
        if (!displayName.trim()) {
          toast.error("Please enter a display name");
          return;
        }
        await signUp(email, password, displayName.trim());
        toast.success("Account created! You're all set.");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="h-9 w-9 rounded-full border border-border/80 bg-card/80 backdrop-blur"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-4 ring-primary/10">
            <img src="/app-icon.png" alt="yoobro" className="h-full w-full object-cover" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">yoobro</h1>
          <p className="mt-2 text-muted-foreground">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          {!isLogin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required={!isLogin}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {submitting ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </form>
      </div>
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};

export default Auth;
