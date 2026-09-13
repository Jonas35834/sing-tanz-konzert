# Resend-Bestätigungs-E-Mail einrichten

Die Ticket-Bestätigung wird jetzt nicht mehr von `sendSignInLinkToEmail()` verschickt.
Stattdessen erzeugt das Backend mit Firebase Admin einen gültigen Firebase-E-Mail-Link und verschickt ihn über Resend.

## Render Environment Variables

Im Render-Service `sing-tanz-konzert-backend` unter **Environment** setzen:

- `RESEND_API_KEY` = dein vorhandener Resend API Key
- `PUBLIC_SITE_URL` = `https://sing-tanz.jonas-hohl.de/`
- `FIREBASE_SERVICE_ACCOUNT` = der komplette JSON-Inhalt eines Firebase-Service-Accounts

## Firebase Service Account

Firebase Console → Projekteinstellungen → Dienstkonten → **Neuen privaten Schlüssel generieren**.

Die heruntergeladene JSON-Datei NICHT ins GitHub-Repository legen.

Den kompletten JSON-Inhalt als Wert von `FIREBASE_SERVICE_ACCOUNT` in Render eintragen.

## Firebase Authentication

In Firebase Authentication muss weiterhin **E-Mail/Passwort** aktiviert sein und darunter die Option **E-Mail-Link (passwortlose Anmeldung)** aktiviert sein.

Die bestehende `authDomain`-Konfiguration des Frontends bleibt erhalten, weil der erzeugte Link ein Firebase-Authentication-Link ist.
