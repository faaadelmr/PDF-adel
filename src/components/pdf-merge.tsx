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
  FileText,
  RotateCw,
} from "lucide-react";
import mammoth from "mammoth";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface FileData {
  id: string;
  file: File;
  preview: string;
  details: string;
  type: "pdf" | "image" | "word";
}

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
    if (fileGridRef.current && !sortableInstance.current) {
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
  }, [files.length]); // Re-init if list appears

  const resetState = () => {
    setFiles([]);
    setIsLoading(false);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const generatePreview = async (file: File): Promise<Omit<FileData, 'id' | 'file'> | null> => {
    if (file.type.startsWith("image/")) {
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      return { preview: dataUrl, details: `Image - ${file.type.split('/')[1].toUpperCase()}`, type: 'image' };
    }
    
    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.8 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      return { preview: canvas.toDataURL(), details: `PDF - ${pdf.numPages} pages`, type: 'pdf' };
    }

    if (file.type.includes("word")) {
      // For Word docs, we don't generate a dynamic preview but use a static icon.
      // The actual content is processed during merge.
      return { 
          preview: '', // Placeholder, will be handled by JSX
          details: 'Word Document', 
          type: 'word' 
      };
    }
    
    return null;
  };

  const handleFiles = useCallback(async (newFiles: File[]) => {
    setIsLoading(true);
    try {
      for (const file of newFiles) {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
          toast({ title: "Unsupported File Type", description: `${file.name} has an unsupported format.`, variant: 'destructive' });
          continue;
        }

        const previewData = await generatePreview(file);
        if (previewData) {
          setFiles(prev => [...prev, { id: `${file.name}-${Date.now()}`, file, ...previewData }]);
        }
      }
    } catch (error) {
      console.error('Error handling files:', error);
      toast({ title: 'Error processing files', description: 'There was an issue reading your files.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast]);
  
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
        let pdfToMergeBytes;
        
        if (fileData.type === 'pdf') {
          pdfToMergeBytes = await fileData.file.arrayBuffer();
        } else if (fileData.type === 'image') {
          const tempPdf = await PDFDocument.create();
          const imageBytes = await fileData.file.arrayBuffer();
          let pdfImage;
          if (fileData.file.type === 'image/jpeg') {
            pdfImage = await tempPdf.embedJpg(imageBytes);
          } else {
            pdfImage = await tempPdf.embedPng(imageBytes);
          }
          const page = tempPdf.addPage([pdfImage.width, pdfImage.height]);
          page.drawImage(pdfImage, { x: 0, y: 0, width: pdfImage.width, height: pdfImage.height });
          pdfToMergeBytes = await tempPdf.save();
        } else if (fileData.type === 'word') {
            const arrayBuffer = await fileData.file.arrayBuffer();
            const { value } = await mammoth.convertToHtml({ arrayBuffer });

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = value;
            const textContent = tempDiv.innerText.replace(/(\r\n|\n|\r)/gm, '\n');

            const tempPdf = await PDFDocument.create();
            const font = await tempPdf.embedFont(StandardFonts.Helvetica);
            let page = tempPdf.addPage();
            const { width, height } = page.getSize();
            const margin = 50;
            const maxWidth = width - margin * 2;
            const fontSize = 12;
            const lineHeight = fontSize * 1.5;
            let y = height - margin;

            const lines = textContent.split('\n');
            for(const line of lines) {
                let textLine = line;
                while (textLine.length) {
                    let i = textLine.length;
                    while (font.widthOfTextAtSize(textLine.slice(0, i), fontSize) > maxWidth && i > 0) {
                        i--;
                    }
                    if (i === 0) i = textLine.length; // Handle case where a single character is too long
                    
                    const segment = textLine.slice(0, i);
                    if (y < margin) {
                        page = tempPdf.addPage();
                        y = height - margin;
                    }
                    page.drawText(segment, { x: margin, y, font, size: fontSize, color: rgb(0, 0, 0) });
                    y -= lineHeight;
                    textLine = textLine.slice(i);
                }
            }
            pdfToMergeBytes = await tempPdf.save();
        }
        
        if (pdfToMergeBytes) {
          const pdfToMerge = await PDFDocument.load(pdfToMergeBytes);
          const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        }
      }
      
      const mergedPdfBytes = await mergedPdf.save();
      downloadBlob(new Blob([mergedPdfBytes], { type: 'application/pdf' }), "PDF-adel_merged.pdf");
      toast({ title: 'Success!', description: 'Files merged successfully.' });
    } catch (error) {
      console.error("Error merging files:", error);
      toast({ variant: "destructive", title: "Error Merging Files", description: "An unexpected error occurred during merge." });
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
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
    }
  };

  if (files.length === 0 && !isLoading) {
    return (
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 border-2 border-dashed rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/50 hover:border-primary'}`}
      >
        <input type="file" ref={fileInputRef} onChange={onFileInputChange} multiple accept=".pdf,image/jpeg,image/png,.docx,.doc" className="hidden" />
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
            <Button onClick={handleDownloadMerged} size="sm" disabled={isProcessing || files.length === 0}>{isProcessing ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2"/>}Download Merged PDF</Button>
            <Button onClick={resetState} variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2"/>Clear All</Button>
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Processing files...</p>
          </div>
        )}

        <div ref={fileGridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {files.map((fileData) => (
                <div key={fileData.id} className="relative group aspect-[0.707] w-full flex flex-col items-center justify-center rounded-lg border border-border/20 shadow-md bg-card overflow-hidden">
                    {fileData.type === 'word' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                           <FileText className="w-16 h-16 text-primary" />
                        </div>
                    ) : (
                       <img src={fileData.preview} className="object-contain w-full h-full" alt={`Preview of ${fileData.file.name}`} />
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 text-white text-xs">
                        <p className="truncate font-semibold">{fileData.file.name}</p>
                        <p className="opacity-80">{fileData.details}</p>
                    </div>

                    <button onClick={() => removeFile(fileData.id)} className="absolute top-1 right-1 p-1 bg-destructive/80 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove file">
                        <Trash2 className="w-4 h-4"/>
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
}
