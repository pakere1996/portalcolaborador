import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Shield, UserCheck, Mail, Phone, Calendar, CalendarDays, CalendarX, CalendarCheck, Filter, Calendar as CalendarIcon } from "lucide-react";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { formatPhone, cleanCNPJ, formatCNPJ } from "@/lib/utils";
import { ColaboradorForm } from "@/components/ColaboradorForm";
import { ColaboradorFormDialog } from "@/components/ColaboradorFormDialog";
import { Tables } from "@/integrations/supabase/types";
import { adminApi } from "@/lib/admin-api";

const adminModules = [
  {
    title: "Gestão de Equipe",
    description: "Gerencie perfis, cargos e status de colaboradores.",
    icon: Users,
    to: "/admin/colaboradores",
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
    description: "Visão consolidada de todas as folgas da equipe.",
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
  // ... existing component code ...
}