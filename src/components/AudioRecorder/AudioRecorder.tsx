import React, { FC, useRef, useState } from "react";
import { Button, message, Space, Tooltip } from "antd";
import { AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined } from "@ant-design/icons";
import { fr } from "@/lib/i18n";

interface Props {
  value?: { src?: string; length?: number };
  onChange?: (value: { src?: string; length?: number }) => void;
}

export const AudioRecorder: FC<Props> = ({ value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        onChange?.({ src: audioUrl, length: Math.round(audioBlob.size / 1000) });
        message.success(fr.editor.voiceCaptured);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      message.error(fr.editor.micError);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlay = () => {
    if (!value?.src) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(value.src);
      audioPlayerRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <Tooltip title="Enregistrer une narration personnalisée au micro">
          <Button
            size="small"
            icon={<AudioOutlined />}
            onClick={startRecording}
          >
            {fr.editor.recordVoice}
          </Button>
        </Tooltip>
      ) : (
        <Button
          size="small"
          danger
          icon={<StopOutlined />}
          onClick={stopRecording}
          className="animate-pulse"
        >
          {fr.editor.stopRecording}
        </Button>
      )}

      {value?.src && (
        <Space size="small">
          <Button
            size="small"
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={togglePlay}
          >
            {isPlaying ? "Pause" : "Écouter"}
          </Button>
          <Button
            size="small"
            type="text"
            danger
            onClick={() => onChange?.({ src: undefined })}
          >
            {fr.editor.clearVoice}
          </Button>
        </Space>
      )}
    </div>
  );
};

export default AudioRecorder;
