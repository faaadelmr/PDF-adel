import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SeparatorVertical, Combine } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 overflow-hidden">
      <header className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold font-headline text-yellow-400 tracking-widest">
          PDF-adel
        </h1>
      </header>
      
      <main className="flex-grow flex flex-col items-center justify-center text-center">
        <div className="opacity-0 fade-in-up flex flex-col items-center justify-center">
          <h2 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tighter mb-4">
            The Cybernetic PDF Toolkit
          </h2>
          <p className="max-w-2xl text-yellow-400 text-center text-lg md:text-xl text-muted-foreground mb-12">
            Select, Split, Merge, and Re-engineer your documents with precision and style.
            <br />No need upload, all process direct from your browser. so its secure.
          </p>
        </div>

        <div className="relative flex items-center justify-center w-full max-w-4xl">
          <div className="w-full h-full flex flex-col md:flex-row items-stretch justify-center gap-0 md:gap-0">
            {/* Left Gate */}
            <Link href="/select" className="group w-full md:w-1/2 p-2 opacity-0 fade-in-up animate-delay-200">
              <div className="relative h-full flex flex-col justify-center items-center p-8 md:p-12 rounded-lg md:rounded-r-none border-2 border-primary/20 bg-card/80 hover:border-accent hover:bg-accent/10 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/20 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-grid-accent opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <SeparatorVertical className="h-16 w-16 mb-4 text-accent transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-2xl font-bold font-headline mb-2 text-accent">Select & Split Pages</h3>
                <p className="text-muted-foreground">Choose, split, rotate, disable or delete pages from your PDF. Reorder pages.</p>
              </div>
            </Link>

            {/* Right Gate */}
            <Link href="/merge" className="group w-full md:w-1/2 p-2 opacity-0 fade-in-up animate-delay-400">
               <div className="relative h-full flex flex-col justify-center items-center p-8 md:p-12 rounded-lg md:rounded-l-none border-2 border-primary/20 bg-card/80 hover:border-primary hover:bg-primary/10 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full bg-grid-primary opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <Combine className="h-16 w-16 mb-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-2xl font-bold font-headline mb-2 text-primary">Merge PDF</h3>
                <p className="text-muted-foreground">Combine multiple PDF files or images into a single document.</p>
              </div>
            </Link>
          </div>
        </div>
      </main>

       <footer className="absolute bottom-0 left-0 w-full p-4 text-center">
         <p className="text-xs text-muted-foreground">
           &copy; {new Date().getFullYear()} PDF-adel. Engineered by humans, perfected by AI.
         </p>
       </footer>
    </div>
  );
}

// Add some styles for the grid background if they aren't in globals
const globalStyles = `
  .bg-grid-accent {
    background-image: linear-gradient(hsl(var(--accent)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--accent)) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .bg-grid-primary {
    background-image: linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--primary)) 1px, transparent 1px);
    background-size: 20px 20px;
  }
`;

if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = globalStyles;
  document.head.appendChild(styleSheet);
}
