import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t-2 border-primary/20 mt-8">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}{" "}
            <span className="font-medium text-yellow-400">PDF-adel</span>. All rights reserved.
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>Crafted with  cyberpunk vibes by</span>
            <Link
              href="https://github.com/faaadelmr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 hover:text-primary transition-colors"
            >
              faaadelmr
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
