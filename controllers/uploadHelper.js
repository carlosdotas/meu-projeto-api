const path = require('path');
const fs = require('fs');

function saveUploadedFile(file) {
    if (!file) return null;
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }
    const filePath = path.join(uploadsDir, file.originalname);
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/${file.originalname}`;
}

module.exports = { saveUploadedFile };
