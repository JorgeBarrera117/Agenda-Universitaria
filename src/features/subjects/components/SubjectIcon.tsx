import React from 'react';
import {
  BookOpen,
  Code,
  Cpu,
  Calculator,
  Atom,
  FlaskConical,
  Scale,
  Briefcase,
  TrendingUp,
  Compass,
  Languages,
  HeartPulse,
  Palette,
  Brain,
  Globe,
  ShieldCheck,
  Award,
  Sparkles,
} from 'lucide-react';

export interface SubjectIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SUBJECT_ICONS: SubjectIconOption[] = [
  { id: 'book', label: 'General / Lectura', icon: BookOpen },
  { id: 'code', label: 'Programación', icon: Code },
  { id: 'cpu', label: 'Sistemas / TI', icon: Cpu },
  { id: 'calculator', label: 'Matemáticas', icon: Calculator },
  { id: 'atom', label: 'Física / Ciencias', icon: Atom },
  { id: 'flask', label: 'Química / Lab', icon: FlaskConical },
  { id: 'scale', label: 'Derecho / Legal', icon: Scale },
  { id: 'briefcase', label: 'Negocios / Admin', icon: Briefcase },
  { id: 'trending-up', label: 'Economía / Finanzas', icon: TrendingUp },
  { id: 'compass', label: 'Ingeniería / Diseño', icon: Compass },
  { id: 'languages', label: 'Idiomas', icon: Languages },
  { id: 'heart', label: 'Salud / Medicina', icon: HeartPulse },
  { id: 'palette', label: 'Arte / Creativo', icon: Palette },
  { id: 'brain', label: 'Psicología / IA', icon: Brain },
  { id: 'globe', label: 'Social / Geografía', icon: Globe },
  { id: 'shield', label: 'Ciberseguridad', icon: ShieldCheck },
  { id: 'award', label: 'Tesis / Grado', icon: Award },
  { id: 'sparkles', label: 'Electiva Libre', icon: Sparkles },
];

export const SUBJECT_PRESET_COLORS = [
  '#006BBB', // Cove Blue
  '#30A0E0', // Cove Sky
  '#004d88', // Cove Deep
  '#081d33', // Navy Universitario
  '#0d9488', // Teal
  '#10b981', // Esmeralda
  '#059669', // Verde Bosque
  '#f59e0b', // Ámbar
  '#ea580c', // Naranja
  '#ef4444', // Rojo Carmesí
  '#e11d48', // Rosa Rubí
  '#8b5cf6', // Púrpura
  '#6366f1', // Índigo
  '#ec4899', // Rosa
  '#64748b', // Pizarra
];

export const renderSubjectGlyph = (
  iconId: string | undefined,
  className: string = 'w-4 h-4'
): React.ReactNode => {
  switch (iconId) {
    case 'code':
      return <Code className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'calculator':
      return <Calculator className={className} />;
    case 'atom':
      return <Atom className={className} />;
    case 'flask':
      return <FlaskConical className={className} />;
    case 'scale':
      return <Scale className={className} />;
    case 'briefcase':
      return <Briefcase className={className} />;
    case 'trending-up':
      return <TrendingUp className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'languages':
      return <Languages className={className} />;
    case 'heart':
      return <HeartPulse className={className} />;
    case 'palette':
      return <Palette className={className} />;
    case 'brain':
      return <Brain className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'book':
    default:
      return <BookOpen className={className} />;
  }
};

export interface SubjectIconProps {
  icon?: string;
  className?: string;
}

export const SubjectIcon: React.FC<SubjectIconProps> = ({ icon, className = 'w-4 h-4' }) => {
  return <>{renderSubjectGlyph(icon, className)}</>;
};

export interface SubjectBadgeProps {
  icon?: string;
  color?: string;
  size?: 'select' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const SubjectBadge: React.FC<SubjectBadgeProps> = ({
  icon,
  color = '#00639B',
  size = 'select',
  className = '',
}) => {
  const sizeStyles = {
    select: { box: 'w-6 h-6', shape: 'rounded-lg', icon: 'w-3.5 h-3.5' },
    sm: { box: 'w-5 h-5', shape: 'rounded-lg', icon: 'w-3 h-3' },
    md: { box: 'w-8 h-8', shape: 'rounded-xl', icon: 'w-4 h-4' },
    lg: { box: 'w-10 h-10', shape: 'rounded-2xl', icon: 'w-5 h-5' },
  }[size];

  return (
    <div
      style={{ backgroundColor: color }}
      className={`${sizeStyles.box} ${sizeStyles.shape} text-white flex items-center justify-center shadow-md ring-2 ring-white/20 shrink-0 select-none overflow-hidden ${className}`}
    >
      {renderSubjectGlyph(icon, sizeStyles.icon)}
    </div>
  );
};

