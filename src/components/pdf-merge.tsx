"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import Sortable from "sortablejs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  Trash2,
  Download,
  Loader2,
  RotateCw,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PageRepresentation {
  id: string; // "fileIndex-pageIndex"
  fileId: number;
  originalPageIndex: number; // 0-based
  fileName: string;
  dataUrl: string;
  type: "pdf" | "image";
}

interface FileWithPages {
  id: number;
  file: File;
  pages: PageRepresentation[];
}

export default function PdfMerge() {
  const [filesWithPages, setFilesWithPages] = useState<FileWithPages[]>([]);
  const [orderedPages, setOrderedPages] = useState<PageRepresentation[]>([]);
  const [pageRotations, setPageRotations] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageGridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (pageGridRef.current && orderedPages.length > 0) {
      new Sortable(pageGridRef.current, {
        animation: 150,
        ghostClass: "opacity-50",
        handle: '.page-handle',
        onEnd: (evt) => {
          const newOrderedIds = Array.from(pageGridRef.current?.children || [])
            .map(child => (child as HTMLElement).dataset.pageId);
          
          const newOrderedPages = newOrderedIds.map(id => {
            return orderedPages.find(p => p.id === id)!;
          }).filter(Boolean);

          setOrderedPages(newOrderedPages);
        },
      });
    }
  }, [orderedPages]);

  const resetState = () => {
    setFilesWithPages([]);
    setOrderedPages([]);
    setPageRotations(new Map());
    setIsLoading(false);
    setIsProcessing(false);
    setStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = useCallback(async (files: FileList) => {
    if (isLoading || isProcessing) return;
    
    // Reset state only when initiating a new upload session
    resetState();
    setIsLoading(true);

    const newFilesWithPages: FileWithPages[] = [];
    let fileIdCounter = 0;

    try {
      for (const file of Array.from(files)) {
        const fileId = fileIdCounter++;
        const pages: PageRepresentation[] = [];

        if (file.type === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument(arrayBuffer).promise;
          for (let i = 0; i < pdf.numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const viewport = page.getViewport({ scale: 0.8 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            pages.push({
              id: `${fileId}-${i}`,
              fileId: fileId,
              originalPageIndex: i,
              fileName: file.name,
              dataUrl: canvas.toDataURL(),
              type: "pdf",
            });
          }
        } else if (file.type.startsWith("image/")) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
          pages.push({
            id: `${fileId}-0`,
            fileId: fileId,
            originalPageIndex: 0,
            fileName: file.name,
            dataUrl,
            type: "image",
          });
        } else {
            toast({
                variant: "destructive",
                title: "Unsupported File Type",
                description: `File "${file.name}" has an unsupported type.`,
            });
            continue;
        }

        if (pages.length > 0) {
            newFilesWithPages.push({ id: fileId, file, pages });
        }
      }
      setFilesWithPages(newFilesWithPages);
      setOrderedPages(newFilesWithPages.flatMap(f => f.pages));
    } catch (error) {
      console.error("Error loading files:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Files",
        description: "There was an error processing your files.",
      });
      resetState();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isProcessing, toast]);

  const rotatePage = (pageId: string) => {
    const newRotations = new Map(pageRotations);
    const currentRotation = newRotations.get(pageId) || 0;
    const newRotation = (currentRotation + 90) % 360;
    newRotations.set(pageId, newRotation);
    setPageRotations(newRotations);
  };

  const handleDownloadMerged = async () => {
    if (orderedPages.length === 0) return;
    setIsProcessing(true);
    setStatusMessage("Creating merged PDF...");
    try {
      const newPdf = await PDFDocument.create();

      for (const page of orderedPages) {
        if (page.type === "pdf") {
          const fileInfo = filesWithPages.find(f => f.id === page.fileId);
          if (!fileInfo) continue;

          const arrayBuffer = await fileInfo.file.arrayBuffer();
          const sourcePdf = await PDFDocument.load(arrayBuffer);
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [page.originalPageIndex]);
          
          const rotation = pageRotations.get(page.id) || 0;
          copiedPage.setRotation(degrees(rotation));
          newPdf.addPage(copiedPage);

        } else if (page.type === "image") {
          const fileInfo = filesWithPages.find(f => f.id === page.fileId);
          if (!fileInfo) continue;

          const arrayBuffer = await fileInfo.file.arrayBuffer();
          const image = page.fileName.toLowerCase().endsWith('.png')
            ? await newPdf.embedPng(arrayBuffer)
            : await newPdf.embedJpg(arrayBuffer);
          
          const pdfPage = newPdf.addPage();
          const { width, height } = image.scale(1);

          const rotation = pageRotations.get(page.id) || 0;
          pdfPage.setRotation(degrees(rotation));

          const rotatedDims = rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };

          pdfPage.setSize(rotatedDims.width, rotatedDims.height);
          pdfPage.drawImage(image, {
              x: 0,
              y: 0,
              width: rotatedDims.width,
              height: rotatedDims.height,
          });
        }
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PDF-adel_merged.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatusMessage("Merged PDF downloaded!");
    } catch (error) {
      console.error("Error creating merged PDF:", error);
      toast({ variant: "destructive", title: "Error Merging PDF" });
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 3000);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  if (filesWithPages.length === 0 && !isLoading) {
    return (
      <div
        id="dropZone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 border-2 border-dashed rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/50 hover:border-primary'}`}
      >
        <input type="file" id="fileInput" ref={fileInputRef} onChange={onFileInputChange} multiple accept=".pdf,image/jpeg,image/png" className="hidden" />
        <div className="text-center">
          <div className="floating">
            <UploadCloud className="mx-auto w-16 h-16 text-primary" strokeWidth={1}/>
          </div>
          <h3 className="mt-4 text-xl font-semibold font-headline">Drop your PDFs or Images here</h3>
          <p className="mt-2 text-sm text-muted-foreground">or click to browse files</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Initializing Neural Interface...</p>
      </div>
    );
  }

  return (
    <div>
        <div className="flex flex-wrap gap-3 justify-start items-center mb-6">
            <Button onClick={handleDownloadMerged} size="sm" disabled={isProcessing || orderedPages.length === 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}Download Merged PDF</Button>
            <Button onClick={resetState} variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2"/>Clear All</Button>
        </div>

        {statusMessage && <div className="mb-4 text-center text-sm p-2 rounded-md bg-accent text-accent-foreground">{statusMessage}</div>}

        <div ref={pageGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-1 gap-y-4">
            {orderedPages.map((page) => {
                const rotation = pageRotations.get(page.id) || 0;
                
                return (
                    <div key={page.id} data-page-id={page.id} className="relative group page-handle cursor-move w-full">
                        <div className={`relative aspect-[0.707] rounded-lg overflow-hidden border-4 border-transparent`}>
                            <img src={page.dataUrl} className="object-contain w-full h-full transition-transform duration-300" alt={`Page from ${page.fileName}`} style={{transform: `rotate(${rotation}deg)`}}/>
                            <div className="absolute right-0 bottom-0 left-0 p-2 text-center text-white text-xs font-bold bg-black/50 truncate">
                                {page.fileName}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); rotatePage(page.id); }} className="absolute top-1 right-1 p-1.5 text-white rounded-full opacity-0 transition-opacity rotate-btn bg-black/50 group-hover:opacity-100 hover:bg-primary z-10">
                                <RotateCw className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
}
