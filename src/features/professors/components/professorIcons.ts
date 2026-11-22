/** Íconos de los docentes: los que se ofrecen (personas de distintos tipos) y los de versiones anteriores. */
import type React from 'react';
import {
  Atom,
  Award,
  BookOpen,
  BookUser,
  Briefcase,
  Calculator,
  CircleUserRound,
  ContactRound,
  GraduationCap,
  HeartPulse,
  Laptop,
  PersonStanding,
  Scale,
  Sparkles,
  Speech,
  SquareUser,
  Type,
  User,
  UserCheck,
  UserCog,
  UserPen,
  UserRound,
  UserSearch,
  UserShield,
  UserStar,
  UsersRound,
} from 'lucide-react';

export interface ProfessorIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Íconos que se ofrecen al registrar un docente: personas de distintos tipos (y las iniciales). */
export const PROFESSOR_ICONS: ProfessorIconOption[] = [
  { id: 'user', label: 'Docente', icon: User },
  { id: 'user-round', label: 'Docente (redondeado)', icon: UserRound },
  { id: 'circle-user', label: 'Perfil', icon: CircleUserRound },
  { id: 'user-star', label: 'Destacado', icon: UserStar },
  { id: 'user-check', label: 'Asesor', icon: UserCheck },
  { id: 'user-pen', label: 'Investigador', icon: UserPen },
  { id: 'user-search', label: 'Tutor', icon: UserSearch },
  { id: 'user-cog', label: 'Coordinador', icon: UserCog },
  { id: 'user-shield', label: 'Director', icon: UserShield },
  { id: 'speech', label: 'Conferencista', icon: Speech },
  { id: 'book-user', label: 'Lector', icon: BookUser },
  { id: 'person-standing', label: 'Entrenador', icon: PersonStanding },
  { id: 'contact', label: 'Contacto', icon: ContactRound },
  { id: 'square-user', label: 'Credencial', icon: SquareUser },
  { id: 'users', label: 'Equipo docente', icon: UsersRound },
  { id: 'initials', label: 'Iniciales', icon: Type },
];

/** Íconos de versiones anteriores: ya no se ofrecen, pero los docentes que los tienen se siguen viendo igual. */
const LEGACY_PROFESSOR_ICONS: ProfessorIconOption[] = [
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
];

const ICON_BY_ID: ReadonlyMap<string, React.ComponentType<{ className?: string }>> = new Map([...PROFESSOR_ICONS, ...LEGACY_PROFESSOR_ICONS].map((option) => [option.id, option.icon]));

/** Ícono de un docente (también los de versiones anteriores); el genérico si no se reconoce. */
export function professorIconComponent(id: string | undefined): React.ComponentType<{ className?: string }> {
  return (id && ICON_BY_ID.get(id)) || User;
}

/** Para validar lo que llega en un .agcontact (también de versiones anteriores). */
export function isProfessorIconId(id: string): boolean {
  return ICON_BY_ID.has(id);
}
