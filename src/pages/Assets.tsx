import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ImageIcon, ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import { moveToTrash } from "@/lib/trash-store";
import Layout from "@/components/Layout";
import { useGenerationStore, type GenerationTask, type ModelType } from "@/lib/generation-store";
import { callGenerateApi, executeGeneration, downloadOriginalImage } from "@/lib/api";
import { formatDate, resolveImageSrc } from "@/lib/format";
import ImageLightbox, { type LightboxImage } from "@/components/ImageLightbox";

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

export default function Assets() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tasks, setTasks, addTask, updateTask, setPrompt, setModel, setAspectRatio, setResolution, setNumImages, setReferenceImages, setReferenceImagePreviews, webSearch, thinkingLevel } = useGenerationStore();
  const [selectedImage, setSelectedImage] = useState<AssetImage | null>(null);
  const [columnSize, setColumnSize] = useState(50);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

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

  const colWidth = Math.round(120 + (columnSize / 100) * 280);

  const handleDelete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) moveToTrash(task);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast({ title: "已移至最近删除" });
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
      await executeGeneration(taskId, bodyToSend, task.numImages || 1, updateTask);
      toast({ title: "重新生成完成" });
    } catch (error: any) {
      const msg = error.message || "";
      updateTask(taskId, { status: "error", error: msg.includes("429") ? "请求过于频繁" : (msg || "生成失败") });
    }
  };

  const handleDownload = async (url: string, index: number) => {
    await downloadOriginalImage(url, index);
  };

  const handleLocate = (taskId: string) => {
    navigate(`/?locate=${taskId}`);
  };

  // Convert AssetImage to LightboxImage
  const lightboxImage: LightboxImage | null = selectedImage ? {
    imageUrl: selectedImage.imageUrl,
    imageIndex: selectedImage.imageIndex,
    prompt: selectedImage.prompt,
    model: selectedImage.model,
    aspectRatio: selectedImage.aspectRatio,
    resolution: selectedImage.resolution,
    createdAt: selectedImage.createdAt,
    completedAt: selectedImage.completedAt,
    webSearch: selectedImage.webSearch,
    thinkingLevel: selectedImage.thinkingLevel,
    taskId: selectedImage.taskId,
    task: selectedImage.task,
  } : null;

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
          <div style={{ columnWidth: `${colWidth}px`, columnGap: "12px" }}>
            {images.map((img) => {
              const thumbSrc = resolveImageSrc(img.thumbUrl);
              const fullSrc = resolveImageSrc(img.imageUrl);
              return (
                <div
                  key={img.id}
                  className="group relative rounded-lg overflow-hidden bg-card/50 border border-border/20 hover:border-primary/30 transition-all duration-300 cursor-pointer mb-3"
                  style={{ breakInside: "avoid" }}
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
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmTaskId(img.taskId); }}
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

      {selectedImage && lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          mode="asset"
          onClose={() => setSelectedImage(null)}
          onUsePrompt={handleUsePrompt}
          onReEdit={handleReEdit}
          onReGenerate={handleReGenerate}
          onDownload={handleDelete}
          onLocate={handleLocate}
          onDelete={handleDelete}
        />
      )}

      {/* Thumbnail delete confirmation */}
      {deleteConfirmTaskId && (() => {
        const task = tasks.find((t) => t.id === deleteConfirmTaskId);
        if (!task) return null;
        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setDeleteConfirmTaskId(null)}
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
                  <p className="text-xs text-muted-foreground mt-0.5">该任务将移至「最近删除」，可随时找回</p>
                </div>
              </div>
              {task.generatedImages && task.generatedImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 bg-muted/20 rounded-lg p-2.5">
                  {task.generatedImages.map((img, i) => {
                    const thumb = task.thumbnails?.[i] || img;
                    const src = resolveImageSrc(thumb);
                    return (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="rounded-md object-cover"
                        style={{ width: task.generatedImages.length === 1 ? "100%" : "calc(50% - 3px)", maxHeight: 120 }}
                      />
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-8 px-4 text-xs" onClick={() => setDeleteConfirmTaskId(null)}>
                  取消
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 px-4 text-xs"
                  onClick={() => {
                    handleDelete(deleteConfirmTaskId);
                    setDeleteConfirmTaskId(null);
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </Layout>
  );
}
