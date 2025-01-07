const express = require('express');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar base de datos SQLite
const db = new Database('database.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, email TEXT UNIQUE)`);

// Configuración de nodemailer (asegúrate de utilizar el correo adecuado)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // O usa otro servicio SMTP
    port:465,
    secure:true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

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

app.post('/unsubscribe', (req, res) => {
    const { email } = req.body;
  
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Correo inválido' });
    }
  
    // Preparar la consulta para eliminar el correo de la base de datos
    const stmt = db.prepare('DELETE FROM subscribers WHERE email = ?');
    const result = stmt.run(email);
  
    if (result.changes > 0) {
      res.status(200).json({ message: 'Desuscripción exitosa' });
    } else {
      res.status(404).json({ error: 'Correo no encontrado en la base de datos' });
    }
  });

// Ruta para enviar correos a todos los suscriptores
app.post('/send-email', (req, res) => {
  const { subject } = req.body; // Solo necesitamos el asunto aquí
  
  if (!subject) {
    return res.status(400).json({ error: 'Falta el campo "subject"' });
  }

  // Ruta del archivo HTML
  const htmlFilePath = path.join(__dirname, 'email-template.html'); // Asegúrate de que el archivo esté en la misma carpeta
  
  // Leer el archivo HTML
  fs.readFile(htmlFilePath, 'utf8', (err, htmlContent) => {
    if (err) {
      console.error('Error al leer el archivo HTML:', err);
      return res.status(500).json({ error: 'No se pudo leer el archivo HTML' });
    }

    // Obtener todos los correos electrónicos de los suscriptores
    const stmt = db.prepare('SELECT email FROM subscribers');
    const subscribers = stmt.all(); // Obtiene todos los correos

    if (subscribers.length === 0) {
      return res.status(404).json({ error: 'No hay suscriptores en la base de datos' });
    }

    // Enviar el correo a todos los suscriptores
    let errorOccurred = false;
    const mailOptions = {
      from: process.env.EMAIL_USER, // Reemplaza con tu correo de Gmail
      subject: subject,
      html: htmlContent, // El contenido HTML leído del archivo
    };

    subscribers.forEach((subscriber) => {
      mailOptions.to = subscriber.email;

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(`Error al enviar correo a ${subscriber.email}:`, error);
          errorOccurred = true;
          return;
        }
        console.log(`Correo enviado a ${subscriber.email}:`, info.response);
      });
    });

    if (errorOccurred) {
      return res.status(500).json({ error: 'Algunos correos no pudieron enviarse' });
    }

    res.status(200).json({ message: 'Correos enviados a todos los suscriptores' });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
