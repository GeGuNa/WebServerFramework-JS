const fs = require('fs');
const path = require('path');

class FileUploader {
  constructor(uploadDir = './uploads') {
    this.uploadDir = uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

 
  saveFile(fileField, req, customName = null) {
    return new Promise((resolve, reject) => {
      if (!req.files || !req.files[fileField]) {
        reject(new Error('No file uploaded'));
        return;
      }

      const file = req.files[fileField];
      const filename = customName || `${Date.now()}_${file.filename}`;
      const filepath = path.join(this.uploadDir, filename);

      fs.writeFile(filepath, file.content, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            originalName: file.filename,
            savedName: filename,
            path: filepath,
            size: file.content.length,
            mimetype: file.mimetype
          });
        }
      });
    });
  }

 
  saveFiles(fileFields, req) {
    const promises = fileFields.map(field => this.saveFile(field, req));
    return Promise.all(promises);
  }

 
  deleteFile(filename) {
    const filepath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }
}

module.exports = FileUploader;
