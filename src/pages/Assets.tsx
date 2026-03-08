import { useState } from "react";
import { Download, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useGenerationStore } from "@/lib/generation-store";

export default function Assets() {
  const { tasks, removeTask } = useGenerationStore();

  // Flatten all completed images with their task info
  const allImages = tasks
    .filter((t) => t.status === "complete" && t.generatedImages.length > 0)
    .flatMap((t) =>
      t.generatedImages.map((img, i) => ({
        taskId: t.id,
        imageUrl: img,
        prompt: t.prompt,
        model: t.model,
        createdAt: t.completedAt || t.createdAt || 0,
        index: i,
      }))
    )
    .reverse();

  if (allImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">暂无图片</h2>
        <p className="text-muted-foreground">生成的图片会显示在这里</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">资产库</h1>
        <span className="text-sm text-muted-foreground">{allImages.length} 张图片</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {allImages.map((item, i) => (
          <div
            key={`${item.taskId}-${item.index}`}
            className="group relative rounded-xl overflow-hidden bg-secondary aspect-square border"
          >
            <img
              src={item.imageUrl}
              alt={item.prompt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-white/80 line-clamp-2 mb-2">{item.prompt}</p>
                <div className="flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = item.imageUrl;
                      a.download = `LumenDust_${Date.now()}.png`;
                      a.click();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          删除后无法恢复，确定要删除这张图片吗？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeTask(item.taskId)}>
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
