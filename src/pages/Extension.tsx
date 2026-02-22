import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Download,
  Chrome,
  Puzzle,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Database,
  Zap,
  Shield,
  Clock,
  LogIn,
  Settings,
  ExternalLink,
} from "lucide-react";

interface IgAccount {
  id: string;
  ig_username: string;
  last_heartbeat: string | null;
  bridge_version: string | null;
  bot_online: boolean | null;
  delay_min: number | null;
  delay_max: number | null;
  max_actions_per_session: number | null;
}

interface CurrentConfig {
  follow_daily_limit: number;
  like_daily_limit: number;
  delay_min: number;
  delay_max: number;
  max_actions_per_session: number;
  unfollow_daily_limit: number;
}

const DEFAULT_CONFIG: CurrentConfig = {
  follow_daily_limit: 150,
  like_daily_limit: 300,
  delay_min: 25,
  delay_max: 45,
  max_actions_per_session: 50,
  unfollow_daily_limit: 100,
};

const REFERENCE_PRESETS = [
  { id: "nova", name: "Conta Nova", badge: "🟢 Conservador", follows: 40, delay: "45–90s", session: 20, desc: "< 3 meses · risco mínimo" },
  { id: "media", name: "Conta Média", badge: "🟡 Moderado", follows: 100, delay: "25–45s", session: 50, desc: "3–12 meses · crescimento estável" },
  { id: "madura", name: "Conta Madura", badge: "🔴 Agressivo", follows: 200, delay: "15–25s", session: 100, desc: "> 12 meses · máximo crescimento" },
];

function getClosestPreset(config: CurrentConfig): string {
  const diffs = REFERENCE_PRESETS.map((p) => ({
    id: p.id,
    diff: Math.abs(config.follow_daily_limit - p.follows) + Math.abs(config.max_actions_per_session - p.session),
  }));
  diffs.sort((a, b) => a.diff - b.diff);
  return diffs[0].id;
}

function getExtensionStatus(lastHeartbeat: string | null): "online" | "away" | "offline" {
  if (!lastHeartbeat) return "offline";
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  if (diff < 6 * 60 * 1000) return "online";
  if (diff < 30 * 60 * 1000) return "away";
  return "offline";
}

const statusConfig = {
  online: { label: "Extensão ativa", color: "hsl(152 72% 48%)", bg: "hsl(152 72% 48% / 0.12)" },
  away: { label: "Extensão ausente", color: "hsl(42 96% 56%)", bg: "hsl(42 96% 56% / 0.12)" },
  offline: { label: "Extensão offline", color: "hsl(215 20% 45%)", bg: "hsl(215 20% 45% / 0.08)" },
};

const EXTENSION_VERSION = "v1.0.0";
const ZIP_URL = "https://github.com/Drmachado0/extensao/archive/refs/heads/main.zip";
const DASHBOARD_URL = "https://organicbot.lovable.app";

const steps = [
  {
    num: 1,
    icon: <Download className="h-5 w-5" />,
    title: "Baixar a extensão",
    desc: "Clique no botão abaixo para baixar o arquivo ZIP da extensão.",
    color: "hsl(152 72% 48%)",
  },
  {
    num: 2,
    icon: <Chrome className="h-5 w-5" />,
    title: "Abrir chrome://extensions",
    desc: "No Chrome ou Edge, abra uma nova aba e navegue para chrome://extensions",
    color: "hsl(42 96% 56%)",
  },
  {
    num: 3,
    icon: <Puzzle className="h-5 w-5" />,
    title: "Ativar Modo Desenvolvedor",
    desc: 'Habilite o toggle "Modo do desenvolvedor" no canto superior direito da página.',
    color: "hsl(252 62% 60%)",
  },
  {
    num: 4,
    icon: <CheckCircle className="h-5 w-5" />,
    title: "Carregar extensão descompactada",
    desc: 'Clique em "Carregar sem compactacao" e selecione a pasta do ZIP que voce extraiu.',
    color: "hsl(215 72% 60%)",
  },
  {
    num: 5,
    icon: <LogIn className="h-5 w-5" />,
    title: "Conectar ao Dashboard",
    desc: `Clique no ícone da extensão no Chrome, faça login com o mesmo email e senha do dashboard (${DASHBOARD_URL}).`,
    color: "hsl(320 65% 60%)",
  },
];

