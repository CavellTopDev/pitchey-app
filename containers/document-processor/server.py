"""
Document Processing Container Server
Handles PDF generation, text extraction, OCR, watermarking, and document manipulation.
"""
import os
import sys
import asyncio
import logging
import tempfile
import shutil
import uuid
import subprocess
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import io

# Add shared utilities to path
sys.path.append('/app/shared')

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Query
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# PDF and document processing
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import PyPDF2
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import docx
from docx import Document
import openpyxl

from health import HealthChecker
from security import SecurityManager, require_auth, ResourceLimiter
from utils import FileManager, ProcessingQueue, setup_logging, ConfigManager

# Initialize services
setup_logging('document-processor')
logger = logging.getLogger(__name__)
config = ConfigManager('document-processor')
health_checker = HealthChecker('document-processor')
security_manager = SecurityManager()
resource_limiter = ResourceLimiter()
file_manager = FileManager()
processing_queue = ProcessingQueue(max_concurrent=config.get('max_workers', 3))

# FastAPI app
app = FastAPI(
    title="Pitchey Document Processor",
    description="Container service for document processing, PDF generation, OCR, and manipulation",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DocumentProcessor:
    """Handles document processing operations."""
    
    def __init__(self):
        self.supported_formats = {
            'input': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xlsx', '.pptx'],
            'output': ['.pdf', '.docx', '.txt', '.html'],
            'image': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']
        }
        
        # Load document templates
        self.template_dir = Path('/app/templates')
        self.templates = self._load_templates()
        
    def _load_templates(self) -> Dict[str, str]:
        """Load document templates from template directory."""
        templates = {}
        if self.template_dir.exists():
            for template_file in self.template_dir.glob('*.html'):
                with open(template_file, 'r') as f:
                    templates[template_file.stem] = f.read()
        return templates
        
    async def extract_text_from_pdf(self, file_path: str) -> Dict[str, Any]:
        """Extract text content from PDF."""
        try:
            extracted_text = ""
            page_count = 0
            
            # Try with PyMuPDF first (better for modern PDFs)
            try:
                doc = fitz.open(file_path)
                for page_num in range(doc.page_count):
                    page = doc.load_page(page_num)
                    extracted_text += page.get_text() + "\n\n"
                    page_count += 1
                doc.close()
            except Exception:
                # Fallback to PyPDF2
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    page_count = len(pdf_reader.pages)
                    
                    for page_num in range(page_count):
                        page = pdf_reader.pages[page_num]
                        extracted_text += page.extract_text() + "\n\n"
            
            return {
                'text': extracted_text.strip(),
                'page_count': page_count,
                'word_count': len(extracted_text.split()),
                'character_count': len(extracted_text)
            }
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise HTTPException(status_code=400, detail=f"PDF text extraction failed: {e}")
            
    async def ocr_document(self, file_path: str, language: str = 'eng') -> Dict[str, Any]:
        """Perform OCR on document/image."""
        try:
            # Convert PDF to images if needed
            if file_path.lower().endswith('.pdf'):
                images = self._pdf_to_images(file_path)
            else:
                images = [Image.open(file_path)]
            
            extracted_text = ""
            confidence_scores = []
            
            for i, img in enumerate(images):
                # Perform OCR
                ocr_data = pytesseract.image_to_data(img, lang=language, output_type=pytesseract.Output.DICT)
                
                # Extract text and confidence
                page_text = []
                page_confidences = []
                
                for j, word in enumerate(ocr_data['text']):
                    if word.strip():
                        page_text.append(word)
                        page_confidences.append(int(ocr_data['conf'][j]))
                
                page_text_str = ' '.join(page_text)
                extracted_text += f"Page {i+1}:\n{page_text_str}\n\n"
                
                if page_confidences:
                    confidence_scores.append(sum(page_confidences) / len(page_confidences))
            
            avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
            
            return {
                'text': extracted_text.strip(),
                'page_count': len(images),
                'average_confidence': round(avg_confidence, 2),
                'word_count': len(extracted_text.split()),
                'language': language
            }
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise HTTPException(status_code=400, detail=f"OCR processing failed: {e}")
            
    def _pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """Convert PDF pages to images for OCR."""
        images = []
        doc = fitz.open(pdf_path)
        
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            pix = page.get_pixmap()
            img_data = pix.tobytes("ppm")
            img = Image.open(io.BytesIO(img_data))
            images.append(img)
            
        doc.close()
        return images
        
    async def generate_pdf_from_template(self, template_name: str, data: Dict[str, Any]) -> str:
        """Generate PDF from template and data."""
        try:
            output_path = os.path.join(file_manager.temp_dir, f"generated_{uuid.uuid4()}.pdf")
            
            # Create PDF document
            doc = SimpleDocTemplate(output_path, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            # Title
            if 'title' in data:
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=18,
                    spaceAfter=30,
                    textColor=colors.darkblue
                )
                story.append(Paragraph(data['title'], title_style))
                story.append(Spacer(1, 20))
            
            # Content sections
            if 'sections' in data:
                for section in data['sections']:
                    if 'heading' in section:
                        story.append(Paragraph(section['heading'], styles['Heading2']))
                        story.append(Spacer(1, 12))
                    
                    if 'content' in section:
                        story.append(Paragraph(section['content'], styles['Normal']))
                        story.append(Spacer(1, 12))
                    
                    if 'table' in section:
                        table = Table(section['table']['data'])
                        table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                            ('FONTSIZE', (0, 0), (-1, 0), 14),
                            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                            ('GRID', (0, 0), (-1, -1), 1, colors.black)
                        ]))
                        story.append(table)
                        story.append(Spacer(1, 12))
            
            # Footer
            if 'footer' in data:
                story.append(Spacer(1, 30))
                story.append(Paragraph(data['footer'], styles['Normal']))
            
            # Generate PDF
            doc.build(story)
            
            return output_path
            
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
            
    async def generate_nda_document(self, nda_data: Dict[str, Any]) -> str:
        """Generate NDA document from template."""
        try:
            output_path = os.path.join(file_manager.temp_dir, f"nda_{uuid.uuid4()}.pdf")
            
            # Create PDF document
            doc = SimpleDocTemplate(output_path, pagesize=A4, topMargin=inch, bottomMargin=inch)
            styles = getSampleStyleSheet()
            story = []
            
            # Title
            title_style = ParagraphStyle(
                'NDATitle',
                parent=styles['Title'],
                fontSize=16,
                spaceAfter=30,
                textColor=colors.darkblue,
                alignment=1  # Center alignment
            )
            story.append(Paragraph("NON-DISCLOSURE AGREEMENT", title_style))
            story.append(Spacer(1, 30))
            
            # Parties
            story.append(Paragraph("PARTIES", styles['Heading2']))
            story.append(Spacer(1, 12))
            
            parties_text = f"""
            This Non-Disclosure Agreement ("Agreement") is entered into on {nda_data.get('date', datetime.now().strftime('%B %d, %Y'))} 
            between:
            
            <b>Disclosing Party:</b> {nda_data.get('disclosing_party', 'N/A')}
            <b>Receiving Party:</b> {nda_data.get('receiving_party', 'N/A')}
            
            (collectively referred to as the "Parties")
            """
            story.append(Paragraph(parties_text, styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Purpose
            story.append(Paragraph("PURPOSE", styles['Heading2']))
            story.append(Spacer(1, 12))
            purpose_text = nda_data.get('purpose', 'Evaluation of potential business opportunity')
            story.append(Paragraph(f"The purpose of this disclosure is: {purpose_text}", styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Confidential Information
            story.append(Paragraph("CONFIDENTIAL INFORMATION", styles['Heading2']))
            story.append(Spacer(1, 12))
            confidential_info = """
            For purposes of this Agreement, "Confidential Information" shall include all information or material 
            that has or could have commercial value or other utility in the business in which Disclosing Party 
            is engaged. If Confidential Information is in written form, the Disclosing Party shall label or 
            stamp the materials with the word "Confidential" or some similar warning.
            """
            story.append(Paragraph(confidential_info, styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Obligations
            story.append(Paragraph("OBLIGATIONS OF RECEIVING PARTY", styles['Heading2']))
            story.append(Spacer(1, 12))
            
            obligations = [
                "Hold and maintain the Confidential Information in strict confidence",
                "Not disclose Confidential Information to any third parties",
                "Not use Confidential Information for any purpose other than evaluation",
                "Return or destroy all Confidential Information upon request"
            ]
            
            for i, obligation in enumerate(obligations, 1):
                story.append(Paragraph(f"{i}. {obligation}", styles['Normal']))
                story.append(Spacer(1, 6))
            
            story.append(Spacer(1, 20))
            
            # Term
            story.append(Paragraph("TERM", styles['Heading2']))
            story.append(Spacer(1, 12))
            term_text = f"""
            This Agreement shall remain in effect for a period of {nda_data.get('term', '5 years')} 
            from the date of execution.
            """
            story.append(Paragraph(term_text, styles['Normal']))
            story.append(Spacer(1, 40))
            
            # Signatures
            story.append(Paragraph("SIGNATURES", styles['Heading2']))
            story.append(Spacer(1, 20))
            
            signature_table = [
                ["Disclosing Party", "", "Receiving Party", ""],
                ["", "", "", ""],
                ["Signature: ________________________", "", "Signature: ________________________", ""],
                ["", "", "", ""],
                [f"Print Name: {nda_data.get('disclosing_party', '')}", "", f"Print Name: {nda_data.get('receiving_party', '')}", ""],
                ["", "", "", ""],
                ["Date: ________________________", "", "Date: ________________________", ""]
            ]
            
            table = Table(signature_table, colWidths=[2.5*inch, 0.5*inch, 2.5*inch, 0.5*inch])
            story.append(table)
            
            # Generate PDF
            doc.build(story)
            
            return output_path
            
        except Exception as e:
            logger.error(f"NDA generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"NDA generation failed: {e}")
            
    async def watermark_pdf(self, input_path: str, watermark_text: str, opacity: float = 0.3) -> str:
        """Add watermark to PDF document."""
        try:
            output_path = os.path.join(file_manager.temp_dir, f"watermarked_{uuid.uuid4()}.pdf")
            
            # Open the PDF
            doc = fitz.open(input_path)
            
            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)
                
                # Get page dimensions
                rect = page.rect
                
                # Add watermark text
                text_rect = fitz.Rect(50, rect.height / 2, rect.width - 50, rect.height / 2 + 50)
                page.insert_text(
                    text_rect.tl,
                    watermark_text,
                    fontsize=36,
                    color=(0.8, 0.8, 0.8),  # Light gray
                    rotate=45  # Diagonal watermark
                )
            
            # Save watermarked PDF
            doc.save(output_path)
            doc.close()
            
            return output_path
            
        except Exception as e:
            logger.error(f"PDF watermarking failed: {e}")
            raise HTTPException(status_code=500, detail=f"PDF watermarking failed: {e}")
            
    async def merge_pdfs(self, file_paths: List[str]) -> str:
        """Merge multiple PDF files into one."""
        try:
            output_path = os.path.join(file_manager.temp_dir, f"merged_{uuid.uuid4()}.pdf")
            
            merger = PyPDF2.PdfMerger()
            
            for file_path in file_paths:
                merger.append(file_path)
            
            with open(output_path, 'wb') as output_file:
                merger.write(output_file)
            
            merger.close()
            
            return output_path
            
        except Exception as e:
            logger.error(f"PDF merging failed: {e}")
            raise HTTPException(status_code=500, detail=f"PDF merging failed: {e}")

# Initialize document processor
doc_processor = DocumentProcessor()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    logger.info("Document Processor starting up...")
    
    # Verify required tools are available
    try:
        subprocess.run(['tesseract', '--version'], check=True, capture_output=True)
        logger.info("Tesseract OCR available")
    except subprocess.CalledProcessError:
        logger.warning("Tesseract OCR not available - OCR functionality disabled")
    
    health_checker.mark_ready()
    logger.info("Document Processor ready to accept requests")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Document Processor shutting down...")
    file_manager.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return health_checker.get_health_status()

@app.get("/ready")
async def readiness_check():
    """Readiness probe endpoint."""
    return health_checker.get_readiness_status()

@app.post("/generate-pdf")
@require_auth(security_manager)
async def generate_pdf(
    template: str = Form('basic'),
    data: str = Form(...)  # JSON string with document data
):
    """Generate PDF from template and data."""
    
    import json
    
    try:
        # Parse data
        document_data = json.loads(data)
        
        # Generate PDF
        if template == 'nda':
            output_path = await doc_processor.generate_nda_document(document_data)
        else:
            output_path = await doc_processor.generate_pdf_from_template(template, document_data)
        
        # Return the PDF file
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"generated_{template}_{uuid.uuid4().hex[:8]}.pdf"
        )
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON data")
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-text")
@require_auth(security_manager)
async def extract_text(
    file: UploadFile = File(...),
    method: str = Form('auto')  # auto, ocr, native
):
    """Extract text from document."""
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    try:
        file_ext = Path(file.filename).suffix.lower()
        
        if method == 'ocr' or file_ext in doc_processor.supported_formats['image']:
            # Use OCR for images or when explicitly requested
            result = await doc_processor.ocr_document(input_path)
            result['method'] = 'ocr'
        elif file_ext == '.pdf':
            # Extract text natively from PDF
            result = await doc_processor.extract_text_from_pdf(input_path)
            result['method'] = 'native'
        elif file_ext == '.docx':
            # Extract text from Word document
            doc = Document(input_path)
            text = '\n'.join([paragraph.text for paragraph in doc.paragraphs])
            result = {
                'text': text,
                'word_count': len(text.split()),
                'character_count': len(text),
                'method': 'native'
            }
        elif file_ext == '.txt':
            # Read plain text file
            with open(input_path, 'r', encoding='utf-8') as f:
                text = f.read()
            result = {
                'text': text,
                'word_count': len(text.split()),
                'character_count': len(text),
                'method': 'native'
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")
        
        result['filename'] = file.filename
        return result
        
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watermark")
@require_auth(security_manager)
async def watermark_document(
    file: UploadFile = File(...),
    watermark_text: str = Form(...),
    opacity: float = Form(0.3)
):
    """Add watermark to PDF document."""
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Check if it's a PDF
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files can be watermarked")
    
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    try:
        output_path = await doc_processor.watermark_pdf(input_path, watermark_text, opacity)
        
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"watermarked_{file.filename}"
        )
        
    except Exception as e:
        logger.error(f"Watermarking failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/merge")
@require_auth(security_manager)
async def merge_documents(
    files: List[UploadFile] = File(...)
):
    """Merge multiple PDF documents."""
    
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merging")
    
    # Validate all files are PDFs
    file_paths = []
    
    try:
        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files can be merged")
            
            file_content = await file.read()
            is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)
            
            file_path = await file_manager.save_uploaded_file(file_content, file.filename)
            file_paths.append(file_path)
        
        # Merge PDFs
        output_path = await doc_processor.merge_pdfs(file_paths)
        
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
        
    except Exception as e:
        logger.error(f"PDF merging failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/templates")
async def list_templates():
    """Get available document templates."""
    return {
        'available_templates': list(doc_processor.templates.keys()),
        'built_in_templates': ['basic', 'nda', 'contract', 'report']
    }

@app.get("/formats")
async def get_supported_formats():
    """Get supported document formats."""
    return doc_processor.supported_formats

if __name__ == "__main__":
    port = config.get('port', 8080)
    debug = config.get('debug', False)
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        log_level="debug" if debug else "info",
        reload=debug
    )