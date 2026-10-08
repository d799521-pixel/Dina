import {
  BookOpen,
  Calculator,
  Clock,
  Layers,
  Moon,
  Utensils,
  Coffee,
  Dumbbell,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  MessageCircle,
  Music,
  Palette,
  Scale,
  Shapes,
  Sun,
  Users,
  type LucideIcon
} from 'lucide-react'

/** Pictogrammes des matières (embarqués, aucun chargement réseau). */
export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  calculator: Calculator,
  clock: Clock,
  layers: Layers,
  moon: Moon,
  utensils: Utensils,
  coffee: Coffee,
  dumbbell: Dumbbell,
  flask: FlaskConical,
  globe: Globe,
  landmark: Landmark,
  languages: Languages,
  'message-circle': MessageCircle,
  music: Music,
  palette: Palette,
  scale: Scale,
  shapes: Shapes,
  sun: Sun,
  users: Users
}

export function SubjectIcon({ icon, className }: { icon: string | null; className?: string }): React.JSX.Element {
  const Icon = (icon && SUBJECT_ICONS[icon]) || BookOpen
  return <Icon className={className} aria-hidden />
}
