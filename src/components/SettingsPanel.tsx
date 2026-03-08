import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { type AppSettings, loadSettings, saveSettings } from "@/components/Layout";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiInfoOpen, setApiInfoOpen] = useState(false);
  const [cacheInfoOpen, setCacheInfoOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    window.dispatchEvent(new Event("settings-updated"));
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      {(apiInfoOpen || cacheInfoOpen) && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none" />
      )}
      <div className="space-y-3">
        <p className="text-sm font-medium">API 配置</p>
        <div className="space-y-2">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs text-muted-foreground">API URL</label>
              <Popover open={apiInfoOpen} onOpenChange={setApiInfoOpen}>
                <PopoverTrigger asChild>
                  <button className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors cursor-pointer">
                    <Info className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 text-[11px] bg-card/90 backdrop-blur-2xl border-border/40 shadow-2xl relative z-[200]" align="start" side="bottom">
                  <p className="font-medium mb-2 text-xs">API URL 说明</p>
                  <div className="space-y-2 text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground/80">🔹 官方 Google API</p>
                      <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">
                        https://generativelanguage.googleapis.com
                      </code>
                      <p className="mt-1">完整支持：联网搜索、思考模式、所有比例和分辨率</p>
                    </div>
                    <div className="border-t border-border/30 pt-2">
                      <p className="font-medium text-foreground/80">🔸 第三方代理 API</p>
                      <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">
                        https://xxx.com/v1
                      </code>
                      <p className="mt-1">使用 OpenAI 兼容格式。联网搜索、思考模式可能不支持，比例/分辨率取决于代理商的适配程度。</p>
                    </div>
                    <p className="text-muted-foreground/60 border-t border-border/30 pt-2">
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
            <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
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
          <p className="text-sm font-medium mb-2">下载设置</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">文件名前缀</label>
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
              <label className="text-xs text-muted-foreground mb-1 block">图片格式</label>
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

        <div className="border-t border-border/30 pt-3">
          <div className="flex items-center gap-1 mb-2">
            <p className="text-sm font-medium">缓存设置</p>
            <Popover open={cacheInfoOpen} onOpenChange={setCacheInfoOpen}>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors cursor-pointer">
                  <Info className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 text-[11px] bg-card/90 backdrop-blur-2xl border-border/40 shadow-2xl relative z-[200]" align="start" side="bottom">
                <p className="font-medium mb-2 text-xs">缓存说明</p>
                <div className="space-y-2 text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground/80">🔹 缓存策略</p>
                    <p className="mt-1">生成的图片会自动缓存缩略图用于快速浏览。原图保存在云端，需要时按需加载。</p>
                  </div>
                  <div className="border-t border-border/30 pt-2">
                    <p className="font-medium text-foreground/80">🔸 清理缓存</p>
                    <p className="mt-1">清理缓存只删除本地文件副本。任务记录、提示词和云端 URL 会保留，可随时重新加载。</p>
                  </div>
                  <div className="border-t border-border/30 pt-2">
                    <p className="font-medium text-foreground/80">📁 下载路径</p>
                    <p className="mt-1">网页版由浏览器决定下载位置。桌面 App 版本中可指定保存路径，已下载的文件永远不会被自动清理。</p>
                  </div>
                  <p className="text-muted-foreground/60 border-t border-border/30 pt-2">
                    ⚠️ 最大缓存留空表示不限制。建议桌面端设置合理上限以节省磁盘空间。
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">下载保存路径</label>
              <input
                type="text"
                value={settings.downloadPath || ""}
                onChange={(e) => setSettings({ ...settings, downloadPath: e.target.value })}
                placeholder="留空则由浏览器/系统决定"
                className="w-full h-8 px-2 rounded-md border border-border/50 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">最大缓存 (MB)</label>
              <input
                type="number"
                value={settings.maxCacheMB ?? ""}
                onChange={(e) => setSettings({ ...settings, maxCacheMB: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="留空表示无限制"
                className="w-full h-8 px-2 rounded-md border border-border/50 bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/30 pt-2">
          <p className="text-sm font-medium mb-1.5">模型</p>
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
          所有配置保存在本地。点击缓存设置旁的 ℹ️ 了解详情。
        </p>
      </div>
    </>
  );
}
