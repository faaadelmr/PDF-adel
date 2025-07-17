import Header from "@/components/header";
import Footer from "@/components/footer";
import PdfEditor from "@/components/pdf-editor";
import { Card, CardContent } from "@/components/ui/card";
import { SeparatorVertical } from "lucide-react";

export default function SelectPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <header className="rounded-md border-b-4 border-accent mb-8">
            <div className="py-3 flex items-center gap-4">
              <SeparatorVertical className="w-8 h-8 text-accent" />
              <h1 className="text-2xl font-bold font-headline text-accent">
                Select & Split Pages
              </h1>
            </div>
          </header>
          <Card className="shadow-2xl shadow-accent/10 bg-card border-accent/20">
            <CardContent className="p-4 md:p-6">
              <PdfEditor />
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
