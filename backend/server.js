const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();

// Erlaube Anfragen von allen Domains (CORS)
app.use(cors());
app.use(express.json());

// Liest den API-Key aus den Umgebungsvariablen von Render
const resend = new Resend(process.env.RESEND_API_KEY);

// API-Endpunkt für den E-Mail-Versand
app.post('/send-ticket', async (req, res) => {
    const { email, name, seat, ticketId, eventConfig } = req.body;

    if (!email || !seat || !ticketId) {
        return res.status(400).json({ error: "Fehlende Daten im Request" });
    }

    try {
        const data = await resend.emails.send({
            from: 'Sing & Tanz Konzert <tickets@sing-tanz.jonas-hohl.de>',
            to: [email],
            subject: `Dein Ticket für ${eventConfig.title} (Platz ${seat})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e65c00; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #e65c00; margin-top: 0;">${eventConfig.title}</h2>
                    <p>Hallo <strong>${name}</strong>,</p>
                    <p>vielen Dank für deine Buchung! Hier sind deine offiziellen Ticket-Details:</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Ticket-ID:</strong> <span style="font-size: 1.2em; color: #e65c00;">${ticketId}</span></p>
                        <p style="margin: 5px 0;"><strong>Sitzplatz:</strong> ${seat}</p>
                        <p style="margin: 5px 0;"><strong>Preis:</strong> ${eventConfig.price} €</p>
                        <p style="margin: 5px 0;"><strong>Datum:</strong> ${eventConfig.date} um ${eventConfig.time}</p>
                        <p style="margin: 5px 0;"><strong>Ort:</strong> ${eventConfig.location}</p>
                    </div>

                    <p style="font-size: 0.9em; color: #555;">Bitte zeige diese E-Mail oder deine Ticket-ID (<strong>${ticketId}</strong>) am Einlass vor.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
                    <p style="font-size: 0.8em; color: #888; text-align: center;">Wir freuen uns auf deinen Besuch!</p>
                </div>
            `
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Resend Fehler:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
