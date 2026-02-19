import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Zap, Loader2 } from "lucide-react";

type Mode = "login" | "signup";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  // Already authenticated → go to dashboard
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Preencha email e senha");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        if (form.password.length < 6) {
          toast.error("Senha deve ter no mínimo 6 caracteres");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName || form.email.split("@")[0] },
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
        setMode("login");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de autenticação";
      if (msg.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos");
      } else if (msg.includes("User already registered")) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow effect */}
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
            style={{ backgroundColor: "hsl(152 72% 48% / 0.15)", border: "1px solid hsl(152 72% 48% / 0.4)" }}
          >
            <Zap className="h-6 w-6" style={{ color: "hsl(152 72% 48%)" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Organic Pro</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm text-muted-foreground">
                  Nome completo
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={form.fullName}
                  onChange={handleChange}
                  className="bg-secondary/50 border-border/60 focus:border-primary h-10"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={handleChange}
                required
                className="bg-secondary/50 border-border/60 focus:border-primary h-10"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "••••••••"}
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="bg-secondary/50 border-border/60 focus:border-primary h-10 pr-10"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold mt-2"
              disabled={isSubmitting}
              style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">
                {mode === "login" ? "Não tem conta?" : "Já tem conta?"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full h-9 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setForm({ email: "", password: "", fullName: "" });
            }}
          >
            {mode === "login" ? "Criar uma conta" : "Fazer login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
