import { memo } from "react";
import { DEFAULT_HUMAN_AVATAR_ID, HUMAN_GIF_AVATARS } from "../../utils/constants";
import { useChatStore } from "../../store/chatStore";

interface Props {
    isSpeaking: boolean;
}

export const StaticAvatar = memo(function StaticAvatar({ isSpeaking: _isSpeaking }: Props) {
    const avatarId = useChatStore((s) => s.avatarId);

    const imageUrl =
        HUMAN_GIF_AVATARS[avatarId as keyof typeof HUMAN_GIF_AVATARS]
        ?? HUMAN_GIF_AVATARS[DEFAULT_HUMAN_AVATAR_ID];

    return (
        <img
            src={imageUrl}
            alt="Avatar"
            className="rounded-full object-cover"
            style={{
                width: "100%",
                height: "100%",
                imageRendering: "auto",
            }}
        />
    );
});
