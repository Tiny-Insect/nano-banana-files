import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ImageIcon, Wand2, Settings, Eye, EyeOff, Check, Sun, Moon, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toggleTheme, isDarkMode } from "@/App";
import StarField from "@/components/StarField";

const SETTINGS_KEY = "nanobanana_settings";

export interface AppSettings {
  customApiUrl: string;
  customApiKey: string;
  downloadPrefix: string;
  downloadFormat: string;
}

const defaultSettings: AppSettings = {
  customApiUrl: "",
  customApiKey: "",
  downloadPrefix: "LumenDust",
  downloadFormat: "png",
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
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dark, setDark] = useState(() => isDarkMode());
  const [apiInfoOpen, setApiInfoOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    const themeHandler = () => setDark(isDarkMode());
    window.addEventListener("settings-updated", handler);
    window.addEventListener("theme-changed", themeHandler);
    return () => {
      window.removeEventListener("settings-updated", handler);
      window.removeEventListener("theme-changed", themeHandler);
    };
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    window.dispatchEvent(new Event("settings-updated"));
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="min-h-screen flex flex-col relative z-[1]">
      <StarField />
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-12">
          <span className="text-sm font-semibold tracking-tight">LumenDust</span>
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
              <PopoverContent className="w-80 p-3" align="end">
                <div className="space-y-3">
                  <p className="text-xs font-medium">API 配置</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <label className="text-[11px] text-muted-foreground">API URL</label>
                        <Popover open={apiInfoOpen} onOpenChange={setApiInfoOpen}>
                          <PopoverTrigger asChild>
                            <button className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors cursor-pointer">
                              <Info className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3 text-xs" align="start" side="bottom">
                            <p className="font-medium mb-2">API URL 说明</p>
                            <div className="space-y-2 text-muted-foreground">
                              <div>
                                <p className="font-medium text-foreground/80">🔹 官方 Google API</p>
                                <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">
                                  https://generativelanguage.googleapis.com
                                </code>
                                <p className="text-[10px] mt-1">完整支持：联网搜索、思考模式、所有比例和分辨率</p>
                              </div>
                              <div className="border-t border-border/30 pt-2">
                                <p className="font-medium text-foreground/80">🔸 第三方代理 API</p>
                                <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">
                                  https://xxx.com/v1
                                </code>
                                <p className="text-[10px] mt-1">使用 OpenAI 兼容格式。联网搜索、思考模式可能不支持，比例/分辨率取决于代理商的适配程度。</p>
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2">
                                ⚠️ 切换第三方 API 后如遇到错误，请优先检查该 API 是否支持对应功能。
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <input
                        type="text"
                        value={settings.customApiUrl}
                        onChange={(e) => setSettings({ ...settings, customApiUrl: e.target.value })}
                        placeholder="例: https://generativelanguage.googleapis.com"
                        className="w-full h-8 px-2 rounded-md border border-border/50 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">API Key</label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={settings.customApiKey}
                          onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
                          placeholder="填入你的 API 密钥"
                          className="w-full h-8 px-2 pr-8 rounded-md border border-border/50 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 font-mono"
                        />
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                        >
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-medium mb-2">下载设置</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">文件名前缀</label>
                        <input
                          type="text"
                          value={settings.downloadPrefix}
                          onChange={(e) => setSettings({ ...settings, downloadPrefix: e.target.value })}
                          placeholder="LumenDust"
                          className="w-full h-8 px-2 rounded-md border border-border/50 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
                        />
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                          下载文件名格式: {settings.downloadPrefix || "LumenDust"}-时间戳.{settings.downloadFormat || "png"}
                        </p>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">图片格式</label>
                        <div className="flex gap-1">
                          {["png", "jpg", "webp"].map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => setSettings({ ...settings, downloadFormat: fmt })}
                              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                                settings.downloadFormat === fmt
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                              }`}
                            >
                              {fmt.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleSave}
                  >
                    {saved ? <><Check className="w-3 h-3 mr-1" />已保存</> : "保存配置"}
                  </Button>

                  <div className="border-t border-border/30 pt-2">
                    <p className="text-xs font-medium mb-1.5">模型</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">NanoBanana 2</span>
                        <span className="text-[10px] text-muted-foreground/60">联网 · 思考 · 14比例</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">NanoBanana Pro</span>
                        <span className="text-[10px] text-muted-foreground/60">高质量 · 10比例</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 border-t border-border/30 pt-2">
                    所有配置仅保存在本地浏览器中。下载路径由浏览器设置决定。
                  </p>
                </div>
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
