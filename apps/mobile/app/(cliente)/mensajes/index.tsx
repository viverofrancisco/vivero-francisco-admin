import { useRouter } from "expo-router";
import { MessagesInbox } from "@/components/MessagesInbox";

export default function ClienteMensajesScreen() {
  const router = useRouter();
  return (
    <MessagesInbox
      isAdminSide={false}
      onOpenVisita={(id, search, messageId) => {
        router.push({
          pathname: "/(cliente)/mensajes/chat/[id]",
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
