import React from "react";
import { Spin } from "antd";
import { fr } from "@/lib/i18n";

export const LoadingCard: React.FC = () => {
  return (
    <div className="w-full aspect-[9/16] max-h-[75vh] bg-gray-900 rounded-xl flex flex-col items-center justify-center text-white gap-3 shadow-lg">
      <Spin size="large" />
      <span className="text-sm font-medium text-gray-300">{fr.preview.generating}</span>
    </div>
  );
};

export default LoadingCard;
