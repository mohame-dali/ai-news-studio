import React from "react";
import { Alert, Button } from "antd";
import { fr } from "@/lib/i18n";

interface Props {
  errorMessage: string;
  onRetry?: () => void;
}

export const ErrorCard: React.FC<Props> = ({ errorMessage, onRetry }) => {
  return (
    <div className="w-full aspect-[9/16] max-h-[75vh] bg-gray-50 dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-lg">
      <Alert
        type="error"
        message={fr.preview.errorTitle}
        description={errorMessage}
        showIcon
        className="mb-4 text-left"
      />
      {onRetry && (
        <Button type="primary" onClick={onRetry}>
          {fr.preview.retry}
        </Button>
      )}
    </div>
  );
};

export default ErrorCard;
