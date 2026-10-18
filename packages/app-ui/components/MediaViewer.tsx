import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";

export interface MediaViewerSource {
  url: string;
  tipo: "imagen" | "video" | string;
}

export function MediaViewer({
  media,
  onClose,
}: {
  media: MediaViewerSource | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={media !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {media?.tipo === "video" ? (
        <VideoBody url={media.url} onClose={onClose} />
      ) : media ? (
        <ImageBody url={media.url} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function ImageBody({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        resizeMode="contain"
      />
      <CloseButton onPress={onClose} top={insets.top + 12} />
    </View>
  );
}

function VideoBody({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
      <CloseButton onPress={onClose} top={insets.top + 12} />
    </View>
  );
}

function CloseButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.closeBtn,
        { top },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.closeBtnLabel}>×</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  video: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnLabel: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "300",
  },
});
