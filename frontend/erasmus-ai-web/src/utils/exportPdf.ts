import { jsPDF } from 'jspdf';

export function exportTextAsPdf(title: string, content: string): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');

    const splitText = doc.splitTextToSize(content, maxLineWidth);
    
    // Add text starting at Y=40
    doc.text(splitText, margin, 40);

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}
