import type { ReactNode } from "react";

import {
  LayoutGridIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BriefcaseIcon,
  UsersIcon,
  PlugIcon,
  KeyRoundIcon,
  SettingsIcon,
  CreditCardIcon,
  HelpCircleIcon,
  BookOpenIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Product",
    items: [
      {
        title: "Dashboard",
        path: "/",
        icon: <LayoutGridIcon />,
      },
      {
        title: "Swap",
        path: "/swap",
        icon: <ArrowRightLeftIcon />,
      },
      {
        title: "Analytics",
        path: "#/analytics",
        icon: <BarChart3Icon />,
      },
      {
        title: "Projects",
        path: "#/projects",
        icon: <BriefcaseIcon />,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Team",
        path: "#/team",
        icon: <UsersIcon />,
      },
      {
        title: "Integrations",
        path: "#/integrations",
        icon: <PlugIcon />,
      },
      {
        title: "API Keys",
        path: "#/api-keys",
        icon: <KeyRoundIcon />,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Settings",
        path: "#/settings",
        icon: <SettingsIcon />,
      },
      {
        title: "Billing",
        path: "#/billing",
        icon: <CreditCardIcon />,
      },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Help Center",
    path: "#/help",
    icon: <HelpCircleIcon />,
  },
  {
    title: "Documentation",
    path: "#/documentation",
    icon: <BookOpenIcon />,
  },
];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) => (item.subItems?.length ? [item, ...item.subItems] : [item])),
  ),
  ...footerNavLinks,
];

export function getActiveNavGroups(pathname: string): SidebarNavGroup[] {
  return navGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      isActive: item.path === pathname || !!item.subItems?.some((subItem) => subItem.path === pathname),
      subItems: item.subItems?.map((subItem) => ({
        ...subItem,
        isActive: subItem.path === pathname,
      })),
    })),
  }));
}

export function getActiveNavItem(pathname: string): SidebarNavItem | undefined {
  return navLinks.find((item) => item.path === pathname);
}
