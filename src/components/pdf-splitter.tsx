"use client";

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  Download,
  Loader2,
  Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Page {
  id: number;
  dataUrl: string;
}

export default function PdfSplitter() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [splitRanges, setSplitRanges] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setCurrentFile(null);
    setNumPages(0);
    setSplitRanges("");
    setIsLoading(false);
    setIsProcessing(false);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleFile = useCallback(async (file: File) => {
    if (isLoading || isProcessing) return;
    resetState();
    setCurrentFile(file);
    setFileName(file.name);
    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      setNumPages(pdf.numPages);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({
        variant: "destructive",
        title: "Error Loading PDF",
        description: "There was an error processing your PDF file.",
      });
      resetState();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isProcessing, toast]);

  const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }

  const handleSplit = async () => {
    if (!currentFile || !splitRanges) return;
    setIsProcessing(true);
    
    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const originalPdf = await PDFDocument.load(arrayBuffer);
        const originalFileName = currentFile.name.replace(/\.pdf$/i, '');

        const ranges = splitRanges.split(',').map(r => r.trim());

        for (const range of ranges) {
            const newPdf = await PDFDocument.create();
            let pageNumbers: number[] = [];

            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > numPages) {
                    toast({ variant: "destructive", title: "Invalid page range", description: `The range "${range}" is invalid.` });
                    continue;
                }
                for (let i = start; i <= end; i++) {
                    pageNumbers.push(i);
                }
            } else {
                const pageNum = Number(range);
                 if (isNaN(pageNum) || pageNum < 1 || pageNum > numPages) {
                    toast({ variant: "destructive", title: "Invalid page number", description: `Page "${range}" is invalid.` });
                    continue;
                 }
                pageNumbers.push(pageNum);
            }
            
            const pageIndices = pageNumbers.map(n => n - 1);
            const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            downloadBlob(blob, `${originalFileName}_split_${range}.pdf`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        toast({ title: "PDF Split Successful", description: "Your PDF files have been split and downloaded." });

    } catch (error) {
        console.error("Error splitting PDF:", error);
        toast({ variant: "destructive", title: "Error Splitting PDF" });
    } finally {
        setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  if (!currentFile) {
    return (
      <div
        id="dropZone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 border-2 border-dashed rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/50 hover:border-primary'}`}
      >
        <input type="file" id="fileInput" ref={fileInputRef} onChange={onFileInputChange} multiple={false} accept=".pdf" className="hidden" />
        <div className="text-center">
          <div className="floating">
            <UploadCloud className="mx-auto w-16 h-16 text-primary" strokeWidth={1}/>
          </div>
          <h3 className="mt-4 text-xl font-semibold font-headline">Drop your PDF here</h3>
          <p className="mt-2 text-sm text-muted-foreground">or click to browse files</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Analyzing Datastream...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
        <div className="w-full max-w-md text-center">
            <p className="font-semibold">{fileName}</p>
            <p className="text-sm text-muted-foreground">Total Pages: {numPages}</p>
        </div>

        <div className="w-full max-w-md space-y-4">
            <div>
                <Label htmlFor="split-ranges">Pages or page ranges</Label>
                <Input 
                    id="split-ranges"
                    type="text" 
                    value={splitRanges} 
                    onChange={(e) => setSplitRanges(e.target.value)}
                    placeholder="e.g., 1, 3, 5-7, 10"
                    className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Separate with commas. Use a dash for ranges.
                </p>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-center items-center">
            <Button onClick={handleSplit} disabled={isProcessing || !splitRanges}>
                {isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}
                Split & Download
            </Button>
            <Button onClick={resetState} variant="destructive" disabled={isProcessing}>
                <Trash2 className="mr-2"/>Delete
            </Button>
        </div>
    </div>
  );
}
