import LoadingIndicator from "@/components/LoadingIndicator";

export default function RootLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-6">
      <LoadingIndicator size="lg" />
    </main>
  );
}
