import { Link } from "react-router-dom";
import { Scale, Users, FileText } from "lucide-react";

const modules = [
  {
    title: "Cadastro de Sindicatos",
    description: "Cadastre os sindicatos patronal e laboral com seus vínculos.",
    icon: Users,
    to: "/admin/sindicatos/cadastro",
  },
  {
    title: "Negociações",
    description: "Registre acordos entre sindicatos e anexe ACT/CCT.",
    icon: FileText,
    to: "/admin/sindicatos/negociacoes",
  },
];

export default function SindicatosHub() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Scale className="size-6 text-primary" /> Sindicatos
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie sindicatos, vínculos e negociações coletivas.
        </p>
      </div>

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