import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(128),
});

export default function Login() {
  const { user, loading } = useAuth();
  const location = useLocation() as any;
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<"login" | "signup">("login");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (!loading && user) {
    return <Navigate to="/app/calendar" replace />;
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast("Não foi possível entrar", { description: error.message });
        return;
      }
      const to = location?.state?.from ?? "/app/calendar";
      navigate(to, { replace: true });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast("Não foi possível cadastrar", { description: error.message });
      return;
    }
    toast("Conta criada", {
      description: "Você já pode entrar. Seu CRM foi inicializado automaticamente.",
    });
    setMode("login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center px-4 py-10 md:grid-cols-2 md:gap-8 md:px-6">
        <div className="fade-up">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">
            CRM + Calendário inteligente
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Leads, contratos e agenda do artista em um só lugar — com regras para evitar conflitos.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-lg border bg-card/70 p-4 shadow-soft">
              <div className="text-sm font-semibold">O que já está incluído</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Calendário Mês/Semana/Lista com drag-and-drop</li>
                <li>Resumo do mês (shows, negociações, dias livres, faturamento)</li>
                <li>Leads (funil) + Contratos simples + base de Financeiro</li>
                <li>Permissões por perfil (Admin/Comercial/Financeiro)</li>
              </ul>
            </div>
          </div>
        </div>

        <Card className="border bg-card/70 p-6 shadow-elev">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold tracking-tight">
                {mode === "login" ? "Entrar" : "Criar conta"}
              </div>
              <div className="text-sm text-muted-foreground">
                {mode === "login" ? "Acesse seu CRM" : "Crie seu acesso em 1 minuto"}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            >
              {mode === "login" ? "Cadastrar" : "Já tenho conta"}
            </Button>
          </div>

          <div className="mt-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="voce@empresa.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">{mode === "login" ? "Entrar" : "Criar conta"}</Button>
              </form>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
}
