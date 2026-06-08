"use client";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Google, Apple } from "lucide-react";

export function SocialLoginButtons() {
  const handleLogin = async (provider: "google" | "apple") => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        // opcional: redirecionar para a página desejada após login
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
    } catch (e) {
      console.error("[SocialLogin] Erro ao iniciar login", e);
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-4">
      <Button
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={() => handleLogin("google")}
      >
        <Google className="size-5" />
        Entrar com Google
      </Button>

      <Button
        variant="outline"
        className="w-full flex items-center justify-center gap-2"
        onClick={() => handleLogin("apple")}
      >
        <Apple className="size-5" />
        Entrar com Apple
      </Button>
    </div>
  );
}