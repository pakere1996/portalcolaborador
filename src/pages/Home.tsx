"use client";

import { useAuth } from "@/lib/auth-context";
import { NavigationCard } from "@/components/NavigationCard";
import {
  Calendar,
  ArrowLeftRight,
  ClipboardList,
  Settings,
  FileText,
  FileWarning,
  Users,
} from "lucide-react";

const employeeModules = [
  {
    title: "Meu Cadastro",
    description: "Visualize e edite suas informações pessoais e de contato.",
    icon: Settings,
    to: "/perfil",
    category: "Geral",
  },
  {
    title: "Calendário de Folgas",
    description: "Verifique suas folgas agendadas e a disponibilidade da equipe.",
    icon: Calendar,
    to: "/calendario",
    category: "Folgas",
  },
  {
    title: "Trocas de Folga",
    description: "Solicite ou responda a pedidos de troca de folga com colegas.",
    icon: ArrowLeftRight,
    to: "/trocas",
    category: "Folgas",
  },
  {
    title: "Histórico de Folgas",
    description: "Consulte seu histórico de folgas e solicitações passadas.",
    icon: ClipboardList,
    to: "/historico",
    category: "Folgas",
  },
  {
    title: "Contracheques",
    description: "Acesse seus contracheques mensais.",
    icon: FileText,
    to: "/documentos",
    category: "Documentos",
  },
  {
    title: "Folhas de Ponto",
    description: "Visualize suas folhas de ponto.",
    icon: FileText,
    to: "/documentos/ponto",
    category: "Documentos",
  },
  {
    title: "Atestados",
    description: "Envie e acompanhe seus atestados médicos.",
    icon: FileWarning,
    to: "/documentos/atestados",
    category: "Documentos",
  },
];

export default function HomePage() {
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] ?? "Colaborador";

  const groupedModules = employeeModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof employeeModules>);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="p-6 bg-red-600 text-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold">Olá, {firstName}!</h1>
        <p className="mt-1 text-red-100">Bem-vindo(a) ao Portal do Colaborador Pakerê.</p>
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