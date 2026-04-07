import { useMemo, useRef, useState } from "react";
import { ArrowRightFromLine, ChevronDown, MessageSquareMore, Send, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAssistantStore, type AssistantContextSnapshot } from "@/lib/assistant-store";
import { formatAssistantErrorMessage, getAssistantRuntimeInfo, runImageAssistantOptimization } from "@/lib/assistant-api";
import type { ImageOptimizationContext } from "@/lib/image-assistant-protocol";

interface AssistantSidebarProps {
  snapshot: AssistantContextSnapshot;
  onApplySuggestion: (instruction: string, action: "suggest_only" | "apply" | "apply_and_generate") => Promise<string> | string;
  onWritePrompt: (prompt: string) => void;
  onApplySuggestedSettings: (settings: { model?: string; aspectRatio?: string; resolution?: string; numImages?: number; webSearch?: boolean; thinkingLevel?: string }) => void;
  onRemoveReference: (index: number) => void;
  isReferenceDropActive: boolean;
  onReferenceDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onReferenceDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onReferenceDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

function buildAssistantReply(input: string, snapshot: AssistantContextSnapshot): string {
  const context: ImageOptimizationContext = {
    prompt: snapshot.prompt,
    model: snapshot.model,
    aspectRatio: snapshot.aspectRatio,
    resolution: snapshot.resolution,
    referenceCount: snapshot.referenceCount,
    webSearch: snapshot.webSearch,
    thinkingLevel: snapshot.thinkingLevel,
  };

  const lower = input.toLowerCase();

  if (lower.includes("为什么") || lower.includes("不对") || lower.includes("问题") || lower.includes("bug") || lower.includes("排查")) {
    if (!snapshot.prompt.trim() && snapshot.referenceCount === 0) {
      return "你当前还没有输入提示词，也没有添加参考图。先给我一句目标描述，或者先放一张参考图，我再帮你细化。";
    }
  }

  return "我会基于你当前的画面需求、模型、比例和参考图情况，帮你整理成更适合出图的提示词。";
}

function formatSessionTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function AssistantSidebar({ snapshot, onApplySuggestion, onWritePrompt, onApplySuggestedSettings, onRemoveReference, isReferenceDropActive, onReferenceDragOver, onReferenceDragLeave, onReferenceDrop, onClose }: AssistantSidebarProps) {
  const { sessions, activeSessionId, setActiveSessionId, createSession, appendMessage, deleteSession } = useAssistantStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [showAllReferences, setShowAllReferences] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const runtimeInfo = getAssistantRuntimeInfo();
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId],
  );

  const createNewSession = () => {
    const sessionId = createSession("mixed");
    setActiveSessionId(sessionId);
    setInput("");
  };

  const submit = async (action: "suggest_only" | "apply" | "apply_and_generate", intent: "chat" | "optimize" = "chat") => {
    if (!activeSession || !input.trim() || busy) return;
    const userText = input.trim();
    appendMessage(activeSession.id, { role: "user", content: userText });
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const fallbackReply = buildAssistantReply(userText, snapshot);
      let reply = fallbackReply;
      try {
        const result = await runImageAssistantOptimization(intent === "optimize" ? `请专注做提示词优化：${userText}` : userText, {
          prompt: snapshot.prompt,
          model: snapshot.model,
          aspectRatio: snapshot.aspectRatio,
          resolution: snapshot.resolution,
          referenceCount: snapshot.referenceCount,
          webSearch: snapshot.webSearch,
          thinkingLevel: snapshot.thinkingLevel,
        }, controller.signal);
        reply = result.reply || fallbackReply;
        if (action !== "suggest_only") {
          const instruction = result.optimizedPrompt || userText;
          const applyResult = await onApplySuggestion(instruction, action);
          reply += `\n\n${applyResult}`;
        }
        const promptPreview = intent === "optimize" && result.optimizedPrompt
          ? `${reply}\n\n优化后的提示词：\n${result.optimizedPrompt}`
          : reply;

        appendMessage(activeSession.id, {
          role: "assistant",
          content: promptPreview,
          optimizedPrompt: intent === "optimize" ? (result.optimizedPrompt || null) : null,
          suggestedSettings: result.suggestedSettings,
        });
        return;
      } catch (error: any) {
        if (controller.signal.aborted) {
          appendMessage(activeSession.id, { role: "system", content: "已停止本次回复" });
          return;
        }
        if (action !== "suggest_only") {
          const applyResult = await onApplySuggestion(userText, action);
          reply += `\n\n${applyResult}`;
        }
        reply += `\n\n（助手 API 暂时不可用，已切换为本地规则模式：${formatAssistantErrorMessage(error)}）`;
      }
      appendMessage(activeSession.id, { role: "assistant", content: reply });
    } finally {
      requestControllerRef.current = null;
      setBusy(false);
    }
  };

  const stopCurrentRequest = () => {
    requestControllerRef.current?.abort();
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-background/95 backdrop-blur-xl">
      <div className="px-4 py-4 border-b border-border/30 text-left">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquareMore className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">对话</p>
              <p className="text-[11px] text-muted-foreground">陪你整理想法、优化提示词</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              onClick={createNewSession}
              title="新建对话"
            >
              <MessageSquareMore className="w-4 h-4" />
            </button>
            <Popover open={showSessionList} onOpenChange={setShowSessionList}>
              <PopoverTrigger asChild>
                <button
                  className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  title={showSessionList ? "收起历史对话" : "展开历史对话"}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSessionList ? "rotate-180" : "rotate-0"}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="bottom" sideOffset={8} className="w-[320px] p-2 bg-card/95 backdrop-blur-xl border-border/40 shadow-2xl">
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group rounded-xl px-3 py-2.5 transition-colors border ${
                        session.id === activeSessionId
                          ? "bg-primary/10 border-primary/20"
                          : "bg-muted/20 border-transparent hover:bg-muted/40"
                      }`}
                      title={session.title}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setActiveSessionId(session.id);
                            setShowSessionList(false);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{session.title}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">{formatSessionTime(session.updatedAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {session.messages.at(-1)?.content || "开始一个新想法"}
                          </p>
                        </button>
                        {deleteConfirmSessionId === session.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              className="w-6 h-6 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10"
                              title="确认删除"
                              onClick={() => {
                                deleteSession(session.id);
                                setDeleteConfirmSessionId(null);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40"
                              title="取消"
                              onClick={() => setDeleteConfirmSessionId(null)}
                            >
                              <Square className="w-3 h-3 fill-current" />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="删除对话"
                            onClick={() => setDeleteConfirmSessionId(session.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" title="收起助手" onClick={onClose}>
                <ArrowRightFromLine className="w-[18px] h-[18px]" />
              </button>
          </div>
        </div>
        <div className="pt-2 text-[10px] text-muted-foreground/80 leading-relaxed">
          <div>当前助手：{runtimeInfo.provider} / {runtimeInfo.configuredModel}</div>
          <div>{runtimeInfo.usingImageApiFallback ? "当前复用生图配置" : "当前使用独立助手配置"}</div>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border/20 overflow-x-hidden space-y-3">
        <p className="text-[11px] text-muted-foreground">当前会话：{activeSession?.title || "新对话"}</p>
        <div
          className={`rounded-xl border px-3 py-2.5 space-y-2 transition-all duration-200 relative ${isReferenceDropActive ? "border-primary/50 bg-primary/10" : "border-border/30 bg-muted/20"}`}
          onDragOver={onReferenceDragOver}
          onDragLeave={onReferenceDragLeave}
          onDrop={onReferenceDrop}
        >
          {isReferenceDropActive && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] whitespace-nowrap shadow-lg">
              释放以添加为参考图
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[12px] font-medium">当前参考图</p>
              <p className="text-[10px] text-muted-foreground">{snapshot.referenceCount > 0 ? `已带入 ${snapshot.referenceCount} 张` : "当前没有参考图"}</p>
            </div>
            {snapshot.referenceCount > 3 && (
              <button
                onClick={() => setShowAllReferences((prev) => !prev)}
                className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title={showAllReferences ? "收起参考图" : "展开参考图"}
              >
                {showAllReferences ? "收起" : "展开"}
              </button>
            )}
          </div>
          {snapshot.referencePreviews.length > 0 ? (
            <div className="flex items-end gap-1 overflow-x-auto custom-scrollbar pb-1">
              {(showAllReferences ? snapshot.referencePreviews : snapshot.referencePreviews.slice(0, 6)).map((preview, i) => {
                const actualIndex = showAllReferences ? i : i;
                return (
                  <div
                    key={`${preview}-${i}`}
                    className="relative shrink-0 rounded-lg overflow-hidden border border-border/30 group/ref"
                    style={{
                      width: 40,
                      height: 52,
                      marginLeft: i > 0 ? -8 : 0,
                      zIndex: i,
                      transform: "rotate(-10deg)",
                    }}
                  >
                    <img
                      src={preview}
                      alt="参考图"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => onRemoveReference(actualIndex)}
                      className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white rounded-bl-sm flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity"
                      title="移除参考图"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/60 rounded-lg border border-dashed border-border/30 px-3 py-2">
              你在主提示词栏或任务卡中加入参考图后，这里会实时显示。
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
        {activeSession?.messages.length ? activeSession.messages.map((message) => (
          <div key={message.id} className="space-y-2">
            <div
              className={`rounded-2xl px-3.5 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-8"
                  : message.role === "assistant"
                    ? "bg-muted/40 mr-4"
                    : "bg-secondary/50 text-secondary-foreground"
              }`}
            >
              {message.content}
            </div>
            {message.role === "assistant" && (message.optimizedPrompt || message.suggestedSettings) && (
              <div className="mr-4 flex flex-wrap items-center gap-2">
                {message.optimizedPrompt && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => onWritePrompt(message.optimizedPrompt || "")}
                  >
                    写入提示词
                  </Button>
                )}
                {message.suggestedSettings?.aspectRatio && <span className="text-[10px] px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">比例 {message.suggestedSettings.aspectRatio}</span>}
                {message.suggestedSettings?.resolution && <span className="text-[10px] px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">{message.suggestedSettings.resolution.toUpperCase()}</span>}
                {message.suggestedSettings?.numImages && <span className="text-[10px] px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">{message.suggestedSettings.numImages} 张</span>}
                {message.suggestedSettings?.model && <span className="text-[10px] px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">{message.suggestedSettings.model}</span>}
                {message.suggestedSettings && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => onApplySuggestedSettings(message.suggestedSettings || {})}
                  >
                    应用建议参数
                  </Button>
                )}
              </div>
            )}
          </div>
        )) : (
          <div className="text-sm text-muted-foreground/70 px-1 py-2 space-y-2">
            <p>告诉我你想做什么画面，我先帮你把想法整理清楚。</p>
            <p>例如：</p>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              <li>帮我把这句提示词写得更像商业海报</li>
              <li>我想做电影感、冷色调、人物半身特写</li>
              <li>为什么我现在这组参考图生成出来不稳定</li>
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-border/30 p-4">
        <div className="rounded-2xl border border-border/40 bg-background/50 p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={() => input.trim() && submit("suggest_only", "optimize")}
              disabled={!input.trim() || busy}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              提示词优化
            </button>
            <div className="text-[11px] text-muted-foreground text-right leading-relaxed">
              <div>{snapshot.model}</div>
              <div>{snapshot.aspectRatio} · {snapshot.resolution.toUpperCase()} · {snapshot.referenceCount} 张参考图</div>
            </div>
          </div>

          <div className="relative rounded-xl bg-background/20">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="描述你想要的画面，或者把现在的问题直接告诉我..."
              className="min-h-[156px] resize-none border-0 bg-transparent px-0 py-0 pr-14 shadow-none focus-visible:ring-0"
            />
            <button
              onClick={() => (busy ? stopCurrentRequest() : submit("suggest_only", "chat"))}
              disabled={!busy && !input.trim()}
              className="absolute right-1 bottom-1 inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
              title={busy ? "停止" : "发送"}
            >
              {busy ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