export default function ExtensionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentConfig, setCurrentConfig] = useState<CurrentConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);

  // Fetch accounts and settings
  useEffect(() => {
    if (!user) return;

    // Fetch accounts
    supabase
      .from("ig_accounts")
      .select("id, ig_username, last_heartbeat, bridge_version, bot_online, delay_min, delay_max, max_actions_per_session")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        setAccounts((data as IgAccount[]) ?? []);
        setLoading(false);
      });

    // Fetch user_settings for real config
    supabase
      .from("user_settings")
      .select("settings_json")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.settings_json as Record<string, unknown> | null;
        if (raw) {
          setCurrentConfig({
            follow_daily_limit: Number(raw.follow_daily_limit ?? DEFAULT_CONFIG.follow_daily_limit),
            like_daily_limit: Number(raw.like_daily_limit ?? DEFAULT_CONFIG.like_daily_limit),
            delay_min: Number(raw.delay_min ?? DEFAULT_CONFIG.delay_min),
            delay_max: Number(raw.delay_max ?? DEFAULT_CONFIG.delay_max),
            max_actions_per_session: Number(raw.max_actions_per_session ?? DEFAULT_CONFIG.max_actions_per_session),
            unfollow_daily_limit: Number(raw.unfollow_daily_limit ?? DEFAULT_CONFIG.unfollow_daily_limit),
          });
        }
        setConfigLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`extension-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ig_accounts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as IgAccount;
          setAccounts((prev) =>
            prev.map((a) => (a.id === row.id ? { ...a, ...row } : a))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refresh = () => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("ig_accounts")
      .select("id, ig_username, last_heartbeat, bridge_version, bot_online")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        setAccounts((data as IgAccount[]) ?? []);
        setLoading(false);
      });
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">

        {/* ── Header ── */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "hsl(152 72% 48% / 0.15)", border: "1px solid hsl(152 72% 48% / 0.4)" }}
            >
              <Chrome className="h-5 w-5" style={{ color: "hsl(152 72% 48%)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Extensão Chrome</h1>
              <p className="text-sm text-muted-foreground">Organic Pro — integração com o Instagram</p>
            </div>
          </div>
        </header>

        {/* ── Connection Status ── */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Status de Conexão</p>
            </div>
            <button
              onClick={refresh}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div
              className="rounded-xl px-4 py-5 text-center"
              style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
            >
              <WifiOff className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma conta Instagram conectada.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Adicione uma conta em Configurações.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => {
                const status = getExtensionStatus(acc.last_heartbeat);
                const cfg = statusConfig[status];
                return (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
                  >
                    <span
                      className="relative flex h-2.5 w-2.5 flex-shrink-0"
                    >
                      {status === "online" && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.color }} />
                      )}
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: cfg.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">@{acc.ig_username}</p>
                      {acc.last_heartbeat && (
                        <p className="text-xs text-muted-foreground">
                          Último sync: {new Date(acc.last_heartbeat).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {acc.bridge_version && ` · v${acc.bridge_version}`}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Download ── */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5"
          style={{ backgroundColor: "hsl(152 72% 48% / 0.08)", border: "1px solid hsl(152 72% 48% / 0.25)" }}
        >
          <div className="flex-1 space-y-1">
            <p className="font-bold text-base">Baixar Extensão</p>
            <p className="text-sm text-muted-foreground">
              Versão {EXTENSION_VERSION} — Arquivo ZIP — Chrome/Edge modo desenvolvedor
            </p>
          </div>
          <Button
            asChild
            className="gap-2 font-semibold shrink-0"
            style={{ backgroundColor: "hsl(152 72% 48%)", color: "hsl(222 25% 6%)" }}
          >
            <a href={ZIP_URL} download>
              <Download className="h-4 w-4" />
              Baixar ZIP
            </a>
          </Button>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Abrir Dashboard</p>
            <p className="text-xs text-muted-foreground">Acesse o painel de controle do OrganicBot</p>
          </div>
          <Button
            asChild
            className="gap-2 font-semibold shrink-0"
            variant="outline"
          >
            <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir Dashboard
            </a>
          </Button>
        </div>


        <div className="glass-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Guia de Instalação</p>
          </div>
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.num}
                className="flex gap-4 rounded-xl px-4 py-3"
                style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${step.color.replace(")", " / 0.12)")}`, color: step.color }}
                >
                  {step.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground/50">Passo {step.num}</span>
                  </div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Current Config + Safety Presets ── */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Configuração Atual</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-3.5 w-3.5" />
              Ir para Configurações
            </Button>
          </div>

          {/* Current active config */}
          {configLoading ? (
            <div className="h-20 rounded-xl bg-muted/20 animate-pulse" />
          ) : (
            <div
              className="rounded-xl px-4 py-4 space-y-3"
              style={{ backgroundColor: "hsl(152 72% 48% / 0.06)", border: "1px solid hsl(152 72% 48% / 0.25)" }}
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: "hsl(152 72% 48%)" }} />
                <p className="text-sm font-bold" style={{ color: "hsl(152 72% 48%)" }}>Valores Ativos na Extensão</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Follow/dia", value: currentConfig.follow_daily_limit },
                  { label: "Like/dia", value: currentConfig.like_daily_limit },
                  { label: "Delay", value: `${currentConfig.delay_min}–${currentConfig.delay_max}s` },
                  { label: "Sessão", value: `${currentConfig.max_actions_per_session} ações` },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reference presets */}
          <p className="text-xs text-muted-foreground font-medium pt-1">Presets de referência:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {REFERENCE_PRESETS.map((p) => {
              const isClosest = !configLoading && getClosestPreset(currentConfig) === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-xl px-4 py-4 space-y-2 transition-colors"
                  style={{
                    backgroundColor: isClosest ? "hsl(152 72% 48% / 0.08)" : "hsl(220 18% 10%)",
                    border: isClosest ? "1px solid hsl(152 72% 48% / 0.4)" : "1px solid hsl(220 18% 18%)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">{p.badge}</p>
                    {isClosest && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "hsl(152 72% 48%)", backgroundColor: "hsl(152 72% 48% / 0.12)" }}>
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm">{p.name}</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Follow: <span className="text-foreground font-medium">{p.follows}/dia</span></p>
                    <p>Delay: <span className="text-foreground font-medium">{p.delay}</span></p>
                    <p>Sessão: <span className="text-foreground font-medium">{p.session} ações</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground/60">{p.desc}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Os valores ativos são lidos de <strong>Configurações</strong>. A extensão sincroniza automaticamente a cada 2 minutos.
          </p>
        </div>

        {/* ── How it syncs ── */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Como a Sincronização Funciona</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {[
              { icon: <Chrome className="h-4 w-4" />, label: "Extensão Chrome", desc: "Roda no Instagram e executa as ações", color: "hsl(42 96% 56%)" },
              { icon: <ArrowRight className="h-4 w-4" />, label: "", desc: "", color: "hsl(215 20% 35%)", isArrow: true },
              { icon: <Database className="h-4 w-4" />, label: "Supabase", desc: "Banco de dados compartilhado em tempo real", color: "hsl(152 72% 48%)" },
              { icon: <ArrowRight className="h-4 w-4" />, label: "", desc: "", color: "hsl(215 20% 35%)", isArrow: true },
              { icon: <Zap className="h-4 w-4" />, label: "Dashboard", desc: "Monitora, controla e exibe os dados", color: "hsl(252 62% 60%)" },
            ].map((item, i) =>
              item.isArrow ? (
                <div key={i} className="flex items-center justify-center sm:self-center" style={{ color: item.color }}>
                  {item.icon}
                </div>
              ) : (
                <div
                  key={i}
                  className="flex-1 rounded-xl px-4 py-3 text-center space-y-1"
                  style={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 18% 18%)" }}
                >
                  <div className="flex justify-center" style={{ color: item.color }}>{item.icon}</div>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              )
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              { icon: <Clock className="h-3.5 w-3.5" />, text: "Heartbeat a cada 3 min — mantém status online atualizado" },
              { icon: <Zap className="h-3.5 w-3.5" />, text: "Comandos (start/pause/stop) enviados via dashboard são lidos em até 45s" },
              { icon: <Database className="h-3.5 w-3.5" />, text: "Configurações sincronizadas automaticamente a cada 2 min" },
              { icon: <Shield className="h-3.5 w-3.5" />, text: "Fila de alvos injeta até 50 usernames por lote" },
            ].map(({ icon, text }, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="flex-shrink-0 mt-0.5" style={{ color: "hsl(152 72% 48%)" }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
