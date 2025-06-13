import React from 'react';
import { useLocale } from '../LocaleContext';
import Button from './Button'; // Assuming Button component is in the same directory or accessible
import Textarea from './Textarea'; // Assuming Textarea component is available

const GeminiAssistantWidget: React.FC = () => {
  const { t } = useLocale();

  return (
    <div className="p-4 border border-dashed border-slate-600 rounded-lg bg-slate-700/50">
      <h3 className="text-lg font-semibold text-cyan-400 mb-2">
        {t('adminDashboard_geminiAssistantTitle')}
      </h3>
      <p className="text-sm text-slate-300 mb-3">
        {t('adminDashboard_geminiAssistantWelcome')}
      </p>
      <div className="space-y-3">
        <Textarea
          placeholder={t('adminDashboard_geminiAssistantInputPlaceholder')}
          aria-label={t('adminDashboard_geminiAssistantInputPlaceholder')}
          rows={3}
          className="mb-0" // Remove default bottom margin from Textarea component
        />
        <Button
          variant="primary"
          className="w-full sm:w-auto"
        >
          {t('adminDashboard_geminiAssistantSend')}
        </Button>
      </div>
      {/* Placeholder for future chat messages or responses */}
      <div className="mt-4 text-xs text-slate-500 italic">
        (Gemini Assistant Widget Placeholder - Full functionality to be implemented here)
      </div>
    </div>
  );
};

export default GeminiAssistantWidget;
