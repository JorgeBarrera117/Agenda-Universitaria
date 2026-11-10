import React from 'react';
import { Camera } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '../../../shared/components/form';
import { SettingsBlock, SettingsCard } from './SettingsPrimitives';
import type { AppSettings } from '../types';

interface MediaSettingsProps {
  imageQuality: AppSettings['imageQuality'];
  onImageQualityChange: (quality: AppSettings['imageQuality']) => void;
}

const QUALITY_OPTIONS: (SegmentedOption<AppSettings['imageQuality']> & { description: string })[] = [
  {
    value: 'balanced',
    label: '720p · Equilibrada',
    shortLabel: '720p',
    description: 'Recomendada: ahorra más del 70% de espacio y mantiene legibles fórmulas y texto.',
  },
  {
    value: 'high',
    label: '1080p · Alta nitidez',
    shortLabel: '1080p',
    description: 'Más detalle para diapositivas con letra muy pequeña, a cambio de ocupar más espacio.',
  },
];

export const MediaSettings: React.FC<MediaSettingsProps> = ({ imageQuality, onImageQualityChange }) => {
  const current = QUALITY_OPTIONS.find((o) => o.value === imageQuality) ?? QUALITY_OPTIONS[0];
  return (
    <SettingsCard>
      <SettingsBlock
        title="Resolución de las fotos"
        description="Calidad con la que se comprimen las fotos del pizarrón y las diapositivas."
        icon={<Camera className="h-4 w-4" aria-hidden="true" />}
      >
        <SegmentedControl
          value={imageQuality}
          onChange={onImageQualityChange}
          options={QUALITY_OPTIONS}
          ariaLabel="Resolución de las fotos"
        />
        <p className="text-xs text-[var(--color-md-on-surface-variant)]" aria-live="polite">
          {current.description}
        </p>
      </SettingsBlock>
    </SettingsCard>
  );
};
