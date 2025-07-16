import Header from "@/components/header";
import Footer from "@/components/footer";
import PdfSelect from "@/components/pdf-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="rounded-md border-b-4 border-accent mb-8">
            <div className="py-3">
              <h1 className="text-2xl font-bold text-primary font-headline">
                Selected PDF
              </h1>
            </div>
          </header>
          <Card className="shadow-xl bg-card border-none">
            <CardContent className="p-4 md:p-6">
              <PdfSelect />
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
