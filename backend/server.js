const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const QRCode = require('qrcode');
const admin = require('firebase-admin');

const app = express();

// Erlaube Anfragen von allen Domains (CORS)
app.use(cors());

// Resend-Webhooks müssen mit dem unveränderten Raw-Body geprüft werden.
// Diese Route steht deshalb vor express.json().
app.post('/resend-inbound', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        if (!process.env.RESEND_WEBHOOK_SECRET) {
            console.error('RESEND_WEBHOOK_SECRET fehlt in Render.');
            return res.status(500).send('Webhook nicht konfiguriert');
        }

        if (!process.env.FORWARD_EMAIL) {
            console.error('FORWARD_EMAIL fehlt in Render.');
            return res.status(500).send('Weiterleitungsziel nicht konfiguriert');
        }

        const payload = req.body.toString('utf8');
        const id = req.get('svix-id');
        const timestamp = req.get('svix-timestamp');
        const signature = req.get('svix-signature');

        if (!id || !timestamp || !signature) {
            return res.status(400).send('Fehlende Webhook-Signatur');
        }

        const event = resend.webhooks.verify({
            payload,
            headers: { id, timestamp, signature },
            webhookSecret: process.env.RESEND_WEBHOOK_SECRET
        });

        if (event.type !== 'email.received') {
            return res.status(200).json({ ignored: true });
        }

        const emailId = event.data.email_id;
        if (!emailId) {
            return res.status(400).send('Keine E-Mail-ID vorhanden');
        }

        // Resend kann eine empfangene E-Mail direkt weiterleiten und übernimmt
        // dabei auch Inhalt und Anhänge.
        const { data, error } = await resend.emails.receiving.forward({
            emailId,
            to: process.env.FORWARD_EMAIL,
            from: process.env.FORWARD_FROM || 'Sing & Tanz Konzert <tickets@sing-tanz.jonas-hohl.de>'
        });

        if (error) {
            console.error('Resend Weiterleitungsfehler:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`Eingehende E-Mail weitergeleitet: ${emailId} -> ${process.env.FORWARD_EMAIL}`);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Inbound-Webhook Fehler:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.use(express.json());

// Liest den API-Key aus den Umgebungsvariablen von Render
const resend = new Resend(process.env.RESEND_API_KEY);

// Firebase Admin SDK für eigene E-Mail-Bestätigungslinks
// In Render muss FIREBASE_SERVICE_ACCOUNT als komplette JSON-Zeichenkette hinterlegt sein.
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const adminDb = admin.firestore();



// E-Mail-Bestätigungslink über Firebase erzeugen und anschließend mit Resend senden
app.post('/send-verification', async (req, res) => {
    const { email, ticketId, name, seat } = req.body;

    if (!email || !ticketId) {
        return res.status(400).json({ error: "Fehlende Daten im Request" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        const ticketRef = adminDb.collection('tickets').doc(ticketId);
        const ticketSnap = await ticketRef.get();

        if (!ticketSnap.exists) {
            return res.status(404).json({ error: "Die Buchung wurde nicht gefunden." });
        }

        const ticket = ticketSnap.data();

        if (String(ticket.email || '').toLowerCase() !== normalizedEmail) {
            return res.status(403).json({ error: "E-Mail-Adresse und Buchung stimmen nicht überein." });
        }

        if (ticket.status !== 'EMAIL_BESTAETIGUNG_AUSSTEHEND') {
            return res.status(400).json({ error: "Diese Buchung wartet nicht mehr auf eine E-Mail-Bestätigung." });
        }

        const continueUrl = process.env.PUBLIC_SITE_URL || 'https://sing-tanz.jonas-hohl.de/';

        const actionCodeSettings = {
            url: continueUrl,
            handleCodeInApp: true
        };

        const verificationLink = await admin.auth().generateSignInWithEmailLink(
            normalizedEmail,
            actionCodeSettings
        );

        const safeName = String(name || ticket.name || 'Gast');
        const safeSeat = String(seat || ticket.seat || '');

        const data = await resend.emails.send({
            from: 'Sing & Tanz Konzert <tickets@sing-tanz.jonas-hohl.de>',
            to: [normalizedEmail],
            subject: 'Bitte bestätige deine Ticket-Buchung',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border:1px solid #eee;border-radius:14px;">
                    <h2 style="color:#e65c00;margin-top:0;">Sing & Tanz Konzert</h2>
                    <p>Hallo <strong>${safeName}</strong>,</p>
                    <p>du hast den Sitzplatz <strong>${safeSeat}</strong> reserviert.</p>
                    <p>Bitte bestätige deine E-Mail-Adresse, damit deine Buchung endgültig bestätigt wird:</p>
                    <p style="text-align:center;margin:28px 0;">
                        <a href="${verificationLink}" style="display:inline-block;background:#e65c00;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:bold;">E-Mail bestätigen</a>
                    </p>
                    <p style="font-size:13px;color:#666;">Falls der Button nicht funktioniert, öffne den folgenden Link:</p>
                    <p style="font-size:12px;word-break:break-all;color:#666;">${verificationLink}</p>
                    <p style="font-size:13px;color:#777;">Nach der Bestätigung wird dein Ticket automatisch an diese E-Mail-Adresse geschickt.</p>
                </div>
            `
        });

        if (data.error) {
            console.error('Resend API Fehler:', data.error);
            return res.status(400).json({ error: data.error });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Bestätigungs-E-Mail Fehler:', error);
        res.status(500).json({ error: error.message });
    }
});

// API-Endpunkt für den E-Mail-Versand mit QR-Code
app.post('/send-ticket', async (req, res) => {
    const { email, name, seat, ticketId, eventConfig } = req.body;

    if (!email || !seat || !ticketId) {
        return res.status(400).json({ error: "Fehlende Daten im Request" });
    }

    try {
        // QR-Code als Data-URL Bild aus der Ticket-ID generieren
        const qrCodeDataUrl = await QRCode.toDataURL(ticketId);

        const data = await resend.emails.send({
            from: 'Sing & Tanz Konzert <tickets@sing-tanz.jonas-hohl.de>',
            to: [email],
            subject: `Dein Ticket für ${eventConfig.title} (Platz ${seat})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e65c00; border-radius: 10px; max-width: 500px; margin: 0 auto; background-color: #ffffff;">
                    <h2 style="color: #e65c00; margin-top: 0; text-align: center;">${eventConfig.title}</h2>
                    <p>Hallo <strong>${name}</strong>,</p>
                    <p>vielen Dank für deine Buchung! Hier ist dein offizielles Eintrittsticket:</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Ticket-ID:</strong> <span style="font-size: 1.1em; color: #e65c00; font-weight: bold;">${ticketId}</span></p>
                        <p style="margin: 5px 0;"><strong>Sitzplatz:</strong> ${seat}</p>
                        <p style="margin: 5px 0;"><strong>Preis:</strong> ${eventConfig.price} €</p>
                        <p style="margin: 5px 0;"><strong>Datum:</strong> ${eventConfig.date} um ${eventConfig.time}</p>
                        <p style="margin: 5px 0;"><strong>Ort:</strong> ${eventConfig.location}</p>
                    </div>

                    <div style="text-align: center; margin: 20px 0;">
                        <img src="${qrCodeDataUrl}" alt="QR-Code Ticket" style="width: 180px; height: 180px; border: 1px solid #ddd; padding: 5px; background: #fff; border-radius: 8px;" />
                        <p style="font-size: 0.85em; color: #666; margin-top: 8px;">Zeige diesen QR-Code einfach am Einlass auf deinem Smartphone vor.</p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.8em; color: #888; text-align: center;">Wir freuen uns auf deinen Besuch!</p>
                </div>
            `
        });

        if (data.error) {
            console.error("Resend API Fehler:", data.error);
            return res.status(400).json({ error: data.error });
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Resend Fehler:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
