import { useState, useRef, useEffect } from "react";
import { Send, Smile, Plus, Image, Camera, Paperclip, X, Pencil, Reply, FileText, Mic, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { getMessageTypeLabel } from "@/lib/message-utils";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface ReplyPreviewData {
  senderName: string;
  preview: string;
  messageType: string;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendAttachment?: (file: File) => void | Promise<void>;
  onDraftChange?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onValueChange?: (text: string) => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
  replyPreview?: ReplyPreviewData | null;
  onCancelReply?: () => void;
}

const ChatInput = ({
  onSend,
  onSendAttachment,
  onDraftChange,
  placeholder = "Type a message...",
  disabled,
  value,
  onValueChange,
  isEditing = false,
  onCancelEdit,
  replyPreview,
  onCancelReply,
}: ChatInputProps) => {
  const [input, setInput] = useState(value ?? "");
  const [showAttach, setShowAttach] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInput(value);
    }
  }, [value]);

  useEffect(() => {
    onDraftChange?.(input);
  }, [input, onDraftChange]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const updateInput = (nextValue: string | ((prev: string) => string)) => {
    const resolvedValue = typeof nextValue === "function" ? nextValue(input) : nextValue;
    setInput(resolvedValue);
    onValueChange?.(resolvedValue);
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    updateInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiSelect = (emoji: { native: string }) => {
    updateInput((prev) => prev + emoji.native);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const handleEmojiOpenChange = (open: boolean) => {
    setEmojiOpen(open);
  };

  const handleAttachAction = (action: string) => {
    setShowAttach(false);
    const accept =
      action === "camera" ? "image/*;capture=camera" :
      action === "gallery" ? "image/*,video/*" :
      "*/*";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = accept;
    if (action === "camera") fileInput.capture = "environment";
    fileInput.onchange = async () => {
      const selectedFile = fileInput.files?.[0];
      if (!selectedFile || !onSendAttachment) return;

      try {
        await onSendAttachment(selectedFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send attachment";
        toast.error(message);
      }
    };
    fileInput.click();
  };

  const renderReplyIcon = (messageType: string) => {
    switch (messageType) {
      case "photo":
        return <Image className="h-4 w-4" />;
      case "video":
        return <Film className="h-4 w-4" />;
      case "voice note":
        return <Mic className="h-4 w-4" />;
      case "file":
        return <FileText className="h-4 w-4" />;
      default:
        return <Reply className="h-4 w-4" />;
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-10 border-t border-border/70 chat-input-bg px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isEditing && (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Pencil className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium text-primary">Editing message</span>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onCancelEdit} className="h-7 w-7 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {replyPreview && (
          <div className="mb-3 flex items-start justify-between rounded-2xl border border-primary/18 bg-primary/8 px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 text-primary">{renderReplyIcon(getMessageTypeLabel({ message_type: replyPreview.messageType }))}</div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary">Replying to {replyPreview.senderName}</div>
                <div className="truncate text-sm text-muted-foreground">{replyPreview.preview}</div>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onCancelReply} className="h-7 w-7 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="rounded-[1.6rem] border border-white/75 bg-white/82 p-2 shadow-[0_22px_54px_-36px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
                onClick={() => setShowAttach(!showAttach)}
              >
                {showAttach ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </Button>
              {showAttach && (
                <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-12 left-0 z-50 flex flex-col gap-1 rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur">
                  <button
                    onClick={() => handleAttachAction("camera")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
                      <Camera className="h-4 w-4" />
                    </div>
                    Camera
                  </button>
                  <button
                    onClick={() => handleAttachAction("gallery")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
                      <Image className="h-4 w-4" />
                    </div>
                    Gallery
                  </button>
                  <button
                    onClick={() => handleAttachAction("file")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    Document
                  </button>
                </div>
              )}
            </div>

            <Popover open={emojiOpen} onOpenChange={handleEmojiOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto border-0 p-0 shadow-xl">
                <Picker
                  data={data}
                  onEmojiSelect={onEmojiSelect}
                  theme="auto"
                  previewPosition="none"
                  skinTonePosition="none"
                  maxFrequentRows={2}
                />
              </PopoverContent>
            </Popover>

            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => updateInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-11 flex-1 rounded-2xl border-0 bg-muted/70 text-base shadow-none md:text-sm"
              disabled={disabled}
            />

            <Button onClick={handleSend} disabled={!input.trim() || disabled} size="icon" className="h-11 w-11 shrink-0 rounded-2xl">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatInput;
