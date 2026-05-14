const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

/**
 * Service to handle file processing (OCR for images, text extraction for PDFs).
 * Ensures files are deleted immediately after processing to maintain privacy.
 */
class FileService {
  /**
   * Processes a file based on its type.
   * @param {Object} file - The file object from Multer.
   * @returns {Promise<string>} The extracted text content.
   */
  async processFile(file) {
    const filePath = file.path;
    const fileType = file.mimetype;
    let extractedText = '';

    try {
      if (fileType.includes('image')) {
        extractedText = await this.performOCR(filePath);
      } else if (fileType === 'application/pdf') {
        extractedText = await this.extractPDFText(filePath);
      } else {
        throw new Error('Unsupported file type');
      }

      return extractedText;
    } catch (err) {
      console.error('File processing error:', err);
      throw err;
    }
  }

  /**
   * Performs OCR on an image file.
   * @param {string} filePath 
   * @returns {Promise<string>}
   */
  async performOCR(filePath) {
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
    return text;
  }

  /**
   * Extracts text from a PDF file.
   * @param {string} filePath 
   * @returns {Promise<string>}
   */
  async extractPDFText(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  /**
   * Deletes a file from the filesystem.
   * @param {string} filePath 
   */
  cleanupFile(filePath) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Failed to delete temporary file: ${filePath}`, err);
      else console.log(`Privacy Cleanup: Deleted temporary file ${filePath}`);
    });
  }
}

module.exports = new FileService();
