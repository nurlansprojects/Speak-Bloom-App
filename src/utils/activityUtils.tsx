import React from 'react';
import { ActivityFormat } from '../types';
import { PenLine, Mic, Sparkles, UploadCloud, FileText } from 'lucide-react';

/**
 * Centralized Activity Icon Helper for Speak Bloom
 * Enforces consistent branding (#6546D7) across the entire platform.
 */
export function getActivityIcon(format: ActivityFormat, className: string = 'w-4 h-4 text-[#6546D7]') {
  switch (format) {
    case 'text':
      return <PenLine className={className} />;
    case 'recording':
      return <Mic className={className} />;
    case 'ai_conversation':
      return <Sparkles className={className} />;
    case 'uploading':
      return <UploadCloud className={className} />;
    default:
      return <FileText className={className} />;
  }
}

/**
 * Human-readable format label
 */
export function getActivityFormatLabel(format: ActivityFormat): string {
  switch (format) {
    case 'text':
      return 'Text Response';
    case 'recording':
      return 'Voice Recording';
    case 'ai_conversation':
      return 'AI Speaking Partner';
    case 'uploading':
      return 'File Uploading';
    default:
      return 'Practice Activity';
  }
}

/**
 * Action button label for starting/viewing an activity
 */
export function getActivityActionLabel(format: ActivityFormat): string {
  switch (format) {
    case 'text':
      return 'Write Response';
    case 'recording':
      return 'Record Voice';
    case 'ai_conversation':
      return 'Practice with Bloom';
    case 'uploading':
      return 'Upload Assignment';
    default:
      return 'Start Activity';
  }
}
