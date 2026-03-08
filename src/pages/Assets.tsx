import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ImageIcon, Loader2 } from "lucide-react";
import Layout, { loadSettings } from "@/components/Layout";
import { useGenerationStore } from "@/lib/generation-store";

export default function Assets() {
  const { toast } = useToast();
  const { tasks, setTasks } = useGenerationStore();

  // Flatten completed tasks into images
  const images = tasks
    .filter((t) => t.status === "complete" && t.generatedImages.length > 0)
    .flatMap((t) =>
      t.generatedImages.map((img, i) => ({
        id: `${t.id}-${i}`,
        taskId: t.id,
        imageUrl: img,
        prompt: t.prompt,
        model: t.model,
        aspectRatio: t.aspectRatio,
        resolution: t.resolution,
      }))
    )
    .reverse();

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast({ title: "已删除" });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">资产库</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              共 {images.length} 张历史图片
            </p>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ImageIcon className="w-10 h-10 mb-3 opacity-15" />
            <p className="text-xs opacity-40">还没有生成过图片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => {
              const src = img.imageUrl.startsWith("data:") || img.imageUrl.startsWith("http")
                ? img.imageUrl
                : `data:image/png;base64,${img.imageUrl}`;
              return (
                <div key={img.id} className="group relative rounded-md overflow-hidden bg-card border border-border/30">
                  <img
                    src={src}
                    alt={img.prompt || "生成图片"}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                    <div className="flex-1 min-w-0 mr-2">
                      {img.prompt && (
                        <p className="text-[10px] text-white/80 truncate">{img.prompt}</p>
                      )}
                      <p className="text-[10px] text-white/50">{img.model} / {img.aspectRatio} / {img.resolution}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70"
                        onClick={() => {
                          const s = loadSettings();
                          const prefix = s.downloadPrefix || "LumenDust";
                          const fmt = s.downloadFormat || "png";
                          const a = document.createElement("a");
                          a.href = src;
                          a.download = `${prefix}-${img.id}.${fmt}`;
                          a.click();
                        }}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-white/70"
                        onClick={() => handleDelete(img.taskId)}
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
    </Layout>
  );
}
