"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
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
  FileText,
} from "lucide-react";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PageRepresentation {
  id: string; // "fileIndex-pageIndex"
  fileId: number;
  originalPageIndex: number; // 0-based for PDFs/images, page number for docx
  fileName: string;
  dataUrl: string;
  type: "pdf" | "image" | "docx";
  docxHtmlContent?: string; // For docx pages
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
    
    setIsLoading(true);
    let lastFileId = filesWithPages.length > 0 ? Math.max(...filesWithPages.map(f => f.id)) : -1;

    try {
      for (const file of Array.from(files)) {
        const fileId = ++lastFileId;
        const newPages: PageRepresentation[] = [];

        if (file.type === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument(arrayBuffer).promise;
          for (let pageNum = 0; pageNum < pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum + 1);
            const viewport = page.getViewport({ scale: 0.8 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            newPages.push({
              id: `${fileId}-${pageNum}`,
              fileId: fileId,
              originalPageIndex: pageNum,
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
          newPages.push({
            id: `${fileId}-0`,
            fileId: fileId,
            originalPageIndex: 0,
            fileName: file.name,
            dataUrl,
            type: "image",
          });
        } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const { value } = await mammoth.convertToHtml({ arrayBuffer });
            
            // For simplicity, we'll treat the whole docx as one page.
            // A more complex implementation could split by headers, etc.
            newPages.push({
                id: `${fileId}-0`,
                fileId: fileId,
                originalPageIndex: 0,
                fileName: file.name,
                dataUrl: '', // No direct preview, will show an icon.
                type: 'docx',
                docxHtmlContent: value,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Unsupported File Type",
                description: `File "${file.name}" has an unsupported type.`,
            });
            continue;
        }

        if (newPages.length > 0) {
            setFilesWithPages(prev => [...prev, { id: fileId, file, pages: newPages }]);
            setOrderedPages(prev => [...prev, ...newPages]);
        }
      }
    } catch (error) {
      console.error("Error loading files:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Files",
        description: `There was an error processing your files. ${error instanceof Error ? error.message : ''}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isProcessing, toast, filesWithPages]);

  const rotatePage = (pageId: string) => {
    const newRotations = new Map(pageRotations);
    const currentRotation = newRotations.get(pageId) || 0;
    const newRotation = (currentRotation + 90) % 360;
    newRotations.set(pageId, newRotation);
    setPageRotations(newRotations);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const addHtmlToPdf = async (pdfDoc: PDFDocument, html: string) => {
    // This is a simplified text conversion. For full HTML rendering, a library like html2canvas would be needed
    // which adds significant complexity. We will extract text and format it simply.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.innerText || '';
    
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const margin = 50;

    const textWidth = width - margin * 2;
    
    const lines = text.split('\n');
    let y = height - margin;

    for (const line of lines) {
      let textSegment = line;
      while (textSegment.length > 0) {
        let textFits = textSegment;
        let segmentWidth = font.widthOfTextAtSize(textFits, fontSize);

        while (segmentWidth > textWidth) {
          textFits = textFits.slice(0, -1);
          segmentWidth = font.widthOfTextAtSize(textFits, fontSize);
        }

        if (y < margin) {
          pdfDoc.addPage();
          y = height - margin;
        }

        page.drawText(textFits, { x: margin, y, font, size: fontSize, color: rgb(0, 0, 0) });
        y -= fontSize * 1.2;
        textSegment = textSegment.substring(textFits.length);
      }
    }
  };


  const handleDownloadMerged = async () => {
    if (orderedPages.length === 0) return;
    setIsProcessing(true);
    setStatusMessage("Creating merged PDF...");
    try {
      const newPdf = await PDFDocument.create();

      for (const page of orderedPages) {
        const fileInfo = filesWithPages.find(f => f.id === page.fileId);
        if (!fileInfo) continue;
        
        const rotation = pageRotations.get(page.id) || 0;
        
        if (page.type === "pdf") {
          const arrayBuffer = await fileInfo.file.arrayBuffer();
          const sourcePdf = await PDFDocument.load(arrayBuffer);
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [page.originalPageIndex]);
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees(currentRotation + rotation));
          newPdf.addPage(copiedPage);
        } else if (page.type === "image") {
          const arrayBuffer = await fileInfo.file.arrayBuffer();
          let image;
          if (fileInfo.file.type === 'image/png') {
            image = await newPdf.embedPng(arrayBuffer);
          } else { // Assumes jpeg for others
            image = await newPdf.embedJpg(arrayBuffer);
          }
          
          const dims = image.scale(1);
          let pageWidth = dims.width;
          let pageHeight = dims.height;

          if (rotation === 90 || rotation === 270) {
            pageWidth = dims.height;
            pageHeight = dims.width;
          }

          const pdfPage = newPdf.addPage([pageWidth, pageHeight]);
          
          pdfPage.drawImage(image, {
            x: rotation === 90 ? pageHeight : (rotation === 180 ? pageWidth : (rotation === 270 ? 0 : 0)),
            y: rotation === 270 ? pageWidth : (rotation === 180 ? pageHeight : (rotation === 90 ? 0 : 0)),
            width: dims.width,
            height: dims.height,
            rotate: degrees(rotation)
          });
        } else if (page.type === 'docx' && page.docxHtmlContent) {
           await addHtmlToPdf(newPdf, page.docxHtmlContent);
        }
      }

      const pdfBytes = await newPdf.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), "PDF-adel_merged.pdf");
      setStatusMessage("Merged PDF downloaded successfully!");

    } catch (error) {
      console.error("Error creating merged PDF:", error);
      toast({ variant: "destructive", title: "Error Merging PDF", description: "Failed to create the merged document." });
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
      // Reset input value to allow re-uploading the same file
      e.target.value = '';
    }
  };
  
  const renderPagePreview = (page: PageRepresentation) => {
    const rotation = pageRotations.get(page.id) || 0;
    
    if (page.type === 'docx') {
      return (
        <div className="w-full h-full bg-card flex flex-col items-center justify-center p-2 border-2 border-primary/50 rounded-md">
            <FileText className="w-12 h-12 text-primary" />
            <p className="text-xs text-muted-foreground mt-2 text-center">DOCX Page</p>
        </div>
      );
    }
    
    return (
       <img src={page.dataUrl} className="object-contain w-full h-full transition-transform duration-300" alt={`Page from ${page.fileName}`} style={{transform: `rotate(${rotation}deg)`}}/>
    );
  }

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
        <input type="file" id="fileInput" ref={fileInputRef} onChange={onFileInputChange} multiple accept=".pdf,image/jpeg,image/png,.docx,.doc" className="hidden" />
        <div className="text-center">
          <div className="floating">
            <UploadCloud className="mx-auto w-16 h-16 text-primary" strokeWidth={1}/>
          </div>
          <h3 className="mt-4 text-xl font-semibold font-headline">Drop your PDFs, Images, or DOCX here</h3>
          <p className="mt-2 text-sm text-muted-foreground">or click to browse files</p>
        </div>
      </div>
    );
  }
  
  return (
    <div>
        <div className="flex flex-wrap gap-3 justify-start items-center mb-6">
            <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" disabled={isLoading || isProcessing}>
              <UploadCloud className="mr-2"/> Add More Files
            </Button>
            <Button onClick={handleDownloadMerged} size="sm" disabled={isProcessing || orderedPages.length === 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}Download Merged PDF</Button>
            <Button onClick={resetState} variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2"/>Clear All</Button>
        </div>

        {statusMessage && <div className="mb-4 text-center text-sm p-2 rounded-md bg-accent text-accent-foreground">{statusMessage}</div>}
        
        {isLoading && (
          <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Processing files...</p>
          </div>
        )}

        <div ref={pageGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-x-2 gap-y-4">
            {orderedPages.map((page) => {
                
                return (
                    <div key={page.id} data-page-id={page.id} className="relative group page-handle cursor-move w-full flex flex-col items-center">
                        <div className={`relative w-full aspect-[0.707] rounded-lg overflow-hidden border-4 border-transparent`}>
                            {renderPagePreview(page)}
                            <div className="absolute right-0 bottom-0 left-0 p-1 text-center text-white text-[10px] font-bold bg-black/60 truncate">
                                {page.fileName}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); rotatePage(page.id); }} className="absolute top-1 right-1 p-1.5 text-white rounded-full opacity-0 transition-opacity rotate-btn bg-black/50 group-hover:opacity-100 hover:bg-primary z-10" title="Rotate 90° CW">
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
