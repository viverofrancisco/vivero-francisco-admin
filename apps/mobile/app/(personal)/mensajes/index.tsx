import { useRouter } from "expo-router";
import { MessagesInbox } from "@/components/MessagesInbox";

export default function PersonalMensajesScreen() {
  const router = useRouter();
  return (
    <MessagesInbox
      isAdminSide={true}
      onOpenVisita={(id, search, messageId) => {
        router.push({
          pathname: "/(personal)/mensajes/chat/[id]",
          params: {
            id,
            ...(search ? { search } : {}),
            ...(messageId ? { messageId } : {}),
          },
        });
      }}
    />
  );
}
