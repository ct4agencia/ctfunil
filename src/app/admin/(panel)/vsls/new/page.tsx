import NewVslForm from "@/components/admin/NewVslForm";

export default function NewVslPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Nova VSL</h1>
      <p className="mb-6 text-sm text-slate-500">
        Defina nome e slug. Os detalhes (vídeo, copy, cor, integrações) você
        configura no editor em seguida.
      </p>
      <NewVslForm />
    </div>
  );
}
