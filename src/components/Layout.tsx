import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ImageIcon, Wand2, Settings, Sun, Moon, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toggleTheme, isDarkMode } from "@/App";
import SettingsPanel from "@/components/SettingsPanel";

const SETTINGS_KEY = "nanobanana_settings";

export interface AppSettings {
  customApiUrl: string;
  customApiKey: string;
  downloadPrefix: string;
  downloadFormat: string;
  downloadPath: string;
  maxCacheMB: number | null;
}

const defaultSettings: AppSettings = {
  customApiUrl: "",
  customApiKey: "",
  downloadPrefix: "LumenDust",
  downloadFormat: "png",
  downloadPath: "",
  maxCacheMB: null,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const navItems = [
  { path: "/", label: "生成", icon: Wand2 },
  { path: "/assets", label: "资产", icon: ImageIcon },
  { path: "/trash", label: "最近删除", icon: Trash2 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [dark, setDark] = useState(() => isDarkMode());

  useEffect(() => {
    const themeHandler = () => setDark(isDarkMode());
    window.addEventListener("theme-changed", themeHandler);
    return () => window.removeEventListener("theme-changed", themeHandler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative z-[1]">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-12">
          <span className="select-none pointer-events-none" style={{ fontFamily: "'Dancing Script', cursive", fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>LumenDust</span>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === item.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              </Link>
            ))}

            <button
              onClick={() => { toggleTheme(); }}
              className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors overflow-hidden"
              title={dark ? "切换亮色模式" : "切换暗色模式"}
            >
              <Sun className={`w-3.5 h-3.5 absolute transition-all duration-300 ease-in-out ${dark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"}`} />
              <Moon className={`w-3.5 h-3.5 absolute transition-all duration-300 ease-in-out ${dark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"}`} />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Settings className="w-3.5 h-3.5" />
                  设置
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 bg-card/70 backdrop-blur-xl border-border/40 shadow-xl" align="end">
                <SettingsPanel />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </nav>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
