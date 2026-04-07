import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, Info, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { type AppSettings, loadSettings, saveSettings } from "@/components/Layout";
import { testImageApiConnection } from "@/lib/api";
import { formatAssistantErrorMessage, getAssistantRuntimeInfo, testAssistantConnection } from "@/lib/assistant-api";
import { appLog, appLogError } from "@/lib/app-log";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiInfoOpen, setApiInfoOpen] = useState(false);
  const [cacheInfoOpen, setCacheInfoOpen] = useState(false);
  const [testingAssistant, setTestingAssistant] = useState(false);
  const [assistantTestMessage, setAssistantTestMessage] = useState("");
  const [testingImageApi, setTestingImageApi] = useState(false);
  const [imageApiTestMessage, setImageApiTestMessage] = useState("");
  const [updateStatus, setUpdateStatus] = useState<any>(null);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (!electron?.getUpdateStatus) return;
    electron.getUpdateStatus().then(setUpdateStatus).catch(() => {});
    const unsubscribe = electron.onUpdateStatus?.((payload: any) => setUpdateStatus(payload));
    return () => unsubscribe?.();
  }, []);

  const runtimeInfo = getAssistantRuntimeInfo(settings);

  const handleSave = () => {
    appLog("settings.save");
    saveSettings(settings);
    setSaved(true);
    window.dispatchEvent(new Event("settings-updated"));
    setTimeout(() => setSaved(false), 1500);
  };

  const clearApiSettings = () => {
    setSettings({
      ...settings,
      customApiUrl: "",
      customApiKey: "",
      assistantApiUrl: "",
      assistantApiKey: "",
      assistantModel: "",
    });
    setAssistantTestMessage("");
    setImageApiTestMessage("");
  };

  const sectionClass = "rounded-2xl bg-background/55 backdrop-blur-md shadow-sm ring-1 ring-border/20 p-5 space-y-3";
  const labelClass = "text-xs text-muted-foreground mb-1 block";
  const inputClass = "w-full h-9 px-3 rounded-xl bg-muted/25 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none ring-1 ring-border/15 focus:ring-primary/35 transition";

  return (
    <>
      {(apiInfoOpen || cacheInfoOpen) && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none" />
      )}

      <div className="space-y-4 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <div className={sectionClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1">
                  <div>
                    <p className="text-sm font-medium">图片 API</p>
                    {imageApiTestMessage && <p className="text-[11px] text-muted-foreground mt-1">{imageApiTestMessage}</p>}
                  </div>
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
                          <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">https://generativelanguage.googleapis.com</code>
                          <p className="mt-1">完整支持：联网搜索、思考模式、所有比例和分辨率</p>
                        </div>
                        <div className="border-t border-border/30 pt-2">
                          <p className="font-medium text-foreground/80">🔸 第三方代理 API</p>
                          <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded block mt-1 break-all">https://xxx.com/v1</code>
                          <p className="mt-1">使用 OpenAI 兼容格式。联网搜索、思考模式可能不支持，比例/分辨率取决于代理商的适配程度。</p>
                        </div>
                        <div className="border-t border-border/30 pt-2">
                          <p className="font-medium text-foreground/80">🖼 参考图限制</p>
                          <p className="mt-1">最多 10 张；单张不超过 40MB；单次批量总大小不超过 120MB。</p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={testingImageApi}
                    onClick={async () => {
                      setTestingImageApi(true);
                      setImageApiTestMessage("");
                      try {
                        const result = await testImageApiConnection(settings);
                        setImageApiTestMessage(result.message);
                        appLog("settings.testImageApi success");
                      } catch (error: any) {
                        appLogError("settings.testImageApi", error);
                        setImageApiTestMessage(error?.message || "图片 API 连接失败");
                      } finally {
                        setTestingImageApi(false);
                      }
                    }}
                  >
                    {testingImageApi ? "测试中..." : "测试图片 API"}
                  </Button>
                  {(settings.customApiUrl || settings.customApiKey || settings.assistantApiUrl || settings.assistantApiKey || settings.assistantModel) && (
                    <button
                      onClick={clearApiSettings}
                      className="flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                      title="清空图片和助手的 API 配置"
                    >
                      <Trash2 className="w-3 h-3" />清空
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>图片 API URL</label>
                <input type="text" value={settings.customApiUrl} onChange={(e) => setSettings({ ...settings, customApiUrl: e.target.value })} placeholder="例: https://generativelanguage.googleapis.com" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>图片 API Key</label>
                <div className="relative">
                  <input type={showKey ? "text" : "password"} value={settings.customApiKey} onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })} placeholder="填入你的 API 密钥" className={`${inputClass} pr-8 font-mono`} />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-muted/18 ring-1 ring-border/15 px-3 py-2 text-[11px] text-muted-foreground">
                图片接口建议优先配置可直接稳定出图的 URL / Key。对话助手可以独立配置，也可以复用这一套凭据。
              </div>
            </div>

            <div className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">对话助手</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={testingAssistant}
                  onClick={async () => {
                    setTestingAssistant(true);
                    setAssistantTestMessage("");
                    try {
                      const result = await testAssistantConnection(undefined, settings);
                      appLog("settings.testAssistant success");
                      setAssistantTestMessage(`已连接：${result.provider} / ${result.model}`);
                    } catch (error) {
                      appLogError("settings.testAssistant", error);
                      setAssistantTestMessage(formatAssistantErrorMessage(error, settings));
                    } finally {
                      setTestingAssistant(false);
                    }
                  }}
                >
                  {testingAssistant ? "测试中..." : "测试助手连接"}
                </Button>
              </div>

              <div>
                <label className={labelClass}>助手 API URL</label>
                <input type="text" value={settings.assistantApiUrl} onChange={(e) => setSettings({ ...settings, assistantApiUrl: e.target.value })} placeholder="留空则复用图片 URL/Key 配置" className={inputClass} />
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">留空时，助手会借用上面的 URL/Key 配置去调用文本模型，不是去调用图片模型。</p>
              </div>

              <div>
                <label className={labelClass}>助手 API Key</label>
                <input type={showKey ? "text" : "password"} value={settings.assistantApiKey} onChange={(e) => setSettings({ ...settings, assistantApiKey: e.target.value })} placeholder="留空则复用图片 Key 配置" className={`${inputClass} font-mono`} />
              </div>

              <div>
                <label className={labelClass}>助手模型名</label>
                <input type="text" value={settings.assistantModel} onChange={(e) => setSettings({ ...settings, assistantModel: e.target.value })} placeholder="留空则使用适配器默认模型" className={inputClass} />
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">例如：`kimi-k2.5`、`MiniMax-M2.7`、`gpt-5.4`、`gpt-5-codex`、`gemini-3.1-pro`</p>
              </div>

              <div className="rounded-xl bg-muted/18 ring-1 ring-border/15 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                <div>当前识别：{runtimeInfo.provider} / {runtimeInfo.configuredModel}</div>
                <div>{runtimeInfo.message}</div>
                {assistantTestMessage && <div>{assistantTestMessage}</div>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={sectionClass}>
              <p className="text-sm font-medium">下载设置</p>
              <div>
                <label className={labelClass}>文件名前缀</label>
                <input type="text" value={settings.downloadPrefix} onChange={(e) => setSettings({ ...settings, downloadPrefix: e.target.value })} placeholder="LumenDust" className={inputClass} />
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">下载文件名格式：{settings.downloadPrefix || "LumenDust"}-时间戳.{settings.downloadFormat || "png"}</p>
              </div>
              <div>
                <label className={labelClass}>图片格式</label>
                <div className="flex gap-1 flex-wrap">
                  {["png", "jpg", "webp"].map((fmt) => (
                    <button key={fmt} onClick={() => setSettings({ ...settings, downloadFormat: fmt })} className={`px-3 py-1 rounded-xl text-xs transition-colors ${settings.downloadFormat === fmt ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>下载保存路径</label>
                <div className="flex gap-1">
                  <input type="text" value={settings.downloadPath || ""} onChange={(e) => setSettings({ ...settings, downloadPath: e.target.value })} placeholder="留空则默认保存到 LumenDust Download" className={`${inputClass} flex-1 font-mono`} />
                  {(window as any).electronAPI && (
                    <button onClick={async () => {
                      const dir = await (window as any).electronAPI.selectFolder("选择下载保存路径");
                      if (dir) setSettings({ ...settings, downloadPath: dir });
                    }} className="h-9 px-3 rounded-xl bg-muted/25 ring-1 ring-border/15 text-xs text-muted-foreground hover:bg-muted/40 transition-colors whitespace-nowrap">浏览…</button>
                  )}
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium">缓存与本地存储</p>
                  <Popover open={cacheInfoOpen} onOpenChange={setCacheInfoOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors cursor-pointer">
                        <Info className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 text-[11px] bg-card/90 backdrop-blur-2xl border-border/40 shadow-2xl relative z-[200]" align="start" side="bottom">
                      <p className="font-medium mb-2 text-xs">缓存说明</p>
                      <div className="space-y-2 text-muted-foreground">
                        <p>桌面版会将生成原图保存在本地缓存路径中，用于资产库、放大查看和再次编辑；缩略图和预览文件用于加速浏览。</p>
                        <p>清理缓存只删除可再生的缩略图和预览文件，不会删除生成原图。任务记录、提示词和本地资产会保留。</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {(window as any).electronAPI?.getUpdateStatus && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window as any).electronAPI.checkForUpdates?.()}>
                      检查更新
                    </Button>
                    {updateStatus?.status === "available" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window as any).electronAPI.downloadUpdate?.()}>
                        下载更新
                      </Button>
                    )}
                    {updateStatus?.status === "downloaded" && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => (window as any).electronAPI.installUpdate?.()}>
                        安装更新
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {updateStatus?.message && <p className="text-[11px] text-muted-foreground">{updateStatus.message}</p>}
              {updateStatus?.status === "downloaded" && (
                <p className="text-[11px] text-primary">更新包已经准备好，点击上方“安装更新”即可退出并完成安装。</p>
              )}

              <div>
                <label className={labelClass}>缓存路径</label>
                <div className="flex gap-1">
                  <input type="text" value={settings.cachePath || ""} onChange={(e) => setSettings({ ...settings, cachePath: e.target.value })} placeholder={(window as any).electronAPI ? "留空则使用默认应用数据目录" : "桌面版可配置，网页版使用浏览器缓存"} className={`${inputClass} flex-1 font-mono`} />
                  {(window as any).electronAPI && (
                    <button onClick={async () => {
                      const dir = await (window as any).electronAPI.selectFolder("选择缓存路径");
                      if (dir) setSettings({ ...settings, cachePath: dir });
                    }} className="h-9 px-3 rounded-xl bg-muted/25 ring-1 ring-border/15 text-xs text-muted-foreground hover:bg-muted/40 transition-colors whitespace-nowrap">浏览…</button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">默认目录将包含 chat、thumbnails、originals 和 LumenDust Download。</p>
              </div>

              <div>
                <label className={labelClass}>最大缓存 (MB)</label>
                <input type="number" value={settings.maxCacheMB ?? ""} onChange={(e) => setSettings({ ...settings, maxCacheMB: e.target.value ? parseInt(e.target.value) : null })} placeholder="留空表示无限制" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        <Button size="sm" className="w-full h-9 text-xs rounded-xl" onClick={handleSave}>
          {saved ? <><Check className="w-3 h-3 mr-1" />已保存</> : "保存配置"}
        </Button>

        <p className="text-[10px] text-muted-foreground/50 text-center border-t border-border/30 pt-3">
          所有配置保存在本地。助手对话现在会优先写入桌面版的 chat 目录，并保留浏览器侧兜底持久化。
        </p>
      </div>
    </>
  );
}
