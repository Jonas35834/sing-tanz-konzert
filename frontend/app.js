// Firebase Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyDO8HC7Q3zW8HiiEMIzJvMR5kzRSOEurW8",
    authDomain: "sing-tanz.firebaseapp.com",
    projectId: "sing-tanz",
    storageBucket: "sing-tanz.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "160340825018"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Globale Variablen
let currentLayout = [];
let bookedSeats = [];
let selectedSeats = [];
let posSelectedSeats = [];
let html5QrCode = null;
let isScannerRunning = false;

let eventConfig = {
    title: "Sing & Tanz Konzert",
    date: "15. November 2026",
    time: "17:00 Uhr",
    location: "Stadthalle Musterstadt",
    price: 12.00,
    about: "Wir drei Veranstalter laden euch herzlich zu einem unvergesslichen Nachmittag ein. Es erwartet euch eine familiäre Atmosphäre mit stimmungsvollem Live-Gesang und mitreißenden Tanzdarbietungen für Groß und Klein!"
};

document.addEventListener('DOMContentLoaded', () => {
    loadEventDetails();
    loadLayoutAndBookings();
});

function loadEventDetails() {
    db.collection('config').doc('details').onSnapshot(doc => {
        if (doc.exists) {
            eventConfig = doc.data();
            updateUIWithEventDetails();
        } else {
            db.collection('config').doc('details').set(eventConfig);
        }
    });
}

function updateUIWithEventDetails() {
    document.querySelectorAll('.event-title-display').forEach(el => el.innerText = eventConfig.title);
    document.getElementById('display-date').innerText = eventConfig.date;
    document.getElementById('display-time').innerText = eventConfig.time;
    document.getElementById('display-location').innerText = eventConfig.location;
    document.getElementById('display-price').innerText = parseFloat(eventConfig.price).toFixed(2);
    document.getElementById('display-about-text').innerText = eventConfig.about || "";

    document.getElementById('edit-title').value = eventConfig.title || "";
    document.getElementById('edit-date').value = eventConfig.date || "";
    document.getElementById('edit-time').value = eventConfig.time || "";
    document.getElementById('edit-location').value = eventConfig.location || "";
    document.getElementById('edit-price').value = eventConfig.price || 12;
    document.getElementById('edit-about').value = eventConfig.about || "";
}

document.getElementById('event-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
        title: document.getElementById('edit-title').value,
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value,
        location: document.getElementById('edit-location').value,
        price: parseFloat(document.getElementById('edit-price').value),
        about: document.getElementById('edit-about').value
    };

    try {
        await db.collection('config').doc('details').set(updated);
        alert("Veranstaltungs-Details erfolgreich aktualisiert!");
    } catch (err) {
        alert("Fehler beim Speichern: " + err.message);
    }
});

