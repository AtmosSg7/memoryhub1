import { memo } from "react";
import { avatarTone, initialsFrom } from "./inboxUtils";

function ConversationAvatar({ name, email, size = "md", className = "" }) {
  const seed = email || name || "?";
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-10 w-10 text-xs";
  return (
    <div
      className={[
        "shrink-0 rounded-full flex items-center justify-center font-semibold",
        sizeClass,
        avatarTone(seed),
        className,
      ].join(" ")}
      aria-hidden
      data-testid="conversation-avatar"
    >
      {initialsFrom(name || email)}
    </div>
  );
}

export default memo(ConversationAvatar);
