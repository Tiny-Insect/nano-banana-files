/**
 * Unified ImageLightbox component.
 * Replaces three separate lightbox implementations across Home, Assets, and RecentlyDeleted.
 */

import { useState, useEffect } from "react";
import { Download, X, RotateCcw, Copy, Pencil, RefreshCw, MapPin, Trash2, ClipboardCopy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { resolveImageSrc, formatDate } from "@/lib/format";
import { downloadOriginalImage } from "@/lib/api";
import type { GenerationTask } from "@/lib/generation-store";

const MODEL_LABELS: Record<string, string> = {
  "nanobanana-2": "NanoBanana 2",
  "nanobanana-pro": "NanoBanana Pro",
};

export type LightboxMode = "simple" | "asset" | "trash";

export interface LightboxImage {
  /** Original image URL (always from generatedImages, never thumbnail) */
  imageUrl: string;
  imageIndex: number;
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  createdAt?: number;
  completedAt?: number;
  webSearch?: boolean;
  thinkingLevel?: string;
  taskId?: string;
  task?: GenerationTask;
}

interface ImageLightboxProps {
  image: LightboxImage;
  mode: LightboxMode;
  onClose: () => void;
  /** Asset mode callbacks */
  onUsePrompt?: (p: string) => void;
  onReEdit?: (task: GenerationTask) => void;
  onReGenerate?: (task: GenerationTask) => void;
  onLocate?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  /** Trash mode callbacks */
  onRestore?: (taskId: string) => void;
}

export default function ImageLightbox({ image, mode, onClose, onUsePrompt, onReEdit, onReGenerate, onLocate, onDelete, onRestore }: ImageLightboxProps) {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const src = resolveImageSrc(image.imageUrl);

  const handleDownload = () => {
    downloadOriginalImage(image.imageUrl, image.imageIndex);
  };

  const handleCopyPrompt = async () => {
    if (!image.prompt) return;
    try {
      await navigator.clipboard.writeText(image.prompt);
      toast({ title: "已复制到剪贴板" });
    } catch {
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
    setVisible(false);
    setTimeout(() => {
      onDelete?.(image.taskId!);
      onClose();
    }, 300);
  };

  // Simple mode: just image + download button (used by Home page for ref image preview)
  if (mode === "simple") {
    return (
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center cursor-pointer transition-all duration-200 ${visible ? "bg-black/80 backdrop-blur-sm" : "bg-black/0"}`}
        onClick={handleClose}
      >
        <div className={`flex flex-col items-center gap-3 transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`} onClick={(e) => e.stopPropagation()}>
          <img src={src} alt="放大预览" className="max-w-[90vw] max-h-[82vh] object-contain rounded-lg shadow-2xl" />
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium backdrop-blur-md transition-all duration-200 border border-white/10"
          >
            <Download className="w-4 h-4" />
            下载原图
          </button>
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

  // Trash mode: image + download + restore
  if (mode === "trash") {
    return (
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${visible ? "bg-black/80 backdrop-blur-md" : "bg-black/0"}`}
        onClick={handleClose}
      >
        <div
          className={`flex flex-col items-center gap-4 transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <img src={src} alt="已删除图片" className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl" />
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium backdrop-blur-md transition-all duration-200 border border-white/10"
            >
              <Download className="w-4 h-4" />
              下载原图
            </button>
            <button
              onClick={() => { onRestore?.(image.taskId!); handleClose(); }}
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

  // Asset mode: full detail panel
  const modelLabel = MODEL_LABELS[image.model || ""] || image.model || "";

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
                ["比例", image.aspectRatio || ""],
                ["分辨率", (image.resolution || "").toUpperCase()],
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
              onClick={() => { onUsePrompt?.(image.prompt!); handleClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <Copy className="w-4 h-4" />
              使用提示词
            </button>
            <button
              onClick={() => { onReEdit?.(image.task!); handleClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <Pencil className="w-4 h-4" />
              重新编辑
            </button>
            <button
              onClick={() => onReGenerate?.(image.task!)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border border-border/20"
            >
              <RefreshCw className="w-4 h-4" />
              再次生成
            </button>
            <button
              onClick={() => { onLocate?.(image.taskId!); handleClose(); }}
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
              onClick={handleDownload}
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
                <p className="text-xs text-muted-foreground mt-0.5">该任务将移至「最近删除」，可随时找回</p>
              </div>
            </div>
            {image.task?.generatedImages && image.task.generatedImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 bg-muted/20 rounded-lg p-2.5">
                {image.task.generatedImages.map((img, i) => {
                  const thumb = image.task!.thumbnails?.[i] || img;
                  const thumbSrc = resolveImageSrc(thumb);
                  return (
                    <img
                      key={i}
                      src={thumbSrc}
                      alt=""
                      className="rounded-md object-cover"
                      style={{ width: image.task!.generatedImages.length === 1 ? "100%" : "calc(50% - 3px)", maxHeight: 120 }}
                    />
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-8 px-4 text-xs" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </Button>
              <Button variant="destructive" size="sm" className="h-8 px-4 text-xs" onClick={handleConfirmDelete}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
