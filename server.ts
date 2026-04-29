import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import axios from "axios";
import { parse } from "csv-parse/sync";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json());

  const SPREADSHEET_ID = "1qMgsmIERDsUTfiYhyaDr3YPuXN7eJV0tlwHK1WhTIYI";
  const PUBLIC_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZvnaH1B9Il4UEd7JCiRi-UE0XZLaJJ4fK2AbA0aN9ZEscl4aO8rck0dMt9Yhol352QI6Gw2SIe6jF/pub?gid=0&single=true&output=csv";

  // API Routes
  app.get("/api/data", async (req, res) => {
    try {
      const auth = await getAuthorizedClient();
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

      // Prioritize API (Real-time) if we have credentials
      if (auth || apiKey) {
        try {
          const sheets = google.sheets({ version: "v4", auth: auth || apiKey });
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "A:E",
          });
          if (response.data.values) {
            return res.json(response.data.values);
          }
        } catch (apiError: any) {
          console.error("Sheets API Read error, falling back to CSV:", apiError.message);
        }
      }

      // Fallback: Fetch from public CSV (May have ~5min cache delay)
      const csvResponse = await axios.get(PUBLIC_CSV_URL, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      const rows = parse(csvResponse.data, {
        skip_empty_lines: true,
        trim: true
      });

      res.json(rows);
    } catch (error: any) {
      console.error("Global fetch error:", error.message);
      res.status(500).json({ error: "Impossible de récupérer les données." });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      const { values } = req.body;
      const auth = await getAuthorizedClient();
      
      if (!auth) {
        return res.status(401).json({ 
          error: "PERMISSION_DENIED: L'écriture nécessite un 'Service Account' Google Cloud configuré dans les Secrets AI Studio (GOOGLE_SERVICE_ACCOUNT_JSON)." 
        });
      }

      const sheets = google.sheets({ version: "v4", auth });
      
      // 1. Append to main data sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "A:E",
        valueInputOption: "RAW",
        requestBody: { values: [values] },
      });

      // 2. Append to Historique sheet
      const timestamp = new Date().toLocaleString('fr-FR');
      const historyValues = [timestamp, ...values]; // [Date, Design, Num, Zone, Etat, Obs]
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Historique!A:F",
        valueInputOption: "RAW",
        requestBody: { values: [historyValues] },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error appending sheets data:", error);
      res.status(500).json({ error: error.message || "Impossible d'écrire dans le Google Sheet" });
    }
  });

  app.put("/api/data/:row", async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.row);
      const { values } = req.body;
      const auth = await getAuthorizedClient();

      if (!auth) {
        return res.status(401).json({ error: "Accès refusé: Identifiants manquants." });
      }

      const sheets = google.sheets({ version: "v4", auth });
      
      // 1. Update main data sheet
      const range = `A${rowIndex}:E${rowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [values] },
      });

      // 2. Append to Historique sheet
      const timestamp = new Date().toLocaleString('fr-FR');
      const historyValues = [timestamp, ...values];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Historique!A:F",
        valueInputOption: "RAW",
        requestBody: { values: [historyValues] },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating sheets data:", error);
      res.status(500).json({ error: error.message || "Échec de la mise à jour." });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      const auth = await getAuthorizedClient();
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

      const sheets = google.sheets({ version: "v4", auth: auth || apiKey });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Historique!A:F",
      });
      res.json(response.data.values || []);
    } catch (error: any) {
      res.status(500).json({ error: "Impossible de récupérer l'historique." });
    }
  });

  async function getAuthorizedClient() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    }
    return null;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
