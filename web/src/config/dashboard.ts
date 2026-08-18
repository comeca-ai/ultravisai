import {
  BarChart3,
  Building2,
  CircleDollarSign,
  Eye,
  FileText,
  Gauge,
  Globe,
  LineChart,
  Quote,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { Feature } from '@/config/plans';

/**
 * A brand-level preference that, when present on a NavItem, must be `true`
 * on the active brand for the item to render at all. Distinct from plan-level
 * `requiredFeature` which downgrades the item to a locked/disabled state when
 * the plan doesn't include it — `requiresBrandPref` hides the item entirely so
 * it doesn't appear as a "you could have this if you paid more" hint when the
 * active brand isn't supposed to see Shopping in the first place.
 */
export type BrandPrefKey = 'shoppingModeEnabled';

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
  requiredFeature?: Feature;
  requiresBrandPref?: BrandPrefKey;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
  /** Only rendered for platform operators (see @/lib/admin). */
  adminOnly?: boolean;
}

export const dashboardNav: NavGroup[] = [
  {
    items: [
      {
        title: 'Brands',
        href: '/dashboard/brands',
        icon: Building2,
      },
      {
        title: 'Agent',
        href: '/dashboard/agent',
        icon: Sparkles,
        requiredFeature: 'ai_agent',
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        title: 'Answer Engine Insights',
        href: '/dashboard/insights',
        icon: BarChart3,
        requiredFeature: 'basic_insights',
      },
      // Ultravis addition (fork layer): Citability Index page — the
      // prescriptive counterpart to Insights. Framework source of truth:
      // estrategia/indice-citabilidade.md.
      {
        title: 'Citability',
        href: '/dashboard/citability',
        icon: Eye,
        badge: 'New',
      },
      // Ultravis addition (fork layer): result index of the two-index
      // architecture (17/ago logic docs) — driven by the Citability Index.
      {
        title: 'Visibility Score',
        href: '/dashboard/score',
        icon: Gauge,
        badge: 'New',
      },
      {
        title: 'Prompts',
        href: '/dashboard/prompts',
        icon: Globe,
      },
      {
        title: 'Topics',
        href: '/dashboard/topics',
        icon: Tag,
      },
      {
        title: 'Citations',
        href: '/dashboard/citations',
        icon: Quote,
      },
      {
        title: 'Shopping',
        href: '/dashboard/shopping',
        icon: ShoppingBag,
        requiredFeature: 'shopping_analytics',
        requiresBrandPref: 'shoppingModeEnabled',
      },
      {
        title: 'AI Traffic Analytics',
        href: '/dashboard/traffic',
        icon: LineChart,
        requiredFeature: 'advanced_analytics',
      },
    ],
  },
  {
    title: 'Optimization',
    items: [
      {
        title: 'Content Optimization',
        href: '/dashboard/content',
        icon: FileText,
        requiredFeature: 'content_optimization',
      },
      {
        title: 'Site Audit',
        href: '/dashboard/audit',
        icon: Gauge,
        requiredFeature: 'content_optimization',
      },
    ],
  },
  // Ultravis addition (fork layer): operator-facing cost monitor. adminOnly
  // hides the whole group from client users (gated by operator e-mail, not
  // org role); the route is also guarded server-side.
  {
    title: 'Admin',
    adminOnly: true,
    items: [
      {
        title: 'Costs',
        href: '/dashboard/admin/costs',
        icon: CircleDollarSign,
      },
    ],
  },
];
