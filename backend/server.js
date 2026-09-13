const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const QRCode = require('qrcode');

const app = express();

// Erlaube Anfragen von allen Domains (CORS)
app.use(cors());
app.use(express.json());

// Liest den API-Key aus den Umgebungsvariablen von Render
const resend = new Resend(process.env.RESEND_API_KEY);

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
