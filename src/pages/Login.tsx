@@
import { IdCard, Lock } from "lucide-react";
import { formatCPF } from "@/lib/cpf";
+import { SocialLoginButtons } from "@/components/SocialLoginButtons";

@@
          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={busy}>
            {busy ? "Verificando..." : "Entrar"}
          </Button>
          
-          <div className="text-center pt-2">
-            <p className="text-xs text-muted-foreground">
-              Esqueceu sua senha? Entre em contato com o administrador.
-            </p>
-          </div>
+          {/* Área de login social */}
+          <SocialLoginButtons />
+
+          <div className="text-center pt-2">
+            <p className="text-xs text-muted-foreground">
+              Esqueceu sua senha? Entre em contato com o administrador.
+            </p>
+          </div>
         </form>
       </div>
     </div>
   );
 }