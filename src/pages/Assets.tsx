import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ImageIcon, X, Copy, Pencil, RefreshCw, MapPin, ZoomIn, ZoomOut, AlertTriangle, ClipboardCopy } from "lucide-react";
import Layout, { loadSettings } from "@/components/Layout";
import { useGenerationStore, type GenerationTask, type ModelType } from "@/lib/generation-store";
import { getStorage } from "@/lib/storage-factory";
import { supabase } from "@/integrations/supabase/client";

const MODEL_LABELS: Record<string, string> = {
  "nanobanana-2": "NanoBanana 2",
  "nanobanana-pro": "NanoBanana Pro",
};

interface AssetImage {
  id: string;
  taskId: string;
  imageIndex: number;
  imageUrl: string;
  thumbUrl: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  createdAt?: number;
  completedAt?: number;
  webSearch?: boolean;
  thinkingLevel?: string;
  task: GenerationTask;
}

function formatDate(ts?: number) {
  if (!ts) return "未知时间";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function AssetLightbox({ image, onClose, onUsePrompt, onReEdit, onReGenerate, onDownload, onLocate, onDelete }: {
  image: AssetImage;
  onClose: () => void;
  onUsePrompt: (p: string) => void;
  onReEdit: (task: GenerationTask) => void;
  onReGenerate: (task: GenerationTask) => void;
  onDownload: (url: string, index: number) => void;
  onLocate: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const modelLabel = MODEL_LABELS[image.model] || image.model;

  useState(() => {
    requestAnimationFrame(() => setVisible(true));
  });

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleCopyPrompt = async () => {
    if (!image.prompt) return;
    try {
      await navigator.clipboard.writeText(image.prompt);
      toast({ title: "已复制到剪贴板" });
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = image.prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast({ title: "已复制到剪贴板" });
    }
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    // Smooth fade out then delete
    setVisible(false);
    setTimeout(() => {
      onDelete(image.taskId);
      onClose();
    }, 300);
  };

  const src = image.imageUrl.startsWith("data:") || image.imageUrl.startsWith("http")
    ? image.imageUrl
    : `data:image/png;base64,${image.imageUrl}`;

  return (
    <div
      className={`fixed inset-0 z-[100] flex transition-all duration-300 ${visible ? "bg-black/70 backdrop-blur-md" : "bg-black/0"}`}
      onClick={handleClose}
    >
      {/* Left: Image */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <img
          src={src}
          alt={image.prompt || "生成图片"}
          className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Right: Detail Panel */}
      <div
        className={`w-80 bg-card/95 backdrop-blur-xl border-l border-border/30 flex flex-col overflow-y-auto custom-scrollbar transition-all duration-300 ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex-1 flex flex-col space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">图片详情</h3>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt */}
          {image.prompt && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground/70 font-medium">提示词</p>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <ClipboardCopy className="w-3 h-3" />
                  复制
                </button>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words bg-muted/20 rounded-lg p-3 max-h-44 overflow-y-auto custom-scrollbar">
                {image.prompt}
              </p>
            </div>
          )}

          {/* Parameters */}
          <div>
            <p className="text-xs text-muted-foreground/70 font-medium mb-2">参数</p>
            <div className="space-y-2.5 bg-muted/20 rounded-lg p-3">
              {[
                ["模型", modelLabel],
                ["比例", image.aspectRatio],
                ["分辨率", image.resolution.toUpperCase()],
                ["联网搜索", image.webSearch ? "是" : "否"],
                ...(image.model !== "nanobanana-pro" ? [["思考模式", image.thinkingLevel === "deep" ? "深度" : "快速"]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/60">{label}</span>
                  <span className="text-xs text-foreground/80">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <p className="text-xs text-muted-foreground/70 font-medium mb-2">时间</p>
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/60">创建</span>
                <span className="text-xs text-foreground/80">{formatDate(image.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground/60">完成</span>
                <span className="text-xs text-foreground/80">{formatDate(image.completedAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground/70 font-medium mb-2">操作</p>
            <button
              onClick={() => { onUsePrompt(image.prompt); handleClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <Copy className="w-4 h-4" />
              使用提示词
            </button>
            <button
              onClick={() => { onReEdit(image.task); handleClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <Pencil className="w-4 h-4" />
              重新编辑
            </button>
            <button
              onClick={() => onReGenerate(image.task)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <RefreshCw className="w-4 h-4" />
              再次生成
            </button>
            <button
              onClick={() => { onLocate(image.taskId); handleClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <MapPin className="w-4 h-4" />
              定位到生成界面
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom: Download + Delete */}
          <div className="flex gap-2 pt-3 border-t border-border/20">
            <Button
              onClick={() => onDownload(src, image.imageIndex)}
              className="flex-1 h-11 text-sm font-medium gap-2"
            >
              <Download className="w-4 h-4" />
              下载原图
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 h-11 text-sm font-medium gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-card border border-border/50 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">确认删除</p>
                <p className="text-xs text-muted-foreground mt-0.5">删除后无法找回，包括关联的生成图片</p>
              </div>
            </div>
            {image.prompt && (
              <p className="text-xs text-muted-foreground/70 bg-muted/30 rounded-md px-3 py-2 mb-4 truncate">
                "{image.prompt}"
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={() => setShowDeleteConfirm(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={handleConfirmDelete}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Assets() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tasks, setTasks, addTask, updateTask, setPrompt, setModel, setAspectRatio, setResolution, setNumImages, setReferenceImages, setReferenceImagePreviews, webSearch, thinkingLevel } = useGenerationStore();
  const [selectedImage, setSelectedImage] = useState<AssetImage | null>(null);
  const [columnSize, setColumnSize] = useState(50); // 0-100 slider

  // Flatten completed tasks into images
  const images: AssetImage[] = useMemo(() => {
    return tasks
      .filter((t) => t.status === "complete" && t.generatedImages.length > 0)
      .flatMap((t) =>
        t.generatedImages.map((img, i) => ({
          id: `${t.id}-${i}`,
          taskId: t.id,
          imageIndex: i,
          imageUrl: img,
          thumbUrl: t.thumbnails?.[i] || img,
          prompt: t.prompt,
          model: t.model,
          aspectRatio: t.aspectRatio,
          resolution: t.resolution,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          webSearch: t.webSearch,
          thinkingLevel: t.thinkingLevel,
          task: t,
        }))
      )
      .reverse();
  }, [tasks]);

  // Map slider 0-100 to column width: min 120px, max 400px
  const colWidth = Math.round(120 + (columnSize / 100) * 280);

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast({ title: "已删除" });
  };

  const handleUsePrompt = (p: string) => {
    setPrompt(p);
    toast({ title: "已复制提示词" });
    navigate("/");
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
    navigate("/");
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
    toast({ title: "正在重新生成..." });

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
        toast({ title: "重新生成完成" });
      } else {
        updateTask(taskId, { status: "error", error: lastError || "未返回图片", completedAt: Date.now() });
      }
    } catch (error: any) {
      const msg = error.message || "";
      updateTask(taskId, { status: "error", error: msg.includes("429") ? "请求过于频繁" : (msg || "生成失败") });
    }
  };

  const handleDownload = async (url: string, index: number) => {
    const s = loadSettings();
    const prefix = s.downloadPrefix || "LumenDust";
    try {
      const storage = getStorage();
      await storage.downloadImage(url, `${prefix}-${Date.now()}-${index}`);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleLocate = (taskId: string) => {
    // Navigate to home with task ID hash for scrolling
    navigate(`/?locate=${taskId}`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-lg font-semibold">资产库</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              共 {images.length} 张历史图片
            </p>
          </div>

          {/* View size slider */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <Slider
              value={[columnSize]}
              onValueChange={([v]) => setColumnSize(v)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          </div>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ImageIcon className="w-10 h-10 mb-3 opacity-15" />
            <p className="text-xs opacity-40">还没有生成过图片</p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${colWidth}px, 1fr))`,
            }}
          >
            {images.map((img) => {
              const thumbSrc = img.thumbUrl.startsWith("data:") || img.thumbUrl.startsWith("http")
                ? img.thumbUrl
                : `data:image/png;base64,${img.thumbUrl}`;
              const fullSrc = img.imageUrl.startsWith("data:") || img.imageUrl.startsWith("http")
                ? img.imageUrl
                : `data:image/png;base64,${img.imageUrl}`;
              return (
                <div
                  key={img.id}
                  className="group relative rounded-lg overflow-hidden bg-card/50 border border-border/20 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 16px 2px hsl(var(--primary) / 0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  <img
                    src={thumbSrc}
                    alt={img.prompt || "生成图片"}
                    loading="lazy"
                    className="w-full h-auto transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-2.5">
                    <div className="flex-1 min-w-0 mr-2">
                      {img.prompt && (
                        <p className="text-[10px] text-white/80 truncate">{img.prompt}</p>
                      )}
                      <p className="text-[10px] text-white/50">{MODEL_LABELS[img.model] || img.model} · {img.aspectRatio}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleDownload(fullSrc, img.imageIndex); }}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.taskId); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedImage && (
        <AssetLightbox
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onUsePrompt={handleUsePrompt}
          onReEdit={handleReEdit}
          onReGenerate={handleReGenerate}
          onDownload={handleDownload}
          onLocate={handleLocate}
          onDelete={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            toast({ title: "已删除" });
          }}
        />
      )}
    </Layout>
  );
}
