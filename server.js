const express = require('express');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar base de datos SQLite
const db = new Database('database.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, email TEXT UNIQUE)`);

// Middleware
app.use(express.json());

// Ruta para suscribirse
app.post('/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }

  try {
    const stmt = db.prepare('INSERT INTO subscribers (email) VALUES (?)');
    stmt.run(email);
    res.status(200).json({ message: 'Suscripción exitosa' });
  } catch (error) {
    res.status(400).json({ error: 'El correo ya está suscrito' });
  }
});

// Ruta para enviar correos a todos los suscriptores
app.post('/send-newsletter', async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Faltan asunto o mensaje' });
  }

  try {
    const subscribers = db.prepare('SELECT email FROM subscribers').all();
    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'No hay suscriptores' });
    }

    const emails = subscribers.map(sub => sub.email);

    // Configurar Nodemailer
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // O usa otro servicio SMTP
      port:465,
      secure:true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Enviar correos
    await Promise.all(
      emails.map(email =>
        transporter.sendMail({
          from: process.env.EMAIL,
          to: email,
          subject,
          html: message,
        })
      )
    );

    res.status(200).json({ message: 'Correos enviados exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar correos' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
