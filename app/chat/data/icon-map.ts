import {
  Landmark, Briefcase, Users, Calendar, Wallet, Gift,
  Scale, Shield, CreditCard, Search, FileText, Award,
  FlaskConical, Building, Database, FolderOpen
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * 아이콘 이름 -> 컴포넌트 매핑
 * description.icon 필드에 저장된 문자열을 컴포넌트로 변환
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Landmark,
  Briefcase,
  Users,
  Calendar,
  Wallet,
  Gift,
  Scale,
  Shield,
  CreditCard,
  Search,
  FileText,
  Award,
  FlaskConical,
  Building,
  Database,
  FolderOpen,
};

/**
 * 아이콘 이름으로 컴포넌트 반환 (없으면 Database 기본값)
 */
export function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return Database;
  return ICON_MAP[iconName] || Database;
}

/**
 * 사용 가능한 아이콘 목록 (메타데이터 편집 UI용)
 */
export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
