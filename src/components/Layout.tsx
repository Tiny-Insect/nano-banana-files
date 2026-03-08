import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationStore } from "@/lib/generation-store";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { settings, updateSettings } = useGenerationStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>LumenDust</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link to="/assets">
              <Button
                variant={pathname === "/assets" ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
              >
                <Image className="h-4 w-4" />
                资产库
              </Button>
            </Link>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>设置</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>API 地址</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={settings.customApiUrl}
                      onChange={(e) => updateSettings({ customApiUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API 密钥</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings.customApiKey}
                      onChange={(e) => updateSettings({ customApiKey: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>下载文件名前缀</Label>
                    <Input
                      value={settings.downloadPrefix}
                      onChange={(e) => updateSettings({ downloadPrefix: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>下载格式</Label>
                    <Select
                      value={settings.downloadFormat}
                      onValueChange={(v) => updateSettings({ downloadFormat: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpg">JPG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
