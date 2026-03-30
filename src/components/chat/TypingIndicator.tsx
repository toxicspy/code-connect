interface TypingIndicatorProps {
  align?: "left" | "right";
  label?: string;
}

const TypingIndicator = ({ align = "left", label = "Typing" }: TypingIndicatorProps) => {
  const isRight = align === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} animate-message-in`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isRight ? "chat-bubble-sent rounded-br-md" : "chat-bubble-received rounded-bl-md"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${isRight ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
            {label}
          </span>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${isRight ? "bg-primary-foreground/85" : "bg-muted-foreground/80"} animate-bounce`} />
            <span className={`h-1.5 w-1.5 rounded-full ${isRight ? "bg-primary-foreground/85" : "bg-muted-foreground/80"} animate-bounce [animation-delay:150ms]`} />
            <span className={`h-1.5 w-1.5 rounded-full ${isRight ? "bg-primary-foreground/85" : "bg-muted-foreground/80"} animate-bounce [animation-delay:300ms]`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
