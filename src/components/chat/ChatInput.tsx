import { useState, useRef, useEffect } from "react";
import { Send, Smile, Plus, Image, Camera, Paperclip, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onDraftChange?: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onValueChange?: (text: string) => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

const ChatInput = ({
  onSend,
  onDraftChange,
  placeholder = "Type a message...",
  disabled,
  value,
  onValueChange,
  isEditing = false,
  onCancelEdit,
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
    fileInput.onchange = () => {
      if (fileInput.files?.[0]) {
        const name = fileInput.files[0].name;
        updateInput((prev) => prev + (prev ? " " : "") + `[file ${name}]`);
      }
    };
    fileInput.click();
  };

  return (
    <div className="sticky bottom-0 z-10 border-t chat-input-bg px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {isEditing && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Pencil className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium text-primary">Editing message</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancelEdit} className="h-7 w-7 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowAttach(!showAttach)}
          >
            {showAttach ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </Button>
          {showAttach && (
            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-12 left-0 z-50 flex flex-col gap-1 rounded-xl border bg-popover p-2 shadow-lg">
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

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
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
          className="flex-1 border-0 bg-muted text-base md:text-sm"
          disabled={disabled}
        />

        <Button onClick={handleSend} disabled={!input.trim() || disabled} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
