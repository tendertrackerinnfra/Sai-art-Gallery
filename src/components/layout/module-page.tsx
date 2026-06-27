import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePageProps = {
  title: string;
  description: string;
  ownerOnly?: boolean;
};

export function ModulePage({ title, description, ownerOnly = false }: ModulePageProps) {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Module foundation</CardTitle>
          <CardDescription>
            Data tables, forms, filters, and audit tracking will be added during feature development.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {ownerOnly
            ? "Access policy: Owner only. Staff and non-owner users must not access this module."
            : "Access policy will follow the configured role permissions for Owner, Manager, Staff, and Accountant."}
        </CardContent>
      </Card>
    </section>
  );
}

