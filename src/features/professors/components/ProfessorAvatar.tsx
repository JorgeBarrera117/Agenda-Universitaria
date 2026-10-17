import React from 'react';
import {
  User,
  GraduationCap,
  Briefcase,
  BookOpen,
  Laptop,
  Atom,
  Calculator,
  Scale,
  HeartPulse,
  Award,
  Sparkles,
  Type,
} from 'lucide-react';

export interface ProfessorIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PROFESSOR_ICONS: ProfessorIconOption[] = [
  { id: 'user', label: 'Docente', icon: User },
  { id: 'graduation-cap', label: 'Catedrático', icon: GraduationCap },
  { id: 'briefcase', label: 'Profesional', icon: Briefcase },
  { id: 'book', label: 'Humanidades', icon: BookOpen },
  { id: 'laptop', label: 'Tecnología', icon: Laptop },
  { id: 'atom', label: 'Ciencias', icon: Atom },
  { id: 'calculator', label: 'Cálculo', icon: Calculator },
  { id: 'scale', label: 'Leyes', icon: Scale },
  { id: 'heart', label: 'Salud', icon: HeartPulse },
  { id: 'award', label: 'Mérito', icon: Award },
  { id: 'sparkles', label: 'Creativo', icon: Sparkles },
  { id: 'initials', label: 'Iniciales', icon: Type },
];

export const PROFESSOR_PRESET_COLORS = [
  '#081d33', // Navy Universitario (Por defecto)
  '#006BBB', // Cove Blue
  '#004d88', // Cove Deep
  '#30A0E0', // Cove Sky
  '#0d9488', // Teal
  '#10b981', // Esmeralda
  '#f59e0b', // Ámbar
  '#ea580c', // Naranja
  '#ef4444', // Rojo
  '#8b5cf6', // Púrpura
  '#ec4899', // Rosa
  '#475569', // Pizarra
];

export interface ProfessorAvatarProps {
  name: string;
  icon?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'contact' | 'lg' | 'xl' | 'select';
  shape?: 'squircle' | 'circle';
  className?: string;
}

export const renderProfessorGlyph = (
  iconId: string | undefined,
  name: string,
  iconClassName: string = 'w-5 h-5'
): React.ReactNode => {
  // Si no tiene icono o se especificó 'initials', mostrar iniciales
  if (iconId === 'initials' || (!iconId && name)) {
    const initials = name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

    if (initials) {
      return <span>{initials}</span>;
    }
  }

  // Mapeo de icono por identificador
  switch (iconId) {
    case 'graduation-cap':
      return <GraduationCap className={iconClassName} />;
    case 'briefcase':
      return <Briefcase className={iconClassName} />;
    case 'book':
      return <BookOpen className={iconClassName} />;
    case 'laptop':
      return <Laptop className={iconClassName} />;
    case 'atom':
      return <Atom className={iconClassName} />;
    case 'calculator':
      return <Calculator className={iconClassName} />;
    case 'scale':
      return <Scale className={iconClassName} />;
    case 'heart':
      return <HeartPulse className={iconClassName} />;
    case 'award':
      return <Award className={iconClassName} />;
    case 'sparkles':
      return <Sparkles className={iconClassName} />;
    case 'user':
    default:
      return <User className={iconClassName} />;
  }
};

export const ProfessorAvatar: React.FC<ProfessorAvatarProps> = ({
  name,
  icon,
  color = '#081d33',
  size = 'md',
  shape = 'squircle',
  className = '',
}) => {
  const sizeStyles = {
    xs: { box: 'w-4 h-4 text-[8px]', shapeClass: 'rounded-md', icon: 'w-2.5 h-2.5' },
    sm: { box: 'w-5 h-5 text-[9px]', shapeClass: 'rounded-lg', icon: 'w-3 h-3' },
    select: { box: 'w-6 h-6 text-[10px]', shapeClass: 'rounded-lg', icon: 'w-3.5 h-3.5' },
    md: { box: 'w-7 h-7 text-xs', shapeClass: 'rounded-xl', icon: 'w-4 h-4' },
    contact: { box: 'w-11 h-11 sm:w-12 sm:h-12 text-sm sm:text-base font-bold', shapeClass: 'rounded-full', icon: 'w-5 h-5 sm:w-6 sm:h-6' },
    lg: { box: 'w-13 h-13 text-sm font-black', shapeClass: 'rounded-2xl', icon: 'w-6 h-6' },
    xl: { box: 'w-14 h-14 text-base font-black', shapeClass: 'rounded-2xl', icon: 'w-7 h-7' },
  }[size];

  const effectiveShapeClass = shape === 'circle' ? 'rounded-full' : sizeStyles.shapeClass;

  return (
    <div
      style={{ backgroundColor: color }}
      className={`${sizeStyles.box} ${effectiveShapeClass} text-white flex items-center justify-center shadow-md ring-2 ring-white/20 shrink-0 select-none overflow-hidden ${className}`}
      title={name}
      aria-label={`Avatar de ${name}`}
    >
      {renderProfessorGlyph(icon, name, sizeStyles.icon)}
    </div>
  );
};
