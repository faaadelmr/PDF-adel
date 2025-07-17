
"use client";

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import Sortable from "sortablejs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  Trash2,
  Download,
  Loader2,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface FileData {
  id: string;
  file: File;
  preview: string;
  pageCount: number;
  type: 'pdf' | 'image';
}

const DropZone = ({ onDrop, onFileInputChange, isDragging, fileInputRef, isLoading }: {
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
}) => {
  const [localDragging, setLocalDragging] = useState(false);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setLocalDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setLocalDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    setLocalDragging(false);
    onDrop(e);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={() => !isLoading && fileInputRef.current?.click()}
      className={`p-8 border-2 border-dashed rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${localDragging || isDragging ? 'border-primary bg-primary/10' : 'border-primary/50 hover:border-primary'}`}
    >
      <input type="file" ref={fileInputRef} onChange={onFileInputChange} multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
      <div className="text-center">
        <div className="floating">
          <UploadCloud className="mx-auto w-16 h-16 text-primary" strokeWidth={1}/>
        </div>
        <h3 className="mt-4 text-xl font-semibold font-headline">Drop your PDFs or Images here</h3>
        <p className="mt-2 text-sm text-muted-foreground">or click to browse files</p>
      </div>
    </div>
  );
};


export default function PdfMerge() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileGridRef = useRef<HTMLDivElement>(null);
  const sortableInstance = useRef<Sortable | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (fileGridRef.current && files.length > 0 && !sortableInstance.current) {
      sortableInstance.current = new Sortable(fileGridRef.current, {
        animation: 150,
        ghostClass: "opacity-50",
        onEnd: (evt) => {
          if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
          
          setFiles(currentFiles => {
            const newFiles = [...currentFiles];
            const [movedItem] = newFiles.splice(evt.oldIndex!, 1);
            newFiles.splice(evt.newIndex!, 0, movedItem);
            return newFiles;
          });
        },
      });
    }
  }, [files.length]);

  const resetState = () => {
    setFiles([]);
    setIsLoading(false);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const generatePreview = async (file: File): Promise<Omit<FileData, 'id' | 'file'> | null> => {
    try {
      if (file.type.startsWith('image/')) {
        return { 
            preview: URL.createObjectURL(file), 
            pageCount: 1,
            type: 'image'
        };
      }
      
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.8 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return null;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        return { 
            preview: canvas.toDataURL(), 
            pageCount: pdf.numPages,
            type: 'pdf'
        };
      }
      return null;
    } catch(e) {
      console.error("Failed to generate preview for", file.name, e);
      toast({ title: "Unsupported File", description: `Could not process ${file.name}. It might be corrupted or protected.`, variant: 'destructive' });
      return null;
    }
  };

  const handleFiles = useCallback(async (newFiles: File[]) => {
    if (isLoading || isProcessing) return;
    setIsLoading(true);
    
    try {
      const addedFiles: FileData[] = [];
      for (const file of newFiles) {
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          toast({ title: "Unsupported File Type", description: `${file.name} is not a supported file.`, variant: 'destructive' });
          continue;
        }

        const previewData = await generatePreview(file);
        if (previewData) {
          addedFiles.push({ id: `${file.name}-${Date.now()}`, file, ...previewData });
        }
      }
      if (addedFiles.length > 0) {
        setFiles(prev => [...prev, ...addedFiles]);
      }
    } catch (error) {
      console.error('Error handling files:', error);
      toast({ title: 'Error processing files', description: 'There was an issue reading your files.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isProcessing, toast]);
  
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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
  
  const handleDownloadMerged = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const fileData of files) {
        if (fileData.type === 'pdf') {
          const pdfBytes = await fileData.file.arrayBuffer();
          const pdfToMerge = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        } else if (fileData.type === 'image') {
            const imgBytes = await fileData.file.arrayBuffer();
            let pdfImage;
            if (fileData.file.type === 'image/jpeg') {
                pdfImage = await mergedPdf.embedJpg(imgBytes);
            } else if (fileData.file.type === 'image/png') {
                pdfImage = await mergedPdf.embedPng(imgBytes);
            } else {
                continue; // Should not happen due to file type check
            }
            const { width, height } = pdfImage.scale(1);
            const page = mergedPdf.addPage([width, height]);
            page.drawImage(pdfImage, { x: 0, y: 0, width, height });
        }
      }
      
      const mergedPdfBytes = await mergedPdf.save();
      downloadBlob(new Blob([mergedPdfBytes], { type: 'application/pdf' }), "PDF-adel_merged.pdf");
      toast({ title: 'Success!', description: 'Files merged successfully.' });
    } catch (error) {
      console.error("Error merging files:", error);
      toast({ variant: "destructive", title: "Error Merging Files", description: "An unexpected error occurred during merge. One of the files might be corrupted or encrypted." });
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };
  
  return (
    <div className="space-y-6">
      <DropZone
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
        isDragging={isDragging}
        fileInputRef={fileInputRef}
        isLoading={isLoading}
      />
      
      {files.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 justify-start items-center">
              <Button onClick={handleDownloadMerged} size="sm" disabled={isProcessing || files.length === 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}Download Merged PDF</Button>
              <Button onClick={resetState} variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2"/>Clear All</Button>
          </div>

          <div ref={fileGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {files.map((fileData) => (
                  <div key={fileData.id} className="relative group aspect-[0.707] w-full flex flex-col items-center justify-center rounded-lg border border-border/20 shadow-md bg-card overflow-hidden cursor-move">
                     <img src={fileData.preview} className="object-contain w-full h-full" alt={`Preview of ${fileData.file.name}`} />
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 text-white text-xs">
                          <p className="truncate font-semibold">{fileData.file.name}</p>
                          <p className="opacity-80">{fileData.type === 'pdf' ? `${fileData.pageCount} pages` : 'Image'}</p>
                      </div>
                      <button onClick={() => removeFile(fileData.id)} className="absolute top-1 right-1 p-1 bg-destructive/80 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove file">
                          <Trash2 className="w-4 h-4"/>
                      </button>
                  </div>
              ))}
          </div>
        </>
      )}

      {isLoading && (
        <div className="text-center py-10">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Processing files...</p>
        </div>
      )}
    </div>
  );
}
