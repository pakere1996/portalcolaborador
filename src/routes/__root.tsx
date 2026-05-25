import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Portal do Colaborador" },
      { name: "description", content: "Portal do Colaborador da Pizzaria Pakerê." },
      { property: "og:title", content: "Portal do Colaborador" },
      { name: "twitter:title", content: "Portal do Colaborador" },
      { property: "og:description", content: "Portal do Colaborador da Pizzaria Pakerê." },
      { name: "twitter:description", content: "Portal do Colaborador da Pizzaria Pakerê." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/N6TmoTwv1FXRQbCa28FWo55oRm93/social-images/social-1779233349918-logo_2026_quadrada.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/N6TmoTwv1FXRQbCa28FWo55oRm93/social-images/social-1779233349918-logo_2026_quadrada.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

