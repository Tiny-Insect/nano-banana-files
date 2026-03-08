import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGenerationStore, type ModelType, type GenerationTask } from "@/lib/generation-store";
import { getStorage } from "@/lib/storage-factory";
import { NANOBANANA2_RATIOS, NANOBANANA_PRO_RATIOS, RESOLUTIONS } from "@/lib/schema";
import { X, Loader2, Download, ImageIcon, Zap, Plus, Send, ChevronDown, Copy, Pencil, RefreshCw, Trash2, ArrowDown, AlertTriangle, Info, Globe, Brain } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import Layout, { loadSettings } from "@/components/Layout";

function getCustomApiHeaders(): Record<string, string> {
  const s = loadSettings();
  const headers: Record<string, string> = {};
  if (s.customApiUrl.trim()) headers["X-Custom-Api-Url"] = s.customApiUrl.trim();
  if (s.customApiKey.trim()) headers["X-Custom-Api-Key"] = s.customApiKey.trim();
  return headers;
}

async function callGenerateApi(body: Record<string, any>): Promise<any> {
  const customHeaders = getCustomApiHeaders();
  const { data, error } = await supabase.functions.invoke("generate", {
    body,
    headers: customHeaders,
  });
  if (error) throw error;

  if (data && data.error) return data;
  if (data && data.images) return data;

  const storage = getStorage();
  const images: string[] = [];
  const thumbnails: string[] = [];

  if (data?.candidates) {
    for (const candidate of data.candidates) {
      if (candidate?.finishReason === "SAFETY") {
        return { error: "请求被安全过滤器拦截，请尝试修改提示词" };
      }
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          const imgData = part.inlineData || part.inline_data;
          if (imgData?.data) {
            const mimeType = imgData.mimeType || imgData.mime_type || "image/png";
            const dataUrl = `data:${mimeType};base64,${imgData.data}`;
            try {
              const blob = await fetch(dataUrl).then(r => r.blob());
              const stored = await storage.saveGeneratedImage(blob, mimeType);
              images.push(stored.originalUrl);
              thumbnails.push(stored.thumbnailUrl);
            } catch {
              // Fallback to data URL if storage fails
              images.push(dataUrl);
              thumbnails.push(dataUrl);
            }
          }
        }
      }
    }
  }

  if (images.length > 0) return { images, thumbnails };
  return { error: "未返回图片", raw: data };
}

function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const [w, h] = ratio.split(":").map(Number);
  const maxSize = 22;
  const scale = maxSize / Math.max(w, h);
  const width = Math.max(Math.round(w * scale), 3);
  const height = Math.max(Math.round(h * scale), 3);
  return (
    <div className="flex items-center justify-center" style={{ width: 26, height: 26 }}>
      <div
        className={`rounded-[2px] ${active ? "border-2 border-primary" : "border border-muted-foreground/30"}`}
        style={{ width, height }}
      />
    </div>
  );
}

function BananaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 13c3.5-2 8-2 10 1a5.5 5.5 0 0 0 4-7c-3 1-7.5 2-14 6Z" />
      <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 4.01 9.33 5.15 17.89Z" />
    </svg>
  );
}

const MODEL_LABELS: Record<string, string> = {
  "nanobanana-2": "NanoBanana 2",
  "nanobanana-pro": "NanoBanana Pro",
};

