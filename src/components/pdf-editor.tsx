"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import Sortable from "sortablejs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FlipHorizontal,
  RotateCw,
  Trash2,
  Download,
  Loader2,
  Scissors,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface Page {
  id: number;
  dataUrl: string;
}

export default function PdfEditor() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<Map<number, number>>(new Map());
  const [splitPoints, setSplitPoints] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageGridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (pageGridRef.current && pages.length > 0) {
      new Sortable(pageGridRef.current, {
        animation: 150,
        ghostClass: "opacity-50",
        handle: '.page-handle',
        onEnd: (evt) => {
          if (evt.newIndex === undefined || evt.oldIndex === undefined) return;
          const newOrder = Array.from(pageGridRef.current?.children || [])
            .filter(child => child.hasAttribute('data-page-id'))
            .map(child => parseInt((child as HTMLElement).dataset.pageId || "0"));
          setPageOrder(newOrder);
        },
      });
    }
  }, [pages]);

  const resetState = () => {
    setCurrentFile(null);
    setPages([]);
    setSelectedPages(new Set());
    setPageOrder([]);
    setPageRotations(new Map());
    setSplitPoints(new Set());
    setIsLoading(false);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleFile = useCallback(async (file: File) => {
    if (isLoading || isProcessing) return;
    resetState();
    setCurrentFile(file);
    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;
      const newPages: Page[] = [];
      const newSelectedPages = new Set<number>();
      const newOrder: number[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.8 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        newPages.push({ id: i, dataUrl: canvas.toDataURL() });
        newSelectedPages.add(i);
        newOrder.push(i);
      }
      setPages(newPages);
      setSelectedPages(newSelectedPages);
      setPageOrder(newOrder);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({
        variant: "destructive",
        title: "Failed to Load PDF",
        description: "An error occurred while processing your PDF file.",
      });
      resetState();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isProcessing, toast]);

  const togglePageSelection = (pageId: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    setSelectedPages(newSelected);
  };
  
  const toggleSplitPoint = (pageId: number) => {
    const newSplitPoints = new Set(splitPoints);
    if (newSplitPoints.has(pageId)) {
        newSplitPoints.delete(pageId);
    } else {
        newSplitPoints.add(pageId);
    }
    setSplitPoints(newSplitPoints);
  };

  const handleInvertSelection = () => {
    const allPageIds = new Set(pages.map((p) => p.id));
    const newSelected = new Set(
      [...allPageIds].filter((id) => !selectedPages.has(id))
    );
    setSelectedPages(newSelected);
  };

  const rotatePage = (pageId: number, direction: 'cw' | 'ccw' = 'cw') => {
    const newRotations = new Map(pageRotations);
    const currentRotation = newRotations.get(pageId) || 0;
    const newRotation = (currentRotation + (direction === 'cw' ? 90 : -90) + 360) % 360;
    newRotations.set(pageId, newRotation);
    setPageRotations(newRotations);
  };
  
  const handleRotateAll = () => {
    const newRotations = new Map(pageRotations);
    for (const pageId of selectedPages) {
        const currentRotation = newRotations.get(pageId) || 0;
        const newRotation = (currentRotation + 90) % 360;
        newRotations.set(pageId, newRotation);
    }
    setPageRotations(newRotations);
  };

  const createPdf = async (pagesToInclude: number[]) => {
    if (!currentFile || pagesToInclude.length === 0) return null;
    const arrayBuffer = await currentFile.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();

    const originalPageIndices = pagesToInclude
      .map(pageNumber => pageNumber - 1)
      .filter(index => index >= 0 && index < originalPdf.getPageCount());

    if (originalPageIndices.length === 0) return null;
    
    const copiedPages = await newPdf.copyPages(originalPdf, originalPageIndices);
    
    copiedPages.forEach((page, i) => {
        const pageNum = pagesToInclude[i];
        const rotation = pageRotations.get(pageNum) || 0;
        page.setRotation(degrees(rotation));
        newPdf.addPage(page);
    });

    return await newPdf.save();
  };

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

  const handleDownloadMerged = async () => {
    if (!currentFile || selectedPages.size === 0) return;
    setIsProcessing(true);
    setStatusMessage("Creating merged PDF...");
    try {
        const orderedSelected = pageOrder.filter(id => selectedPages.has(id));
        const pdfBytes = await createPdf(orderedSelected);
        if (!pdfBytes) throw new Error("Gagal membuat PDF.");
        
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const originalFileName = currentFile.name.replace(/\.pdf$/i, '');
        downloadBlob(blob, `${originalFileName}_PDF-adelMerge.pdf`);
        setStatusMessage("Merged PDF downloaded!");
    } catch (error) {
        console.error("Error creating merged PDF:", error);
        toast({ variant: "destructive", title: "Failed to Merge PDF" });
        setStatusMessage(null);
    } finally {
        setIsProcessing(false);
        setTimeout(() => setStatusMessage(null), 3000);
    }
  };
  
  const handleDownloadSplit = async () => {
    if (!currentFile || splitPoints.size === 0) {
      toast({ variant: "destructive", title: "No split points", description: "Please click between pages to create dividers." });
      return;
    }
    setIsProcessing(true);
    const originalFileName = currentFile.name.replace(/\.pdf$/i, '');
    
    try {
        const chunks: number[][] = [];
        let currentChunk: number[] = [];
        
        const orderedSelected = pageOrder.filter(id => selectedPages.has(id));

        for (const pageId of orderedSelected) {
            currentChunk.push(pageId);
            if (splitPoints.has(pageId)) {
                chunks.push(currentChunk);
                currentChunk = [];
            }
        }
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        if (chunks.length === 0 || chunks.every(c => c.length === 0)) {
            toast({ variant: "destructive", title: "Nothing to split", description: "No selected pages within the split range." });
            setIsProcessing(false);
            return;
        }

        setStatusMessage(`Creating ${chunks.length} split files...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.length === 0) continue;
            const pdfBytes = await createPdf(chunk);
            if (pdfBytes) {
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                downloadBlob(blob, `${originalFileName}_PDF-adelSelect_${i + 1}.pdf`);
                await new Promise(resolve => setTimeout(resolve, 200)); 
            }
        }

        setStatusMessage(`Successfully downloaded ${chunks.length} split files!`);
    } catch (error) {
        console.error("Error creating split PDFs:", error);
        toast({ variant: "destructive", title: "Failed to Create Split PDFs", description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
        setIsProcessing(false);
        setTimeout(() => setStatusMessage(null), 5000);
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
          <h3 className="mt-4 text-xl font-semibold font-headline">Drop PDF file here</h3>
          <p className="mt-2 text-sm text-muted-foreground">or click here to select file</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Processing your PDF...</p>
      </div>
    );
  }

  return (
    <div>
        <div className="flex flex-wrap gap-3 justify-start items-center mb-6">
            <Button onClick={handleInvertSelection} variant="secondary" size="sm" disabled={isProcessing}><FlipHorizontal className="mr-2"/>Jutsushiki Hanten</Button>
            <Button onClick={handleRotateAll} variant="secondary" size="sm" disabled={isProcessing}><RotateCw className="mr-2"/>Rotate Selected</Button>
            <Button onClick={handleDownloadMerged} size="sm" disabled={isProcessing || selectedPages.size === 0 || splitPoints.size > 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}Download Selected</Button>
            <Button onClick={handleDownloadSplit} variant="outline" size="sm" disabled={isProcessing || splitPoints.size === 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Scissors className="mr-2"/>}Download Split PDF</Button>
            <Button onClick={resetState} variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2"/>Delete PDF</Button>
        </div>

        {statusMessage && <div className="mb-4 text-center text-sm p-2 rounded-md bg-accent text-accent-foreground">{statusMessage}</div>}

        <div ref={pageGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-1 gap-y-4">
            {pageOrder.map((pageId, index) => {
                const page = pages.find(p => p.id === pageId);
                if (!page) return null;
                const isSelected = selectedPages.has(page.id);
                const rotation = pageRotations.get(page.id) || 0;
                const isLastInOrder = index === pageOrder.length - 1;
                
                return (
                    <div key={page.id} data-page-id={page.id} className="flex items-start justify-center">
                        <div className="relative group page-handle cursor-move w-full" onClick={() => togglePageSelection(page.id)}>
                            <div className={`relative aspect-[0.707] rounded-lg overflow-hidden border-4 transition-all duration-200 ${isSelected ? 'border-primary' : 'border-transparent'}`}>
                                <img src={page.dataUrl} className="object-contain w-full h-full transition-transform duration-300" alt={`Page ${page.id}`} style={{transform: `rotate(${rotation}deg)`}}/>
                                <div className={`absolute inset-0 transition-all bg-black ${isSelected ? 'opacity-0' : 'opacity-40 group-hover:opacity-10'}`}></div>
                                <div className="absolute right-0 bottom-0 left-0 p-2 text-center text-white text-xs font-bold bg-black/50">
                                    Page {page.id}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); rotatePage(page.id, 'cw'); }} className="absolute top-1 right-1 p-1.5 text-white rounded-full opacity-0 transition-opacity rotate-btn bg-black/50 group-hover:opacity-100 hover:bg-primary z-10">
                                    <RotateCw className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                        {!isLastInOrder && (
                            <div className="flex-shrink-0 w-8 h-full flex items-center justify-center -ml-1 -mr-1 z-10">
                                <button
                                    onClick={() => toggleSplitPoint(page.id)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${splitPoints.has(page.id) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-accent'}`}
                                    title={splitPoints.has(page.id) ? "Remove divider" : "Add divider"}
                                >
                                    <Scissors className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
}
