export interface WidgetDef {
  id: string;
  nameKey: string;       // i18n key for name
  descKey: string;       // i18n key for description
  icon: string;          // lucide icon name
  size: "sm" | "md" | "lg";  // sm=1col, md=2col, lg=full-width
  component: React.ComponentType;
}

export interface WidgetLayout {
  id: string;
  enabled: boolean;
  order: number;
}
