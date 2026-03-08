import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ImageIcon, X, ZoomIn, ZoomOut, AlertTriangle, RotateCcw } from "lucide-react";
import Layout, { loadSettings } from "@/components/Layout";
import { useGenerationStore, type GenerationTask } from "@/lib/generation-store";
import { getStorage } from "@/lib/storage-factory";
import { loadTrash, saveTrash, restoreFromTrash, permanentDelete, clearAllTrash, type TrashedTask } from "@/lib/trash-store";

interface TrashImage {
  id: string;
  taskId: string;
  imageIndex: number;
  imageUrl: string;
  thumbUrl: string;
  task: TrashedTask;
}

function TrashLightbox({ image, onClose, onDownload, onRestore }: {
  image: TrashImage;
  onClose: () => void;
  onDownload: (url: string, index: number) => void;
  onRestore: (taskId: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useState(() => {
    requestAnimationFrame(() => setVisible(true));
  });

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const src = image.imageUrl.startsWith("data:") || image.imageUrl.startsWith("http")
    ? image.imageUrl
    : `data:image/png;base64,${image.imageUrl}`;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${visible ? "bg-black/80 backdrop-blur-md" : "bg-black/0"}`}
      onClick={handleClose}
    >
      <div
        className={`flex flex-col items-center gap-4 transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt="已删除图片"
          className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDownload(src, image.imageIndex)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium backdrop-blur-md transition-all duration-200 border border-white/10"
          >
            <Download className="w-4 h-4" />
            下载原图
          </button>
          <button
            onClick={() => { onRestore(image.taskId); handleClose(); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/80 hover:bg-primary text-primary-foreground text-sm font-medium backdrop-blur-md transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            还原
          </button>
        </div>
      </div>
      <button
        onClick={handleClose}
        className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
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
    const s = loadSettings();
    const prefix = s.downloadPrefix || "LumenDust";
    try {
      const storage = getStorage();
      await storage.downloadImage(url, `${prefix}-${Date.now()}-${index}`);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleRestore = useCallback((taskId: string) => {
    // Fade out animation
    setFadingOut((prev) => new Set(prev).add(taskId));
    setTimeout(() => {
      const restored = restoreFromTrash(taskId);
      if (restored) {
        // Insert back at original time position
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
              const thumbSrc = img.thumbUrl.startsWith("data:") || img.thumbUrl.startsWith("http")
                ? img.thumbUrl : `data:image/png;base64,${img.thumbUrl}`;
              const fullSrc = img.imageUrl.startsWith("data:") || img.imageUrl.startsWith("http")
                ? img.imageUrl : `data:image/png;base64,${img.imageUrl}`;
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
                  {/* Hover overlay with download + restore + delete */}
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

      {selectedImage && (
        <TrashLightbox
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onDownload={handleDownload}
          onRestore={handleRestore}
        />
      )}

      {/* Permanent delete confirmation - shows task thumbnails */}
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
            {/* Show task thumbnails */}
            {deleteConfirmTask.generatedImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 bg-muted/20 rounded-lg p-2.5">
                {deleteConfirmTask.generatedImages.map((img, i) => {
                  const thumb = deleteConfirmTask.thumbnails?.[i] || img;
                  const src = thumb.startsWith("data:") || thumb.startsWith("http") ? thumb : `data:image/png;base64,${thumb}`;
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
            {/* Show all thumbnails preview */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4 bg-muted/20 rounded-lg p-2 max-h-40 overflow-y-auto custom-scrollbar">
                {images.slice(0, 20).map((img) => {
                  const src = img.thumbUrl.startsWith("data:") || img.thumbUrl.startsWith("http") ? img.thumbUrl : `data:image/png;base64,${img.thumbUrl}`;
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
