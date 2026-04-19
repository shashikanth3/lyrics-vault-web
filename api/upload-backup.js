// api/upload-backup.js
import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-upload-secret'];
  if (authHeader !== process.env.UPLOAD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const form = new IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFile = files.backup?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // Upload the ZIP (overwrite latest-backup.zip)
    const blob = await put('latest-backup.zip', fileBuffer, {
      access: 'public',
      contentType: 'application/zip',
      addRandomSuffix: false,
    });

    // Create/update metadata file with the URL and timestamp
    const meta = {
      url: blob.url,
      lastModified: new Date().toISOString(),
    };
    await put('backup-meta.json', JSON.stringify(meta), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    fs.unlinkSync(uploadedFile.filepath);

    res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}