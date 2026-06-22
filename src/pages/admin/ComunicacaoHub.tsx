import { Link } from "react-router-dom";
import { MessageSquare, Bell } from "lucide-react";
import { AniversariantesWidget } from "@/components/AniversariantesWidget";

const modules = [
  {
    title: "Comunicados",
    description: "Envie mensagens para colaboradores.",
    icon: MessageSquare,
    to: "/admin/mensagens",
  },
  {
    title: "Quadro de Avisos",
    description: "Crie avisos para os colaboradores.",
    icon: Bell,
    to: "/admin/avisos",
  },
];

export default function ComunicacaoHub() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" /> Comunicação
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie comunicados, avisos e confraternize com os aniversariantes da equipe.
        </p>
      </div>

      {/* Aniversariantes Widget */}
      <AniversariantesWidget 
        title="🎂 Aniversariantes dos Próximos 30 Dias" 
        showMessageButton={true} 
        maxItems={10} 
      />

      {/* Cards de Comunicação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className="block">
            <div className="bg-card border-2 border-border rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full">
              <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <m.icon className="size-6" />
              </div>
              <div className="text-lg font-semibold text-primary mb-1">{m.title}</div>
              <p className="text-sm text-muted-foreground">{m.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}