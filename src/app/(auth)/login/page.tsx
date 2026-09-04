"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, CheckCircle2, Database, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { startSession } from "@/lib/api";
import { AnimateInView, AnimatedItem } from "@/components/ui/animate-in-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const trustItems = [
  { icon: Database, title: "بيانات موحّدة", text: "إدارة السوق والحزم والوظائف من مكان واحد." },
  { icon: ShieldCheck, title: "صلاحيات محمية", text: "كل إجراء حساس مسجل وقابل للتدقيق." },
  { icon: Sparkles, title: "جودة قبل النشر", text: "لا يصل المحتوى الناقص إلى السوق العام." },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await startSession(email, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذّر تسجيل الدخول");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background px-4 py-6 lg:grid lg:grid-cols-[1.08fr_.92fr] lg:p-0">
      <div className="admin-grid-pattern pointer-events-none absolute inset-0 opacity-35" />

      <section className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-e border-border/60 bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <div className="absolute -start-24 -top-24 size-96 rounded-full border border-primary-foreground/10" />
        <div className="absolute -start-5 -top-5 size-64 rounded-full border border-primary-foreground/10" />
        <AnimateInView className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-foreground text-primary shadow-xl"><Car className="size-6" /></span>
          <div><p className="text-xl font-bold tracking-tight">YallaMotors</p><p className="text-[0.68rem] font-semibold tracking-[0.18em] text-primary-foreground/60 uppercase">Control Center</p></div>
        </AnimateInView>

        <AnimateInView stagger slow className="relative max-w-xl space-y-8">
          <AnimatedItem>
            <p className="text-xs font-bold tracking-[0.16em] text-primary-foreground/60 uppercase">Marketplace operations</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-balance xl:text-5xl">كل عمليات السوق.<br />في مركز تحكم واحد.</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-primary-foreground/70">راقب الإعلانات، راجع جودة البيانات، وتابع عمليات الاستيراد ضمن تجربة إدارية عربية واضحة وآمنة.</p>
          </AnimatedItem>
          <div className="grid gap-3">
            {trustItems.map((item) => (
              <AnimatedItem key={item.title}>
                <div className="flex items-start gap-3 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 backdrop-blur-sm">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/10"><item.icon className="size-4" /></span>
                  <div><h2 className="text-sm font-bold">{item.title}</h2><p className="mt-1 text-xs leading-5 text-primary-foreground/60">{item.text}</p></div>
                </div>
              </AnimatedItem>
            ))}
          </div>
        </AnimateInView>

        <p className="relative flex items-center gap-2 text-xs text-primary-foreground/50"><CheckCircle2 className="size-3.5" /> دخول مخصص لمدير المنصة فقط</p>
      </section>

      <section className="relative grid min-h-[calc(100dvh-3rem)] place-items-center lg:min-h-dvh">
        <AnimateInView className="w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Car className="size-5" /></span>
            <div><p className="text-lg font-bold">YallaMotors</p><p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Control Center</p></div>
          </div>

          <Card className="border-border/80 bg-card/88 shadow-2xl backdrop-blur-xl">
            <CardHeader className="pb-2">
              <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-muted text-foreground"><LockKeyhole className="size-5" /></span>
              <h2 className="font-heading text-2xl leading-snug font-bold tracking-tight">مرحبًا بعودتك</h2>
              <CardDescription className="leading-6">أدخل بيانات حساب الإدارة للوصول إلى مركز التحكم.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@arabiyatmart.com" className="h-11 text-start" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 pe-11 text-start" required />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-6 text-destructive">{error}</p>}
                <Button type="submit" className="h-11 w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
                  {isSubmitting ? "جارٍ التحقق…" : "دخول آمن"}
                </Button>
              </form>
              <p className="mt-6 flex items-center justify-center gap-2 border-t border-border/60 pt-5 text-center text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> جلسة محمية ومقيّدة بصلاحيات الإدارة</p>
            </CardContent>
          </Card>
        </AnimateInView>
      </section>
    </main>
  );
}
