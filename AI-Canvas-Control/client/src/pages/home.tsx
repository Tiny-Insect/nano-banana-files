import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useGenerationStore, type ModelType, type GenerationTask } from "@/lib/generation-store";
import { NANOBANANA2_RATIOS, NANOBANANA_PRO_RATIOS, RESOLUTIONS } from "@shared/schema";
import { X, Loader2, Download, ImageIcon, Sparkles, Zap, Plus, Send, ChevronDown, Copy, Pencil, RefreshCw, Trash2, ArrowDown, AlertTriangle, Info } from "lucide-react";
import Layout from "@/components/layout";
import { loadSettings } from "@/components/layout";

function getCustomApiHeaders(): Record<string, string> {
  const s = loadSettings();
  const headers: Record<string, string> = {};
  if (s.customApiUrl.trim()) headers["X-Custom-Api-Url"] = s.customApiUrl.trim();
  if (s.customApiKey.trim()) headers["X-Custom-Api-Key"] = s.customApiKey.trim();
  return headers;
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

const MODEL_LABELS: Record<string, string> = {
  "nanobanana-2": "NanoBanana 2",
  "nanobanana-pro": "NanoBanana Pro",
};

function ModelToggle({ model, onChange }: { model: string; onChange: (m: ModelType) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btn1Ref = useRef<HTMLButtonElement>(null);
  const btn2Ref = useRef<HTMLButtonElement>(null);
  const [slider, setSlider] = useState({ left: 2, width: 0 });

  useEffect(() => {
    const activeRef = model === "nanobanana-2" ? btn1Ref : btn2Ref;
    if (activeRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = activeRef.current.getBoundingClientRect();
      setSlider({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [model]);

  return (
    <div ref={containerRef} className="relative flex items-center bg-muted/30 rounded-md p-0.5 mr-0.5">
      <div
        className="absolute top-0.5 bottom-0.5 rounded bg-primary transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ left: slider.left, width: slider.width }}
      />
      <button
        ref={btn1Ref}
        onClick={() => onChange("nanobanana-2")}
        data-testid="button-model-nanobanana2"
        className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
          model === "nanobanana-2" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        NanoBanana 2
      </button>
      <button
        ref={btn2Ref}
        onClick={() => onChange("nanobanana-pro")}
        data-testid="button-model-nanobananapro"
        className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
          model === "nanobanana-pro" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
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
  const downloadImage = (url: string, index: number) => {
    const s = loadSettings();
    const prefix = s.downloadPrefix || "LumenDust";
    const fmt = s.downloadFormat || "png";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${Date.now()}-${index}.${fmt}`;
    a.click();
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
    <div className="mb-6" data-testid={`task-card-${task.id}`}>
      <div className="flex items-start gap-3 mb-3">
        {task.referenceImagePreviews.length > 0 && (
          <div className="flex gap-1.5 shrink-0">
            {task.referenceImagePreviews.map((preview, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-md overflow-hidden border border-border/40 cursor-pointer hover:border-primary/50 hover:scale-110 hover:shadow-lg active:scale-95 transition-all duration-200"
                onClick={(e) => onUseRefImage(preview, task.referenceImageBase64[i], e)}
                title="点击添加为参考图"
                data-testid={`task-ref-img-${task.id}-${i}`}
              >
                <img src={preview} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <div className="group/prompt flex-1 min-w-0">
          {task.prompt && (
            <div className="relative rounded-lg px-3 py-2 transition-all duration-200 group-hover/prompt:bg-muted/20 cursor-default">
              <div
                className="prompt-fade-mask overflow-hidden transition-[max-height] duration-300 ease-out max-h-[2.8em] group-hover/prompt:max-h-[500px]"
              >
                <p
                  className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words"
                  data-testid={`task-prompt-${task.id}`}
                >
                  {task.prompt}
                </p>
              </div>
              <div className="flex items-center gap-0 mt-1 opacity-0 group-hover/prompt:opacity-100 transition-opacity duration-200">
                <span className="text-[11px] text-muted-foreground/40">{modelLabel}</span>
                <span className="text-muted-foreground/20 mx-1.5">|</span>
                <span className="text-[11px] text-muted-foreground/40">{task.aspectRatio}</span>
                <span className="text-muted-foreground/20 mx-1.5">|</span>
                <span className="text-[11px] text-muted-foreground/40">{task.resolution.toUpperCase()}</span>
                <span className="text-muted-foreground/20 mx-1.5">|</span>
                <span className="group/info relative inline-flex items-center gap-1 cursor-default" data-testid={`button-task-info-${task.id}`}>
                  <span className="text-[11px] text-muted-foreground/40 group-hover/info:text-muted-foreground/70 transition-colors">详细信息</span>
                  <Info className="w-3 h-3 text-muted-foreground/30 group-hover/info:text-muted-foreground/60 transition-colors" />
                  <div className="absolute left-0 top-full mt-1 z-50 w-56 p-3 rounded-lg border border-border/50 bg-popover shadow-xl opacity-0 scale-95 pointer-events-none group-hover/info:opacity-100 group-hover/info:scale-100 group-hover/info:pointer-events-auto transition-all duration-200 origin-top-left" data-testid={`task-info-popup-${task.id}`}>
                    <div className="space-y-1.5">
                      {[
                        ["模型", modelLabel],
                        ["比例", task.aspectRatio],
                        ["分辨率", task.resolution.toUpperCase()],
                        // Web search and thinking level info removed from popup
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
                  data-testid={`button-use-prompt-${task.id}`}
                >
                  <Copy className="w-3 h-3" />
                  使用提示词
                </button>
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
              data-testid={`task-placeholder-${task.id}-${i}`}
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
            return (
              <div
                key={i}
                className="group/img relative rounded-lg overflow-hidden bg-card/50 border border-border/20 hover:border-primary/30 transition-all duration-300"
                style={{ maxWidth: 180, boxShadow: "0 0 0 0 transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 16px 2px hsl(var(--primary) / 0.15), 0 0 6px 0 hsl(var(--primary) / 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; }}
                data-testid={`img-container-${task.id}-${i}`}
              >
                <img
                  src={src}
                  alt={`生成 ${i + 1}`}
                  className="w-full h-auto cursor-pointer transition-transform duration-300 ease-out group-hover/img:scale-[1.04]"
                  onClick={() => onClickImage(src)}
                  data-testid={`img-generated-${task.id}-${i}`}
                />
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="w-7 h-7"
                    onClick={(e) => { e.stopPropagation(); downloadImage(src, i); }}
                    data-testid={`button-download-${task.id}-${i}`}
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
        <div className="flex items-center gap-2 mt-2.5" data-testid={`task-actions-${task.id}`}>
          <button
            onClick={() => onReEdit(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/30"
            data-testid={`button-reedit-${task.id}`}
          >
            <Pencil className="w-3 h-3" />
            重新编辑
          </button>
          <button
            onClick={() => onReGenerate(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/30"
            data-testid={`button-regenerate-${task.id}`}
          >
            <RefreshCw className="w-3 h-3" />
            再次生成
          </button>
          <button
            onClick={() => onDelete(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border/30"
            data-testid={`button-delete-${task.id}`}
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
      data-testid="lightbox-overlay"
    >
      <img
        src={src}
        alt="放大预览"
        className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="lightbox-image"
      />
      <button
        onClick={handleClose}
        className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        data-testid="button-lightbox-close"
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
  } = store;

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<GenerationTask | null>(null);
  const [flyingImage, setFlyingImage] = useState<{ src: string; x: number; y: number } | null>(null);
  const isAtBottomRef = useRef(true);
  const prevTaskCountRef = useRef(tasks.length);
  const prevLastTaskRef = useRef<string | null>(null);

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
        if (atBottom) setInputCollapsed(false);
        else if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) setInputCollapsed(true);
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
      setAspectRatio("1:1");
    }
  }, [aspectRatio, setModel, setAspectRatio]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setReferenceImagePreviews((prev) => [...prev, base64]);
      setReferenceImages((prev) => [...prev, base64.split(",")[1]]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [referenceImages.length, toast, setReferenceImages, setReferenceImagePreviews]);

  const removeImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferenceImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }, [setReferenceImages, setReferenceImagePreviews]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
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
      createdAt: Date.now(),
      webSearch,
      thinkingLevel,
    };

    addTask(task);

    const bodyToSend: Record<string, any> = {
      model,
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      resolution,
      num_images: numImages,
      web_search: !!webSearch,
      thinking_level: thinkingLevel || "fast",
      images: referenceImages.length > 0 ? referenceImages : [],
    };

    try {
      updateTask(taskId, { status: "creating", statusDetail: "正在提交请求..." });

      await new Promise((r) => setTimeout(r, 300));
      updateTask(taskId, { status: "generating", statusDetail: "已发送至 API，等待模型响应..." });

      const res = await apiRequest("POST", "/api/generate", bodyToSend, getCustomApiHeaders());

      updateTask(taskId, { status: "downloading", statusDetail: "正在接收图片数据..." });

      const data = await res.json();
      console.log("Generation response:", data);

      if (data.error) {
        updateTask(taskId, { status: "error", error: data.error, completedAt: Date.now() });
      } else if (data.images && data.images.length > 0) {
        updateTask(taskId, { status: "complete", generatedImages: data.images, completedAt: Date.now() });
      } else {
        console.log("API response (no images):", JSON.stringify(data).substring(0, 1000));
        updateTask(taskId, { status: "error", error: "未返回图片" });
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
    if (e.key === "Enter" && !e.shiftKey && canGenerate) {
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
      images: refBase64,
    };

    try {
      updateTask(taskId, { status: "creating", statusDetail: "正在提交请求..." });
      await new Promise((r) => setTimeout(r, 300));
      updateTask(taskId, { status: "generating", statusDetail: "已发送至 API，等待模型响应..." });

      const res = await apiRequest("POST", "/api/generate", bodyToSend, getCustomApiHeaders());
      updateTask(taskId, { status: "downloading", statusDetail: "正在接收图片数据..." });
      const data = await res.json();

      if (data.error) {
        updateTask(taskId, { status: "error", error: data.error, completedAt: Date.now() });
      } else if (data.images && data.images.length > 0) {
        updateTask(taskId, { status: "complete", generatedImages: data.images, completedAt: Date.now() });
      } else {
        updateTask(taskId, { status: "error", error: "未返回图片" });
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
    for (const img of task.generatedImages) {
      try {
        const response = await fetch("/api/images?" + new URLSearchParams({ limit: "200", offset: "0" }));
        const data = await response.json();
        if (data.images) {
          for (const dbImg of data.images) {
            if (dbImg.imageUrl === img) {
              await apiRequest("DELETE", `/api/images/${dbImg.id}`);
            }
          }
        }
      } catch {}
    }
    toast({ title: "已删除任务" });
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
        <div ref={feedRef} className="flex-1 py-6 overflow-y-auto flex flex-col">
          {tasks.length > 0 ? (
            <div className="mt-auto">
              {tasks.map((task) => (
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
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[300px]" data-testid="empty-state">
              <ImageIcon className="w-10 h-10 mb-3 opacity-15" />
              <p className="text-xs opacity-40">生成的图片将在这里展示</p>
            </div>
          )}
        </div>

        {!isAtBottom && tasks.length > 0 && (
          <div className="flex justify-center pb-2">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary transition-colors animate-in fade-in slide-in-from-bottom-2 duration-200"
              data-testid="button-scroll-bottom"
            >
              <ArrowDown className="w-3 h-3" />
              回到底部
            </button>
          </div>
        )}

        <div
          className="pb-4 transition-all duration-300 ease-in-out"
          data-testid="input-area"
          onClick={() => { if (inputCollapsed) { setInputCollapsed(false); } }}
        >
          <div className={`rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm transition-all duration-300 ease-in-out ${inputCollapsed ? "cursor-pointer hover:border-border/80" : ""}`}>
            {inputCollapsed ? (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Plus className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                <span className="text-xs text-muted-foreground/40 truncate flex-1">
                  {prompt.trim() || "输入提示词..."}
                </span>
                <Send className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2 p-3 pb-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    data-testid="input-file-upload"
                  />

                  <div className="shrink-0 flex items-end">
                    <div className="flex items-end">
                      {referenceImagePreviews.map((preview, i) => (
                        <div
                          key={i}
                          className="relative shrink-0 rounded-md overflow-hidden border border-border/40 transition-all duration-300 ease-out cursor-pointer group/img"
                          style={{
                            width: 44,
                            height: 44,
                            marginLeft: i > 0 ? -12 : 0,
                            zIndex: i,
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            el.style.width = "56px";
                            el.style.height = "56px";
                            el.style.zIndex = "20";
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            el.style.width = "44px";
                            el.style.height = "44px";
                            el.style.zIndex = String(i);
                          }}
                          data-testid={`img-stack-${i}`}
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
                            data-testid={`button-remove-stack-${i}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {referenceImages.length < 10 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-11 h-11 rounded-md border border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground/30 shrink-0 transition-colors hover:border-muted-foreground/40"
                          style={{ marginLeft: referenceImagePreviews.length > 0 ? -4 : 0 }}
                          data-testid="button-add-image"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入提示词..."
                    className="flex-1 bg-transparent border-0 outline-none resize-none text-sm min-h-[56px] max-h-[160px] py-2 text-foreground placeholder:text-muted-foreground/30 overflow-hidden"
                    rows={2}
                    data-testid="input-prompt"
                  />

                  <Button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    size="icon"
                    className="shrink-0 mt-0.5 rounded-lg"
                    data-testid="button-generate"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                <div className="border-t border-border/20 px-3 py-2 flex flex-wrap items-center gap-2" data-testid="params-section">
              <ModelToggle model={model} onChange={handleModelChange} />

              <span className="w-px h-5 bg-border/30" />

              <Popover open={ratioOpen} onOpenChange={setRatioOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
                    data-testid="select-aspect-ratio"
                  >
                    <RatioIcon ratio={aspectRatio} active={false} />
                    {aspectRatio}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start" data-testid="ratio-dropdown">
                  <div className="flex flex-wrap gap-1" style={{ maxWidth: 360 }}>
                    {currentRatios.map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => { setAspectRatio(ratio); setRatioOpen(false); }}
                        data-testid={`option-ratio-${ratio}`}
                        className={`flex flex-col items-center gap-0.5 w-12 py-1.5 rounded-md text-[11px] transition-colors ${
                          aspectRatio === ratio
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <RatioIcon ratio={ratio} active={aspectRatio === ratio} />
                        {ratio}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="h-auto w-auto border-0 bg-transparent text-xs px-2 py-1 gap-1 text-muted-foreground" data-testid="select-resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((r) => (
                    <SelectItem key={r} value={r} data-testid={`option-resolution-${r}`}>{r.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(numImages)} onValueChange={(v) => setNumImages(Number(v))}>
                <SelectTrigger className="h-auto w-auto border-0 bg-transparent text-xs px-2 py-1 gap-1 text-muted-foreground" data-testid="select-num-images">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)} data-testid={`option-num-${n}`}>{n} 张</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="w-px h-5 bg-border/30" />
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {deleteConfirmTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setDeleteConfirmTask(null)} data-testid="delete-confirm-overlay">
          <div className="bg-card border border-border/50 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium" data-testid="text-delete-title">确认删除</p>
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
                data-testid="button-delete-cancel"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={confirmDelete}
                data-testid="button-delete-confirm"
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
