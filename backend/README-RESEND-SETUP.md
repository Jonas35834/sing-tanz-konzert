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


## Eingehende E-Mails automatisch weiterleiten

Das Backend kann jetzt eingehende E-Mails über Resend Inbound automatisch an deine persönliche E-Mail-Adresse weiterleiten. Resend stellt dafür das Ereignis `email.received` bereit; die Weiterleitung kann dabei auch Anhänge übernehmen.

### Render-Variablen

Zusätzlich zu den bisherigen Variablen brauchst du:

- `FORWARD_EMAIL` = deine persönliche E-Mail-Adresse, an die weitergeleitet werden soll
- `RESEND_WEBHOOK_SECRET` = das Signing Secret des Resend-Webhooks
- optional `FORWARD_FROM` = Absender für die Weiterleitung; standardmäßig `Sing & Tanz Konzert <tickets@sing-tanz.jonas-hohl.de>`

### Resend Webhook

Webhook-URL:

`https://backend.sing-tanz.jonas-hohl.de/resend-inbound`

Event:

`email.received`

Resend Inbound muss für die gewünschte Domain bzw. Subdomain aktiviert sein. Die dafür benötigten MX-DNS-Einträge zeigt Resend im Dashboard an; diese Werte bitte exakt dort übernehmen und nicht selbst erfinden.

### Wichtig

Die Weiterleitungsadresse steht absichtlich nur in `FORWARD_EMAIL` auf Render und nicht im Quellcode/GitHub. `RESEND_WEBHOOK_SECRET` und `RESEND_API_KEY` ebenfalls niemals in GitHub veröffentlichen.


## Neue E-Mail- und Ticket-Funktionen

### Absender
Alle aus dem Backend versendeten E-Mails verwenden standardmäßig:

`Sing & Tanz Konzert <email@sing-tanz.jonas-hohl.de>`

Optional kann der Absender über `EMAIL_SENDER` in Render geändert werden. Die Domain `email.sing-tanz.jonas-hohl.de` muss bei Resend zum Senden verifiziert sein.

### Admin-E-Mails
Das Admin-Panel kann E-Mails manuell verschicken. Dafür in Render zusätzlich setzen:

- `ADMIN_EMAILS` = erlaubte Admin-E-Mail-Adressen, durch Komma getrennt

Der Firebase-Login wird serverseitig geprüft; nur dort eingetragene Admin-Adressen dürfen `/admin-send-email` verwenden.

### 5-Minuten-Reservierung
Eine nicht bestätigte Reservierung erhält `expiresAt` 5 Minuten nach Erstellung. Das Backend räumt abgelaufene Reservierungen regelmäßig auf; beim Bestätigungsversuch wird die Ablaufzeit ebenfalls geprüft.

### Stornierung
Normale Tickets enthalten einen persönlichen Stornierungslink. Die öffentliche E-Mail-Stornierung wurde entfernt. Der Link führt zur Website und kann nur für das zugehörige gültige Ticket verwendet werden.

### Backend-Domain
Das Frontend verwendet für alle Backend-Aufrufe:

`https://backend.sing-tanz.jonas-hohl.de`
