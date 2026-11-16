import React from 'react';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import { useSeason } from './useSeason';
import { SeasonalSnowfall } from './SeasonalSnowfall';
import { NewYearFireworks } from './NewYearFireworks';

/**
 * Efecto animado de la temporada, en la capa del fondo: nieve en Navidad, fuegos artificiales y
 * chispas en Año Nuevo.
 * - No se monta con el Modo Ultra Fluidez.
 * - El CSS lo esconde si el sistema pide reducir el movimiento.
 */
export const SeasonalEffects: React.FC = () => {
  const season = useSeason();
  const { settings } = useAppSettings();
  if (!season || settings.performanceMode) return null;
  return season === 'christmas' ? <SeasonalSnowfall /> : <NewYearFireworks />;
};
