"use client";

import { useAuth } from "@/lib/auth-context";
import { NavigationCard } from "@/components/NavigationCard";
import {
  Users,
  Shield,
  Calendar,
  ClipboardList,
  UserCheck,
  ArrowLeftRight,
  Ban,
  FileText,
  FileWarning,
  ShieldAlert,
} from "lucide-react";

const adminModules = [
  {
    title: "Gestão de Equipe",
    description: "Gerencie perfis, cargos e status de colaboradores.",
    icon: Users,
    to: "/admin/funcionarios",
    category: "Geral",
  },
  {
    title: "Dashboard Folgas",
    description: "Visão geral e estatísticas do sistema de folgas.",
    icon: Shield,
    to: "/admin",
    category: "Folgas",
  },
  {
    title: "Calendário Geral",
    description: "Visualize todas as folgas, fixas e solicitadas, da equipe.",
    icon: Calendar,
    to: "/admin/calendario",
    category: "Folgas",
  },
  {
    title: "Solicitações Especiais",
    description: "Gerencie pedidos de folgas fora das regras normais.",
    icon: ClipboardList,
    to: "/admin/solicitacoes",
    category: "Folgas",
  },
  {
    title: "Aprovações",
    description: "Aprove ou rejeite folgas pendentes e prioridades de aniversário.",
    icon: UserCheck,
    to: "/admin/aprovacoes",
    category: "Folgas",
  },
  {
    title: "Trocas de Folga",
    description: "Monitore e gerencie as solicitações de troca entre colaboradores.",
    icon: ArrowLeftRight,
    to: "/admin/trocas",
    category: "Folgas",
  },
  {
    title: "Datas Bloqueadas",
    description: "Configure e gerencie dias de bloqueio de folgas.",
    icon: Ban,
    to: "/admin/bloqueios",
    category: "Folgas",
  },
  {
    title: "Contracheques",
    description: "Faça upload e gerencie contracheques.",
    icon: FileText,
    to: "/admin/documentos",
    category: "Documentos",
  },
  {
    title: "Folhas de Ponto",
    description: "Faça upload e gerencie folhas de ponto.",
    icon: FileText,
    to: "/admin/documentos/ponto",
    category: "Documentos",
  },
  {
    title: "Atestados",
    description: "Gerencie e aprove atestados médicos.",
    icon: FileWarning,
    to: "/admin/documentos/atestados",
    category: "Documentos",
  },
  {
    title: "Registros Disciplinares",
    description: "Cadastre advertências e suspensões.",
    icon: ShieldAlert,
    to: "/admin/documentos/disciplinar",
    category: "Documentos",
  },
];

export default function AdminHomeAdminPage() {
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] ?? "Administrador";

  const groupedModules = adminModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof adminModules>);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="p-6 bg-red-600 text-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold">Olá, {firstName}!</h1>
        <p className="mt-1 text-red-100">Painel de Administração Pakerê.</p>
      </div>

      {Object.entries(groupedModules).map(([category, modules]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-yellow-500 pb-1 text-red-600">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <NavigationCard
                key={module.to}
                to={module.to}
                title={module.title}
                description={module.description}
                icon={module.icon}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}