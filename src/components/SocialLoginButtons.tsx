"use client";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/SocialIcons";

export function SocialLoginButtons() {
  const handleLogin = async (provider: "google") => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
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
        <GoogleIcon />
        Entrar com Google
      </Button>
    </div>
  );
}