function ModelToggle({ model, onChange }: { model: string; onChange: (m: ModelType) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btn1Ref = useRef<HTMLButtonElement>(null);
  const btn2Ref = useRef<HTMLButtonElement>(null);
  const [slider, setSlider] = useState({ left: 2, width: 0 });
  const [animPhase, setAnimPhase] = useState<"idle" | "squeeze" | "move" | "expand">("idle");
  const [direction, setDirection] = useState<"left" | "right">("right");
  const prevModelRef = useRef(model);
  const isPro = model === "nanobanana-pro";
  const [colorProgress, setColorProgress] = useState(isPro ? 1 : 0);
  const animFrameRef = useRef<number>(0);

  // Smooth color interpolation via requestAnimationFrame
  const targetColor = useRef(isPro ? 1 : 0);

  useEffect(() => {
    if (prevModelRef.current === model) return;
    const movingRight = model === "nanobanana-pro";
    setDirection(movingRight ? "right" : "left");
    prevModelRef.current = model;
    targetColor.current = movingRight ? 1 : 0;

    // Phase 1: Directional squeeze
    setAnimPhase("squeeze");

    // Start smooth color interpolation
    const startColor = colorProgress;
    const endColor = movingRight ? 1 : 0;
    const startTime = performance.now();
    const duration = 500; // total animation duration for color

    const animateColor = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setColorProgress(startColor + (endColor - startColor) * ease);
      if (t < 1) animFrameRef.current = requestAnimationFrame(animateColor);
    };
    animFrameRef.current = requestAnimationFrame(animateColor);

    setTimeout(() => {
      // Phase 2: move
      setAnimPhase("move");
      const activeRef = model === "nanobanana-2" ? btn1Ref : btn2Ref;
      if (activeRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const btnRect = activeRef.current.getBoundingClientRect();
        setSlider({ left: btnRect.left - containerRect.left, width: btnRect.width });
      }
      setTimeout(() => {
        // Phase 3: elastic expand
        setAnimPhase("expand");
        setTimeout(() => setAnimPhase("idle"), 280);
      }, 320);
    }, 140);

    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Initial position
  useEffect(() => {
    const activeRef = model === "nanobanana-2" ? btn1Ref : btn2Ref;
    if (activeRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = activeRef.current.getBoundingClientRect();
      setSlider({ left: btnRect.left - containerRect.left, width: btnRect.width });
    }
    setColorProgress(isPro ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Directional squeeze: compress toward movement direction
  const getSliderTransform = () => {
    if (animPhase === "squeeze") {
      // Squeeze toward the direction of travel
      if (direction === "right") return "scaleX(0.78) scaleY(0.9) translateX(8%)";
      return "scaleX(0.78) scaleY(0.9) translateX(-8%)";
    }
    if (animPhase === "expand") {
      // Overshoot expand from arrival side
      if (direction === "right") return "scaleX(1.06) scaleY(1.03) translateX(-1%)";
      return "scaleX(1.06) scaleY(1.03) translateX(1%)";
    }
    return "scaleX(1) scaleY(1) translateX(0)";
  };

  const sliderTransition =
    animPhase === "squeeze" ? "transform 140ms cubic-bezier(0.6, 0, 1, 0.8)" :
    animPhase === "move" ? "all 320ms cubic-bezier(0.4, 0, 0.15, 1)" :
    animPhase === "expand" ? "transform 280ms cubic-bezier(0, 0.6, 0.3, 1.3)" :
    "all 320ms cubic-bezier(0.4, 0, 0.2, 1)";

  // Smooth gradient background based on colorProgress
  // blue → teal → gold transition
  const blueH = 217, blueS = 91, blueL = 60;
  const goldH = 40, goldS = 92, goldL = 55;
  const midH = blueH + (goldH - blueH) * colorProgress;
  const midS = blueS + (goldS - blueS) * colorProgress;
  const midL = blueL + (goldL - blueL) * colorProgress;
  const sliderBg = `linear-gradient(135deg, hsl(${midH}, ${midS}%, ${midL}%), hsl(${midH + 8}, ${midS - 5}%, ${midL - 4}%))`;

  return (
    <div ref={containerRef} className="relative flex items-center bg-muted/30 rounded-md p-0.5 mr-0.5">
      <div
        className="absolute top-0.5 bottom-0.5 rounded"
        style={{
          left: slider.left,
          width: slider.width,
          background: sliderBg,
          transform: getSliderTransform(),
          transition: sliderTransition,
          transformOrigin: direction === "right" ? "right center" : "left center",
        }}
      />
      <button
        ref={btn1Ref}
        onClick={() => onChange("nanobanana-2")}
        className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
          model === "nanobanana-2" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        NanoBanana 2
      </button>
      <button
        ref={btn2Ref}
        onClick={() => onChange("nanobanana-pro")}
        className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
          model === "nanobanana-pro" ? "text-pro-accent-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <BananaIcon className="w-3.5 h-3.5" />
        NanoBanana Pro
      </button>
    </div>
  );
}

function TaskCard({ task, onUsePrompt, onUseRefImage, onClickImage, onReEdit, onReGenerate, onDelete }: {
  task: GenerationTask;
  onUsePrompt: (p: string) => void;
  onUseRefImage: (preview: string, base64: string, event?: any) => void;
  onClickImage: (src: string) => void;
  onReEdit: (task: GenerationTask) => void;
  onReGenerate: (task: GenerationTask) => void;
  onDelete: (task: GenerationTask) => void;
}) {
  const downloadImage = async (url: string, index: number) => {
    const s = loadSettings();
    const prefix = s.downloadPrefix || "LumenDust";
    try {
      const storage = getStorage();
      await storage.downloadImage(url, `${prefix}-${Date.now()}-${index}`);
    } catch {
      window.open(url, "_blank");
    }
  };

  const statusLabels: Record<string, string> = {
    creating: "任务创建中...",
    generating: "图片生成中...",
    downloading: "图片接收中...",
    complete: "生成完成",
    error: "生成失败",
  };

  const isFinished = task.status === "complete" || task.status === "error";
  const modelLabel = MODEL_LABELS[task.model] || task.model;

  return (
    <div className="mb-6 max-w-4xl">
      <div className="flex items-start gap-3 mb-3">
        {task.referenceImagePreviews.length > 0 && (
          <div className="flex gap-1.5 shrink-0">
            {task.referenceImagePreviews.map((preview, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-md overflow-hidden border border-border/40 cursor-pointer hover:border-primary/50 hover:scale-110 hover:shadow-lg active:scale-95 transition-all duration-200"
                onClick={(e) => onUseRefImage(preview, task.referenceImageBase64[i], e)}
                title="点击添加为参考图"
              >
                <img src={preview} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <div className="group/prompt flex-1 min-w-0 relative">
          {task.prompt && (
            <div className="relative rounded-lg px-3 py-2 cursor-default">
              {/* Always visible: clipped to 2 lines with fade */}
              <div className="prompt-fade-mask overflow-hidden max-h-[2.8em]">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {task.prompt}
                </p>
              </div>
              {/* Hover overlay: expands downward over images */}
              <div className="absolute left-0 right-0 top-0 z-20 rounded-lg px-3 py-2 bg-card/95 backdrop-blur-md border border-border/30 shadow-lg opacity-0 pointer-events-none group-hover/prompt:opacity-100 group-hover/prompt:pointer-events-auto transition-all duration-200 origin-top">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto custom-scrollbar">
                  {task.prompt}
                </p>
                <div className="flex items-center gap-0 mt-1.5">
                  <span className="text-[11px] text-muted-foreground/40">{modelLabel}</span>
                  <span className="text-muted-foreground/20 mx-1.5">|</span>
                  <span className="text-[11px] text-muted-foreground/40">{task.aspectRatio}</span>
                  <span className="text-muted-foreground/20 mx-1.5">|</span>
                  <span className="text-[11px] text-muted-foreground/40">{task.resolution.toUpperCase()}</span>
                  <span className="text-muted-foreground/20 mx-1.5">|</span>
                  <span className="group/info relative inline-flex items-center gap-1 cursor-default">
                    <span className="text-[11px] text-muted-foreground/40 group-hover/info:text-muted-foreground/70 transition-colors">详细信息</span>
                    <Info className="w-3 h-3 text-muted-foreground/30 group-hover/info:text-muted-foreground/60 transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1 z-50 w-56 p-3 rounded-lg border border-border/50 bg-popover shadow-xl opacity-0 scale-95 pointer-events-none group-hover/info:opacity-100 group-hover/info:scale-100 group-hover/info:pointer-events-auto transition-all duration-200 origin-bottom-left">
                      <div className="space-y-1.5">
                        {[
                          ["模型", modelLabel],
                          ["比例", task.aspectRatio],
                          ["分辨率", task.resolution.toUpperCase()],
                          ["联网搜索", task.webSearch ? "是" : "否"],
                          ...(task.model !== "nanobanana-pro" ? [["思考模式", task.thinkingLevel === "deep" ? "深度" : "快速"]] : []),
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground/60">{label}</span>
                            <span className="text-[11px] text-foreground/80">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </span>
                  <span className="flex-1" />
                  <button
                    onClick={() => onUsePrompt(task.prompt)}
                    className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded bg-primary/5 hover:bg-primary/10 transition-colors shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    使用提示词
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {task.status !== "complete" && task.status !== "error" ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: task.numImages }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/20 bg-card/40 flex flex-col items-center justify-center"
              style={{ width: 180, height: 180 }}
            >
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground/50">{statusLabels[task.status]}</p>
              {task.statusDetail && (
                <p className="text-[10px] text-muted-foreground/30 mt-1">{task.statusDetail}</p>
              )}
            </div>
          ))}
        </div>
      ) : task.status === "error" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-xs text-destructive/70">{task.error || "生成失败"}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {task.generatedImages.map((img, i) => {
            const src = img.startsWith("data:") || img.startsWith("http") ? img : `data:image/png;base64,${img}`;
            const thumbSrc = task.thumbnails?.[i] || src;
            const displaySrc = thumbSrc.startsWith("data:") || thumbSrc.startsWith("http") ? thumbSrc : `data:image/png;base64,${thumbSrc}`;
            return (
              <div
                key={i}
                className="group/img relative rounded-lg overflow-hidden bg-card/50 border border-border/20 hover:border-primary/30 transition-all duration-300"
                style={{ maxWidth: 180, boxShadow: "0 0 0 0 transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 16px 2px hsl(var(--primary) / 0.15), 0 0 6px 0 hsl(var(--primary) / 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; }}
              >
                <img
                  src={displaySrc}
                  alt={`生成 ${i + 1}`}
                  loading="lazy"
                  className="w-full h-auto cursor-pointer transition-transform duration-300 ease-out group-hover/img:scale-[1.04]"
                  onClick={() => onClickImage(src)}
                />
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-7 h-7"
                    onClick={(e) => { e.stopPropagation(); downloadImage(src, i); }}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFinished && (
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => onReEdit(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/30"
          >
            <Pencil className="w-3 h-3" />
            重新编辑
          </button>
          <button
            onClick={() => onReGenerate(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/30"
          >
            <RefreshCw className="w-3 h-3" />
            再次生成
          </button>
          <button
            onClick={() => onDelete(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border/30"
          >
            <Trash2 className="w-3 h-3" />
            删除
          </button>
        </div>
      )}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center cursor-pointer transition-all duration-200 ${visible ? "bg-black/80 backdrop-blur-sm" : "bg-black/0"}`}
      onClick={handleClose}
    >
      <img
        src={src}
        alt="放大预览"
        className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={handleClose}
        className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const store = useGenerationStore();
  const {
    model, setModel,
    prompt, setPrompt,
    referenceImages, setReferenceImages,
    referenceImagePreviews, setReferenceImagePreviews,
    aspectRatio, setAspectRatio,
    resolution, setResolution,
    numImages, setNumImages,
    webSearch, setWebSearch,
    thinkingLevel, setThinkingLevel,
    tasks, addTask, updateTask, setTasks,
    lightboxImage, setLightboxImage,
    visibleCount, loadMore, hasMore, clearOldTasks,
  } = store;

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<GenerationTask | null>(null);
  const [flyingImage, setFlyingImage] = useState<{ src: string; x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const isAtBottomRef = useRef(true);
  const prevTaskCountRef = useRef(tasks.length);
  const prevLastTaskRef = useRef<string | null>(null);
  const isPro = model === "nanobanana-pro";
  const accentActiveClass = isPro ? "text-pro-accent bg-pro-accent/10" : "text-primary bg-primary/10";

  useEffect(() => {
    requestAnimationFrame(() => {
      feedEndRef.current?.scrollIntoView();
    });
  }, []);

  useEffect(() => {
    const newCount = tasks.length;
    const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
    const lastTaskKey = lastTask ? `${lastTask.id}-${lastTask.status}-${lastTask.generatedImages.length}` : null;

    if (newCount > prevTaskCountRef.current) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isAtBottomRef.current && lastTaskKey !== prevLastTaskRef.current && newCount === prevTaskCountRef.current) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTaskCountRef.current = newCount;
    prevLastTaskRef.current = lastTaskKey;
  }, [tasks]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        isAtBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
      }, 50);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const [ratioOpen, setRatioOpen] = useState(false);

  const currentRatios = model === "nanobanana-2" ? [...NANOBANANA2_RATIOS] : [...NANOBANANA_PRO_RATIOS];

  const handleModelChange = useCallback((newModel: ModelType) => {
    setModel(newModel);
    const newRatios = newModel === "nanobanana-2" ? NANOBANANA2_RATIOS : NANOBANANA_PRO_RATIOS;
    if (!newRatios.includes(aspectRatio as any)) {
      setAspectRatio("9:16");
    }
  }, [aspectRatio, setModel, setAspectRatio]);

  const uploadImageToStorage = useCallback(async (file: File): Promise<string> => {
    const storage = getStorage();
    return storage.saveReferenceImage(file);
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "请上传图片文件", variant: "destructive" });
      return;
    }
    if (referenceImages.length >= 10) {
      toast({ title: "最多上传10张参考图", variant: "destructive" });
      return;
    }
    try {
      toast({ title: "正在上传参考图..." });
      const url = await uploadImageToStorage(file);
      setReferenceImagePreviews((prev) => [...prev, url]);
      setReferenceImages((prev) => [...prev, url]);
    } catch (err: any) {
      toast({ title: err.message || "上传失败", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [referenceImages.length, toast, setReferenceImages, setReferenceImagePreviews, uploadImageToStorage]);

  const removeImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferenceImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }, [setReferenceImages, setReferenceImagePreviews]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const remaining = 10 - referenceImages.length;
    const toUpload = files.slice(0, remaining);
    for (const file of toUpload) {
      try {
        toast({ title: "正在上传参考图..." });
        const url = await uploadImageToStorage(file);
        setReferenceImagePreviews((prev) => [...prev, url]);
        setReferenceImages((prev) => [...prev, url]);
      } catch (err: any) {
        toast({ title: err.message || "上传失败", variant: "destructive" });
      }
    }
  }, [referenceImages.length, toast, setReferenceImages, setReferenceImagePreviews, uploadImageToStorage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }
  }, []);

  useEffect(() => { autoResize(); }, [prompt, autoResize]);

  const canGenerate = prompt.trim().length > 0 || referenceImages.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast({ title: "请输入提示词或上传参考图", variant: "destructive" });
      return;
    }

    const taskId = `task-${Date.now()}`;
    const task: GenerationTask = {
      id: taskId,
      prompt: prompt.trim(),
      referenceImagePreviews: [...referenceImagePreviews],
      referenceImageBase64: [...referenceImages],
      model,
      aspectRatio,
      resolution,
      numImages,
      status: "creating",
      generatedImages: [],
      thumbnails: [],
      createdAt: Date.now(),
      webSearch,
      thinkingLevel,
    };

    addTask(task);

    // Clear input
    setPrompt("");
    setReferenceImages([]);
    setReferenceImagePreviews([]);

    const bodyToSend: Record<string, any> = {
      model,
      prompt: task.prompt,
      aspect_ratio: aspectRatio,
      resolution,
      num_images: numImages,
      web_search: !!webSearch,
      thinking_level: thinkingLevel || "fast",
      image_urls: task.referenceImageBase64.length > 0 ? task.referenceImageBase64 : [],
    };

    try {
      updateTask(taskId, { status: "creating", statusDetail: "正在提交请求..." });
      await new Promise((r) => setTimeout(r, 300));

      // Gemini generateContent only returns 1 image per call.
      // For multiple images, call API multiple times in parallel.
      const count = numImages || 1;
      updateTask(taskId, { status: "generating", statusDetail: `正在生成 ${count} 张图片...` });

      const promises = Array.from({ length: count }, () => callGenerateApi(bodyToSend));
      const results = await Promise.allSettled(promises);

      const allImages: string[] = [];
      const allThumbs: string[] = [];
      let lastError = "";
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.images) {
          allImages.push(...r.value.images);
          allThumbs.push(...(r.value.thumbnails || r.value.images));
        } else if (r.status === "fulfilled" && r.value.error) {
          lastError = r.value.error;
        } else if (r.status === "rejected") {
          lastError = r.reason?.message || "生成失败";
        }
      }

      updateTask(taskId, { status: "downloading", statusDetail: "正在接收图片数据..." });

      if (allImages.length > 0) {
        updateTask(taskId, { status: "complete", generatedImages: allImages, thumbnails: allThumbs, completedAt: Date.now() });
      } else {
        updateTask(taskId, { status: "error", error: lastError || "未返回图片", completedAt: Date.now() });
      }
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("429")) {
        updateTask(taskId, { status: "error", error: "请求过于频繁，请稍等几秒后再试" });
      } else {
        updateTask(taskId, { status: "error", error: msg || "生成失败" });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canGenerate) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleUsePrompt = (p: string) => {
    setPrompt(p);
    toast({ title: "已复制提示词" });
  };

  const handleUseRefImage = (preview: string, base64: string, event?: MouseEvent) => {
    if (referenceImages.length >= 10) {
      toast({ title: "最多上传10张参考图", variant: "destructive" });
      return;
    }
    if (event) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setFlyingImage({ src: preview, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setTimeout(() => setFlyingImage(null), 500);
    }
    setReferenceImagePreviews((prev) => [...prev, preview]);
    setReferenceImages((prev) => [...prev, base64]);
    toast({ title: "已添加参考图" });
  };

  const handleReEdit = (task: GenerationTask) => {
    setPrompt(task.prompt);
    setModel(task.model);
    setAspectRatio(task.aspectRatio);
    setResolution(task.resolution);
    setNumImages(task.numImages);
    if (task.referenceImagePreviews.length > 0) {
      setReferenceImagePreviews([...task.referenceImagePreviews]);
      const refBase64 = task.referenceImageBase64.length > 0
        ? [...task.referenceImageBase64]
        : task.referenceImagePreviews.map((p) => {
            const match = p.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
            return match ? match[1] : p;
          }).filter(Boolean);
      setReferenceImages(refBase64);
    }
    toast({ title: "已加载任务参数到编辑区" });
  };

  const handleReGenerate = async (task: GenerationTask) => {
    const taskId = `task-${Date.now()}`;

    let refBase64 = task.referenceImageBase64.length > 0
      ? [...task.referenceImageBase64]
      : task.referenceImagePreviews.map((p) => {
          const match = p.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/);
          return match ? match[1] : p;
        }).filter(Boolean);

    const reWebSearch = task.webSearch ?? webSearch;
    const reThinkingLevel = task.thinkingLevel ?? thinkingLevel;
    const newTask: GenerationTask = {
      id: taskId,
      prompt: task.prompt,
      referenceImagePreviews: [...task.referenceImagePreviews],
      referenceImageBase64: refBase64,
      model: task.model,
      aspectRatio: task.aspectRatio,
      resolution: task.resolution,
      numImages: task.numImages,
      status: "creating",
      generatedImages: [],
      thumbnails: [],
      createdAt: Date.now(),
      webSearch: reWebSearch,
      thinkingLevel: reThinkingLevel,
    };
    addTask(newTask);

    const bodyToSend: Record<string, any> = {
      model: task.model,
      prompt: task.prompt,
      aspect_ratio: task.aspectRatio,
      resolution: task.resolution,
      num_images: task.numImages,
      web_search: !!reWebSearch,
      thinking_level: reThinkingLevel || "fast",
      image_urls: refBase64,
    };

    try {
      updateTask(taskId, { status: "creating", statusDetail: "正在提交请求..." });
      await new Promise((r) => setTimeout(r, 300));

      const count = task.numImages || 1;
      updateTask(taskId, { status: "generating", statusDetail: `正在生成 ${count} 张图片...` });

      const promises = Array.from({ length: count }, () => callGenerateApi(bodyToSend));
      const results = await Promise.allSettled(promises);

      const allImages: string[] = [];
      const allThumbs: string[] = [];
      let lastError = "";
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.images) {
          allImages.push(...r.value.images);
          allThumbs.push(...(r.value.thumbnails || r.value.images));
        } else if (r.status === "fulfilled" && r.value.error) {
          lastError = r.value.error;
        } else if (r.status === "rejected") {
          lastError = r.reason?.message || "生成失败";
        }
      }

      updateTask(taskId, { status: "downloading", statusDetail: "正在接收图片数据..." });

      if (allImages.length > 0) {
        updateTask(taskId, { status: "complete", generatedImages: allImages, thumbnails: allThumbs, completedAt: Date.now() });
      } else {
        updateTask(taskId, { status: "error", error: lastError || "未返回图片", completedAt: Date.now() });
      }
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("429")) {
        updateTask(taskId, { status: "error", error: "请求过于频繁，请稍等几秒后再试" });
      } else {
        updateTask(taskId, { status: "error", error: msg || "生成失败" });
      }
    }
  };

  const handleDeleteTask = (task: GenerationTask) => {
    setDeleteConfirmTask(task);
  };

  const confirmDelete = async () => {
    const task = deleteConfirmTask;
    if (!task) return;
    setDeleteConfirmTask(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast({ title: "已删除任务" });
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 overflow-hidden relative">
        <div ref={feedRef} className="flex-1 py-6 pb-48 overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
          {tasks.length > 0 ? (
            <div className="mt-auto">
              {hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={loadMore}
                    className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30"
                  >
                    加载更早的任务 ({tasks.length - visibleCount} 条隐藏)
                  </button>
                </div>
              )}
              {tasks.length > 50 && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={() => { clearOldTasks(30); toast({ title: "已清理旧任务" }); }}
                    className="px-3 py-1 rounded-md text-[10px] text-muted-foreground/40 hover:text-destructive/70 transition-colors"
                  >
                    清理旧缓存 (保留最近30条)
                  </button>
                </div>
              )}
              {tasks.slice(-visibleCount).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUsePrompt={handleUsePrompt}
                  onUseRefImage={handleUseRefImage}
                  onClickImage={setLightboxImage}
                  onReEdit={handleReEdit}
                  onReGenerate={handleReGenerate}
                  onDelete={handleDeleteTask}
                />
              ))}
              <div ref={feedEndRef} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[300px]">
              <ImageIcon className="w-10 h-10 mb-3 opacity-15" />
              <p className="text-xs opacity-40">生成的图片将在这里展示</p>
            </div>
          )}
        </div>

        {!isAtBottom && tasks.length > 0 && (
          <div className="absolute bottom-56 left-0 right-0 flex justify-center z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              回到底部
            </button>
          </div>
        )}

        <div
          className="fixed bottom-0 left-0 right-0 px-6 pb-5 z-30"
        >
          <div className="max-w-3xl mx-auto">
          <TooltipProvider delayDuration={300}>
          <div 
            className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl shadow-xl transition-colors duration-500"
            style={isPro ? { borderColor: "hsl(var(--pro-accent) / 0.15)" } : undefined}
          >
              <>
                <div className="flex items-start gap-3 p-5 pb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    multiple
                  />

                  <div className="shrink-0 flex items-end">
                    <div className="flex items-end gap-1">
                      {referenceImagePreviews.map((preview, i) => (
                        <div
                          key={i}
                          className="relative shrink-0 rounded-lg overflow-hidden border border-border/40 transition-all duration-300 ease-out cursor-pointer group/img"
                          style={{
                            width: 44,
                            height: 58,
                            marginLeft: i > 0 ? -8 : 0,
                            zIndex: i,
                            transform: "rotate(-15deg)",
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            el.style.width = "52px";
                            el.style.height = "68px";
                            el.style.zIndex = "20";
                            el.style.transform = "rotate(-12deg) scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            el.style.width = "44px";
                            el.style.height = "58px";
                            el.style.zIndex = String(i);
                            el.style.transform = "rotate(-15deg)";
                          }}
                        >
                          <img
                            src={preview}
                            alt=""
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setLightboxImage(preview)}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                            className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white rounded-bl-sm flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {referenceImages.length < 10 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          className={`flex flex-col items-center justify-center rounded-lg border border-dashed shrink-0 transition-all duration-300 ${
                            isDragOver
                              ? "border-primary bg-primary/10 scale-110"
                              : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:scale-105"
                          }`}
                          style={{
                            width: 44,
                            height: 58,
                            marginLeft: referenceImagePreviews.length > 0 ? -2 : 0,
                            transform: "rotate(-15deg)",
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 text-muted-foreground/30" />
                          <span className="text-[8px] text-muted-foreground/25 mt-0.5 leading-none">参考图</span>
                        </button>
                      )}
                    </div>
                  </div>

                   <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入提示词...  Ctrl+Enter 发送"
                    className="flex-1 bg-transparent border-0 outline-none resize-none text-base min-h-[72px] max-h-[180px] py-3 text-foreground placeholder:text-muted-foreground/30 overflow-y-auto transition-[height] duration-200 ease-out custom-scrollbar font-sans tracking-wide leading-relaxed"
                    rows={2}
                  />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        size="icon"
                        className="shrink-0 mt-1 rounded-lg w-11 h-11 transition-all duration-500"
                        style={isPro ? {
                          background: "linear-gradient(135deg, hsl(var(--pro-accent)), hsl(var(--pro-accent) / 0.85))",
                        } : undefined}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      发送 <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Enter</kbd>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="border-t border-border/15 px-5 py-3 flex flex-wrap items-center gap-3 font-sans tracking-wide">
                  <ModelToggle model={model} onChange={handleModelChange} />

                  <span className="w-px h-6 bg-border/20" />

                  <Popover open={ratioOpen} onOpenChange={setRatioOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground tracking-wide">
                        <RatioIcon ratio={aspectRatio} active={false} />
                        {aspectRatio}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2.5 bg-card/80 backdrop-blur-xl border-border/30 shadow-2xl animate-in zoom-in-95 fade-in duration-200" align="start">
                      <div className="flex flex-wrap gap-1" style={{ maxWidth: 360 }}>
                        {currentRatios.map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => { setAspectRatio(ratio); setRatioOpen(false); }}
                            className={`flex flex-col items-center gap-0.5 w-12 py-1.5 rounded-md text-[10px] font-medium tracking-wide transition-all duration-200 ${
                              aspectRatio === ratio
                                ? (isPro ? "bg-pro-accent/15 text-pro-accent" : "bg-primary/15 text-primary")
                                : "text-muted-foreground hover:bg-muted/50 hover:scale-105"
                            }`}
                          >
                            <RatioIcon ratio={ratio} active={aspectRatio === ratio} />
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground tracking-wide">
                        {resolution.toUpperCase()}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1.5 min-w-[80px] bg-card/80 backdrop-blur-xl border-border/30 shadow-2xl animate-in zoom-in-95 fade-in duration-200" align="start">
                      <div className="flex flex-col gap-0.5">
                        {RESOLUTIONS.map((r) => (
                          <button
                            key={r}
                            onClick={() => setResolution(r)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium text-left transition-colors tracking-wide ${
                              resolution === r ? (isPro ? "bg-pro-accent/15 text-pro-accent" : "bg-primary/15 text-primary") : "text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            {r.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground tracking-wide">
                        {numImages} 张
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1.5 min-w-[70px] bg-card/80 backdrop-blur-xl border-border/30 shadow-2xl animate-in zoom-in-95 fade-in duration-200" align="start">
                      <div className="flex flex-col gap-0.5">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            onClick={() => setNumImages(n)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium text-left transition-colors tracking-wide ${
                              numImages === n ? (isPro ? "bg-pro-accent/15 text-pro-accent" : "bg-primary/15 text-primary") : "text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            {n} 张
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <button
                    onClick={() => setWebSearch(!webSearch)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-300 tracking-wide ${
                      webSearch
                        ? accentActiveClass
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    title="联网搜索"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    联网
                  </button>

                  {model !== "nanobanana-pro" && (
                    <button
                      onClick={() => setThinkingLevel(thinkingLevel === "deep" ? "none" : "deep")}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-300 tracking-wide ${
                        thinkingLevel === "deep"
                          ? accentActiveClass
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                      title="深度思考"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      思考
                    </button>
                  )}

                  <span className="w-px h-6 bg-border/20" />
                </div>
              </>
          </div>
          </TooltipProvider>
          </div>
        </div>
      </div>

      {deleteConfirmTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setDeleteConfirmTask(null)}>
          <div className="bg-card border border-border/50 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">确认删除</p>
                <p className="text-xs text-muted-foreground mt-0.5">删除后无法找回，包括关联的生成图片</p>
              </div>
            </div>
            {deleteConfirmTask.prompt && (
              <p className="text-xs text-muted-foreground/70 bg-muted/30 rounded-md px-3 py-2 mb-4 truncate">
                "{deleteConfirmTask.prompt}"
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={() => setDeleteConfirmTask(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={confirmDelete}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {flyingImage && (
        <div
          className="fixed z-[200] w-10 h-10 rounded-md overflow-hidden border-2 border-primary/50 shadow-lg pointer-events-none"
          style={{
            left: flyingImage.x - 20,
            top: flyingImage.y - 20,
            animation: "flyToBottom 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          <img src={flyingImage.src} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <style>{`
        @keyframes flyToBottom {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.7) translateY(40vh); opacity: 0.8; }
          100% { transform: scale(0.3) translateY(80vh); opacity: 0; }
        }
      `}</style>

      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </Layout>
  );
}
