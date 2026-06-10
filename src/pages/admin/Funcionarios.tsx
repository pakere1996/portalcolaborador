import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, KeyRound, Cake, CalendarDays, RefreshCw, Shield } from "lucide-react";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Profile {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  ativo: boolean;
  aprovacao_status: string;
  data_admissao: string | null;
  data_demissao: string | null;
  data_nascimento: string | null;
  folga_fixa_semana: number | null;
  role?: string;
  created_at: string;
}

const blankForm = {
  nome: "",
  cpf: "",
  cargo: "Pizzaiolo",
  senha: "",
  dataAdmissao: "",
  dataNascimento: "",
  folgaFixa: "",
};

export default function Funcionarios() {
  const [list, setList] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "", cargo: "", dataAdmissao: "", dataDemissao: "", dataNascimento: "", folgaFixa: "",
  });

  const [resetting, setResetting] = useState<Profile | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const load = async () => {
    const [{ data: profs, error }, { data: roles }] = await Promise.all