function loadLayoutAndBookings() {
    db.collection('config').doc('layout').onSnapshot(doc => {
        if (doc.exists) {
            currentLayout = doc.data().rows || [];
            renderUserSeating();
            if (!document.getElementById('admin-dashboard').classList.contains('hidden')) {
                renderAdminEditor();
                renderPosSeating();
            }
        }
    });

    db.collection('tickets').onSnapshot(snapshot => {
        bookedSeats = [];
        const bookingsTableBody = document.querySelector('#bookings-table tbody');
        bookingsTableBody.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            bookedSeats.push(data.seat);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${doc.id}</td>
                <td>${data.name}</td>
                <td>${data.email}</td>
                <td>${data.seat}</td>
                <td><strong>${data.status || 'GÜLTIG'}</strong></td>
                <td>${data.price} €</td>
                <td>
                    <button class="btn-danger" onclick="cancelTicket('${doc.id}')">Stornieren</button>
                </td>
            `;
            bookingsTableBody.appendChild(tr);
        });
        renderUserSeating();
        renderPosSeating();
    });
}

async function cancelTicket(ticketId) {
    if (confirm(`Möchtest du das Ticket ${ticketId} wirklich stornieren?`)) {
        try {
            await db.collection('tickets').doc(ticketId).delete();
            alert("Ticket storniert!");
        } catch (err) {
            alert("Fehler beim Stornieren: " + err.message);
        }
    }
}

document.getElementById('user-cancel-btn').addEventListener('click', async () => {
    const email = document.getElementById('cancel-email-input').value.trim().toLowerCase();
    
    if (!email) {
        alert("Bitte gib deine E-Mail-Adresse ein.");
        return;
    }

    try {
        const snapshot = await db.collection('tickets').where('email', '==', email).get();

        if (snapshot.empty) {
            alert("Unter dieser E-Mail-Adresse wurde kein aktives Ticket gefunden.");
            return;
        }

        if (confirm(`Möchtest du dein Ticket für die E-Mail "${email}" wirklich stornieren?`)) {
            snapshot.forEach(async (doc) => {
                await db.collection('tickets').doc(doc.id).delete();
            });
            alert("Dein Ticket wurde erfolgreich storniert. Der Sitzplatz ist wieder frei!");
            document.getElementById('cancel-email-input').value = '';
        }
    } catch (err) {
        alert("Fehler bei der Stornierung: " + err.message);
    }
});

function renderUserSeating() {
    const el = document.getElementById('seating-map');
    el.innerHTML = '';
    
    currentLayout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';
        
        row.seats.forEach(seat => {
            const seatDiv = document.createElement('div');
            seatDiv.className = 'seat';
            
            const isBooked = bookedSeats.includes(seat.id);
            const isSelected = selectedSeats.includes(seat.id);

            if (seat.status === 'blocked') {
                seatDiv.classList.add('blocked');
                seatDiv.innerText = 'X';
            } else if (isBooked) {
                seatDiv.classList.add('booked');
                seatDiv.innerText = seat.id;
            } else if (isSelected) {
                seatDiv.classList.add('selected');
                seatDiv.innerText = seat.id;
                seatDiv.onclick = () => toggleSeatSelection(seat.id);
            } else {
                seatDiv.classList.add('available');
                seatDiv.innerText = seat.id;
                seatDiv.onclick = () => toggleSeatSelection(seat.id);
            }
            rowDiv.appendChild(seatDiv);
        });
        el.appendChild(rowDiv);
    });
}

function toggleSeatSelection(seatId) {
    if (selectedSeats.includes(seatId)) {
        selectedSeats = [];
    } else {
        selectedSeats = [seatId];
    }

    const container = document.getElementById('booking-form-container');

    if (selectedSeats.length > 0) {
        container.classList.remove('hidden');
        document.getElementById('selected-seats-list').innerText = selectedSeats[0];
        document.getElementById('total-price').innerText = eventConfig.price.toFixed(2);
    } else {
        container.classList.add('hidden');
    }
    renderUserSeating();
}

// BUCHUNG: Aufruf an das eigene Render-Backend
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('buyer-email').value.trim().toLowerCase();
    const name = document.getElementById('buyer-name').value.trim();

    if (selectedSeats.length === 0) {
        alert("Bitte wähle zuerst einen Sitzplatz aus!");
        return;
    }

    try {
        const existingTicket = await db.collection('tickets').where('email', '==', email).get();

        if (!existingTicket.empty) {
            alert(`⚠️ Die E-Mail-Adresse "${email}" hat bereits ein Ticket gebucht! Pro E-Mail ist nur genau 1 Ticket erlaubt.`);
            return;
        }

        const seat = selectedSeats[0];
        const ticketId = 'TICK-' + Math.floor(100000 + Math.random() * 900000);

        await db.collection('tickets').doc(ticketId).set({
            name: name,
            email: email,
            seat: seat,
            price: eventConfig.price.toFixed(2),
            status: 'GÜLTIG',
            createdAt: new Date().toISOString()
        });

        // E-Mail über das eigene Render-Backend versenden
        await sendEmailViaBackend(email, name, seat, ticketId);

        alert(`🎉 Buchung erfolgreich! Deine Ticket-Bestätigung wurde an ${email} gesendet.`);
        
        selectedSeats = [];
        document.getElementById('booking-form-container').classList.add('hidden');
        document.getElementById('booking-form').reset();
        renderUserSeating();

    } catch (err) {
        alert("Fehler bei der Buchung: " + err.message);
    }
});

// RUFT DAS RENDER BACKEND AUF (Kein API-Key hier sichtbar!)
async function sendEmailViaBackend(userEmail, userName, seatNumber, ticketId) {
    // ERSETZE DIESE URL MIT DEINER BACKEND-URL VON RENDER:
    const BACKEND_URL = "https://DEIN-BACKEND-NAME.onrender.com/send-ticket";

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userEmail,
                name: userName,
                seat: seatNumber,
                ticketId: ticketId,
                eventConfig: {
                    ...eventConfig,
                    price: eventConfig.price.toFixed(2)
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("Backend Fehler:", data);
        } else {
            console.log("E-Mail über Backend versendet:", data);
        }
    } catch (err) {
        console.error("Netzwerkfehler beim Backend:", err);
    }
}

document.getElementById('pos-submit-btn').onclick = async () => {
    if (posSelectedSeats.length === 0) {
        alert("Wähle mindestens einen Platz aus!");
        return;
    }

    const posInputs = document.querySelectorAll('.pos-seat-name-input');

    try {
        for (const input of posInputs) {
            const seat = input.dataset.seat;
            const ticketName = input.value.trim() || "Barzahler Abendkasse";
            const ticketId = 'POS-' + Math.floor(100000 + Math.random() * 900000);

            await db.collection('tickets').doc(ticketId).set({
                name: ticketName,
                email: "barverkauf-vor-ort-" + ticketId + "@kasse.local",
                seat: seat,
                price: eventConfig.price.toFixed(2),
                status: 'GÜLTIG',
                createdAt: new Date().toISOString()
            });
        }

        alert("Barverkauf erfolgreich abgeschlossen!");
        posSelectedSeats = [];
        document.getElementById('pos-names-container').innerHTML = '';
        document.getElementById('pos-seats-list').innerText = '-';
        document.getElementById('pos-total-price').innerText = '0.00';
        renderPosSeating();

    } catch (err) {
        alert("Fehler beim Kassenverkauf: " + err.message);
    }
};

document.getElementById('check-ticket-btn').onclick = () => {
    const id = document.getElementById('manual-ticket-id').value.trim();
    if (id) processTicketScan(id);
};

document.getElementById('restart-scanner-btn').onclick = () => {
    document.getElementById('restart-scanner-btn').classList.add('hidden');
    document.getElementById('scan-result').classList.add('hidden');
    startQRScanner();
};

async function processTicketScan(ticketId) {
    const resultEl = document.getElementById('scan-result');
    resultEl.classList.remove('hidden', 'valid', 'invalid');

    try {
        const docRef = db.collection('tickets').doc(ticketId);
        const doc = await docRef.get();

        if (!doc.exists) {
            resultEl.classList.add('invalid');
            resultEl.innerText = `❌ UNGÜLTIG: Ticket ${ticketId} existiert nicht!`;
            return;
        }

        const data = doc.data();
        if (data.status === 'ENTWERTET') {
            resultEl.classList.add('invalid');
            resultEl.innerText = `⚠️ BEREITS ENTWERTET: Dieses Ticket (Platz ${data.seat}) wurde schon genutzt!`;
        } else {
            await docRef.update({ status: 'ENTWERTET' });
            resultEl.classList.add('valid');
            resultEl.innerText = `✅ GÜLTIG! Einlass gewährt für ${data.name} (Platz: ${data.seat})`;
            
            await stopQRScanner();
            document.getElementById('restart-scanner-btn').classList.remove('hidden');
        }

    } catch (err) {
        resultEl.classList.add('invalid');
        resultEl.innerText = "Fehler beim Scannen: " + err.message;
    }
}

function startQRScanner() {
    if (isScannerRunning) return;

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => processTicketScan(decodedText),
        () => {}
    ).then(() => {
        isScannerRunning = true;
    }).catch(err => {
        console.error("Kamera konnte nicht gestartet werden:", err);
    });
}

async function stopQRScanner() {
    if (html5QrCode && isScannerRunning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
            isScannerRunning = false;
            document.getElementById('reader').innerHTML = '';
        } catch (err) {
            console.error("Fehler beim Beenden des Scanners:", err);
            isScannerRunning = false;
        }
    }
}

function renderAdminEditor() {
    const el = document.getElementById('admin-seating-editor');
    if (!el) return;
    el.innerHTML = '';

    currentLayout.forEach((row, rIndex) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        const rowLabel = document.createElement('strong');
        rowLabel.innerText = row.rowName + ": ";
        rowDiv.appendChild(rowLabel);

        row.seats.forEach((seat, sIndex) => {
            const seatBox = document.createElement('div');
            seatBox.className = 'seat-edit-box';

            const seatBtn = document.createElement('button');
            seatBtn.className = seat.status === 'blocked' ? 'btn-danger' : 'btn-secondary';
            seatBtn.innerText = `${seat.id} (${seat.status === 'blocked' ? 'gesperrt' : 'frei'})`;

            seatBtn.onclick = () => {
                currentLayout[rIndex].seats[sIndex].status = 
                    currentLayout[rIndex].seats[sIndex].status === 'available' ? 'blocked' : 'available';
                renderAdminEditor();
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete-seat';
            deleteBtn.innerText = 'X';
            deleteBtn.title = 'Sitz löschen';
            deleteBtn.onclick = () => {
                currentLayout[rIndex].seats.splice(sIndex, 1);
                renderAdminEditor();
            };

            seatBox.appendChild(seatBtn);
            seatBox.appendChild(deleteBtn);
            rowDiv.appendChild(seatBox);
        });

        const addSeatBtn = document.createElement('button');
        addSeatBtn.innerText = "+ Sitz";
        addSeatBtn.onclick = () => {
            const nextSeatNum = row.seats.length + 1;
            row.seats.push({ id: `${rIndex + 1}-${nextSeatNum}`, status: 'available' });
            renderAdminEditor();
        };
        rowDiv.appendChild(addSeatBtn);

        const deleteRowBtn = document.createElement('button');
        deleteRowBtn.className = 'btn-danger';
        deleteRowBtn.style.marginLeft = '10px';
        deleteRowBtn.innerText = "Reihe löschen";
        deleteRowBtn.onclick = () => {
            currentLayout.splice(rIndex, 1);
            renderAdminEditor();
        };
        rowDiv.appendChild(deleteRowBtn);

        el.appendChild(rowDiv);
    });
}

document.getElementById('add-row-btn').onclick = () => {
    const newRowIndex = currentLayout.length + 1;
    currentLayout.push({
        rowName: `Reihe ${newRowIndex}`,
        seats: [{ id: `${newRowIndex}-1`, status: "available" }]
    });
    renderAdminEditor();
};

document.getElementById('save-layout-btn').onclick = () => {
    db.collection('config').doc('layout').set({ rows: currentLayout })
        .then(() => alert("Saalplan erfolgreich gespeichert!"))
        .catch(err => alert("Fehler beim Speichern: " + err.message));
};

const posContainer = document.getElementById('pos-mode-container');

document.getElementById('toggle-pos-btn').onclick = async () => {
    posContainer.classList.remove('hidden');
    renderPosSeating();
    startQRScanner();

    if (posContainer.requestFullscreen) {
        posContainer.requestFullscreen().catch(err => console.log("Vollbild Fehler:", err));
    } else if (posContainer.webkitRequestFullscreen) {
        posContainer.webkitRequestFullscreen();
    }
};

document.getElementById('close-pos-btn').onclick = async () => {
    await stopQRScanner();
    posContainer.classList.add('hidden');

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
    }
};

function renderPosSeating() {
    const el = document.getElementById('pos-seating-map');
    if (!el) return;
    el.innerHTML = '';
    
    currentLayout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';
        
        row.seats.forEach(seat => {
            const seatDiv = document.createElement('div');
            seatDiv.className = 'seat';
            
            const isBooked = bookedSeats.includes(seat.id);
            const isSelected = posSelectedSeats.includes(seat.id);

            if (seat.status === 'blocked') {
                seatDiv.classList.add('blocked');
                seatDiv.innerText = 'X';
            } else if (isBooked) {
                seatDiv.classList.add('booked');
                seatDiv.innerText = seat.id;
            } else if (isSelected) {
                seatDiv.classList.add('selected');
                seatDiv.innerText = seat.id;
                seatDiv.onclick = () => togglePosSeatSelection(seat.id);
            } else {
                seatDiv.classList.add('available');
                seatDiv.innerText = seat.id;
                seatDiv.onclick = () => togglePosSeatSelection(seat.id);
            }
            rowDiv.appendChild(seatDiv);
        });
        el.appendChild(rowDiv);
    });
}

function togglePosSeatSelection(seatId) {
    if (posSelectedSeats.includes(seatId)) {
        posSelectedSeats = posSelectedSeats.filter(id => id !== seatId);
    } else {
        posSelectedSeats.push(seatId);
    }

    const posNamesDiv = document.getElementById('pos-names-container');
    const existingValues = {};
    document.querySelectorAll('.pos-seat-name-input').forEach(input => {
        existingValues[input.dataset.seat] = input.value;
    });

    posNamesDiv.innerHTML = '';
    posSelectedSeats.forEach(s => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Name für Platz ${s}`;
        input.dataset.seat = s;
        input.value = existingValues[s] || '';
        input.className = 'pos-seat-name-input';
        input.style.display = 'block';
        input.style.width = '100%';
        input.style.marginTop = '8px';
        posNamesDiv.appendChild(input);
    });

    document.getElementById('pos-seats-list').innerText = posSelectedSeats.length > 0 ? posSelectedSeats.join(', ') : '-';
    document.getElementById('pos-total-price').innerText = (posSelectedSeats.length * eventConfig.price).toFixed(2);
    renderPosSeating();
}

document.getElementById('admin-login-btn').onclick = () => document.getElementById('login-modal').classList.remove('hidden');
document.getElementById('close-login-btn').onclick = () => document.getElementById('login-modal').classList.add('hidden');

document.getElementById('do-login-btn').onclick = () => {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.remove('hidden');
            renderAdminEditor();
            renderPosSeating();
        })
        .catch(err => alert("Login fehlgeschlagen: " + err.message));
};

document.getElementById('logout-btn').onclick = async () => {
    await stopQRScanner();
    auth.signOut().then(() => {
        document.getElementById('admin-dashboard').classList.add('hidden');
    });
};
