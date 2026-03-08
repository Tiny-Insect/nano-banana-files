import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ImageIcon, X, ZoomIn, ZoomOut, AlertTriangle, RotateCcw } from "lucide-react";
import Layout from "@/components/Layout";
import { useGenerationStore } from "@/lib/generation-store";
import { downloadOriginalImage } from "@/lib/api";
import { resolveImageSrc } from "@/lib/format";
import { loadTrash, restoreFromTrash, permanentDelete, clearAllTrash, type TrashedTask } from "@/lib/trash-store";
import ImageLightbox, { type LightboxImage } from "@/components/ImageLightbox";

interface TrashImage {
  id: string;
  taskId: string;
  imageIndex: number;
  imageUrl: string;
  thumbUrl: string;
  task: TrashedTask;
}

export default function RecentlyDeleted() {
  const { toast } = useToast();
  const { setTasks } = useGenerationStore();
  const [trashItems, setTrashItems] = useState<TrashedTask[]>(() => loadTrash());
  const [selectedImage, setSelectedImage] = useState<TrashImage | null>(null);
  const [columnSize, setColumnSize] = useState(50);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<TrashedTask | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());

  const refreshTrash = useCallback(() => setTrashItems(loadTrash()), []);

  const images: TrashImage[] = useMemo(() => {
    return trashItems
      .filter((t) => t.status === "complete" && t.generatedImages.length > 0)
      .flatMap((t) =>
        t.generatedImages.map((img, i) => ({
          id: `${t.id}-${i}`,
          taskId: t.id,
          imageIndex: i,
          imageUrl: img,
          thumbUrl: t.thumbnails?.[i] || img,
          task: t,
        }))
      )
      .reverse();
  }, [trashItems]);

  const colWidth = Math.round(120 + (columnSize / 100) * 280);

  const handleDownload = async (url: string, index: number) => {
    const savePath = await downloadOriginalImage(url, index);
    toast({ title: savePath ? `已保存至「${savePath}」` : "已开始下载" });
  };

  const handleRestore = useCallback((taskId: string) => {
    setFadingOut((prev) => new Set(prev).add(taskId));
    setTimeout(() => {
      const restored = restoreFromTrash(taskId);
      if (restored) {
        setTasks((prev) => {
          const newTasks = [...prev, restored];
          newTasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          return newTasks;
        });
        toast({ title: "已还原到资产库" });
      }
      setFadingOut((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      refreshTrash();
    }, 300);
  }, [setTasks, toast, refreshTrash]);

  const handlePermanentDelete = (taskId: string) => {
    permanentDelete(taskId);
    refreshTrash();
    setDeleteConfirmTask(null);
    toast({ title: "已永久删除" });
  };

  const handleClearAll = () => {
    clearAllTrash();
    refreshTrash();
    setClearAllConfirm(false);
    toast({ title: "已清空最近删除" });
  };

  // Convert to LightboxImage for the unified component
  const lightboxImage: LightboxImage | null = selectedImage ? {
    imageUrl: selectedImage.imageUrl,
    imageIndex: selectedImage.imageIndex,
    taskId: selectedImage.taskId,
  } : null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-lg font-semibold">最近删除</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              共 {images.length} 张图片
            </p>
          </div>
          <div className="flex items-center gap-3">
            {trashItems.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setClearAllConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                全部删除
              </Button>
            )}
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
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Trash2 className="w-10 h-10 mb-3 opacity-15" />
            <p className="text-xs opacity-40">最近删除为空</p>
          </div>
        ) : (
          <div style={{ columnWidth: `${colWidth}px`, columnGap: "12px" }}>
            {images.map((img) => {
              const thumbSrc = resolveImageSrc(img.thumbUrl);
              const fullSrc = resolveImageSrc(img.imageUrl);
              const isFading = fadingOut.has(img.taskId);
              return (
                <div
                  key={img.id}
                  className={`group relative rounded-lg overflow-hidden bg-card/50 border border-border/20 hover:border-primary/30 transition-all duration-300 cursor-pointer mb-3 ${isFading ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
                  style={{ breakInside: "avoid" }}
                  onClick={() => setSelectedImage(img)}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 16px 2px hsl(var(--primary) / 0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  <img
                    src={thumbSrc}
                    alt="已删除图片"
                    loading="lazy"
                    className="w-full h-auto transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-2.5">
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleDownload(fullSrc, img.imageIndex); }}
                        title="下载"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleRestore(img.taskId); }}
                        title="还原"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmTask(img.task); }}
                        title="永久删除"
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
          mode="trash"
          onClose={() => setSelectedImage(null)}
          onRestore={handleRestore}
        />
      )}

      {/* Permanent delete confirmation */}
      {deleteConfirmTask && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmTask(null)}
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
                <p className="text-sm font-medium">永久删除</p>
                <p className="text-xs text-muted-foreground mt-0.5">删除后无法找回</p>
              </div>
            </div>
            {deleteConfirmTask.generatedImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 bg-muted/20 rounded-lg p-2.5">
                {deleteConfirmTask.generatedImages.map((img, i) => {
                  const thumb = deleteConfirmTask.thumbnails?.[i] || img;
                  const src = resolveImageSrc(thumb);
                  return (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="rounded-md object-cover"
                      style={{ width: deleteConfirmTask.generatedImages.length === 1 ? "100%" : "calc(50% - 3px)", maxHeight: 120 }}
                    />
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-8 px-4 text-xs" onClick={() => setDeleteConfirmTask(null)}>
                取消
              </Button>
              <Button variant="destructive" size="sm" className="h-8 px-4 text-xs" onClick={() => handlePermanentDelete(deleteConfirmTask.id)}>
                永久删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all confirmation */}
      {clearAllConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setClearAllConfirm(false)}
        >
          <div
            className="bg-card border border-border/50 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">清空最近删除</p>
                <p className="text-xs text-muted-foreground mt-0.5">所有 {trashItems.length} 个任务将被永久删除，无法找回</p>
              </div>
            </div>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4 bg-muted/20 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar">
                {images.slice(0, 20).map((img) => {
                  const src = resolveImageSrc(img.thumbUrl);
                  return (
                    <img key={img.id} src={src} alt="" className="w-12 h-12 rounded object-cover" />
                  );
                })}
                {images.length > 20 && (
                  <div className="w-12 h-12 rounded bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                    +{images.length - 20}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-8 px-4 text-xs" onClick={() => setClearAllConfirm(false)}>
                取消
              </Button>
              <Button variant="destructive" size="sm" className="h-8 px-4 text-xs" onClick={handleClearAll}>
                全部永久删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
