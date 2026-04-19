// api/upload-backup.js
import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for multipart
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check secret key from custom header
  const authHeader = req.headers['x-upload-secret'];
  if (authHeader !== process.env.UPLOAD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Parse the incoming form (multipart/form-data)
    const form = new IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFile = files.backup?.[0]; // 'backup' is the field name from the app
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the file buffer
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // Upload to Vercel Blob with public access, overwriting 'latest-backup.zip'
    const blob = await put('latest-backup.zip', fileBuffer, {
      access: 'public',
      contentType: 'application/zip',
      addRandomSuffix: false, // keep the name exactly 'latest-backup.zip'
    });

    // Optional: update a metadata file with last modified timestamp
    const metaBlob = await put('backup-meta.json', JSON.stringify({
      lastModified: new Date().toISOString().split('T')[0],
      url: blob.url,
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    // Clean up temp file
    fs.unlinkSync(uploadedFile.filepath);

    res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}