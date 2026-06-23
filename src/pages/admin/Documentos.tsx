import { Link } from "react-router-dom";
import { FileText, FileWarning, ShieldAlert, Clock, Coins } from "lucide-react";

const modulos = [
  {
    title: "Contracheques",
    description: "Importe e gerencie contracheques mensais dos colaboradores.",
    icon: FileText,
    to: "/admin/documentos/contracheque",
    cor: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "Folhas de Ponto",
    description: "Importe e gerencie folhas de ponto mensais dos colaboradores.",
    icon: Clock,
    to: "/admin/documentos/ponto",
    cor: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "Adiantamentos",
    description: "Importe e gerencie adiantamentos salariais dos colaboradores.",
    icon: Coins,
    to: "/admin/documentos/adiantamento",
    cor: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  {
    title: "Atestados",
    description: "Cadastre, aprove ou rejeite atestados médicos da equipe.",
    icon: FileWarning,
    to: "/admin/documentos/atestados",
    cor: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "Registros Disciplinares",
    description: "Advertências e suspensões vinculadas a colaboradores.",
    icon: ShieldAlert,
    to: "/admin/documentos/disciplinar",
    cor: "text-red-600",
    bg: "bg-red-50",
  },
];

export default function DocumentosHubPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie todos os documentos dos colaboradores.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modulos.map((m) => (
          <Link key={m.to} to={m.to} className="block">
            <div className="bg-card border-2 border-border rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full">
              <div className={`size-12 rounded-xl ${m.bg} ${m.cor} flex items-center justify-center mb-4`}>
                <m.icon className="size-6" />
              </div>
              <div className={`text-lg font-semibold ${m.cor} mb-1`}>{m.title}</div>
              <p className="text-sm text-muted-foreground">{m.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}