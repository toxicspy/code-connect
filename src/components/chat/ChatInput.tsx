import { useState, useRef, useEffect } from "react";
import { Send, Smile, Plus, Image, Camera, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ChatInput = ({ onSend, placeholder = "Type a message...", disabled }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiSelect = (emoji: any) => {
    setInput((prev) => prev + emoji.native);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const handleAttachAction = (action: string) => {
    setShowAttach(false);
    // Camera / Gallery / File actions — trigger native file picker
    const accept =
      action === "camera" ? "image/*;capture=camera" :
      action === "gallery" ? "image/*,video/*" :
      "*/*";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = accept;
    if (action === "camera") fileInput.capture = "environment";
    fileInput.onchange = () => {
      // Placeholder — file upload can be implemented later
      if (fileInput.files?.[0]) {
        const name = fileInput.files[0].name;
        setInput((prev) => prev + (prev ? " " : "") + `[📎 ${name}]`);
      }
    };
    fileInput.click();
  };

  return (
    <div className="border-t chat-input-bg px-4 py-3">
      <div className="flex items-center gap-2">
        {/* Attachment / Plus button */}
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
            <div className="absolute bottom-12 left-0 z-50 flex flex-col gap-1 rounded-xl border bg-popover p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={() => handleAttachAction("camera")}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
                  <Camera className="h-4 w-4" />
                </div>
                Camera
              </button>
              <button
                onClick={() => handleAttachAction("gallery")}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
                  <Image className="h-4 w-4" />
                </div>
                Gallery
              </button>
              <button
                onClick={() => handleAttachAction("file")}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                  <Paperclip className="h-4 w-4" />
                </div>
                Document
              </button>
            </div>
          )}
        </div>

        {/* Emoji Picker */}
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
          <PopoverContent
            side="top"
            align="start"
            className="w-auto border-0 p-0 shadow-xl"
          >
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

        {/* Text input */}
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-muted border-0"
          disabled={disabled}
        />

        {/* Send */}
        <Button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
