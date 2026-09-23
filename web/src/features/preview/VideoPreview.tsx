import { BLACK } from "../../theme/colors.generated";
interface Props {
  src: string;
}

export default function VideoPreview({ src }: Props) {
  return (
    <video
      src={src}
      controls
      playsInline
      style={{
        width: "100%",
        maxHeight: "60vh",
        borderRadius: 8,
        backgroundColor: BLACK,
        display: "block",
        marginBottom: 24,
      }}
    />
  );
}
