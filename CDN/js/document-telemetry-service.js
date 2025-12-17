/**
 * Document Telemetry Service
 * 
 * Tracks PDF/document views, page views, time spent, downloads
 */

class DocumentTelemetryService {
  constructor() {
    this.apiBase = '/api/telemetry';
  }

  /**
   * Generate unique token for document tracking
   */
  generateToken(documentId) {
    return btoa(`${documentId}_${Date.now()}`).replace(/[+/=]/g, '');
  }

  /**
   * Generate tracked document URL
   */
  generateTrackedDocumentUrl(documentId, dealId, contactId, documentType = 'pdf', originalUrl = null) {
    const baseUrl = window.location.origin;
    const token = this.generateToken(documentId);
    
    if (originalUrl) {
      // If we have original URL, create tracking redirect
      return `${baseUrl}${this.apiBase}/document/view?docId=${encodeURIComponent(documentId)}&dealId=${encodeURIComponent(dealId || '')}&contactId=${encodeURIComponent(contactId || '')}&type=${documentType}&token=${token}&redirect=${encodeURIComponent(originalUrl)}`;
    }
    
    return `${baseUrl}${this.apiBase}/document/view?docId=${encodeURIComponent(documentId)}&dealId=${encodeURIComponent(dealId || '')}&contactId=${encodeURIComponent(contactId || '')}&type=${documentType}&token=${token}`;
  }

  /**
   * Track document sent/shared
   */
  async trackDocumentShared(documentId, dealId, contactId, documentType = 'pdf', metadata = {}) {
    const documentRecord = {
      id: documentId,
      dealId: dealId || null,
      contactId: contactId || null,
      type: documentType,
      sharedAt: new Date().toISOString(),
      views: 0,
      pagesViewed: [],
      totalTimeSpent: 0,
      downloads: 0,
      printed: false,
      lastViewed: null,
      metadata: {
        ...metadata,
        title: metadata.title || `Document ${documentId}`,
        pageCount: metadata.pageCount || 0
      }
    };
    
    // Save to localStorage
    const documents = JSON.parse(localStorage.getItem('celera_tracked_documents') || '[]');
    const existingIndex = documents.findIndex(d => d.id === documentId);
    
    if (existingIndex >= 0) {
      documents[existingIndex] = { ...documents[existingIndex], ...documentRecord };
    } else {
      documents.push(documentRecord);
    }
    
    localStorage.setItem('celera_tracked_documents', JSON.stringify(documents));
    
    return documentRecord;
  }

  /**
   * Record document view
   */
  async recordDocumentView(documentId, dealId, contactId, metadata = {}) {
    const documents = JSON.parse(localStorage.getItem('celera_tracked_documents') || '[]');
    const document = documents.find(d => d.id === documentId);
    
    if (document) {
      document.views = (document.views || 0) + 1;
      document.lastViewed = new Date().toISOString();
      
      if (metadata.pagesViewed) {
        const newPages = metadata.pagesViewed.filter(p => !document.pagesViewed.includes(p));
        document.pagesViewed = [...document.pagesViewed, ...newPages];
      }
      
      if (metadata.timeSpent) {
        document.totalTimeSpent = (document.totalTimeSpent || 0) + metadata.timeSpent;
      }
      
      if (metadata.downloaded) {
        document.downloads = (document.downloads || 0) + 1;
      }
      
      if (metadata.printed) {
        document.printed = true;
      }
      
      localStorage.setItem('celera_tracked_documents', JSON.stringify(documents));
      
      // Create activity entry
      if (dealId && window.dataService) {
        await window.dataService.saveDealActivity(dealId, {
          id: `doc_view_${Date.now()}`,
          type: 'document_view',
          date: new Date().toISOString(),
          documentId: documentId,
          contactId: contactId,
          metadata: {
            title: document.metadata?.title,
            views: document.views,
            pagesViewed: document.pagesViewed.length,
            timeSpent: metadata.timeSpent || 0
          }
        });
      }
      
      return document;
    }
    
    return null;
  }

  /**
   * Get document stats
   */
  getDocumentStats(documentId) {
    const documents = JSON.parse(localStorage.getItem('celera_tracked_documents') || '[]');
    return documents.find(d => d.id === documentId) || null;
  }

  /**
   * Get all documents for a deal
   */
  getDealDocuments(dealId) {
    const documents = JSON.parse(localStorage.getItem('celera_tracked_documents') || '[]');
    return documents.filter(d => d.dealId === dealId);
  }
}

// Export singleton instance
window.documentTelemetryService = new DocumentTelemetryService();

