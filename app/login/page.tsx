import { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/LoginForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to LingoFlow to start your personalized pronunciation practice.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-moss">English practice</p>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
