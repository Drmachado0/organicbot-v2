import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // Supabase redirects with #access_token&type=recovery in the hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    } else {
      // If someone lands here without the recovery token, send them back
      toast.error("Link inválido ou expirado");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    }
    setIsSubmitting(false);
  };

  if (!isRecovery) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, hsl(152 72% 48% / 0.25), transparent)",
        }}
      />

      <div className="w-full max-w-sm space-y-6 relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "hsl(152 72% 48% / 0.15)",
              border: "1px solid hsl(152 72% 48% / 0.4)",
            }}
          >
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nova senha</h1>
          <p className="text-sm text-muted-foreground">
            {done ? "Senha redefinida com sucesso" : "Escolha uma nova senha para sua conta"}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Redirecionando para o login…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary/50 border-border/60 focus:border-primary h-10 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                  Confirmar senha
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="bg-secondary/50 border-border/60 focus:border-primary h-10"
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-semibold mt-2"
                disabled={isSubmitting}
                style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </form>
          )}

          {!done && (
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="hover:text-foreground transition-colors underline">
                Voltar para o login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
