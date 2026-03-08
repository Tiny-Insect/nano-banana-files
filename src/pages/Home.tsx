import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ImagePlus, X, Loader2, Download, RotateCcw, Maximize2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useGenerationStore } from "@/lib/generation-store";
import { mockGenerate } from "@/lib/mock-generate";
import {
  NANOBANANA2_RATIOS,
  NANOBANANA_PRO_RATIOS,
  RESOLUTIONS,
  MODEL_INFO,
  type ModelType,
  type GenerationTask,
} from "@/lib/types";

// ── Ratio Icon ──
function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const [w, h] = ratio.split(":").map(Number);
  const maxDim = 20;
  const scale = maxDim / Math.max(w, h);
  const rw = Math.max(4, Math.round(w * scale));
  const rh = Math.max(4, Math.round(h * scale));
  return (
    <div
      className={`flex items-center justify-center rounded-md border p-1.5 transition-colors cursor-pointer ${
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground"
      }`}
      title={ratio}
    >
      <div
        className="rounded-sm border"
        style={{
          width: rw,
          height: rh,
          borderColor: active ? "hsl(var(--primary))" : "currentColor",
          backgroundColor: active ? "hsl(var(--primary) / 0.3)" : "transparent",
        }}
      />
    </div>
  );
}

// ── Task Card ──
function TaskCard({
  task,
  onRegenerate,
  onReEdit,
  onViewImage,
}: {
  task: GenerationTask;
  onRegenerate: (task: GenerationTask) => void;
  onReEdit: (task: GenerationTask) => void;
  onViewImage: (url: string) => void;
}) {
  const isLoading = task.status === "creating" || task.status === "generating" || task.status === "downloading";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">{task.prompt}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge variant="secondary" className="text-xs">
              {MODEL_INFO[task.model].label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {task.aspectRatio}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {task.resolution.toUpperCase()}
            </Badge>
            {task.numImages > 1 && (
              <Badge variant="outline" className="text-xs">
                ×{task.numImages}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{task.statusDetail || "生成中..."}</span>
        </div>
      )}

      {/* Error */}
      {task.status === "error" && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          {task.error || "生成失败"}
        </div>
      )}

      {/* Images */}
      {task.status === "complete" && task.generatedImages.length > 0 && (
        <div className={`grid gap-2 ${task.generatedImages.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {task.generatedImages.map((img, i) => (
            <div key={i} className="group relative rounded-lg overflow-hidden bg-secondary aspect-square">
              <img
                src={img}
                alt={`生成图片 ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onViewImage(img)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = img;
                      a.download = `LumenDust_${Date.now()}.png`;
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(task.status === "complete" || task.status === "error") && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onRegenerate(task)}>
            <RotateCcw className="h-3 w-3" />
            再次生成
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => onReEdit(task)}>
            重新编辑
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Home Page ──
export default function Home() {
  const { tasks, addTask, updateTask } = useGenerationStore();

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelType>("nanobanana-2");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2k");
  const [numImages, setNumImages] = useState(1);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceBase64, setReferenceBase64] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ratios = model === "nanobanana-2" ? NANOBANANA2_RATIOS : NANOBANANA_PRO_RATIOS;

  // Auto-adjust ratio when switching model
  useEffect(() => {
    const available = model === "nanobanana-2" ? NANOBANANA2_RATIOS : NANOBANANA_PRO_RATIOS;
    if (!available.includes(aspectRatio)) {
      setAspectRatio(available[0]);
    }
  }, [model, aspectRatio]);

  // Scroll to bottom on new task
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tasks.length]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setReferenceImages((prev) => [...prev, dataUrl]);
        const base64 = dataUrl.split(",")[1] || "";
        setReferenceBase64((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  const removeReference = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferenceBase64((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const taskId = `task-${Date.now()}`;
    const task: GenerationTask = {
      id: taskId,
      prompt: prompt.trim(),
      referenceImagePreviews: [...referenceImages],
      referenceImageBase64: [...referenceBase64],
      model,
      aspectRatio,
      resolution,
      numImages,
      status: "generating",
      statusDetail: "正在生成图片...",
      generatedImages: [],
      createdAt: Date.now(),
    };

    addTask(task);
    setPrompt("");
    setReferenceImages([]);
    setReferenceBase64([]);

    try {
      const images = await mockGenerate(numImages);
      updateTask(taskId, {
        status: "complete",
        generatedImages: images,
        completedAt: Date.now(),
        statusDetail: undefined,
      });
    } catch (err: any) {
      updateTask(taskId, {
        status: "error",
        error: err.message || "生成失败，请重试",
        statusDetail: undefined,
      });
    }
  }, [prompt, referenceImages, referenceBase64, model, aspectRatio, resolution, numImages, addTask, updateTask]);

  const handleRegenerate = useCallback(
    async (task: GenerationTask) => {
      const taskId = `task-${Date.now()}`;
      const newTask: GenerationTask = {
        ...task,
        id: taskId,
        status: "generating",
        statusDetail: "正在重新生成...",
        generatedImages: [],
        error: undefined,
        createdAt: Date.now(),
        completedAt: undefined,
      };
      addTask(newTask);
      try {
        const images = await mockGenerate(task.numImages);
        updateTask(taskId, { status: "complete", generatedImages: images, completedAt: Date.now() });
      } catch (err: any) {
        updateTask(taskId, { status: "error", error: err.message || "生成失败" });
      }
    },
    [addTask, updateTask]
  );

  const handleReEdit = useCallback((task: GenerationTask) => {
    setPrompt(task.prompt);
    setModel(task.model);
    setAspectRatio(task.aspectRatio);
    setResolution(task.resolution);
    setNumImages(task.numImages);
    setReferenceImages(task.referenceImagePreviews || []);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ImagePlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">开始创作</h2>
              <p className="text-muted-foreground max-w-md">
                输入提示词描述你想要生成的图片，支持文生图和图生图
              </p>
            </div>
          )}

          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onRegenerate={handleRegenerate}
              onReEdit={handleReEdit}
              onViewImage={setLightboxImage}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t bg-card/80 glass">
        <div className="mx-auto max-w-3xl px-4 py-3 space-y-3">
          {/* Reference images */}
          {referenceImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeReference(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Prompt + send */}
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Textarea
              ref={textareaRef}
              placeholder="描述你想要生成的图片..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[40px] max-h-[120px] resize-none bg-secondary/50 border-0 focus-visible:ring-1"
              rows={1}
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleGenerate}
              disabled={!prompt.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Params toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-180" : ""}`} />
            参数设置
          </button>

          {/* Params */}
          {!isCollapsed && (
            <div className="space-y-3">
              {/* Model selector */}
              <div className="flex gap-2">
                {(["nanobanana-2", "nanobanana-pro"] as ModelType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`flex-1 rounded-lg border p-2.5 text-sm text-left transition-colors ${
                      model === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{MODEL_INFO[m].label}</div>
                    <div className="text-xs opacity-70">{MODEL_INFO[m].description}</div>
                  </button>
                ))}
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">宽高比</label>
                <div className="flex flex-wrap gap-1.5">
                  {ratios.map((r) => (
                    <button key={r} onClick={() => setAspectRatio(r)} className="relative">
                      <RatioIcon ratio={r} active={aspectRatio === r} />
                      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                        {aspectRatio === r ? r : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution & Count */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1.5 block">分辨率</label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="h-9 bg-secondary/50 border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1.5 block">生成数量</label>
                  <Select value={String(numImages)} onValueChange={(v) => setNumImages(Number(v))}>
                    <SelectTrigger className="h-9 bg-secondary/50 border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} 张
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0 shadow-none">
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="预览"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
